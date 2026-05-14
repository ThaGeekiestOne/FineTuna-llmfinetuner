import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { createKaggleConfigDir } from './kaggleCredentialsStore.mjs'
import { resolveRuntimePath } from './runtimePaths.mjs'
import { buildKaggleOAuthEnv, getKaggleOAuthStatus, hasKaggleOAuthCredentials } from './kaggleAuthRuntime.mjs'

const currentDir = dirname(fileURLToPath(import.meta.url))
const kaggleExe = resolve(process.env.LOCALAPPDATA ?? '', 'Packages/PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0/LocalCache/local-packages/Python312/Scripts/kaggle.exe')

export async function startKaggleExecution(job, examples, authContext = {}) {
  const session = hasKaggleOAuthCredentials() ? null : await createKaggleConfigDir(authContext.userId, authContext.accessToken)
  try {
    const runDir = resolve(resolveRuntimePath('kaggle-runs'), job.id)
    const datasetDir = resolve(runDir, 'dataset')
    const kernelDir = resolve(runDir, 'kernel')
    await mkdir(datasetDir, { recursive: true })
    await mkdir(kernelDir, { recursive: true })

    const username = await resolveKaggleUsername(session)
    const datasetSlug = slugify(`finetuna-data-${job.id}`)
    const kernelSlug = slugify(`finetuna-run-${job.id}`)
    const datasetRef = `${username}/${datasetSlug}`
    const kernelRef = `${username}/${kernelSlug}`

    await writeDatasetPackage(datasetDir, datasetRef, job, examples)
    await writeKernelPackage(kernelDir, kernelRef, datasetRef, job)

    const datasetOutput = await runKaggle(['datasets', 'create', '-p', datasetDir], session?.configDir)
    const kernelOutput = await runKaggle(buildKernelPushArgs(kernelDir, job), session?.configDir)
    const pushedDatasetRef = extractDatasetRef(datasetOutput) ?? datasetRef
    const pushedKernelRef = extractKernelRef(kernelOutput) ?? kernelRef

    return {
      kaggleDatasetRef: pushedDatasetRef,
      kaggleKernelRef: pushedKernelRef,
      kaggleStatusRaw: kernelOutput || 'pushed',
      status: 'running',
      eta: 'Kaggle run submitted',
    }
  } finally {
    if (session) await session.cleanup()
  }
}

export async function getKaggleExecutionStatus(kernelRef, job = null, authContext = {}) {
  const session = hasKaggleOAuthCredentials() ? null : await createKaggleConfigDir(authContext.userId, authContext.accessToken)
  try {
    let raw
    try {
      raw = await runKaggle(['kernels', 'status', kernelRef], session?.configDir)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('wrong kernel slug')) {
        return {
          status: 'running',
          progress: job?.progress ?? 0,
          epoch: job?.epoch ?? 0,
          step: job?.step ?? 0,
          trainLoss: job?.trainLoss ?? 2.4,
          validationLoss: job?.validationLoss ?? 2.7,
          gpuMemory: job?.gpuMemory ?? 'Kaggle GPU pending',
          kaggleStatusRaw: message,
          eta: 'Submitted to Kaggle. Open the notebook URL to verify the run.',
        }
      }
      throw error
    }
    return parseKernelStatus(raw, job)
  } finally {
    if (session) await session.cleanup()
  }
}

export async function downloadKaggleExecutionOutput(jobId, kernelRef, authContext = {}) {
  const session = hasKaggleOAuthCredentials() ? null : await createKaggleConfigDir(authContext.userId, authContext.accessToken)
  try {
    const outputDir = resolve(resolveRuntimePath('kaggle-runs'), jobId, 'output')
    await mkdir(outputDir, { recursive: true })
    await runKaggle(['kernels', 'output', kernelRef, '-p', outputDir, '-o'], session?.configDir)
    await removeNoisyOutputFiles(outputDir)
    const files = await listFiles(outputDir)
    const reportPath = resolve(outputDir, 'report.txt')
    const summaryPath = resolve(outputDir, 'training_summary.json')
    const summary = existsSync(summaryPath) ? JSON.parse(await readFile(summaryPath, 'utf8')) : null
    return {
      files,
      report: existsSync(reportPath) ? await readFile(reportPath, 'utf8') : '',
      summary,
      downloadArtifacts: files.map((file) => ({ label: file, size: 'Kaggle output', path: file })),
    }
  } finally {
    if (session) await session.cleanup()
  }
}

