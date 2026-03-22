# Deployment

This project should be deployed as two services:

1. `/meet` Next.js app on Vercel
2. `/voice-agent-server` on a host that supports long-lived WebSocket connections, such as Heroku or a DigitalOcean Droplet

That split is important. Vercel Functions do not support acting as a WebSocket server, so the voice backend should not be deployed on Vercel.

## Recommended Architecture

- Deploy the Next.js app in this repo to Vercel
- Deploy the voice WebSocket server from [`voice-agent-server`](./voice-agent-server) to Heroku or DigitalOcean
- Point `NEXT_PUBLIC_VOICE_AGENT_WS_URL` in Vercel to the public `wss://.../ws` URL of the voice server
- Keep Supabase and LiveKit as managed external services

## Before You Deploy

You should already have:

- a Supabase project
- a Supabase Storage bucket for uploaded documents
- the SQL from [`supabase/schema.sql`](./supabase/schema.sql) applied
- a LiveKit server or LiveKit Cloud project
- API keys for OpenAI, AssemblyAI, and ElevenLabs if you want the full voice pipeline

## Environment Variables

### Vercel: `/meet`

Set these in the Vercel project:

- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DOCUMENT_BUCKET`
- `NEXT_PUBLIC_CONN_DETAILS_ENDPOINT`
- `NEXT_PUBLIC_VOICE_AGENT_WS_URL`
- `NEXT_PUBLIC_SHOW_SETTINGS_MENU`
- `OPENAI_API_KEY`
- `ASSEMBLYAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`

Notes:

- `NEXT_PUBLIC_VOICE_AGENT_WS_URL` must be a public `wss://.../ws` URL in production
- do not expose `SUPABASE_SERVICE_ROLE_KEY` through any `NEXT_PUBLIC_*` variable

### Voice Server: `/voice-agent-server`

Set these on Heroku or DigitalOcean:

- `VOICE_AGENT_PORT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DOCUMENT_BUCKET`
- `OPENAI_API_KEY`
- `ASSEMBLYAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`

Notes:

- on Heroku or App Platform, `PORT` is usually provided by the platform automatically
- this code currently reads `VOICE_AGENT_PORT`, so map it to the platform port if needed

## Deploy `/meet` To Vercel

### Why Vercel Fits `/meet`

Vercel is a good fit for:

- the Next.js frontend
- API routes for document upload and ingestion
- connection-details token generation
- Supabase-backed persistence calls

Vercel is not a good fit for:

- the persistent voice WebSocket server

### Steps

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. In Vercel, import the repository as a new project.
3. Let Vercel detect Next.js automatically.
4. Set the project root to the repository root.
5. Add all required environment variables.
6. Deploy.
7. After the first deploy, add your production domain if needed.
8. Update `NEXT_PUBLIC_VOICE_AGENT_WS_URL` to the final public `wss://.../ws` URL of your voice server.
9. Redeploy so the browser bundle picks up the public WebSocket URL.

### Post-Deploy Checks

After Vercel deploys:

- room join should work
- `/api/connection-details` should return a token
- document upload should write file metadata and chunks into Supabase
- page refresh should restore the latest uploaded document state

## Deploy `/voice-agent-server` To Heroku

### Recommendation

Heroku is the simpler PaaS option if you want a managed WebSocket host without maintaining a VM.

### Important Repo Layout Note

Heroku deploys a single app root. Since this repo is a monorepo, the cleanest approach is one of these:

1. deploy `voice-agent-server` from a separate repo
2. deploy a subtree split of `voice-agent-server`
3. containerize the voice server and deploy that container

If you want the least friction, use a separate repo containing only `voice-agent-server`.

### Minimal Voice Server Package Requirements

Your deployed voice server app needs:

- `package.json` with a working `start` script
- `tsconfig.json`
- `src/*`
- lockfile if you want reproducible installs

For Heroku specifically, make sure the app starts with a `start` script, for example:

```json
{
  "scripts": {
    "start": "tsx src/index.ts"
  }
}
```

If you prefer a production build step, use:

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  }
}
```

### Steps

1. Put `voice-agent-server` in its own deployable repo or deployment artifact.
2. Create a Heroku app.
3. Set the Node version in `package.json` if you want to pin it.
4. Add the required config vars in Heroku.
5. Set `VOICE_AGENT_PORT` to `${PORT}` behavior in code or update the code to read `process.env.PORT` first.
6. Deploy the app.
7. Confirm the app responds on `/health`.
8. Use the app URL to build `wss://your-app.herokuapp.com/ws`.
9. Put that URL into Vercel as `NEXT_PUBLIC_VOICE_AGENT_WS_URL`.

