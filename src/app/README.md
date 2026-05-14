# FineTuna App

React + Vite frontend with colocated Node-style API routes for auth, Kaggle orchestration, and Google Drive OAuth.

## Local

```bash
npm install
npm run dev
```

App URL:

```text
http://127.0.0.1:5175/
```

## Environment

Set these in `.env.local` for local work and in Vercel project env vars for deployment:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
FINETUNA_ENCRYPTION_KEY=
HUGGING_FACE_TOKEN=
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REDIRECT_URI=
```

Notes:

- `SUPABASE_URL` / `SUPABASE_ANON_KEY` are read by the server routes.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are used by the client.
- `GOOGLE_DRIVE_REDIRECT_URI` should be your final deployed callback URL in production, for example:
  `https://your-domain.example/api/drive/callback`

## Google Drive OAuth

The app uses one Google OAuth client for the whole deployment. Users sign into their own Google accounts through that client.

Required Google Cloud setup:

1. Enable `Google Drive API`.
2. Create an OAuth client of type `Web application`.
3. Add the callback URL to `Authorized redirect URIs`.
4. Copy the client ID and secret into env vars.

For local development, register:

```text
http://127.0.0.1:5175/api/drive/callback
```

For Vercel production, register your production domain callback:

```text
https://your-domain.example/api/drive/callback
```

## Vercel Deployment

Deploy this app with the Vercel project root set to `src/app`.

Recommended Vercel settings:

- Framework preset: `Vite`
- Root directory: `src/app`
- Build command: `npm run build`
- Output directory: `dist`

Set the same env vars in the Vercel project settings before the first production deploy.

If Google Drive popup shows a configuration error, the deployment is missing:

- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- or a matching redirect URI in Google Cloud

## Supabase Auth Email With Resend SMTP

Use Resend as Supabase's custom SMTP provider for signup confirmation, password reset, magic link, and email-change messages. These credentials are configured in the Supabase dashboard, not in this repository or Vercel env vars.

1. Create or open a Resend account.
2. Verify a sending domain in Resend if you want a real from-address such as `FineTuna <no-reply@your-domain.com>`.
3. Create a Resend API key.
4. Open Supabase Dashboard -> Authentication -> Emails -> SMTP Settings.
5. Enable custom SMTP and enter:

```text
Sender email: no-reply@your-domain.com
Sender name: FineTuna
Host: smtp.resend.com
Port: 465
Username: resend
Password: your Resend API key
Secure connection: enabled
```

6. Open Supabase Dashboard -> Authentication -> URL Configuration.
7. Set Site URL to your deployed app URL, for example `https://your-domain.example`.
8. Add redirect URLs for local and production:

```text
http://127.0.0.1:5175
https://your-domain.example
```

When email confirmation is enabled, signup returns a "check your inbox" message and the user signs in after confirming the email.
