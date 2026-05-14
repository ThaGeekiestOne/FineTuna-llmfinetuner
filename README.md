# FineTuna

FineTuna is a guided web app for fine-tuning open-source language models without managing GPU infrastructure directly. It helps a user choose a base model, prepare or select training data, configure LoRA/QLoRA/full fine-tuning settings, launch the job on Kaggle, monitor progress, and download the trained model artifacts when the run is complete.

## What It Does

FineTuna turns the fine-tuning workflow into a step-by-step dashboard:

1. Sign in to a workspace.
2. Connect the required providers.
3. Choose a base model from the Hugging Face catalog.
4. Select or create a dataset template.
5. Configure training settings, accelerator choice, precision, LoRA parameters, and checkpoint behavior.
6. Submit the training job to Kaggle.
7. Track queued/running/completed status.
8. Download artifacts only when the user explicitly requests them.
9. Review before/after performance metrics and saved run history.

The goal is to make small-model fine-tuning usable from a browser while keeping expensive compute on free or user-owned provider resources.

## Main Features

- Guided setup flow so users do not jump randomly between model, data, config, training, and results pages.
- Hugging Face model search with filters for architecture, parameter size, VRAM, and activity.
- Built-in dataset templates plus a custom "My Data" draft area.
- Overlay-based template creation and editing.
- Kaggle execution pipeline that creates a dataset package, pushes a notebook/script, requests the selected accelerator, and tracks the run.
- GPU/TPU/CPU configuration controls with explicit accelerator selection.
- Safer Kaggle output handling: completed runs stay on Kaggle until the user clicks the output download button.
- Model artifact downloads for adapter files, merged model output, and reports.
- Before/after performance panel using metrics written by the training run.
- Version history for previous training jobs.
- Google Drive OAuth connection for user-owned Drive access.
- Supabase-backed auth/data support with local fallback behavior for development.

## Training Outputs

When a Kaggle run succeeds, FineTuna can produce:

- Adapter files for LoRA/QLoRA runs.
- Merged model exports when the merge step succeeds.
- Full model files for full fine-tuning runs.
- A training summary JSON file.
- A human-readable training report.
- Baseline and post-training loss/perplexity metrics.

FineTuna does not automatically pull all Kaggle outputs after completion. This is intentional to avoid bandwidth spikes and accidental downloads of large or unwanted files.

## Provider Roles

- Supabase handles user authentication and persistent app data when configured.
- Kaggle runs the actual fine-tuning job on the user's available accelerator quota.
- Hugging Face supplies model catalog search and base model IDs.
- Google Drive OAuth lets users connect their own Drive account.
- Resend can be used through Supabase SMTP for transactional auth emails if confirmation emails are enabled.

## Privacy And Safety

FineTuna is designed so secrets and runtime artifacts are not committed to source control:

- Environment files are ignored.
- Kaggle credentials are ignored.
- Runtime job output is ignored.
- Vercel local metadata is ignored.
- Downloaded training artifacts are ignored.

The app also avoids automatically downloading Kaggle outputs in the background. Output download is a user-triggered action.

## Current Deployment Shape

The app is a Vite React frontend with a single Vercel API catch-all function. Internally, API logic is organized into route handlers for auth, jobs, Kaggle, models, and Google Drive. The catch-all structure keeps the project within Vercel Hobby plan serverless function limits.

## Intended Users

FineTuna is for builders who want to fine-tune smaller open-source models for a specific domain but do not want to manually write notebook boilerplate, package datasets, track provider credentials, and manage output artifacts by hand.