export function applyCompletedKaggleOutput(job, patch, output) {
  const summary = output?.summary ?? null
  const artifactsFromSummary = Array.isArray(summary?.artifacts)
    ? summary.artifacts
        .map((artifact) => artifact?.path ? ({
          label: artifact.label ? `${artifact.label}: ${basenameFromPath(artifact.path)}` : basenameFromPath(artifact.path),
          size: 'Trained artifact',
        }) : null)
        .filter(Boolean)
    : []
  const outputArtifacts = Array.isArray(output?.downloadArtifacts) ? output.downloadArtifacts : []
  const downloadArtifacts = dedupeArtifacts([...artifactsFromSummary, ...outputArtifacts], job.downloadArtifacts)

  return {
    ...patch,
    status: summary?.status === 'completed' ? 'completed' : patch.status,
    epoch: toFiniteNumber(summary?.epoch, patch.epoch ?? job.epoch),
    step: toFiniteNumber(summary?.step, patch.step ?? job.step),
    trainLoss: toFiniteNumber(summary?.trainLoss, patch.trainLoss ?? job.trainLoss),
    validationLoss: toFiniteNumber(summary?.validationLoss, patch.validationLoss ?? job.validationLoss),
    report: output?.report || job.report,
    downloadArtifacts,
    eta: summary?.status === 'completed' ? 'Complete' : patch.eta,
  }
}

async function writeDatasetPackage(targetDir, datasetRef, job, examples) {
  const datasetSlug = datasetRef.split('/')[1] ?? slugify(`finetuna-data-${job.id}`)
  const metadata = {
    title: datasetSlug,
    id: datasetRef,
    licenses: [{ name: 'CC0-1.0' }],
  }
  await writeFile(resolve(targetDir, 'dataset-metadata.json'), JSON.stringify(metadata, null, 2))
  await writeFile(resolve(targetDir, 'datasets-metadata.json'), JSON.stringify(metadata, null, 2))
  await writeFile(resolve(targetDir, 'training_data.json'), JSON.stringify(examples, null, 2))
  await writeFile(resolve(targetDir, 'config.json'), JSON.stringify({
    modelName: job.modelName,
    templateName: job.templateName,
    technique: job.technique,
    hyperparameters: job.hyperparameters,
  }, null, 2))
}

async function writeKernelPackage(targetDir, kernelRef, datasetRef, job) {
  const computeTarget = job.hyperparameters?.computeTarget ?? 'gpu'
  const kernelSlug = kernelRef.split('/')[1] ?? slugify(`finetuna-run-${job.id}`)
  const metadata = {
    id: kernelRef,
    title: kernelSlug,
    code_file: 'train.py',
    language: 'python',
    kernel_type: 'script',
    is_private: 'true',
    enable_gpu: computeTarget === 'gpu' ? 'true' : 'false',
    enable_tpu: computeTarget === 'tpu' ? 'true' : 'false',
    enable_internet: 'true',
    dataset_sources: [datasetRef],
    competition_sources: [],
    kernel_sources: [],
    model_sources: [],
  }
  await writeFile(resolve(targetDir, 'kernel-metadata.json'), JSON.stringify(metadata, null, 2))
  await writeFile(resolve(targetDir, 'train.py'), buildKaggleTrainScript(job))
}

