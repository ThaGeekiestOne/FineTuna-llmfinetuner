import { useEffect, useMemo, useState, type ReactNode } from 'react'
import './App.css'
import { fallbackCustomTemplate, models, templates, type DomainTemplate, type ModelCard, type Technique, type TrainingExample } from './lib/catalog'
import { getAuthSession, signIn, signOut, signUp, type AuthUser } from './lib/auth'
import { disconnectGoogleDrive, getGoogleDriveStatus, startGoogleDriveAuth, type GoogleDriveStatus } from './lib/drive'
import { buildKaggleArtifactUrl, confirmKaggleOAuthLogin, createStoredJob, deleteStoredJob, downloadKaggleJobOutput, fetchKaggleJobStatus, getKaggleCredentialsStatus, getKaggleOAuthStatus, listStoredJobs, revokeKaggleOAuthLogin, saveKaggleCredentials, startKaggleJob, startKaggleOAuthLogin, type KaggleOAuthStatus, type StoredJob, updateStoredJob } from './lib/jobs'
import { fetchProviderCatalog } from './lib/providers'
import { buildTechniqueReport, calculateHyperparameters, estimateRuntimeHours, generateTrainingScript, mergeDatasets, parseDatasetText, snippets, validateDataset, type Hyperparameters } from './lib/training'

type IconProps = { size?: number }

function Icon({ size = 18 }: IconProps) {
  return <span className="inline-icon" style={{ width: size, height: size }} aria-hidden="true" />
}

const Bell = Icon
const ActivityIcon = Icon
const BrainCircuit = Icon
const Check = Icon
const Clipboard = Icon
const Cloud = Icon
const Code2 = Icon
const Database = Icon
const Download = Icon
const FileJson = Icon
const KeyRound = Icon
const Play = Icon
const Search = Icon
const Settings = Icon
const ShieldCheck = Icon
const Square = Icon
const Upload = Icon
const Star = Icon

type Section = 'dashboard' | 'models' | 'templates' | 'config' | 'training' | 'results' | 'settings' | 'help'
type AuthMode = 'signin' | 'signup'
type StepSummary = { id: Section; label: string; complete: boolean; available: boolean; note: string }

const nav: { id: Section; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'settings', label: 'Connect' },
  { id: 'models', label: 'Models' },
  { id: 'templates', label: 'Templates & Data' },
  { id: 'config', label: 'Config' },
  { id: 'training', label: 'Training' },
  { id: 'results', label: 'Results' },
  { id: 'help', label: 'Help' },
]

const sampleUpload = `instruction,response
"Explain retrieval augmented generation","RAG adds external context before generation so answers can use fresh or private knowledge."
"Review this prompt for ambiguity","Clarify the output format, define the audience, and add one concrete example."`
const customTemplateStorageKey = 'fine-tuna-custom-template'

