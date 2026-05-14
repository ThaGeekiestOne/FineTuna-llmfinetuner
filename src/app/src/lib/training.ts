import type { DomainTemplate, ModelCard, Technique, TrainingExample } from './catalog'

export type Hyperparameters = {
  epochs: number
  learningRate: string
  batchSize: number
  warmupSteps: number
  gradientAccumulation: number
  maxSequenceLength: number
  weightDecay: number
  saveSteps: number
  evalSteps: number
  loraRank: number
  loraAlpha: number
  loraDropout: number
  optimizer: 'paged_adamw_8bit' | 'adamw_torch' | 'adafactor'
  lrScheduler: 'cosine' | 'linear' | 'constant'
  precision: 'fp16' | 'bf16' | 'fp32'
  gradientCheckpointing: boolean
  computeTarget: 'gpu' | 'tpu' | 'cpu'
  accelerator: 'None' | 'NvidiaTeslaP100' | 'NvidiaTeslaT4' | 'NvidiaTeslaT4Highmem' | 'NvidiaTeslaA100' | 'NvidiaL4' | 'NvidiaL4X1' | 'NvidiaH100' | 'NvidiaRtxPro6000' | 'TpuV38' | 'Tpu1VmV38' | 'TpuV5E8' | 'TpuV6E8'
  continueTraining: boolean
}

export type DatasetValidation = {
  valid: boolean
  warnings: string[]
  errors: string[]
  preview: TrainingExample[]
  total: number
}

export type TrainingJob = {
  id: string
  status: 'queued' | 'running' | 'completed' | 'stopped'
  progress: number
  epoch: number
  step: number
  trainLoss: number
  validationLoss: number
  gpuMemory: string
  eta: string
}

export function calculateHyperparameters(
  technique: Technique,
  epochs = 3,
  options: {
    computeTarget?: Hyperparameters['computeTarget']
    continueTraining?: boolean
  } = {},
): Hyperparameters {
  const computeTarget = options.computeTarget ?? 'gpu'
  const continueTraining = options.continueTraining ?? false
  const base: Hyperparameters = {
    epochs,
    learningRate: '2e-4',
    batchSize: 4,
    warmupSteps: 100,
    gradientAccumulation: 4,
    maxSequenceLength: 2048,
    weightDecay: 0.01,
    saveSteps: 50,
    evalSteps: 50,
    loraRank: 16,
    loraAlpha: 32,
    loraDropout: 0.05,
    optimizer: 'paged_adamw_8bit',
    lrScheduler: 'cosine',
    precision: computeTarget === 'cpu' ? 'fp32' : 'fp16',
    gradientCheckpointing: true,
    computeTarget,
    accelerator: computeTarget === 'tpu' ? 'TpuV38' : computeTarget === 'cpu' ? 'None' : 'NvidiaTeslaP100',
    continueTraining,
  }

  if (technique === 'QLoRA') {
    return {
      ...base,
      learningRate: '1e-4',
      batchSize: computeTarget === 'cpu' ? 1 : 8,
      gradientAccumulation: computeTarget === 'cpu' ? 8 : 2,
      precision: computeTarget === 'cpu' ? 'fp32' : 'bf16',
    }
  }

  if (technique === 'Full') {
    return {
      ...base,
      learningRate: '5e-5',
      batchSize: 1,
      gradientAccumulation: computeTarget === 'cpu' ? 32 : 16,
      warmupSteps: 200,
      optimizer: 'adamw_torch',
      loraRank: 0,
      loraAlpha: 0,
      loraDropout: 0,
      saveSteps: 25,
      evalSteps: 25,
    }
  }

  return {
    ...base,
    batchSize: computeTarget === 'cpu' ? 1 : 4,
    gradientAccumulation: computeTarget === 'cpu' ? 8 : 4,
  }
}

export function parseDatasetText(text: string): TrainingExample[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed.map(normalizeExample) : []
  }
  if (trimmed.split('\n').every((line) => line.trim().startsWith('{'))) {
    return trimmed.split('\n').filter(Boolean).map((line) => normalizeExample(JSON.parse(line)))
  }
  const [headerLine, ...rows] = trimmed.split(/\r?\n/)
  const headers = headerLine.split(',').map((header) => header.trim().toLowerCase())
  const instructionIndex = headers.indexOf('instruction')
  const responseIndex = headers.indexOf('response')
  if (instructionIndex === -1 || responseIndex === -1) return []
  return rows.map((row) => {
    const cells = splitCsvRow(row)
    return normalizeExample({ instruction: cells[instructionIndex], response: cells[responseIndex] })
  })
}