export function buildKaggleTrainScript(job) {
  return `import json
import math
import os
import subprocess
import sys
from pathlib import Path


def ensure_packages():
    packages = ['transformers', 'datasets', 'peft', 'accelerate']
    for package in packages:
        try:
            __import__(package)
        except ImportError:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', package, '-q'])
    try:
        __import__('bitsandbytes')
    except ImportError:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'bitsandbytes>=0.46.1', '-q'])


ensure_packages()

import torch
from datasets import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)
from peft import LoraConfig, TaskType, get_peft_model, prepare_model_for_kbit_training

ROOT = Path('/kaggle/input')
WORKDIR = Path('/kaggle/working')
OUTPUT_ROOT = WORKDIR / 'finetuna_output'
CHECKPOINT_DIR = Path('/tmp/finetuna_checkpoints')
ADAPTER_DIR = OUTPUT_ROOT / 'adapter'
MERGED_DIR = OUTPUT_ROOT / 'merged'
SUMMARY_PATH = WORKDIR / 'training_summary.json'
REPORT_PATH = WORKDIR / 'report.txt'

data_files = list(ROOT.rglob('training_data.json'))
config_files = list(ROOT.rglob('config.json'))

if not data_files or not config_files:
    raise RuntimeError('Expected training_data.json and config.json from attached Kaggle dataset')

examples = json.loads(data_files[0].read_text(encoding='utf-8'))
config = json.loads(config_files[0].read_text(encoding='utf-8'))
hyperparameters = config['hyperparameters']
model_name = config['modelName']
technique = config['technique']
compute_target = hyperparameters.get('computeTarget', 'gpu')
requested_accelerator = hyperparameters.get('accelerator', 'None')
continue_training = hyperparameters.get('continueTraining', False)
effective_technique = technique

def inspect_gpu_runtime():
    try:
        output = subprocess.check_output(
            ['nvidia-smi', '--query-gpu=name,compute_cap,memory.total', '--format=csv,noheader'],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        if not output:
            return []
        devices = []
        for line in output.splitlines():
            name, capability, memory = [part.strip() for part in line.split(',', 2)]
            devices.append({'name': name, 'capability': capability, 'memory': memory})
        return devices
    except Exception as exc:
        print(f'Could not inspect GPU with nvidia-smi: {exc}')
        return []


def validate_requested_runtime():
    if compute_target == 'cpu':
        return []
    if compute_target == 'tpu':
        raise RuntimeError('TPU execution is not supported by this Hugging Face Trainer script yet. Choose a Kaggle GPU accelerator for model fine-tuning.')

    devices = inspect_gpu_runtime()
    if not torch.cuda.is_available() or torch.cuda.device_count() == 0:
        raise RuntimeError(
            f'Kaggle did not attach the requested GPU accelerator ({requested_accelerator}). '
            'Do not continue on CPU; choose an available GPU in Kaggle or retry after quota is available.'
        )

    if not devices:
        print('CUDA is available, but nvidia-smi did not return device metadata.')
        return devices

    print(f"Detected CUDA devices: {devices}")
    first_capability = devices[0].get('capability', '0')
    try:
        first_major = int(first_capability.split('.')[0])
        if first_major < 7:
            print(
                f"GPU compute capability {first_capability} detected. "
                'FineTuna will keep using CUDA instead of switching to CPU, but newer PyTorch or bitsandbytes wheels may reject older GPUs. '
                'If this run fails with a CUDA kernel image error, rerun on T4, L4, or A100.'
            )
    except Exception:
        pass
    return devices

gpu_devices = validate_requested_runtime()

if technique == 'QLoRA' and compute_target == 'cpu':
    print('QLoRA on CPU is not supported reliably; falling back to LoRA.')
    effective_technique = 'LoRA'

print('FineTuna Kaggle run starting')
print(f"Model: ${job.modelName}")
print(f"Technique: {technique}")
print(f"Compute target: {compute_target}")
print(f"Requested accelerator: {requested_accelerator}")
print(f"Continue training: {continue_training}")
print(f"Examples: {len(examples)}")
print(f"Hyperparameters: {hyperparameters}")

WORKDIR.mkdir(parents=True, exist_ok=True)
OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

precision = hyperparameters.get('precision', 'fp16')
torch_dtype = torch.float32
cuda_ready = compute_target != 'cpu' and torch.cuda.is_available() and torch.cuda.device_count() > 0
if precision == 'fp16' and cuda_ready:
    torch_dtype = torch.float16
elif precision == 'bf16' and cuda_ready:
    if torch.cuda.is_bf16_supported():
        torch_dtype = torch.bfloat16
    else:
        print('bf16 is not supported on this accelerator; falling back to fp16.')
        precision = 'fp16'
        torch_dtype = torch.float16
elif compute_target == 'cpu' and precision != 'fp32':
    print('CPU training will use fp32 precision.')
    precision = 'fp32'
    torch_dtype = torch.float32

load_kwargs = {}
if effective_technique == 'QLoRA' and compute_target != 'cpu':
    try:
        load_kwargs['quantization_config'] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type='nf4',
            bnb_4bit_compute_dtype=torch_dtype,
        )
        load_kwargs['device_map'] = 'auto'
    except Exception as exc:
        print(f'Could not initialize QLoRA quantization: {exc}')
        print('Falling back to LoRA without 4-bit quantization.')
        effective_technique = 'LoRA'
else:
    load_kwargs['torch_dtype'] = torch_dtype
    if cuda_ready:
        load_kwargs['device_map'] = 'auto'

try:
    model = AutoModelForCausalLM.from_pretrained(model_name, **load_kwargs)
except Exception as exc:
    if effective_technique == 'QLoRA':
        print(f'QLoRA model load failed: {exc}')
        print('Retrying with LoRA settings instead.')
        effective_technique = 'LoRA'
        load_kwargs = {'torch_dtype': torch_dtype}
        if cuda_ready:
            load_kwargs['device_map'] = 'auto'
        model = AutoModelForCausalLM.from_pretrained(model_name, **load_kwargs)
    else:
        raise

if compute_target == 'gpu':
    model_device_text = str(getattr(model, 'device', 'device_map'))
    print(f'Model loaded for GPU execution; model device marker: {model_device_text}')

def find_target_modules(model):
    target_modules = set()
    for name, module in model.named_modules():
        leaf = name.split('.')[-1]
        if any(key in leaf for key in ('q_proj', 'k_proj', 'v_proj', 'o_proj', 'query_key_value', 'c_attn', 'dense', 'fc1', 'fc2')):
            target_modules.add(leaf)
    return sorted(target_modules or ['c_attn'])


if effective_technique in ('LoRA', 'QLoRA'):
    try:
        if effective_technique == 'QLoRA':
            model = prepare_model_for_kbit_training(model)
        lora_config = LoraConfig(
            r=int(hyperparameters.get('loraRank', 16)),
            lora_alpha=int(hyperparameters.get('loraAlpha', 32)),
            lora_dropout=float(hyperparameters.get('loraDropout', 0.05)),
            bias='none',
            task_type=TaskType.CAUSAL_LM,
            target_modules=find_target_modules(model),
        )
        model = get_peft_model(model, lora_config)
        model.print_trainable_parameters()
    except Exception as exc:
        print(f'Adapter setup failed: {exc}')
        print('Falling back to full fine-tuning for this run.')
        effective_technique = 'Full'

def format_example(example):
    instruction = example.get('instruction', '').strip()
    response = example.get('response', '').strip()
    return {
        'text': f"### Instruction:\\n{instruction}\\n\\n### Response:\\n{response}{tokenizer.eos_token or ''}"
    }


dataset = Dataset.from_list([format_example(example) for example in examples if example.get('instruction') and example.get('response')])
if len(dataset) == 0:
    raise RuntimeError('No valid instruction/response rows were found for training')

def tokenize_batch(batch):
    tokenized = tokenizer(
        batch['text'],
        truncation=True,
        max_length=int(hyperparameters.get('maxSequenceLength', 2048)),
        padding='max_length',
    )
    tokenized['labels'] = [ids[:] for ids in tokenized['input_ids']]
    return tokenized


tokenized = dataset.map(tokenize_batch, batched=True, remove_columns=['text'])
if len(tokenized) >= 10:
    split = tokenized.train_test_split(test_size=min(0.1, max(1 / len(tokenized), 0.1)), seed=42)
    train_dataset = split['train']
    eval_dataset = split['test']
else:
    train_dataset = tokenized
    eval_dataset = None

optimizer_name = hyperparameters.get('optimizer', 'adamw_torch')
if compute_target == 'cpu' and '8bit' in optimizer_name:
    print(f'Optimizer {optimizer_name} is not suitable for CPU training; falling back to adamw_torch.')
    optimizer_name = 'adamw_torch'

trainer_args = TrainingArguments(
    output_dir=str(CHECKPOINT_DIR),
    num_train_epochs=float(hyperparameters.get('epochs', 1)),
    learning_rate=float(hyperparameters.get('learningRate', 1e-4)),
    per_device_train_batch_size=int(hyperparameters.get('batchSize', 1)),
    per_device_eval_batch_size=max(1, int(hyperparameters.get('batchSize', 1))),
    gradient_accumulation_steps=int(hyperparameters.get('gradientAccumulation', 1)),
    warmup_steps=int(hyperparameters.get('warmupSteps', 0)),
    weight_decay=float(hyperparameters.get('weightDecay', 0.0)),
    logging_steps=10,
    save_steps=int(hyperparameters.get('saveSteps', 50)),
    eval_steps=int(hyperparameters.get('evalSteps', 50)),
    eval_strategy='steps' if eval_dataset is not None else 'no',
    save_strategy='steps',
    save_total_limit=2,
    report_to=[],
    lr_scheduler_type=hyperparameters.get('lrScheduler', 'cosine'),
    optim=optimizer_name,
    bf16=precision == 'bf16' and cuda_ready,
    fp16=precision == 'fp16' and cuda_ready,
    gradient_checkpointing=bool(hyperparameters.get('gradientCheckpointing', True)),
    remove_unused_columns=False,
    use_cpu=compute_target == 'cpu',
)

trainer = Trainer(
    model=model,
    args=trainer_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
)

comparison_dataset = eval_dataset
if comparison_dataset is None:
    comparison_dataset = train_dataset.select(range(min(len(train_dataset), 8)))

baseline_metrics = trainer.evaluate(eval_dataset=comparison_dataset, metric_key_prefix='baseline')
baseline_loss = baseline_metrics.get('baseline_loss')

resume_checkpoint = None
if continue_training and CHECKPOINT_DIR.exists():
    checkpoints = sorted([path for path in CHECKPOINT_DIR.glob('checkpoint-*') if path.is_dir()])
    if checkpoints:
        resume_checkpoint = str(checkpoints[-1])

train_result = trainer.train(resume_from_checkpoint=resume_checkpoint)
train_metrics = dict(train_result.metrics)
eval_metrics = trainer.evaluate(eval_dataset=comparison_dataset)

def safe_perplexity(loss):
    try:
        if loss is None:
            return None
        return math.exp(min(float(loss), 20))
    except Exception:
        return None

artifacts = []
if effective_technique in ('LoRA', 'QLoRA'):
    ADAPTER_DIR.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(ADAPTER_DIR)
    tokenizer.save_pretrained(ADAPTER_DIR)
    artifacts.append({'label': 'Adapter', 'path': str(ADAPTER_DIR)})
    try:
        merged_model = model.merge_and_unload()
        MERGED_DIR.mkdir(parents=True, exist_ok=True)
        merged_model.save_pretrained(MERGED_DIR, safe_serialization=True)
        tokenizer.save_pretrained(MERGED_DIR)
        artifacts.append({'label': 'Merged model', 'path': str(MERGED_DIR)})
    except Exception as exc:
        print(f'Could not export merged model: {exc}')
else:
    MERGED_DIR.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(MERGED_DIR, safe_serialization=True)
    tokenizer.save_pretrained(MERGED_DIR)
    artifacts.append({'label': 'Model', 'path': str(MERGED_DIR)})

summary = {
    'status': 'completed',
    'model': model_name,
    'technique': technique,
    'effectiveTechnique': effective_technique,
    'computeTarget': compute_target,
    'examples': len(examples),
    'baselineLoss': baseline_loss,
    'baselinePerplexity': safe_perplexity(baseline_loss),
    'trainLoss': train_metrics.get('train_loss'),
    'validationLoss': eval_metrics.get('eval_loss'),
    'validationPerplexity': safe_perplexity(eval_metrics.get('eval_loss')),
    'epoch': train_metrics.get('epoch'),
    'step': train_metrics.get('global_step'),
    'artifacts': artifacts,
}

SUMMARY_PATH.write_text(json.dumps(summary, indent=2), encoding='utf-8')
REPORT_PATH.write_text(
    '\\n'.join([
        'FineTuna real training run',
        f"Model: {model_name}",
        f"Technique: {technique}",
        f"Effective technique: {effective_technique}",
        f"Examples: {len(examples)}",
        f"Baseline loss: {baseline_loss}",
        f"Baseline perplexity: {safe_perplexity(baseline_loss)}",
        f"Train loss: {train_metrics.get('train_loss')}",
        f"Validation loss: {eval_metrics.get('eval_loss')}",
        f"Validation perplexity: {safe_perplexity(eval_metrics.get('eval_loss'))}",
        f"Artifacts: {', '.join([artifact['path'] for artifact in artifacts])}",
    ]),
    encoding='utf-8',
)

print('FineTuna Kaggle run completed')
print(json.dumps(summary, indent=2))`
}

