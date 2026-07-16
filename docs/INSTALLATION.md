# Installation and Update Guide

This guide covers a local single-machine installation, Docker Compose, and keeping
the `kbarni05/StremioSubMaker` fork synchronized with the upstream project.

## Choose a deployment

- **Local/filesystem:** simplest for one server or personal use; no Redis required.
- **Docker Compose with Redis:** recommended for a long-running public deployment or multiple instances.

## Local installation

### Requirements

- Node.js 22.12 or newer, or Node.js 24 (recommended; see `.nvmrc`)
- npm 10 or newer
- An OpenSubtitles developer API key
- An AI provider key if translation is enabled

### Linux and macOS

```bash
git clone https://github.com/kbarni05/StremioSubMaker.git
cd StremioSubMaker
npm ci
cp .env.example .env
```

Edit `.env` and set at least:

```env
OPENSUBTITLES_API_KEY=replace_me
STORAGE_TYPE=filesystem
PORT=7001
```

Start and verify:

```bash
npm start
curl --fail http://localhost:7001/health
```

### Windows PowerShell

```powershell
git clone https://github.com/kbarni05/StremioSubMaker.git
Set-Location StremioSubMaker
npm ci
Copy-Item .env.example .env
npm start
```

Before starting, edit `.env` as shown above. Verify with:

```powershell
Invoke-RestMethod http://localhost:7001/health
```

Open `http://localhost:7001` after the health endpoint reports `healthy`.

## Docker Compose

```bash
git clone https://github.com/kbarni05/StremioSubMaker.git
cd StremioSubMaker
cp .env.example .env
docker compose up -d --build
docker compose ps
docker compose logs -f submaker
```

The included Compose file runs Redis, persists application data and encryption
keys, and binds Redis only to localhost. See [DOCKER.md](DOCKER.md) for variants,
external Redis, and reverse-proxy notes.

## Update an installation

Always back up `.env`, `data/`, and the persistent encryption-key/Redis volumes
before an update. Losing the encryption key makes saved encrypted credentials
unreadable.

### Local Node installation

```bash
git pull --ff-only
npm ci
npm test
npm start
```

Restart the process through your process manager instead of launching a second
copy if you use systemd, PM2, or another supervisor.

### Docker Compose installation

```bash
git pull --ff-only
docker compose build --pull
docker compose up -d
docker compose ps
```

Confirm the deployment with `http://localhost:7001/health` and inspect
`docker compose logs --tail=100 submaker` if it is not healthy.

## Sync the GitHub fork with upstream

Run this only from a clean `main` branch. It refuses a non-fast-forward merge, so
local fork-specific changes are not silently overwritten.

```bash
git remote add upstream https://github.com/xtremexq/StremioSubMaker.git
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
```

If `upstream` already exists, skip the first command. If fast-forwarding is not
possible, create a branch and reconcile the changes in a pull request.

## Security checklist

- Never commit `.env`, API keys, Redis passwords, or generated encryption keys.
- Persist and back up the encryption key; all instances must share the same key.
- Use Redis for multiple instances and keep `REDIS_KEY_PREFIX` identical.
- Set `TRUST_PROXY` only to the actual number/range of trusted reverse proxies.
- Expose port 7001 through HTTPS for internet-facing deployments.
- Keep dependencies updated; CI and Dependabot check npm, Actions, and Docker.

## Troubleshooting

- `npm ci` fails: confirm Node with `node --version` and npm with `npm --version`.
- Health reports storage failure: check `STORAGE_TYPE`; filesystem mode needs writable `data/` and `.cache/` directories, Redis mode needs a reachable Redis instance.
- Port 7001 is occupied: change `PORT` in `.env` and update the Docker port mapping or reverse proxy.
- Configuration becomes unreadable after a move: restore the original encryption key.