export function validateDataset(examples: TrainingExample[]): DatasetValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const seen = new Set<string>()
  let duplicates = 0
  const cleaned = examples.map(normalizeExample).filter((example) => example.instruction || example.response)
  for (const example of cleaned) {
    if (!example.instruction || !example.response) errors.push('Every row needs both instruction and response fields.')
    const key = `${example.instruction.toLowerCase()}::${example.response.toLowerCase()}`
    if (seen.has(key)) duplicates += 1
    seen.add(key)
  }
  if (cleaned.length > 0 && cleaned.length < 100) warnings.push('Dataset is small. Add at least 100 examples for more reliable tuning.')
  if (duplicates > 0) warnings.push(`${duplicates} duplicate example${duplicates === 1 ? '' : 's'} detected.`)
  return { valid: errors.length === 0, warnings: [...new Set(warnings)], errors: [...new Set(errors)], preview: cleaned.slice(0, 5), total: cleaned.length }
}

export function mergeDatasets(template: DomainTemplate, customExamples: TrainingExample[]): TrainingExample[] {
  if (template.id === 'custom') return customExamples
  const customLimit = Math.ceil(template.examples.length * 0.35)
  return [...template.examples, ...customExamples.slice(0, customLimit)]
}

export function createJob(): TrainingJob {
  return { id: `kg-${Date.now().toString(36)}`, status: 'queued', progress: 0, epoch: 0, step: 0, trainLoss: 2.4, validationLoss: 2.7, gpuMemory: '0 / 16 GB', eta: 'Waiting for Kaggle GPU' }
}

export function advanceJob<T extends TrainingJob>(job: T, epochs: number): T {
  if (job.status === 'completed' || job.status === 'stopped') return job
  const progress = Math.min(100, job.progress + 8)
  const epoch = Math.min(epochs, Math.max(1, Math.ceil((progress / 100) * epochs)))
  return {
    ...job,
    status: progress >= 100 ? 'completed' : 'running',
    progress,
    epoch,
    step: Math.round(progress * 18.75),
    trainLoss: Number(Math.max(1.05, 2.4 - progress * 0.012).toFixed(2)),
    validationLoss: Number(Math.max(1.28, 2.7 - progress * 0.011).toFixed(2)),
    gpuMemory: progress > 0 ? `${Math.min(15.3, 7 + progress * 0.08).toFixed(1)} / 16 GB` : '0 / 16 GB',
    eta: progress >= 100 ? 'Complete' : `${Math.max(5, Math.round((100 - progress) * 1.7))} min`,
  } as T
}

export function generateTrainingScript(model: ModelCard, technique: Technique, template: DomainTemplate, hyperparameters: Hyperparameters): string {
  return `from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from peft import LoraConfig, get_peft_model

BASE_MODEL = "${model.name}"
DOMAIN = "${template.name}"
TECHNIQUE = "${technique}"
COMPUTE_TARGET = "${hyperparameters.computeTarget}"
ACCELERATOR = "${hyperparameters.accelerator}"
CONTINUE_TRAINING = ${hyperparameters.continueTraining ? 'True' : 'False'}

tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    load_in_4bit=${technique === 'QLoRA' ? 'True' : 'False'},
    torch_dtype="${hyperparameters.precision}",
    device_map="auto" if COMPUTE_TARGET != "cpu" else None,
)

if TECHNIQUE in ["LoRA", "QLoRA"]:
    lora = LoraConfig(
        r=${hyperparameters.loraRank},
        lora_alpha=${hyperparameters.loraAlpha},
        lora_dropout=${hyperparameters.loraDropout},
        target_modules=["q_proj", "v_proj"],
    )
    model = get_peft_model(model, lora)

resume_checkpoint = True if CONTINUE_TRAINING else None
args = TrainingArguments(
    output_dir="/kaggle/working/fine-tuned-model",
    num_train_epochs=${hyperparameters.epochs},
    learning_rate=${hyperparameters.learningRate},
    per_device_train_batch_size=${hyperparameters.batchSize},
    gradient_accumulation_steps=${hyperparameters.gradientAccumulation},
    warmup_steps=${hyperparameters.warmupSteps},
    weight_decay=${hyperparameters.weightDecay},
    fp16=${hyperparameters.precision === 'fp16' ? 'True' : 'False'},
    bf16=${hyperparameters.precision === 'bf16' ? 'True' : 'False'},
    gradient_checkpointing=${hyperparameters.gradientCheckpointing ? 'True' : 'False'},
    optim="${hyperparameters.optimizer}",
    lr_scheduler_type="${hyperparameters.lrScheduler}",
    save_strategy="epoch",
    save_steps=${hyperparameters.saveSteps},
    eval_steps=${hyperparameters.evalSteps},
    logging_steps=10,
)

print(f"Training {BASE_MODEL} for {DOMAIN} with {TECHNIQUE} on {COMPUTE_TARGET} / {ACCELERATOR}")
print(f"Resume enabled: {CONTINUE_TRAINING}; resume checkpoint: {resume_checkpoint}")`
}