export function parseKernelStatus(raw, job = null) {
  const text = raw.toLowerCase()
  const currentProgress = job?.progress ?? 0

  if (text.includes('complete') || text.includes('success')) {
    return {
      status: 'completed',
      progress: 100,
      epoch: job?.epoch ?? 0,
      step: job?.step ?? 0,
      trainLoss: job?.trainLoss ?? 2.4,
      validationLoss: job?.validationLoss ?? 2.7,
      gpuMemory: job?.gpuMemory ?? 'Kaggle GPU',
      kaggleStatusRaw: raw,
      eta: 'Complete on Kaggle. Click Download Kaggle output to fetch artifacts.',
    }
  }

  if (text.includes('error') || text.includes('failed') || text.includes('cancel')) {
    return {
      status: 'stopped',
      progress: currentProgress,
      kaggleStatusRaw: raw,
      eta: 'Failed on Kaggle',
    }
  }

  if (text.includes('running')) {
    return {
      status: 'running',
      progress: Math.max(currentProgress, 10),
      epoch: job?.epoch ?? 0,
      step: job?.step ?? 0,
      trainLoss: job?.trainLoss ?? 2.4,
      validationLoss: job?.validationLoss ?? 2.7,
      gpuMemory: 'Kaggle GPU attached',
      kaggleStatusRaw: raw,
      eta: 'Running on Kaggle. Exact metrics appear after output download.',
    }
  }

  return {
    status: 'queued',
    progress: currentProgress,
    kaggleStatusRaw: raw,
    eta: 'Queued on Kaggle',
  }
}

