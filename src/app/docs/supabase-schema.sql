create table if not exists public.training_jobs (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  model_name text not null,
  template_name text not null,
  technique text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null,
  progress integer not null default 0,
  epoch integer not null default 0,
  step integer not null default 0,
  train_loss double precision not null default 2.4,
  validation_loss double precision not null default 2.7,
  gpu_memory text not null default '0 / 16 GB',
  eta text not null default 'Waiting for Kaggle GPU',
  hyperparameters jsonb not null default '{}'::jsonb,
  dataset_total integer not null default 0,
  script text not null default '',
  report text not null default '',
  download_artifacts jsonb not null default '[]'::jsonb,
  kaggle_dataset_ref text not null default '',
  kaggle_kernel_ref text not null default '',
  kaggle_status_raw text not null default ''
);

create table if not exists public.provider_credentials (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table if not exists public.document_sources (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  external_id text not null,
  name text not null,
  mime_type text not null default '',
  size_bytes bigint not null default 0,
  modified_at timestamptz,
  web_view_link text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider, external_id)
);

alter table public.training_jobs enable row level security;
alter table public.provider_credentials enable row level security;
alter table public.document_sources enable row level security;

drop policy if exists "users_manage_their_training_jobs" on public.training_jobs;
create policy "users_manage_their_training_jobs"
on public.training_jobs
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users_manage_their_provider_credentials" on public.provider_credentials;
create policy "users_manage_their_provider_credentials"
on public.provider_credentials
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users_manage_their_document_sources" on public.document_sources;
create policy "users_manage_their_document_sources"
on public.document_sources
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