export function buildTechniqueReport(model: ModelCard, template: DomainTemplate, technique: Technique, hyperparameters: Hyperparameters, totalExamples: number, job: TrainingJob): string {
  return [
    `Fine-tuning Method: ${technique}`,
    `Base model: ${model.name} (${model.parameters})`,
    `Dataset: ${template.name} template plus custom data, ${totalExamples} examples prepared.`,
    'Training split: 80% train, 10% validation, 10% test.',
    `Learning rate: ${hyperparameters.learningRate}; batch size: ${hyperparameters.batchSize}; epochs: ${hyperparameters.epochs}.`,
    `Runtime: ${hyperparameters.computeTarget.toUpperCase()} (${hyperparameters.accelerator}) with ${hyperparameters.precision} precision; ${hyperparameters.continueTraining ? 'checkpoint resume enabled for 9-hour session rollover' : 'single-session execution'}.`,
    `Optimizations: ${hyperparameters.gradientCheckpointing ? 'gradient checkpointing' : 'standard activation storage'}, ${technique === 'QLoRA' ? '4-bit quantization' : 'adapter training'}, ${hyperparameters.optimizer} optimizer, and ${hyperparameters.lrScheduler} scheduling.`,
    `Result: final training loss ${job.trainLoss}, validation loss ${job.validationLoss}, adapter download ready.`,
  ].join('\n')
}

export function estimateRuntimeHours(totalExamples: number, hyperparameters: Hyperparameters, parameters: string): number {
  const parameterCount = parseParameterBillions(parameters)
  const techniqueFactor = hyperparameters.computeTarget === 'cpu' ? 9 : hyperparameters.computeTarget === 'tpu' ? 0.9 : 1
  const baseHours = Math.max(0.5, (totalExamples / 1800) * (hyperparameters.epochs / 3) * Math.max(0.7, parameterCount / 7))
  const batchRelief = Math.max(0.55, 4 / Math.max(1, hyperparameters.batchSize))
  return Number((baseHours * techniqueFactor * batchRelief).toFixed(1))
}

export const snippets = {
  transformers: `from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

base_model = "meta-llama/Llama-2-7b"
adapter_path = "path/to/adapter"

tokenizer = AutoTokenizer.from_pretrained(base_model)
model = AutoModelForCausalLM.from_pretrained(base_model)
model = PeftModel.from_pretrained(model, adapter_path)

inputs = tokenizer("Your prompt", return_tensors="pt")
outputs = model.generate(**inputs, max_length=100)
print(tokenizer.decode(outputs[0]))`,
  merged: `from transformers import AutoTokenizer, AutoModelForCausalLM

tokenizer = AutoTokenizer.from_pretrained("path/to/merged/model")
model = AutoModelForCausalLM.from_pretrained("path/to/merged/model")

inputs = tokenizer("Your prompt", return_tensors="pt")
outputs = model.generate(**inputs, max_length=100)
print(tokenizer.decode(outputs[0]))`,
  gguf: `from llama_cpp import Llama

llm = Llama(model_path="model.gguf", n_gpu_layers=-1)
output = llm("Your prompt", max_tokens=100)
print(output["choices"][0]["text"])`,
  node: `const { Ollama } = require('ollama');

const ollama = new Ollama({ host: 'http://localhost:11434' });
const response = await ollama.generate({
  model: 'your-model',
  prompt: 'Your prompt',
  stream: false
});
console.log(response.response);`,
}

function normalizeExample(value: Partial<TrainingExample>): TrainingExample {
  return { instruction: String(value.instruction ?? '').trim(), response: String(value.response ?? '').trim() }
}

function splitCsvRow(row: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (const char of row) {
    if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else current += char
  }
  cells.push(current.trim())
  return cells
}

function parseParameterBillions(parameters: string) {
  const match = parameters.match(/(\d+(?:\.\d+)?)([BM])/i)
  if (!match) return 7
  const amount = Number(match[1])
  return match[2].toUpperCase() === 'M' ? amount / 1000 : amount
}