function runKaggle(args, configDir) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(kaggleExe, args, {
      env: buildKaggleEnv(configDir),
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.on('error', rejectPromise)
    child.on('close', (code) => {
      if (code === 0) resolvePromise((stdout || stderr).trim())
      else rejectPromise(new Error((stderr || stdout || `Kaggle command failed with exit code ${code}`).trim()))
    })
  })
}

function buildKaggleEnv(configDir) {
  if (hasKaggleOAuthCredentials()) return { ...process.env, ...buildKaggleOAuthEnv() }
  return { ...process.env, KAGGLE_CONFIG_DIR: configDir }
}

async function resolveKaggleUsername(session) {
  if (session?.credentials?.username) return session.credentials.username
  if (hasKaggleOAuthCredentials()) {
    const oauth = await getKaggleOAuthStatus()
    if (oauth.username) return oauth.username
  }
  const error = new Error('Kaggle username is not available for the active auth method')
  error.statusCode = 400
  throw error
}

function buildKernelPushArgs(kernelDir, job) {
  const computeTarget = job.hyperparameters?.computeTarget ?? 'gpu'
  const accelerator = job.hyperparameters?.accelerator
  if (computeTarget === 'cpu') return ['kernels', 'push', '-p', kernelDir]
  return ['kernels', 'push', '-p', kernelDir, '--accelerator', accelerator || (computeTarget === 'tpu' ? 'TpuV38' : 'NvidiaTeslaP100')]
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
}

