## Pulse


██████╗ ██╗   ██╗██╗     ███████╗███████╗
██╔══██╗██║   ██║██║     ██╔════╝██╔════╝
██████╔╝██║   ██║██║     ███████╗█████╗  
██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝  
██║     ╚██████╔╝███████╗███████║███████╗
╚═╝      ╚═════╝ ╚══════╝╚══════╝╚══════╝

Pulse is a lightweight, developer-first observability platform that gives early-stage teams production-grade traces, metrics, and logs without the usual complexity or infra overhead.

## Frontend apps

Pulse now has two separate frontend apps:

1. `frontend/` — public site for landing pages and documentation entry points.
2. `future-web/` — product dashboard UI used after Pulse is deployed/initialized.

### Run public frontend

```bash
cd frontend
npm install
npm run dev
```

### Run product dashboard frontend

```bash
cd future-web
npm install
npm run dev
```

## One-command deploy

```bash
cd deploy
./install.sh
```

This deploys the Pulse runtime stack and serves the product dashboard UI at `http://localhost:3301`.

## Docs

- Architecture: `docs/architecture.md`
- Feature breakdown: `docs/features.md`
- Local development: `docs/local-dev.md`
- Install inventory (what gets installed): `docs/install-includes.md`
