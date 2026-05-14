export type Technique = 'LoRA' | 'QLoRA' | 'Full'
export type DomainId = 'legal' | 'medical' | 'finance' | 'code' | 'general' | 'custom'

export type ModelCard = {
  id: string
  name: string
  architecture: string
  parameters: string
  vram: string
  license: string
  downloads: string
  rating: number
  tags: string[]
  author?: string
  releasedAt?: string
  lastModified?: string
  gated?: boolean
  providerUrl?: string
}

export type TrainingExample = {
  instruction: string
  response: string
}

export type DomainTemplate = {
  id: DomainId
  name: string
  description: string
  source: string
  datasetSize: number
  rating: number
  downloads: number
  examples: TrainingExample[]
}

export const models: ModelCard[] = [
  { id: 'mistral-7b', name: 'Mistral 7B Instruct', architecture: 'Mistral', parameters: '7B', vram: '16 GB', license: 'Apache 2.0', downloads: '9.8M', rating: 4.8, tags: ['trending', 'balanced'] },
  { id: 'llama-2-7b', name: 'Llama 2 7B Chat', architecture: 'Llama', parameters: '7B', vram: '16 GB', license: 'Meta community', downloads: '7.2M', rating: 4.6, tags: ['popular', 'chat'] },
  { id: 'phi-3-mini', name: 'Phi-3 Mini 4K', architecture: 'Phi', parameters: '3.8B', vram: '8 GB', license: 'MIT', downloads: '4.1M', rating: 4.5, tags: ['fast', 'low-vram'] },
  { id: 'gemma-7b', name: 'Gemma 7B IT', architecture: 'Gemma', parameters: '7B', vram: '16 GB', license: 'Gemma terms', downloads: '3.7M', rating: 4.4, tags: ['instruction'] },
  { id: 'codellama-13b', name: 'Code Llama 13B', architecture: 'Llama', parameters: '13B', vram: '24 GB', license: 'Meta community', downloads: '2.9M', rating: 4.7, tags: ['code'] },
  { id: 'mixtral-8x7b', name: 'Mixtral 8x7B Instruct', architecture: 'Mistral', parameters: '46.7B', vram: '40 GB+', license: 'Apache 2.0', downloads: '2.4M', rating: 4.9, tags: ['quality', 'advanced'] },
  { id: 'llama-2-13b', name: 'Llama 2 13B Chat', architecture: 'Llama', parameters: '13B', vram: '24 GB', license: 'Meta community', downloads: '5.6M', rating: 4.6, tags: ['quality'] },
  { id: 'tinyllama-1b', name: 'TinyLlama 1.1B Chat', architecture: 'Llama', parameters: '1.1B', vram: '6 GB', license: 'Apache 2.0', downloads: '1.8M', rating: 4.1, tags: ['starter', 'fast'] },
]

export const templates: DomainTemplate[] = [
  {
    id: 'legal',
    name: 'Legal',
    description: 'Contract analysis, clause extraction, and legal reasoning prompts.',
    source: 'Harvard Case Law, SEC Filings, LexGLUE',
    datasetSize: 2400,
    rating: 4.7,
    downloads: 18500,
    examples: [
      { instruction: 'Summarize the indemnification obligation in this contract clause.', response: 'The clause requires one party to cover losses, claims, and reasonable legal costs caused by specified breaches or misconduct.' },
      { instruction: 'Identify risks in a termination-for-convenience provision.', response: 'Key risks include short notice periods, unrecovered setup costs, unclear refund obligations, and missing transition support language.' },
    ],
  },
  {
    id: 'medical',
    name: 'Medical',
    description: 'Clinical Q&A, medical knowledge grounding, and patient-friendly explanations.',
    source: 'PubMed Central, MedQA, MIMIC-III samples',
    datasetSize: 2200,
    rating: 4.5,
    downloads: 14200,
    examples: [
      { instruction: 'Explain hypertension to a newly diagnosed patient.', response: 'Hypertension means blood pressure stays higher than recommended, which can strain the heart and blood vessels over time.' },
      { instruction: 'List common red flags for severe headache triage.', response: 'Sudden onset, neurological deficits, fever, trauma, pregnancy, cancer history, or the worst headache of life warrant urgent evaluation.' },
    ],
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Tax planning, filing summaries, financial analysis, and risk notes.',
    source: 'SEC EDGAR, FiQA, public filings',
    datasetSize: 2600,
    rating: 4.4,
    downloads: 12100,
    examples: [
      { instruction: 'Explain why revenue concentration is a financial risk.', response: 'Heavy dependence on a few customers can make revenue volatile if one customer churns, renegotiates, or delays payment.' },
      { instruction: 'Summarize this cash-flow statement for a non-finance founder.', response: 'The company generated cash from operations, spent on growth assets, and used financing to cover expansion needs.' },
    ],
  },
  {
    id: 'code',
    name: 'Code',
    description: 'Debugging, code review, implementation planning, and test writing.',
    source: 'CodeSearchNet, StackOverflow, public GitHub datasets',
    datasetSize: 3000,
    rating: 4.8,
    downloads: 22300,
    examples: [
      { instruction: 'Review this API handler for input validation issues.', response: 'Validate request shape at the boundary, reject unknown fields, check authorization before side effects, and return structured errors.' },
      { instruction: 'Write tests for a retry helper that backs off on 429 responses.', response: 'Cover immediate success, retry-after handling, max-attempt exhaustion, and non-retryable status codes.' },
    ],
  },
  {
    id: 'general',
    name: 'General',
    description: 'Customer support, writing assistance, summarization, and general instruction following.',
    source: 'DSTC, MultiWOZ, public instruction datasets',
    datasetSize: 2100,
    rating: 4.2,
    downloads: 9800,
    examples: [
      { instruction: 'Rewrite this support reply to sound concise and calm.', response: 'Thanks for the details. We found the issue and are applying a fix. I will update you once it is live.' },
      { instruction: 'Create an action-item summary from meeting notes.', response: 'Group each decision by owner, due date, dependency, and next check-in so follow-up is unambiguous.' },
    ],
  },
]

export const fallbackCustomTemplate: DomainTemplate = {
  id: 'custom',
  name: 'Custom',
  description: 'Start from uploaded instruction-response data only.',
  source: 'User upload',
  datasetSize: 0,
  rating: 0,
  downloads: 0,
  examples: [],
}