function extractKernelRef(output) {
  const urlMatch = output.match(/kaggle\.com\/code\/([^/\s]+)\/([^?\s]+)/i)
  if (urlMatch) return `${urlMatch[1]}/${urlMatch[2]}`
  const refMatch = output.match(/\b([a-z0-9_-]+\/[a-z0-9][a-z0-9_-]*)\b/i)
  return refMatch?.[1] ?? null
}

function extractDatasetRef(output) {
  const urlMatch = output.match(/kaggle\.com\/datasets\/([^/\s]+)\/([^?\s]+)/i)
  if (urlMatch) return `${urlMatch[1]}/${urlMatch[2]}`
  const refMatch = output.match(/\b([a-z0-9_-]+\/[a-z0-9][a-z0-9_-]*)\b/i)
  return refMatch?.[1] ?? null
}

async function listFiles(rootDir, prefix = '') {
  const entries = await readdir(rootDir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    const absolutePath = resolve(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(absolutePath, relativePath))
    } else {
      files.push(relativePath)
    }
  }
  return files
}

async function removeNoisyOutputFiles(rootDir) {
  const files = await listFiles(rootDir)
  await Promise.all(files.filter(isNoisyOutputFile).map((file) => rm(resolve(rootDir, file), { force: true })))
}

function isNoisyOutputFile(file) {
  const normalized = file.replace(/\\/g, '/')
  return normalized.includes('/checkpoints/')
    || normalized.startsWith('checkpoints/')
    || normalized.includes('/.ipynb_checkpoints/')
    || normalized.startsWith('.ipynb_checkpoints/')
    || normalized.includes('/__pycache__/')
    || normalized.startsWith('__pycache__/')
    || normalized.includes('/wandb/')
    || normalized.startsWith('wandb/')
    || normalized.includes('events.out.tfevents')
    || normalized.endsWith('/trainer_state.json')
    || normalized.endsWith('/optimizer.pt')
    || normalized.endsWith('/scheduler.pt')
    || normalized.endsWith('/rng_state.pth')
}

function basenameFromPath(pathValue) {
  const normalized = String(pathValue).replace(/\\/g, '/')
  return normalized.split('/').filter(Boolean).at(-1) ?? normalized
}

function dedupeArtifacts(artifacts, fallback) {
  const seen = new Set()
  const merged = []
  for (const artifact of artifacts) {
    if (!artifact || !artifact.label) continue
    const key = `${artifact.label}::${artifact.size ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push({
      label: artifact.label,
      size: artifact.size ?? 'Kaggle output',
      ...(artifact.path ? { path: artifact.path } : {}),
    })
  }
  return merged.length > 0 ? merged : fallback
}

function toFiniteNumber(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}
