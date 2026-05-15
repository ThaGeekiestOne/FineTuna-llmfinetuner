# 🐟 FineTuna

**FineTuna** is a guided dashboard for fine-tuning open-source language models without manually managing notebooks, GPU setup, dataset packaging, or artifact downloads.

It helps a user move from **model selection → dataset setup → training configuration → Kaggle execution → results + downloads** in one clear flow.

---

## ✨ Product Preview

| 🧭 Main Dashboard | 📊 Results & Downloads |
| --- | --- |
| ![FineTuna main dashboard showing the guided setup flow, provider connection status, recent training activity, and before/after performance summary](docs/images/main-dashboard.png) | ![FineTuna results page showing model download buttons, Kaggle artifact status, before and after training metrics, and the generated technique report](docs/images/results-downloads.png) |

---

## 🚀 What FineTuna Does

FineTuna turns the model fine-tuning process into a structured browser workflow:

1. 🔐 **Sign in** to a workspace.
2. 🔌 **Connect providers** like Kaggle, Google Drive, Supabase, and Hugging Face.
3. 🧠 **Choose a base model** from the Hugging Face catalog.
4. 🗂️ **Select or create training data** using templates or custom drafts.
5. ⚙️ **Configure training** with LoRA, QLoRA, full fine-tuning, precision, batch size, and accelerator options.
6. ☁️ **Launch the run on Kaggle** using the selected GPU/TPU/CPU target.
7. 📡 **Track status** while the job is queued, running, or completed.
8. 📦 **Download outputs manually** only when the user clicks the artifact button.
9. 📈 **Compare before/after performance** with training metrics and reports.

The goal is simple: **make small-model fine-tuning approachable from a clean web interface while using free or user-owned compute resources.**

---

## 🧩 Core Features

- 🧭 **Guided flow:** prevents users from jumping randomly between setup steps.
- 🔎 **Model discovery:** Hugging Face model search with filters for architecture, size, VRAM, and activity.
- 🗃️ **Template system:** built-in datasets plus a separate **My Data** area for saved drafts.
- 📝 **Overlay editor:** create, edit, save, and remove templates without leaving the page.
- ☁️ **Kaggle pipeline:** packages datasets, generates the training script, pushes the notebook, and tracks execution.
- 🎛️ **Accelerator choice:** GPU, TPU, and CPU options with explicit Kaggle accelerator selection.
- 🧪 **Training methods:** LoRA, QLoRA, and full fine-tuning support.
- 📦 **Manual artifact downloads:** no automatic output pulling after Kaggle finishes.
- 📊 **Before/after metrics:** baseline and post-training loss/perplexity when available.
- 🕓 **Run history:** saved job versions, reports, and previous model runs.
- 🔐 **Provider auth:** Supabase auth, Kaggle credentials/OAuth flow, Google Drive OAuth, and optional Resend email support.

---

## 📦 Training Outputs

When a Kaggle run succeeds, FineTuna can produce:

- 🧩 **Adapter files** for LoRA/QLoRA runs.
- 🧬 **Merged model exports** when merge succeeds.
- 🧱 **Full model files** for full fine-tuning runs.
- 📄 **Training summary JSON** with structured metrics.
- 🧾 **Human-readable report** describing the run.
- 📈 **Baseline vs tuned metrics** such as loss and perplexity.

FineTuna intentionally does **not** auto-download Kaggle output after completion. This avoids bandwidth spikes and prevents unwanted files like checkpoints or callback state from being pulled unless the user asks for them.

---

## 🔌 Provider Roles

| Provider | Role |
| --- | --- |
| 🟢 **Supabase** | Authentication and persistent user/job data when configured |
| 🔵 **Kaggle** | Executes fine-tuning jobs using the user's available accelerator quota |
| 🤗 **Hugging Face** | Supplies model search and base model IDs |
| 🟨 **Google Drive** | Lets users connect their own Drive account |
| ✉️ **Resend** | Optional transactional email provider through Supabase SMTP |
| 🟩 **Netlify** | Hosts the frontend and serverless API function |

---

## 🔐 Privacy & Safety

FineTuna is designed to avoid pushing private files or large runtime artifacts:

- ✅ Environment files are ignored.
- ✅ Kaggle credentials are ignored.
- ✅ Runtime job output is ignored.
- ✅ Local deploy metadata is ignored.
- ✅ Downloaded model artifacts are ignored.
- ✅ Kaggle outputs are downloaded only after an explicit user click.

---

## 🏗️ Current Architecture

FineTuna is a **Vite + React** app deployed on Netlify with a single Netlify Function handling API traffic.

Internally, the API is organized into route handlers for:

- 🔐 Auth
- 🧠 Models
- 🧾 Jobs
- ☁️ Kaggle execution
- 🟨 Google Drive
- 📦 Artifact download

The Netlify function dispatches requests to internal route handlers while keeping backend code organized by feature area.

---

## 🎯 Intended Users

FineTuna is built for:

- Indie builders fine-tuning small models.
- Students experimenting with LoRA/QLoRA.
- Teams creating domain-specific assistants.
- Developers who want Kaggle-backed training without hand-writing notebook boilerplate.
- Users who want browser-first control over model selection, data setup, training, and downloads.

---

## 🐟 Why FineTuna

Fine-tuning should not require wiring together five dashboards, hand-editing notebook scripts, guessing GPU settings, and accidentally downloading huge outputs.

FineTuna keeps the workflow focused:

**choose the model, choose the data, configure the run, train on Kaggle, download only what you need.**