function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [section, setSection] = useState<Section>('dashboard')
  const [query, setQuery] = useState('')
  const [architecture, setArchitecture] = useState('All')
  const [parameterFilter, setParameterFilter] = useState('All')
  const [vramFilter, setVramFilter] = useState('All')
  const [activityFilter, setActivityFilter] = useState('All')
  const [huggingFaceModels, setHuggingFaceModels] = useState<ModelCard[]>([])
  const [huggingFaceLoading, setHuggingFaceLoading] = useState(false)
  const [huggingFaceError, setHuggingFaceError] = useState('')
  const [modelOffset, setModelOffset] = useState(0)
  const [hasMoreModels, setHasMoreModels] = useState(true)
  const [userHuggingFaceToken, setUserHuggingFaceToken] = useState(() => window.sessionStorage.getItem('fine-tuna-hf-token') ?? '')
  const [userTokenEnabled, setUserTokenEnabled] = useState(() => Boolean(window.sessionStorage.getItem('fine-tuna-hf-token')))
  const [selectedModel, setSelectedModel] = useState<ModelCard | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<DomainTemplate | null>(null)
  const [customExamples, setCustomExamples] = useState<TrainingExample[]>([])
  const [datasetText, setDatasetText] = useState(sampleUpload)
  const [newTemplateOpen, setNewTemplateOpen] = useState(false)
  const [customTemplateName, setCustomTemplateName] = useState('My Template')
  const [savedCustomTemplate, setSavedCustomTemplate] = useState<DomainTemplate | null>(() => readSavedCustomTemplate())
  const [templateNotice, setTemplateNotice] = useState('')
  const [googleDrive, setGoogleDrive] = useState<GoogleDriveStatus | null>(null)
  const [technique, setTechnique] = useState<Technique>('LoRA')
  const [epochs, setEpochs] = useState(3)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [computeTarget, setComputeTarget] = useState<Hyperparameters['computeTarget']>('gpu')
  const [autoTune, setAutoTune] = useState(true)
  const [continueTraining, setContinueTraining] = useState(false)
  const [customHyperparameters, setCustomHyperparameters] = useState<Hyperparameters>(() => calculateHyperparameters('LoRA', 3))
  const [isStartingTraining, setIsStartingTraining] = useState(false)
  const [credentials, setCredentials] = useState<'missing' | 'verified'>('missing')
  const [kaggleUsername, setKaggleUsername] = useState('')
  const [kaggleUsernameDraft, setKaggleUsernameDraft] = useState('')
  const [kaggleKeyDraft, setKaggleKeyDraft] = useState('')
  const [kaggleOAuth, setKaggleOAuth] = useState<KaggleOAuthStatus | null>(null)
  const [kaggleOAuthCode, setKaggleOAuthCode] = useState('')
  const [job, setJob] = useState<StoredJob | null>(null)
  const [historyJobs, setHistoryJobs] = useState<StoredJob[]>([])
  const [historyError, setHistoryError] = useState('')
  const [snippetTab, setSnippetTab] = useState<keyof typeof snippets>('transformers')
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'ready'>('idle')

  const customTemplateDraft = useMemo<DomainTemplate>(() => ({
    id: 'custom',
    name: customTemplateName.trim() || 'Custom Template',
    description: 'User-defined template draft.',
    source: googleDrive?.configured ? 'Google Drive auth + manual template data' : 'Manual template data',
    datasetSize: customExamples.length,
    rating: 0,
    downloads: 0,
    examples: customExamples,
  }), [customExamples, customTemplateName, googleDrive?.configured])
  const selectedDataTemplate = selectedTemplate?.id === 'custom'
    ? (savedCustomTemplate ?? fallbackCustomTemplate)
    : selectedTemplate
  const autoHyperparameters = useMemo(
    () => calculateHyperparameters(technique, epochs, { computeTarget, continueTraining }),
    [technique, epochs, computeTarget, continueTraining],
  )
  const hyperparameters = autoTune ? autoHyperparameters : customHyperparameters
  const validation = useMemo(() => validateDataset(customExamples), [customExamples])
  const mergedExamples = useMemo(
    () => {
      if (!selectedDataTemplate) return []
      return selectedDataTemplate.id === 'custom' ? selectedDataTemplate.examples : mergeDatasets(selectedDataTemplate, customExamples)
    },
    [selectedDataTemplate, customExamples],
  )
  const generatedScript = useMemo(
    () => (selectedModel && selectedDataTemplate
      ? generateTrainingScript(selectedModel, technique, selectedDataTemplate, hyperparameters)
      : 'Complete the guided setup steps to generate the Kaggle training script.'),
    [selectedModel, technique, selectedDataTemplate, hyperparameters],
  )
  const estimatedRuntimeHours = useMemo(
    () => (selectedModel && selectedDataTemplate
      ? estimateRuntimeHours(mergedExamples.length || selectedDataTemplate.datasetSize, hyperparameters, selectedModel.parameters)
      : 0),
    [mergedExamples.length, selectedDataTemplate, hyperparameters, selectedModel],
  )
  const modalPreviewTemplate = validation.total > 0 ? customTemplateDraft : savedCustomTemplate ?? fallbackCustomTemplate
  const modalPreviewExamples = validation.total > 0 ? customExamples : modalPreviewTemplate.examples
  const trainingExamplesToSubmit = !selectedDataTemplate
    ? []
    : selectedDataTemplate.id === 'custom'
    ? selectedDataTemplate.examples
    : mergedExamples.length > 0 ? mergedExamples : selectedDataTemplate.examples
  const connectorsReady = credentials === 'verified'
  const hasModelSelection = Boolean(selectedModel)
  const hasTemplateSelection = Boolean(selectedDataTemplate)
  const canOpenModels = connectorsReady
  const canOpenTemplates = canOpenModels && hasModelSelection
  const canOpenConfig = canOpenTemplates && hasTemplateSelection
  const hasExistingJob = Boolean(job || historyJobs.length > 0)
  const canOpenTraining = canOpenConfig || hasExistingJob
  const canOpenResults = Boolean(job || historyJobs.length > 0)
  const flowSteps: StepSummary[] = [
    { id: 'settings', label: 'Connect', complete: connectorsReady, available: true, note: connectorsReady ? 'Kaggle is ready for runs.' : 'Verify Kaggle before continuing.' },
    { id: 'models', label: 'Select Model', complete: hasModelSelection, available: canOpenModels, note: selectedModel ? selectedModel.name : 'Choose the base model for fine-tuning.' },
    { id: 'templates', label: 'Select Data', complete: hasTemplateSelection, available: canOpenTemplates, note: selectedDataTemplate ? selectedDataTemplate.name : 'Pick a built-in template or your saved data.' },
    { id: 'config', label: 'Configure Run', complete: canOpenConfig, available: canOpenConfig, note: `${technique} on ${computeTarget.toUpperCase()} for ${epochs} epoch${epochs === 1 ? '' : 's'}.` },
    { id: 'training', label: 'Launch Training', complete: Boolean(job), available: canOpenTraining, note: isStartingTraining ? 'Submitting job to Kaggle...' : job ? `${job.status} • ${job.progress}%` : 'Start the Kaggle job once setup is complete.' },
    { id: 'results', label: 'Review Results', complete: job?.status === 'completed', available: canOpenResults, note: job?.status === 'completed' ? 'Artifacts and report are ready.' : 'Results unlock after a run exists.' },
  ]

  const activeModels = huggingFaceModels.length > 0 ? huggingFaceModels : models
  const architectureOptions = ['All', ...Array.from(new Set(activeModels.map((model) => model.architecture))).sort()]
  const parameterOptions = [
    'All',
    'Tiny <=1B',
    'Small 1B-2B',
    'Compact 2B-4B',
    'Mid 4B-7B',
    'Upper mid 7B-13B',
    'Large 13B-34B',
    'XL 34B+',
  ]
  const vramOptions = [
    'All',
    '<=4 GB',
    '4-8 GB',
    '8-12 GB',
    '12-16 GB',
    '16-24 GB',
    '24-40 GB',
    '40 GB+',
    'Check model card',
  ]
  const activityOptions = ['All', 'Updated last week', 'Updated last month', 'Updated last 90 days', 'Updated last 6 months', 'Updated last year', 'Older than a year']
  const filteredModels = activeModels.filter((model) => {
    const matchesQuery = `${model.name} ${model.architecture} ${model.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())
    const matchesArchitecture = architecture === 'All' || model.architecture === architecture
    const matchesParameters = parameterFilter === 'All' || matchesParameterBucket(model.parameters, parameterFilter)
    const matchesVram = vramFilter === 'All' || matchesVramBucket(model.vram, vramFilter)
    const matchesActivity = activityFilter === 'All' || matchesActivityBucket(model.lastModified ?? model.releasedAt, activityFilter)
    return matchesQuery && matchesArchitecture && matchesParameters && matchesVram && matchesActivity
  })

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'stopped' || !job.kaggleKernelRef) return
    const timer = window.setInterval(() => {
      void pollKaggleStatus(job.id)
    }, 10000)
    return () => window.clearInterval(timer)
  }, [job])

  useEffect(() => {
    if (section !== 'training') return
    if (!job || job.status === 'completed' || job.status === 'stopped' || !job.kaggleKernelRef) return
    void pollKaggleStatus(job.id)
  }, [section, job?.id])

  useEffect(() => {
    void loadAuthSession()
  }, [])

  useEffect(() => {
    if (!authUser) return
    void loadHuggingFaceModels('')
    void loadStoredJobs()
    void loadKaggleCredentialStatus()
    void loadKaggleOAuthState()
    void loadGoogleDriveConnection()
  }, [authUser])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'finetuna-google-drive-connected') {
        setTemplateNotice('Google Drive connected to this workspace.')
        void loadGoogleDriveConnection()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    if (autoTune) setCustomHyperparameters(autoHyperparameters)
  }, [autoHyperparameters, autoTune])

  useEffect(() => {
    if (!newTemplateOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNewTemplateOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [newTemplateOpen])

  useEffect(() => {
    if (autoTune) return
    setCustomHyperparameters((current) => ({
      ...current,
      epochs,
      computeTarget,
      continueTraining,
    }))
  }, [autoTune, continueTraining, computeTarget, epochs])

  useEffect(() => {
    if (canNavigateToSection(section)) return
    if (!connectorsReady) {
      setSection('settings')
      return
    }
    if (!hasModelSelection) {
      setSection('models')
      return
    }
    if (!hasTemplateSelection) {
      setSection('templates')
      return
    }
    setSection('dashboard')
  }, [section, connectorsReady, hasModelSelection, hasTemplateSelection])

  useEffect(() => {
    persistCustomTemplate(savedCustomTemplate)
  }, [savedCustomTemplate])

  function parseUpload() {
    try {
      setCustomExamples(parseDatasetText(datasetText))
      setTemplateNotice('')
    } catch {
      setCustomExamples([{ instruction: '', response: '' }])
    }
  }

  function resetTemplateBuilder() {
    setCustomTemplateName('My Template')
    setCustomExamples([])
    setDatasetText(sampleUpload)
  }

  function openNewTemplateBuilder() {
    resetTemplateBuilder()
    setTemplateNotice('')
    setNewTemplateOpen(true)
  }

  function saveDraftTemplate(closeAfterSave = false) {
    if (!customTemplateName.trim()) {
      setTemplateNotice('Give the new template a name before saving it')
      return
    }
    if (!validation.valid || customExamples.length === 0) {
      setTemplateNotice('Validate at least one instruction-response example before saving the draft')
      return
    }
    setSavedCustomTemplate(customTemplateDraft)
    setSelectedTemplate(customTemplateDraft)
    setHistoryError('')
    resetTemplateBuilder()
    setTemplateNotice('Draft template saved under My Data.')
    if (closeAfterSave) setNewTemplateOpen(false)
  }

  function editDraftTemplate() {
    const templateToEdit = savedCustomTemplate
    if (!templateToEdit) return
    setCustomTemplateName(templateToEdit.name)
    setCustomExamples(templateToEdit.examples)
    setDatasetText(stringifyDatasetExamples(templateToEdit.examples))
    setTemplateNotice('')
    setNewTemplateOpen(true)
  }

  function removeDraftTemplate() {
    setSavedCustomTemplate(null)
    resetTemplateBuilder()
    setTemplateNotice('Draft template removed.')
    if (selectedTemplate?.id === 'custom') setSelectedTemplate(null)
  }

  function toggleModelSelection(model: ModelCard) {
    setSelectedModel((current) => current?.id === model.id ? null : model)
  }

  function toggleTemplateSelection(template: DomainTemplate) {
    setSelectedTemplate((current) => current?.id === template.id ? null : template)
  }

  function canNavigateToSection(target: Section) {
    if (target === 'dashboard' || target === 'help' || target === 'settings') return true
    if (target === 'models') return canOpenModels
    if (target === 'templates') return canOpenTemplates
    if (target === 'config') return canOpenConfig
    if (target === 'training') return canOpenTraining
    if (target === 'results') return canOpenResults
    return false
  }

  function goToSection(target: Section) {
    if (canNavigateToSection(target)) setSection(target)
  }

  function continueFlow() {
    if (job && job.status !== 'completed' && job.status !== 'stopped') {
      setSection('training')
      return
    }
    const nextStep = flowSteps.find((step) => !step.complete && step.available)
    if (nextStep) {
      setSection(nextStep.id)
      return
    }
    if (canOpenResults) {
      setSection('results')
      return
    }
    if (canOpenTraining) setSection('training')
  }

  function buildPendingJobPreview(): StoredJob {
    return {
      id: `pending-${Date.now()}`,
      userId: authUser?.id ?? 'local',
      modelName: selectedModel?.name ?? 'Pending model',
      templateName: selectedDataTemplate?.name ?? 'Pending dataset',
      technique,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'queued',
      progress: 4,
      epoch: 0,
      step: 0,
      trainLoss: 2.4,
      validationLoss: 2.7,
      gpuMemory: hyperparameters.computeTarget === 'cpu' ? 'CPU run queued' : `${hyperparameters.accelerator} requested`,
      eta: 'Submitting training job to Kaggle...',
      hyperparameters,
      datasetTotal: trainingExamplesToSubmit.length || selectedDataTemplate?.datasetSize || 0,
      script: generatedScript,
      report: 'Preparing Kaggle training run...',
      downloadArtifacts: [],
      kaggleDatasetRef: '',
      kaggleKernelRef: '',
      kaggleStatusRaw: 'Submitting',
    }
  }

  function defaultAcceleratorForTarget(target: Hyperparameters['computeTarget']): Hyperparameters['accelerator'] {
    if (target === 'tpu') return 'TpuV38'
    if (target === 'cpu') return 'None'
    return 'NvidiaTeslaP100'
  }

  function handleComputeTargetChange(target: Hyperparameters['computeTarget']) {
    setComputeTarget(target)
    updateHyperparameter('accelerator', defaultAcceleratorForTarget(target))
  }

  async function saveKaggleCredentialsDraft() {
    if (!kaggleUsernameDraft.trim() || !kaggleKeyDraft.trim()) {
      setCredentials('missing')
      setHistoryError('Kaggle username and API key are required')
      return
    }
    await persistKaggleCredentials({ username: kaggleUsernameDraft.trim(), key: kaggleKeyDraft.trim() })
  }

  async function persistKaggleCredentials(credentialsPayload: { username: string; key: string }) {
    try {
      const saved = await saveKaggleCredentials(credentialsPayload)
      setCredentials(saved.configured ? 'verified' : 'missing')
      setKaggleUsername(saved.username ?? '')
      setHistoryError('')
    } catch (error) {
      setCredentials('missing')
      setHistoryError(error instanceof Error ? error.message : 'Could not save Kaggle credentials')
    }
  }

  async function loadKaggleCredentialStatus() {
    try {
      const status = await getKaggleCredentialsStatus()
      setCredentials(status.configured ? 'verified' : 'missing')
      setKaggleUsername(status.username ?? '')
      setKaggleUsernameDraft(status.username ?? '')
    } catch {
      setCredentials('missing')
    }
  }

  async function loadKaggleOAuthState() {
    try {
      const status = await getKaggleOAuthStatus()
      setKaggleOAuth(status)
      if (status.oauth.configured && status.oauth.username) {
        setCredentials('verified')
        setKaggleUsername(status.oauth.username)
        setKaggleUsernameDraft(status.oauth.username)
      }
    } catch {}
  }

  function updateHyperparameter<K extends keyof Hyperparameters>(key: K, value: Hyperparameters[K]) {
    if (autoTune) setAutoTune(false)
    setCustomHyperparameters((current) => ({ ...current, [key]: value }))
  }

  async function beginKaggleOAuthLogin() {
    try {
      setHistoryError('')
      const status = await startKaggleOAuthLogin(true)
      setKaggleOAuth(status)
      if (status.session?.url) {
        window.open(status.session.url, '_blank', 'noopener,noreferrer')
        return
      }
      setHistoryError('Kaggle OAuth URL was not created')
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Could not start Kaggle OAuth login')
    }
  }

  async function submitKaggleOAuthCode() {
    try {
      const status = await confirmKaggleOAuthLogin(kaggleOAuthCode)
      setKaggleOAuth(status)
      setKaggleOAuthCode('')
      await loadKaggleCredentialStatus()
      await loadKaggleOAuthState()
      setHistoryError('')
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Could not confirm Kaggle OAuth code')
    }
  }

  async function disconnectKaggleOAuth() {
    try {
      const status = await revokeKaggleOAuthLogin()
      setKaggleOAuth(status)
      await loadKaggleCredentialStatus()
      await loadKaggleOAuthState()
      setHistoryError('')
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Could not revoke Kaggle OAuth login')
    }
  }

  async function loadHuggingFaceModels(search = query) {
    setHuggingFaceLoading(true)
    setHuggingFaceError('')
    try {
      const result = await fetchProviderCatalog(search, userTokenEnabled ? userHuggingFaceToken : undefined, 0)
      setHuggingFaceModels(result.models)
      setModelOffset(result.models.length)
      setHasMoreModels(result.models.length >= 100)
      setHuggingFaceError(result.errors[0] ?? '')
      if (result.models[0]) setSelectedModel(result.models[0])
    } catch (error) {
      setHuggingFaceError(error instanceof Error ? error.message : 'Could not load Hugging Face models')
    } finally {
      setHuggingFaceLoading(false)
    }
  }

  async function loadStoredJobs() {
    try {
      const jobs = await listStoredJobs()
      setHistoryJobs(jobs)
      setHistoryError('')
      setJob((current) => current ?? jobs.find((item) => item.status === 'running' || item.status === 'queued') ?? jobs[0] ?? null)
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Could not load saved runs')
    }
  }

  async function loadGoogleDriveConnection() {
    try {
      const status = await getGoogleDriveStatus()
      setGoogleDrive(status)
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Could not load Google Drive status')
    }
  }

  async function connectGoogleDrive() {
    const oauthWindow = window.open('', 'finetuna-google-drive-oauth', 'width=540,height=720')
    try {
      setHistoryError('')
      setTemplateNotice('')
      if (!oauthWindow) {
        setTemplateNotice('Popup blocked. Allow popups for this site and try Google Drive connect again.')
        return
      }
      renderOauthPopup(oauthWindow, 'Connecting to Google Drive...', false)
      const status = await startGoogleDriveAuth()
      setGoogleDrive(status)
      if (status.url) {
        oauthWindow.location.href = status.url
        setTemplateNotice('Google Drive OAuth opened. Finish the consent flow in the popup to connect this draft.')
        return
      }
      renderOauthPopup(oauthWindow, 'Google Drive OAuth URL was not created.', true)
      setTemplateNotice('Google Drive OAuth URL was not created.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start Google Drive connection'
      setHistoryError(message)
      setTemplateNotice(formatGoogleDriveSetupError(message))
      if (oauthWindow) renderOauthPopup(oauthWindow, formatGoogleDriveSetupError(message), true)
    }
  }

  async function disconnectGoogleDriveAccount() {
    try {
      setHistoryError('')
      setGoogleDrive(await disconnectGoogleDrive())
      setTemplateNotice('Google Drive disconnected.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not disconnect Google Drive'
      setHistoryError(message)
      setTemplateNotice(message)
    }
  }

  async function loadMoreHuggingFaceModels() {
    setHuggingFaceLoading(true)
    setHuggingFaceError('')
    try {
      const result = await fetchProviderCatalog(query, userTokenEnabled ? userHuggingFaceToken : undefined, modelOffset)
      setHuggingFaceModels((current) => dedupeModelCards([...current, ...result.models]))
      setModelOffset((current) => current + result.models.length)
      setHasMoreModels(result.models.length >= 100)
      setHuggingFaceError(result.errors[0] ?? '')
    } catch (error) {
      setHuggingFaceError(error instanceof Error ? error.message : 'Could not load more Hugging Face models')
    } finally {
      setHuggingFaceLoading(false)
    }
  }

  async function startTraining() {
    try {
      if (!selectedModel || !selectedDataTemplate) {
        setHistoryError('Select both a model and a dataset before starting training')
        setSection(!selectedModel ? 'models' : 'templates')
        return
      }
      if (credentials !== 'verified') {
        setHistoryError('Connect Kaggle before starting training')
        setSection('settings')
        return
      }
      setIsStartingTraining(true)
      setHistoryError('')
      setJob(buildPendingJobPreview())
      setSection('training')
      const report = buildTechniqueReport(selectedModel, selectedDataTemplate, technique, hyperparameters, mergedExamples.length || selectedDataTemplate.datasetSize, {
        id: 'preview',
        status: 'queued',
        progress: 0,
        epoch: 0,
        step: 0,
        trainLoss: 2.4,
        validationLoss: 2.7,
        gpuMemory: '0 / 16 GB',
        eta: 'Waiting for Kaggle GPU',
      })
      const created = await createStoredJob({
        modelName: selectedModel.name,
        templateName: selectedDataTemplate.name,
        technique,
        hyperparameters,
        datasetTotal: mergedExamples.length || selectedDataTemplate.datasetSize,
        script: generatedScript,
        report,
      })
      setJob(created)
      const started = await startKaggleJob(created.id, trainingExamplesToSubmit)
      setJob(started)
      await loadStoredJobs()
      setSection('training')
      setHistoryError('')
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Could not create training run')
      setSection('config')
      setJob(null)
    } finally {
      setIsStartingTraining(false)
    }
  }

  async function stopTraining(currentJob: StoredJob) {
    const stopped = await updateStoredJob(currentJob.id, { status: 'stopped', eta: 'Stopped locally. Kaggle stop is not exposed by the CLI.' })
    setJob(stopped)
    await loadStoredJobs()
  }

  async function removeJob(id: string) {
    await deleteStoredJob(id)
    setJob((current) => (current?.id === id ? null : current))
    await loadStoredJobs()
  }

  async function pollKaggleStatus(jobId: string) {
    try {
      const updated = await fetchKaggleJobStatus(jobId)
      setJob((current) => current?.id === updated.id ? updated : current)
      await loadStoredJobs()
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Could not poll Kaggle status')
    }
  }

  async function downloadCurrentJobOutput() {
    if (!job) return
    try {
      setDownloadState('downloading')
      setHistoryError('')
      const updated = await downloadKaggleJobOutput(job.id)
      setJob(updated)
      await loadStoredJobs()
      setDownloadState('ready')
    } catch (error) {
      setDownloadState('idle')
      setHistoryError(error instanceof Error ? error.message : 'Could not download Kaggle output')
    }
  }

  async function handleArtifactDownload(artifact: StoredJob['downloadArtifacts'][number]) {
    if (!job) return
    if (artifact.path && artifact.size !== 'Available after download') {
      window.open(buildKaggleArtifactUrl(job.id, artifact.path), '_blank', 'noopener,noreferrer')
      return
    }
    await downloadCurrentJobOutput()
  }

  function saveUserHuggingFaceToken(token: string) {
    const trimmed = token.trim()
    setUserHuggingFaceToken(trimmed)
    setUserTokenEnabled(Boolean(trimmed))
    if (trimmed) window.sessionStorage.setItem('fine-tuna-hf-token', trimmed)
    else window.sessionStorage.removeItem('fine-tuna-hf-token')
  }

  const complete = job?.status === 'completed'
  const report = job?.report ?? ''
  const baselineLoss = metricFromReport(report, 'Baseline loss', '2.40')
  const baselinePerplexity = metricFromReport(report, 'Baseline perplexity', 'Pending')
  const artifactsDownloaded = Boolean(job?.downloadArtifacts.some((artifact) => artifact.size !== 'Available after download' || artifact.path))
  const hasActualTrainingMetrics = hasRealTrainingReport(job) || artifactsDownloaded
  const favoriteDomain = historyJobs.length > 0 ? mostFrequent(historyJobs.map((item) => item.templateName)) : selectedDataTemplate?.name ?? 'None'
  const latestCompletedJob = historyJobs.find((item) => item.status === 'completed') ?? null
  const performanceJob = job?.status === 'completed' ? job : latestCompletedJob

  async function loadAuthSession() {
    try {
      const user = await getAuthSession()
      setAuthUser(user)
      setAuthError('')
    } catch (error) {
      setAuthUser(null)
      setAuthError(error instanceof Error ? error.message : 'Could not load session')
    } finally {
      setAuthLoading(false)
    }
  }

  async function submitAuth() {
    try {
      setAuthLoading(true)
      setAuthError('')
      setAuthNotice('')
      if (authMode === 'signin') {
        const user = await signIn({ email: authEmail, password: authPassword })
        setAuthUser(user)
        setAuthPassword('')
        return
      }
      const result = await signUp({ name: authName, email: authEmail, password: authPassword })
      if (result.confirmationRequired) {
        setAuthMode('signin')
        setAuthNotice('Check your inbox and confirm your email, then sign in.')
        setAuthPassword('')
        return
      }
      const user = result.user
      setAuthUser(user)
      setAuthPassword('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
      setAuthUser(null)
      setAuthPassword('')
      setHistoryJobs([])
      setJob(null)
      setCredentials('missing')
      setKaggleOAuth(null)
      setHistoryError('')
      setIsStartingTraining(false)
      setSection('dashboard')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not sign out')
    }
  }

  if (!authUser) {
    return (
      <main className="auth-shell">
        <section className="auth-visual">
          <div className="auth-visual-copy">
            <span className="auth-kicker">FineTuna</span>
            <h1>Train and ship tuned models without leaving one workflow.</h1>
            <p>Connect providers, shape datasets, launch jobs, and track versions from a single operator surface.</p>
          </div>

          <div className="auth-metrics">
            <div className="auth-metric">
              <span>Provider routing</span>
              <strong>Kaggle + Hugging Face</strong>
            </div>
            <div className="auth-metric">
              <span>Run memory</span>
              <strong>Saved versions and reports</strong>
            </div>
            <div className="auth-metric">
              <span>Training modes</span>
              <strong>LoRA, QLoRA, Full</strong>
            </div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-panel-head">
            <div className="brand auth-brand"><BrainCircuit size={24} /><span>FineTuna</span></div>
            <div className="segmented auth-segmented">
              <button className={authMode === 'signin' ? 'active' : ''} onClick={() => setAuthMode('signin')}>
                Sign in
              </button>
              <button className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>
                Sign up
              </button>
            </div>
          </div>

          <div className="auth-card">
            <div className="auth-copy">
              <h2>{authMode === 'signin' ? 'Welcome back' : 'Create your workspace'}</h2>
              <p>{authMode === 'signin' ? 'Use your account to manage runs, credentials, and saved model versions.' : 'Start with a secure account so jobs, artifacts, and provider settings stay attached to one workspace.'}</p>
            </div>

              <div className="auth-form">
                {authMode === 'signup' && (
                  <label className="auth-field">
                  Full name
                  <input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Ayush Sharma" />
                </label>
              )}
              <label className="auth-field">
                Email
                <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@company.com" />
              </label>
              <label className="auth-field">
                  Password
                  <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Enter password" />
                </label>
                {authNotice && <p className="success auth-error">{authNotice}</p>}
                {authError && <p className="error auth-error">{authError}</p>}

                <button className="primary auth-submit" onClick={() => void submitAuth()} disabled={authLoading}>
                  {authLoading ? 'Working...' : authMode === 'signin' ? 'Sign in to FineTuna' : 'Create account'}
                </button>
              </div>

            <div className="auth-divider"><span>or</span></div>

              <div className="auth-actions">
                <button disabled>Continue with Google</button>
                <button disabled>Continue with GitHub</button>
              </div>

            <div className="auth-footer">
              <span>{authMode === 'signin' ? 'Need an account?' : 'Already have an account?'}</span>
              <button className="auth-link" onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}>
                {authMode === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
      <main className="shell">
      <aside className="sidebar">
        <div className="brand"><BrainCircuit size={24} /><span>FineTuna</span></div>
        <nav>
          {nav.map((item) => (
            <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => goToSection(item.id)} disabled={!canNavigateToSection(item.id)}>{item.label}</button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
          <header className="topbar">
            <div>
              <h1>{titleFor(section)}</h1>
            </div>
            <div className="status-strip">
              <span className="pill"><ShieldCheck size={15} />{authUser.name}</span>
              <span className={credentials === 'verified' ? 'pill ok' : 'pill warn'}><KeyRound size={15} />{credentials === 'verified' ? 'Kaggle verified' : 'Kaggle missing'}</span>
              <span className={huggingFaceModels.length > 0 ? 'pill ok' : 'pill warn'}><BrainCircuit size={15} />{huggingFaceModels.length > 0 ? 'Hugging Face live' : 'Loading models'}</span>
              {userTokenEnabled && <span className="pill ok"><KeyRound size={15} />User HF token</span>}
              <span className="pill"><Bell size={15} />{complete ? 'Job complete' : 'No alerts'}</span>
              <button onClick={() => void handleSignOut()}>Sign out</button>
            </div>
          </header>

        {section === 'dashboard' && (
          <div className="stack">
            <section className="flow-hero panel">
              <div>
                <h2>Guided Run Sequence</h2>
                <p>Move top to bottom: connect Kaggle, choose a model, choose data, confirm the run, then launch training.</p>
              </div>
              <button className="primary" onClick={continueFlow}><Play size={16} />Continue flow</button>
            </section>
            <div className="cards flow-grid">
              {flowSteps.map((step, index) => (
                <article className={`card flow-card ${step.complete ? 'selected' : ''}`} key={step.id}>
                  <div className="card-head">
                    <h2>{index + 1}. {step.label}</h2>
                    <span>{step.complete ? 'Done' : step.available ? 'Ready' : 'Locked'}</span>
                  </div>
                  <p>{step.note}</p>
                  <button className={step.complete ? 'selected-action' : ''} onClick={() => goToSection(step.id)} disabled={!step.available}>
                    {step.complete ? <Check size={16} /> : <Play size={16} />}
                    {step.complete ? 'Review step' : step.available ? 'Open step' : 'Complete previous steps'}
                  </button>
                </article>
              ))}
            </div>
            <div className="grid dashboard">
              <Stat label="Models trained" value={String(historyJobs.length)} />
              <Stat label="Training hours" value={(historyJobs.length * 2.8).toFixed(1)} />
              <Stat label="Favorite domain" value={favoriteDomain} />
            </div>
            <div className="split">
              <Panel icon={<Database />} title="Recent Activity">
                {historyJobs.slice(0, 3).map((item) => (
                  <button className="history-row" key={item.id} onClick={() => { setJob(item); setSection(item.status === 'completed' || item.status === 'stopped' ? 'results' : 'training') }}>
                    <span>{item.modelName}</span>
                    <strong>{item.status}</strong>
                  </button>
                ))}
                {historyJobs.length === 0 && <p>No saved runs yet.</p>}
              </Panel>
              <Panel icon={<ShieldCheck />} title="Provider Boundaries">
                <p>Kaggle is the only required provider for a run. Google Drive and custom Hugging Face access are optional operator tools.</p>
              </Panel>
            </div>
            <Panel icon={<ActivityIcon />} title="Before / After Performance">
              <p>{performanceJob ? `Latest completed run: ${performanceJob.modelName}` : 'Complete a training run to compare baseline and tuned model performance here.'}</p>
              <div className="metrics">
                <Stat label="Before loss" value={performanceJob?.report ? metricFromReport(performanceJob.report, 'Baseline loss', '2.40') : '2.40'} />
                <Stat label="After train loss" value={hasRealTrainingReport(performanceJob) && performanceJob ? String(performanceJob.trainLoss) : 'Pending'} />
                <Stat label="After val loss" value={hasRealTrainingReport(performanceJob) && performanceJob ? String(performanceJob.validationLoss) : 'Pending'} />
              </div>
            </Panel>
            {historyError && <Panel icon={<Bell />} title="Run Status"><p className="warning inline-warning">{historyError}</p></Panel>}
          </div>
        )}

        {section === 'models' && (
          <div className="stack">
            <div className="toolbar">
              <label className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models" /></label>
              <select value={architecture} onChange={(event) => setArchitecture(event.target.value)}>
                {architectureOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
              <button className="primary" onClick={() => loadHuggingFaceModels()} disabled={huggingFaceLoading}>{huggingFaceLoading ? 'Loading...' : 'Search'}</button>
            </div>
            <div className="filter-bar">
              <label>Parameters<select value={parameterFilter} onChange={(event) => setParameterFilter(event.target.value)}>{parameterOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>VRAM<select value={vramFilter} onChange={(event) => setVramFilter(event.target.value)}>{vramOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>Activity<select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>{activityOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
              <button onClick={() => { setParameterFilter('All'); setVramFilter('All'); setActivityFilter('All'); setArchitecture('All') }}>Reset</button>
            </div>
            {huggingFaceError && <p className="warning">{huggingFaceError}. Showing fallback examples.</p>}
            <div className="cards model-grid">
              {filteredModels.map((model) => (
                <article className={`card ${selectedModel?.id === model.id ? 'selected' : ''}`} key={model.id}>
                  <div className="card-head"><h2>{model.name}</h2><span className="rating"><Star size={14} />{model.rating}/5</span></div>
                  <p>{model.architecture} architecture tuned for {model.tags.join(', ')} workloads.</p>
                  <dl>
                    <dt>Params</dt><dd>{model.parameters}</dd>
                    <dt>VRAM</dt><dd>{model.vram}</dd>
                    <dt>Downloads</dt><dd>{model.downloads}</dd>
                    <dt>Released</dt><dd>{model.releasedAt ?? 'Model card'}</dd>
                    <dt>Updated</dt><dd>{model.lastModified ?? 'Unknown'}</dd>
                  </dl>
                  <button className={selectedModel?.id === model.id ? 'selected-action' : ''} onClick={() => toggleModelSelection(model)}>{selectedModel?.id === model.id ? <Check size={16} /> : <BrainCircuit size={16} />}{selectedModel?.id === model.id ? 'Deselect' : 'Select'}</button>
                </article>
              ))}
            </div>
            {hasMoreModels && (
              <button className="load-more" onClick={loadMoreHuggingFaceModels} disabled={huggingFaceLoading}>{huggingFaceLoading ? 'Loading...' : 'Load more models'}</button>
            )}
            <div className="step-actions">
              <button onClick={() => goToSection('settings')}>Back to Connect</button>
              <button className="primary" onClick={() => goToSection('templates')} disabled={!hasModelSelection}>Continue to Data</button>
            </div>
          </div>
        )}

        {section === 'templates' && (
          <div className="stack">
            <div className="toolbar">
              <div>
                <strong>Templates and Dataset</strong>
                <p>Choose a built-in template or create a new one from your own data.</p>
              </div>
              <button className="primary" onClick={openNewTemplateBuilder}>
                <Upload size={16} />Add New Template
              </button>
            </div>
            <div className="cards template-grid">
              {templates.map((template) => (
                <article className={`card ${selectedDataTemplate?.id === template.id ? 'selected' : ''}`} key={template.id}>
                  <div className="card-head"><h2>{template.name}</h2><span>{template.rating ? `${template.rating}/5` : 'Upload'}</span></div>
                  <p>{template.description}</p>
                  <Activity label="Source" value={template.source} />
                  <Activity label="Dataset size" value={template.datasetSize ? `${template.datasetSize.toLocaleString()} pairs` : 'User provided'} />
                  <Activity label="Downloads" value={template.downloads ? template.downloads.toLocaleString() : 'Private'} />
                  <button className={selectedDataTemplate?.id === template.id ? 'selected-action' : ''} onClick={() => toggleTemplateSelection(template)}>
                    {selectedDataTemplate?.id === template.id ? <Check size={16} /> : <FileJson size={16} />}
                    {selectedDataTemplate?.id === template.id ? 'Deselect template' : 'Select template'}
                  </button>
                </article>
              ))}
            </div>

            {savedCustomTemplate && (
              <section className="saved-template-section">
                <div className="saved-template-divider">
                  <strong>My Data</strong>
                  <span>Your saved template lives here, separate from the built-in templates.</span>
                </div>
                <div className="cards template-grid">
                  <article className={`card ${selectedDataTemplate?.id === savedCustomTemplate.id ? 'selected' : ''}`}>
                    <div className="card-head"><h2>{savedCustomTemplate.name}</h2><span>Saved</span></div>
                    <p>{savedCustomTemplate.description}</p>
                    <Activity label="Source" value={savedCustomTemplate.source} />
                    <Activity label="Dataset size" value={`${savedCustomTemplate.datasetSize.toLocaleString()} pairs`} />
                    <Activity label="Downloads" value="Private" />
                    <button className={selectedDataTemplate?.id === savedCustomTemplate.id ? 'selected-action' : ''} onClick={() => toggleTemplateSelection(savedCustomTemplate)}>
                      {selectedDataTemplate?.id === savedCustomTemplate.id ? <Check size={16} /> : <FileJson size={16} />}
                      {selectedDataTemplate?.id === savedCustomTemplate.id ? 'Deselect template' : 'Select template'}
                    </button>
                    <div className="inline-actions">
                      <button onClick={editDraftTemplate}><Upload size={16} />Edit draft</button>
                      <button className="danger" onClick={removeDraftTemplate}>Remove draft</button>
                    </div>
                  </article>
                </div>
              </section>
            )}

            {newTemplateOpen && (
              <div className="modal-backdrop" onClick={() => setNewTemplateOpen(false)} role="presentation">
                <div className="modal-shell" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add New Template">
                  <div className="modal-head">
                    <div>
                      <strong>Add New Template</strong>
                      <p>Create a draft template from your own data without leaving this page.</p>
                    </div>
                    <button className="ghost" onClick={() => setNewTemplateOpen(false)}>Close</button>
                  </div>
                  <div className="modal-content split">
                    <Panel icon={<Upload />} title="Template Builder">
                      <label className="field">Template name<input value={customTemplateName} onChange={(event) => setCustomTemplateName(event.target.value)} placeholder="My Template" /></label>
                      <div className="settings-subcard">
                        <h3>Google Drive</h3>
                        <p>Connect Google Drive here to bind this draft template to the authenticated Drive account.</p>
                        <div className="settings-actions">
                          <button className="primary" onClick={() => void connectGoogleDrive()}>
                            {googleDrive?.configured ? 'Reconnect Google Drive' : 'Connect Google Drive'}
                          </button>
                          <button className="danger" onClick={() => void disconnectGoogleDriveAccount()}>Disconnect</button>
                        </div>
                        <span className={googleDrive?.configured ? 'pill ok' : 'pill warn'}>
                          {googleDrive?.configured ? `${googleDrive.displayName || 'Drive account'}${googleDrive.email ? ` (${googleDrive.email})` : ''}` : 'No Google Drive account linked'}
                        </span>
                      </div>
                      <label className="modal-textarea-label">
                        <span>New template data</span>
                        <textarea value={datasetText} onChange={(event) => setDatasetText(event.target.value)} rows={10} />
                      </label>
                      {templateNotice && <p className="info">{templateNotice}</p>}
                      <div className="settings-actions">
                        <button className="primary" onClick={parseUpload}><Database size={16} />Validate dataset</button>
                        <button onClick={() => saveDraftTemplate(false)}><Star size={16} />Save draft</button>
                        <button className="primary" onClick={() => saveDraftTemplate(true)}><Check size={16} />Save and use</button>
                        {savedCustomTemplate && <button className="danger" onClick={removeDraftTemplate}>Remove draft</button>}
                      </div>
                      <Notice validation={validation} />
                    </Panel>
                    <Panel icon={<FileJson />} title="Training Dataset Preview">
                      <Activity label="Run will use" value={validation.total > 0 ? 'Current draft data' : savedCustomTemplate ? 'Saved draft data' : 'No validated draft yet'} />
                      <Activity label="Template data" value={`${modalPreviewTemplate.datasetSize.toLocaleString()} examples`} />
                      <Activity label="Custom data" value={`${validation.total} examples`} />
                      <Activity label="Training set sent to Kaggle" value={`${modalPreviewExamples.length.toLocaleString()} examples`} />
                      <Activity label="Preview source" value={googleDrive?.configured ? 'Google Drive linked draft' : 'Manual draft preview'} />
                      <div className="preview-table">
                        {modalPreviewExamples.slice(0, 5).map((example, index) => (
                          <div key={`${example.instruction}-${index}`}><strong>{example.instruction}</strong><span>{example.response}</span></div>
                        ))}
                      </div>
                    </Panel>
                  </div>
                </div>
              </div>
            )}
            <div className="step-actions">
              <button onClick={() => goToSection('models')}>Back to Models</button>
              <button className="primary" onClick={() => goToSection('config')} disabled={!hasTemplateSelection}>Continue to Config</button>
            </div>
          </div>
        )}

        {section === 'config' && (
          <div className="split">
            <Panel icon={<Settings />} title="Fine-tuning Configuration">
              <div className="segmented">
                {(['LoRA', 'QLoRA', 'Full'] as Technique[]).map((item) => (
                  <button className={technique === item ? 'active' : ''} onClick={() => setTechnique((current) => current === item ? 'LoRA' : item)} key={item}>
                    {technique === item ? `Selected: ${item}` : item}
                  </button>
                ))}
              </div>
              <label className="field">Epochs <input type="range" min="1" max="5" value={epochs} onChange={(event) => setEpochs(Number(event.target.value))} /><b>{epochs}</b></label>
              <div className="segmented">
                {([
                  { id: 'gpu', label: 'GPU' },
                  { id: 'tpu', label: 'TPU' },
                  { id: 'cpu', label: 'CPU' },
                ] as const).map((item) => (
                  <button className={computeTarget === item.id ? 'active' : ''} onClick={() => handleComputeTargetChange(item.id)} key={item.id}>
                    {computeTarget === item.id ? `Selected: ${item.label}` : item.label}
                  </button>
                ))}
              </div>
              <div className="segmented">
                {(
                  computeTarget === 'gpu'
                    ? [
                        { id: 'NvidiaTeslaP100', label: 'P100' },
                        { id: 'NvidiaTeslaT4', label: 'T4' },
                        { id: 'NvidiaTeslaT4Highmem', label: 'T4 Highmem' },
                        { id: 'NvidiaTeslaA100', label: 'A100' },
                        { id: 'NvidiaL4', label: 'L4' },
                        { id: 'NvidiaL4X1', label: 'L4 x1' },
                        { id: 'NvidiaH100', label: 'H100' },
                        { id: 'NvidiaRtxPro6000', label: 'RTX Pro 6000' },
                      ]
                    : computeTarget === 'tpu'
                    ? [
                        { id: 'TpuV38', label: 'TPU v3-8' },
                        { id: 'Tpu1VmV38', label: 'TPU VM v3-8' },
                        { id: 'TpuV5E8', label: 'TPU v5e-8' },
                        { id: 'TpuV6E8', label: 'TPU v6e-8' },
                      ]
                    : []
                ).map((item) => (
                  <button className={hyperparameters.accelerator === item.id ? 'active' : ''} onClick={() => updateHyperparameter('accelerator', item.id as Hyperparameters['accelerator'])} key={item.id}>
                    {hyperparameters.accelerator === item.id ? `Selected: ${item.label}` : item.label}
                  </button>
                ))}
              </div>
              <div className="segmented">
                <button className={!continueTraining ? 'active' : ''} onClick={() => setContinueTraining(false)}>
                  {!continueTraining ? 'Selected: Single session' : 'Single session'}
                </button>
                <button className={continueTraining ? 'active' : ''} onClick={() => setContinueTraining(true)}>
                  {continueTraining ? 'Selected: Continue training' : 'Continue training'}
                </button>
              </div>
              <div className="segmented">
                <button className={autoTune ? 'active' : ''} onClick={() => setAutoTune(true)}>
                  {autoTune ? 'Selected: Auto defaults' : 'Auto defaults'}
                </button>
                <button className={!autoTune ? 'active' : ''} onClick={() => { setAutoTune(false); setCustomHyperparameters(autoHyperparameters) }}>
                  {!autoTune ? 'Selected: Custom tune' : 'Custom tune'}
                </button>
              </div>
              <button className="ghost" onClick={() => setAdvancedOpen(!advancedOpen)}>Advanced options</button>
              {advancedOpen && (
                <div className="advanced-grid">
                  <label>Learning rate<input value={hyperparameters.learningRate} onChange={(event) => updateHyperparameter('learningRate', event.target.value)} /></label>
                  <label>Batch size<input type="number" value={hyperparameters.batchSize} min={1} onChange={(event) => updateHyperparameter('batchSize', Number(event.target.value))} /></label>
                  <label>Warmup steps<input type="number" value={hyperparameters.warmupSteps} min={0} onChange={(event) => updateHyperparameter('warmupSteps', Number(event.target.value))} /></label>
                  <label>Grad accumulation<input type="number" value={hyperparameters.gradientAccumulation} min={1} onChange={(event) => updateHyperparameter('gradientAccumulation', Number(event.target.value))} /></label>
                  <label>Max sequence length<input type="number" value={hyperparameters.maxSequenceLength} min={128} step={128} onChange={(event) => updateHyperparameter('maxSequenceLength', Number(event.target.value))} /></label>
                  <label>Weight decay<input type="number" value={hyperparameters.weightDecay} min={0} step={0.001} onChange={(event) => updateHyperparameter('weightDecay', Number(event.target.value))} /></label>
                  <label>Save steps<input type="number" value={hyperparameters.saveSteps} min={1} onChange={(event) => updateHyperparameter('saveSteps', Number(event.target.value))} /></label>
                  <label>Eval steps<input type="number" value={hyperparameters.evalSteps} min={1} onChange={(event) => updateHyperparameter('evalSteps', Number(event.target.value))} /></label>
                  <label>Optimizer<select value={hyperparameters.optimizer} onChange={(event) => updateHyperparameter('optimizer', event.target.value as Hyperparameters['optimizer'])}><option value="paged_adamw_8bit">paged_adamw_8bit</option><option value="adamw_torch">adamw_torch</option><option value="adafactor">adafactor</option></select></label>
                  <label>Scheduler<select value={hyperparameters.lrScheduler} onChange={(event) => updateHyperparameter('lrScheduler', event.target.value as Hyperparameters['lrScheduler'])}><option value="cosine">cosine</option><option value="linear">linear</option><option value="constant">constant</option></select></label>
                  <label>Precision<select value={hyperparameters.precision} onChange={(event) => updateHyperparameter('precision', event.target.value as Hyperparameters['precision'])}><option value="fp16">fp16</option><option value="bf16">bf16</option><option value="fp32">fp32</option></select></label>
                  <label className="toggle-field">Gradient checkpointing<input type="checkbox" checked={hyperparameters.gradientCheckpointing} onChange={(event) => updateHyperparameter('gradientCheckpointing', event.target.checked)} /></label>
                  {technique !== 'Full' && (
                    <>
                      <label>LoRA rank<input type="number" value={hyperparameters.loraRank} min={1} onChange={(event) => updateHyperparameter('loraRank', Number(event.target.value))} /></label>
                      <label>LoRA alpha<input type="number" value={hyperparameters.loraAlpha} min={1} onChange={(event) => updateHyperparameter('loraAlpha', Number(event.target.value))} /></label>
                      <label>LoRA dropout<input type="number" value={hyperparameters.loraDropout} min={0} max={1} step={0.01} onChange={(event) => updateHyperparameter('loraDropout', Number(event.target.value))} /></label>
                    </>
                  )}
                  <button onClick={() => setCustomHyperparameters(autoHyperparameters)}>Reset to auto values</button>
                </div>
              )}
            </Panel>
            <Panel icon={<Code2 />} title="Generated Kaggle Script">
              <Activity label="Learning rate" value={hyperparameters.learningRate} />
              <Activity label="Batch size" value={String(hyperparameters.batchSize)} />
              <Activity label="Compute target" value={hyperparameters.computeTarget.toUpperCase()} />
              <Activity label="Session mode" value={hyperparameters.continueTraining ? 'Continue from checkpoints' : 'Single session'} />
              <Activity label="Accelerator" value={hyperparameters.computeTarget === 'cpu' ? 'CPU only' : hyperparameters.accelerator} />
              <Activity label="Selected model" value={selectedModel?.name ?? 'Not selected'} />
              <Activity label="Selected data" value={selectedDataTemplate?.name ?? 'Not selected'} />
              <Activity label="Estimated runtime" value={estimatedRuntimeHours > 0 ? `${estimatedRuntimeHours} hr` : 'Pending selections'} />
              {estimatedRuntimeHours > 9 && !hyperparameters.continueTraining && <p className="warning">Estimated runtime exceeds Kaggle's 9-hour limit. Enable Continue training to checkpoint and resume.</p>}
              <pre>{generatedScript}</pre>
              <div className="step-actions">
                <button onClick={() => goToSection('templates')}>Back to Data</button>
                <button className="primary" disabled={credentials !== 'verified' || !selectedModel || !selectedDataTemplate || isStartingTraining} onClick={startTraining}><Play size={16} />{isStartingTraining ? 'Submitting to Kaggle...' : 'Start training'}</button>
              </div>
            </Panel>
          </div>
        )}

        {section === 'training' && (
          <Panel icon={<Cloud />} title="Training Progress">
            {!job && <button className="primary" disabled={credentials !== 'verified' || isStartingTraining} onClick={startTraining}><Play size={16} />{isStartingTraining ? 'Submitting to Kaggle...' : 'Create Kaggle job'}</button>}
            {job && (
              <div className="training">
                <div className="progress"><span style={{ width: `${job.progress}%` }} /></div>
                <div className="metrics">
                  <Stat label="Status" value={job.status} />
                  <Stat label="Epoch" value={`${job.epoch}/${job.hyperparameters.epochs}`} />
                  <Stat label="Step" value={String(job.step)} />
                  <Stat label="Train loss" value={hasActualTrainingMetrics ? String(job.trainLoss) : 'Pending'} />
                  <Stat label="Val loss" value={hasActualTrainingMetrics ? String(job.validationLoss) : 'Pending'} />
                  <Stat label="GPU memory" value={job.gpuMemory} />
                </div>
                {isStartingTraining && <p className="info">Submitting dataset bundle and notebook to Kaggle. This can take 20-40 seconds before Kaggle returns a kernel reference.</p>}
                <Activity label="Kaggle kernel" value={job.kaggleKernelRef || 'Pending submission'} />
                <Activity label="Kaggle status" value={job.kaggleStatusRaw || job.eta} />
                {job.kaggleKernelRef && job.status !== 'completed' && job.status !== 'stopped' && (
                  <button onClick={() => void pollKaggleStatus(job.id)}>Refresh Kaggle status</button>
                )}
                <button className="danger" onClick={() => void stopTraining(job)}><Square size={16} />Stop training</button>
              </div>
            )}
            <div className="step-actions">
              <button onClick={() => goToSection('config')}>Back to Config</button>
              <button className="primary" onClick={() => goToSection('results')} disabled={!canOpenResults}>Continue to Results</button>
            </div>
          </Panel>
        )}

        {section === 'results' && (
          <div className="split">
            <Panel icon={<Download />} title="Model Downloads">
              <p>Kaggle output is downloaded only when you request it. Completed runs stay on Kaggle until you pull artifacts into this workspace.</p>
              {job?.status === 'completed' && (
                <button className="primary" onClick={() => void downloadCurrentJobOutput()} disabled={downloadState === 'downloading'}>
                  <Download size={16} />{downloadState === 'downloading' ? 'Downloading from Kaggle...' : artifactsDownloaded ? 'Refresh Kaggle output' : 'Download Kaggle output'}
                </button>
              )}
              {(job?.downloadArtifacts ?? []).map((artifact) => {
                const ready = artifact.size !== 'Available after download' || Boolean(artifact.path)
                return <DownloadRow key={`${artifact.label}-${artifact.path ?? artifact.size}`} label={artifact.label} size={artifact.size} ready={ready} fileReady={Boolean(artifact.path)} onDownload={() => void handleArtifactDownload(artifact)} disabled={!job || job.status !== 'completed' || downloadState === 'downloading'} />
              })}
              <Activity label="Base model" value={job?.modelName ?? selectedModel?.name ?? 'Not selected'} />
              <Activity label="Final loss" value={job && hasActualTrainingMetrics ? String(job.trainLoss) : 'Pending until output download'} />
              <Activity label="Kaggle dataset" value={job?.kaggleDatasetRef || 'Pending'} />
              <Activity label="Kaggle kernel" value={job?.kaggleKernelRef || 'Pending'} />
              {job?.kaggleKernelRef && <a className="inline-link" href={`https://www.kaggle.com/code/${job.kaggleKernelRef}`} target="_blank" rel="noreferrer">Open Kaggle run</a>}
            </Panel>
            <Panel icon={<ActivityIcon />} title="Before / After Performance">
              <div className="metrics">
                <Stat label="Before loss" value={baselineLoss} />
                <Stat label="After train loss" value={job?.status === 'completed' && hasActualTrainingMetrics ? String(job.trainLoss) : 'Pending'} />
                <Stat label="After val loss" value={job?.status === 'completed' && hasActualTrainingMetrics ? String(job.validationLoss) : 'Pending'} />
              </div>
              <Activity label="Before perplexity" value={baselinePerplexity} />
              <Activity label="Examples trained" value={job ? job.datasetTotal.toLocaleString() : 'Pending'} />
              <Activity label="Epoch reached" value={job ? `${job.epoch}/${job.hyperparameters.epochs}` : 'Pending'} />
              <Activity label="Progress" value={job ? `${job.progress}%` : 'Pending'} />
            </Panel>
            <Panel icon={<Clipboard />} title="Technique Report">
              <pre>{report || 'Run a training job to generate the report.'}</pre>
              <div className="tabs">{Object.keys(snippets).map((key) => <button className={snippetTab === key ? 'active' : ''} key={key} onClick={() => setSnippetTab(key as keyof typeof snippets)}>{key}</button>)}</div>
              <pre>{snippets[snippetTab]}</pre>
            </Panel>
            <Panel icon={<Database />} title="Version Manager">
              {historyJobs.map((item) => (
                <div className="version-row" key={item.id}>
                  <div>
                    <strong>{item.modelName}</strong>
                    <span>{item.templateName} • {item.technique} • {item.createdAt.slice(0, 10)}</span>
                  </div>
                  <div className="version-actions">
                    <button onClick={() => { setJob(item); setSection('results') }}>View</button>
                    <button className="danger" onClick={() => void removeJob(item.id)}>Delete</button>
                  </div>
                </div>
              ))}
              {historyJobs.length === 0 && <p>No saved model versions yet.</p>}
            </Panel>
          </div>
        )}

        {section === 'settings' && (
          <div className="settings-stack">
            <section className="settings-hero">
              <div>
                <h2>Provider Connections</h2>
                <p>Manage the credentials this app uses for model search and Kaggle execution. Secrets stay in the local runtime or browser session depending on provider.</p>
              </div>
              <div className="settings-hero-pills">
                <span className={credentials === 'verified' ? 'pill ok' : 'pill warn'}><KeyRound size={15} />{credentials === 'verified' ? `Kaggle connected${kaggleUsername ? `: ${kaggleUsername}` : ''}` : 'Kaggle not connected'}</span>
                <span className={userTokenEnabled ? 'pill ok' : 'pill'}><BrainCircuit size={15} />{userTokenEnabled ? 'Custom HF token' : 'Using app HF token'}</span>
                <span className={googleDrive?.configured ? 'pill ok' : 'pill'}><Cloud size={15} />{googleDrive?.configured ? 'Google Drive linked' : 'Google Drive optional'}</span>
              </div>
            </section>

            <div className="settings-layout">
              <Panel icon={<KeyRound />} title="Kaggle Connection">
                <div className="connector-card">
                  <div className="connector-head">
                    <div>
                      <strong>Execution Provider</strong>
                      <p>FineTuna submits datasets and kernels through the Kaggle CLI from the backend.</p>
                    </div>
                    <span className={credentials === 'verified' ? 'pill ok' : 'pill warn'}>
                      {credentials === 'verified' ? 'Ready to submit jobs' : 'Needs credentials'}
                    </span>
                  </div>

                  <div className="settings-subcard">
                    <h3>Kaggle OAuth Login</h3>
                    <div className="settings-actions">
                      <button className="primary" onClick={() => void beginKaggleOAuthLogin()}>Start OAuth login</button>
                      <button className="danger" onClick={() => void disconnectKaggleOAuth()}>Disconnect OAuth</button>
                    </div>
                    {kaggleOAuth?.session && kaggleOAuth.session.status === 'awaiting_code' && (
                      <div className="oauth-box">
                        <strong>Waiting for Kaggle verification</strong>
                        <p>After you finish the Kaggle sign-in in the new tab, paste the verification code here.</p>
                        <label className="settings-field">Verification code<input value={kaggleOAuthCode} onChange={(event) => setKaggleOAuthCode(event.target.value)} placeholder="Paste code from Kaggle" /></label>
                        <div className="settings-actions">
                          <button className="primary" onClick={() => void submitKaggleOAuthCode()}>Confirm code</button>
                          <span className="pill">{kaggleOAuth.session.status}</span>
                        </div>
                      </div>
                    )}
                    {kaggleOAuth?.oauth.configured && <span className="pill ok">OAuth connected{` `}{kaggleOAuth.oauth.username ? `for ${kaggleOAuth.oauth.username}` : ''}</span>}
                  </div>

                  <div className="settings-columns">
                    <div className="settings-subcard">
                      <h3>Quick Connect</h3>
                      <p>Use your Kaggle username and API key directly. This is the fastest working path for backend submissions.</p>
                      <div className="settings-form-grid">
                        <label className="settings-field">Username<input value={kaggleUsernameDraft} onChange={(event) => setKaggleUsernameDraft(event.target.value)} placeholder="Kaggle username" /></label>
                        <label className="settings-field">API key<input type="password" value={kaggleKeyDraft} onChange={(event) => setKaggleKeyDraft(event.target.value)} placeholder="Kaggle API key" /></label>
                      </div>
                      <div className="settings-actions">
                        <button className="primary" onClick={() => void saveKaggleCredentialsDraft()}>Save credentials</button>
                      </div>
                    </div>
                  </div>

                  <div className="settings-checklist">
                    <div><strong>1.</strong><span>Choose either OAuth login or username and API key.</span></div>
                    <div><strong>2.</strong><span>Connect Kaggle once in Settings.</span></div>
                    <div><strong>3.</strong><span>Launch jobs from the training page.</span></div>
                  </div>
                </div>
              </Panel>

              <Panel icon={<BrainCircuit />} title="Hugging Face Access">
                <div className="connector-card">
                  <div className="connector-head">
                    <div>
                      <strong>Model Catalog Access</strong>
                      <p>Add your own Hugging Face token if you need gated or private model cards during search.</p>
                    </div>
                    <span className={userTokenEnabled ? 'pill ok' : 'pill'}>{userTokenEnabled ? 'User token enabled' : 'App token in use'}</span>
                  </div>

                  <div className="settings-subcard">
                    <h3>Session Token</h3>
                    <p>The token stays in this browser session and is only sent to this app backend for Hugging Face model lookup.</p>
                    <input className="token-input" type="password" placeholder="hf_..." defaultValue={userHuggingFaceToken} onBlur={(event) => saveUserHuggingFaceToken(event.target.value)} />
                    <div className="settings-actions">
                      <button onClick={() => saveUserHuggingFaceToken('')}>Clear token</button>
                      <button className="primary" onClick={() => loadHuggingFaceModels()} disabled={huggingFaceLoading}>{huggingFaceLoading ? 'Loading...' : 'Reload models'}</button>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel icon={<Cloud />} title="Google Drive">
                <div className="connector-card">
                  <div className="connector-head">
                    <div>
                      <strong>Cloud Document Source</strong>
                      <p>Connect Google Drive so training source documents can be selected from the user&apos;s cloud instead of uploaded into Supabase.</p>
                    </div>
                    <span className={googleDrive?.configured ? 'pill ok' : 'pill warn'}>
                      {googleDrive?.configured ? 'Connected' : 'Not connected'}
                    </span>
                  </div>

                  <div className="settings-subcard">
                    <h3>Google Drive OAuth</h3>
                    <p>FineTuna stores encrypted Google Drive connection data and document metadata only. The raw documents remain in Drive until we build the ingestion worker.</p>
                    <div className="settings-actions">
                      <button className="primary" onClick={() => void connectGoogleDrive()}>
                        {googleDrive?.configured ? 'Reconnect Google Drive' : 'Connect Google Drive'}
                      </button>
                      <button className="danger" onClick={() => void disconnectGoogleDriveAccount()}>Disconnect</button>
                    </div>
                    <span className={googleDrive?.configured ? 'pill ok' : 'pill'}>
                      {googleDrive?.configured ? `${googleDrive.displayName || 'Drive account'}${googleDrive.email ? ` (${googleDrive.email})` : ''}` : 'No Google Drive account linked'}
                    </span>
                  </div>
                </div>
              </Panel>
            </div>
            <div className="step-actions">
              <button onClick={() => setSection('dashboard')}>Back to Dashboard</button>
              <button className="primary" onClick={() => goToSection('models')} disabled={!connectorsReady}>Continue to Models</button>
            </div>
          </div>
        )}

        {section === 'help' && (
          <div className="cards template-grid">
            {['Connect Kaggle in Settings.', 'Choose a base model and domain template.', 'Validate optional CSV, JSON, or JSONL data.', 'Review LoRA or QLoRA defaults.', 'Start the Kaggle job and watch metrics.', 'Download adapters and deployment snippets.'].map((item, index) => (
              <article className="card" key={item}><h2>{index + 1}. {item}</h2><p>Each step maps directly to the PRD acceptance flow for the MVP.</p></article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className="panel"><div className="panel-title">{icon}<h2>{title}</h2></div>{children}</section>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div>
}

function Activity({ label, value }: { label: string; value: string }) {
  return <div className="activity"><span>{label}</span><strong>{value}</strong></div>
}

function DownloadRow({ label, size, ready, fileReady, disabled, onDownload }: { label: string; size: string; ready: boolean; fileReady: boolean; disabled: boolean; onDownload: () => void }) {
  return <div className="download-row"><span>{label}</span><strong>{ready ? size : 'On Kaggle'}</strong><button onClick={onDownload} disabled={disabled}><Download size={15} />{fileReady ? 'Save file' : ready ? 'Refresh' : 'Download'}</button></div>
}

function Notice({ validation }: { validation: ReturnType<typeof validateDataset> }) {
  return <div className="notices">{validation.errors.map((error) => <p className="error" key={error}>{error}</p>)}{validation.warnings.map((warning) => <p className="warning" key={warning}>{warning}</p>)}{validation.valid && validation.total > 0 && <p className="success">Dataset format accepted.</p>}</div>
}

function titleFor(section: Section) {
  return {
    dashboard: 'Guided Setup',
    models: 'Model Selection',
    templates: 'Templates and Dataset',
    config: 'Fine-tuning Setup',
    training: 'Kaggle Execution',
    results: 'Results and Downloads',
    settings: 'Provider Connections',
    help: 'Help and Documentation',
  }[section]
}

function matchesParameterBucket(parameters: string, bucket: string) {
  const match = parameters.match(/(\d+(?:\.\d+)?)([BM])/)
  if (!match) return false
  const value = Number(match[1]) * (match[2] === 'M' ? 0.001 : 1)
  if (bucket === 'Tiny <=1B') return value <= 1
  if (bucket === 'Small 1B-2B') return value > 1 && value <= 2
  if (bucket === 'Compact 2B-4B') return value > 2 && value <= 4
  if (bucket === 'Mid 4B-7B') return value > 4 && value <= 7
  if (bucket === 'Upper mid 7B-13B') return value > 7 && value <= 13
  if (bucket === 'Large 13B-34B') return value > 13 && value <= 34
  if (bucket === 'XL 34B+') return value > 34
  return true
}

function matchesVramBucket(vram: string, bucket: string) {
  if (bucket === 'Check model card') return /check model card/i.test(vram)
  const match = vram.match(/(\d+(?:\.\d+)?)/)
  if (!match) return false
  const value = Number(match[1])
  if (bucket === '<=4 GB') return value <= 4
  if (bucket === '4-8 GB') return value > 4 && value <= 8
  if (bucket === '8-12 GB') return value > 8 && value <= 12
  if (bucket === '12-16 GB') return value > 12 && value <= 16
  if (bucket === '16-24 GB') return value > 16 && value <= 24
  if (bucket === '24-40 GB') return value > 24 && value < 40
  if (bucket === '40 GB+') return value >= 40
  return true
}

function matchesActivityBucket(dateValue: string | undefined, bucket: string) {
  if (!dateValue) return false
  const released = new Date(dateValue)
  const now = new Date()
  const ageDays = (now.getTime() - released.getTime()) / 86_400_000
  if (bucket === 'Updated last week') return ageDays <= 7
  if (bucket === 'Updated last month') return ageDays <= 30
  if (bucket === 'Updated last 90 days') return ageDays <= 90
  if (bucket === 'Updated last 6 months') return ageDays <= 183
  if (bucket === 'Updated last year') return ageDays <= 365
  if (bucket === 'Older than a year') return ageDays > 365
  return true
}

function dedupeModelCards(modelCards: ModelCard[]) {
  const seen = new Set<string>()
  return modelCards.filter((model) => {
    if (seen.has(model.id)) return false
    seen.add(model.id)
    return true
  })
}

function mostFrequent(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'None'
}

function metricFromReport(report: string, label: string, fallback: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = report.match(new RegExp(`${escapedLabel}:\\s*([^\\n]+)`, 'i'))
  const value = Number(match?.[1])
  return Number.isFinite(value) ? value.toFixed(3) : fallback
}

function hasRealTrainingReport(job: StoredJob | null) {
  return Boolean(job?.report?.includes('FineTuna real training run'))
}

function readSavedCustomTemplate(): DomainTemplate | null {
  try {
    const raw = window.localStorage.getItem(customTemplateStorageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DomainTemplate> & { examples?: TrainingExample[] }
    if (!parsed || parsed.id !== 'custom' || !Array.isArray(parsed.examples)) return null
    return {
      id: 'custom',
      ...parsed,
      name: parsed.name ?? 'Custom Template',
      description: parsed.description ?? 'User-defined template draft.',
      source: parsed.source ?? 'Manual template data',
      datasetSize: Array.isArray(parsed.examples) ? parsed.examples.length : 0,
      downloads: 0,
      rating: 0,
      examples: parsed.examples,
    }
  } catch {
    return null
  }
}

function persistCustomTemplate(template: DomainTemplate | null) {
  try {
    if (!template) {
      window.localStorage.removeItem(customTemplateStorageKey)
      return
    }
    window.localStorage.setItem(customTemplateStorageKey, JSON.stringify(template))
  } catch {}
}

function stringifyDatasetExamples(examples: TrainingExample[]) {
  if (examples.length === 0) return sampleUpload
  return [
    'instruction,response',
    ...examples.map((example) => `${escapeCsv(example.instruction)},${escapeCsv(example.response)}`),
  ].join('\n')
}

function escapeCsv(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function formatGoogleDriveSetupError(message: string) {
  if (/GOOGLE_DRIVE_CLIENT_ID is not configured|GOOGLE_DRIVE_CLIENT_SECRET is not configured/i.test(message)) {
    return 'Google Drive OAuth is not configured for this deployment yet. Add the Google Drive client ID and client secret in the deployment environment variables.'
  }
  return message
}

function renderOauthPopup(popup: Window, message: string, isError: boolean) {
  const safeMessage = escapeHtml(message)
  popup.document.open()
  popup.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>FineTuna Google Drive</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.5; color: #111827; }
      .box { border: 1px solid ${isError ? '#fecaca' : '#dbeafe'}; background: ${isError ? '#fff1f2' : '#eff6ff'}; color: ${isError ? '#991b1b' : '#1d4ed8'}; border-radius: 10px; padding: 16px; }
      button { margin-top: 16px; border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="box">
      <strong>FineTuna Google Drive</strong>
      <p>${safeMessage}</p>
      ${isError ? '<p>Keep this window open to review the error, or close it and fix the deployment configuration.</p>' : ''}
    </div>
    <button onclick="window.close()">Close</button>
  </body>
</html>`)
  popup.document.close()
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export default App