### Recommended Port Handling

For Heroku, the safest server boot logic is:

```ts
const PORT = Number.parseInt(process.env.PORT ?? process.env.VOICE_AGENT_PORT ?? '8787', 10);
```

If you do not make that change, the app may not bind to the port Heroku expects.

### Post-Deploy Checks

- `https://your-app.herokuapp.com/health` returns JSON
- browser connects to `wss://your-app.herokuapp.com/ws?...`
- voice turns stream correctly
- document-grounded retrieval works after restarting the dyno

## Deploy `/voice-agent-server` To DigitalOcean

### Best Option

For this service, a DigitalOcean Droplet is the safer option than trying to force-fit a long-lived WebSocket server into a more constrained serverless setup.

### Recommended Stack

- Ubuntu Droplet
- Node.js 20 or newer
- `pnpm`
- `pm2`
- `nginx`
- Let’s Encrypt TLS

### Steps

1. Create a Droplet.
2. Point a subdomain such as `voice.yourdomain.com` at the Droplet.
3. SSH into the box.
4. Install Node.js and `pnpm`.
5. Clone the repo.
6. From the repo root, install dependencies with `pnpm install`.
7. Set environment variables on the server.
8. Start the voice server with PM2.
9. Put Nginx in front of it and proxy `/ws` and `/health`.
10. Add TLS so the public client uses `wss://voice.yourdomain.com/ws`.
11. Set `NEXT_PUBLIC_VOICE_AGENT_WS_URL=wss://voice.yourdomain.com/ws` in Vercel and redeploy.

### Example PM2 Command

From the repo root:

```bash
pm2 start "pnpm voice:server" --name meet-voice --cwd /path/to/repo
pm2 save
```

### Example Nginx Reverse Proxy

```nginx
server {
  server_name voice.yourdomain.com;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /ws {
    proxy_pass http://127.0.0.1:8787/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600;
  }
}
```

### Port Handling

On a Droplet, keeping `VOICE_AGENT_PORT=8787` is fine.

### Post-Deploy Checks

- `https://voice.yourdomain.com/health` returns JSON
- WebSocket handshake succeeds on `wss://voice.yourdomain.com/ws`
- voice and TTS work from the deployed Vercel frontend

## Recommended Production URLs

- app: `https://meet.yourdomain.com`
- voice websocket: `wss://voice.yourdomain.com/ws`

That keeps the browser-side configuration simple and avoids mixed-content issues.

## Deployment Order

Deploy in this order:

1. Supabase schema and bucket
2. LiveKit configuration
3. voice server on Heroku or DigitalOcean
4. Next.js app on Vercel
5. final `NEXT_PUBLIC_VOICE_AGENT_WS_URL` update in Vercel

## Production Validation Checklist

- Vercel app loads over HTTPS
- room join works
- LiveKit token endpoint works
- document upload succeeds
- Supabase `meet_documents` and `meet_document_chunks` populate
- page refresh restores latest uploaded document state
- voice websocket connects over `wss://`
- agent can summarize an uploaded PDF
- `meet_voice_turns` rows are written
- scene snapshots persist and reload if you use shared-screen highlights

## One Small Code Change I Recommend Before Production

Update the voice server port selection to prefer the platform port first:

```ts
const PORT = Number.parseInt(process.env.PORT ?? process.env.VOICE_AGENT_PORT ?? '8787', 10);
```

That will make Heroku and some managed hosts work more reliably.

## Sources

These deployment recommendations are based on the current platform docs and references:

- Vercel deployment docs: https://vercel.com/docs/deployments
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel WebSocket limitation: https://vercel.com/docs/limits/overview
- Vercel WebSocket KB: https://vercel.com/guides/do-vercel-serverless-functions-support-websocket-connections
- Heroku Node.js WebSockets: https://devcenter.heroku.com/articles/node-websockets
- DigitalOcean App Platform docs: https://docs.digitalocean.com/docs/app-platform
- DigitalOcean Node.js marketplace reference: https://docs.digitalocean.com/products/marketplace/catalog/nodejs/
