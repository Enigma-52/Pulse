# future-web

Product dashboard frontend for Pulse.

## Purpose

This app is the user-facing product UI used after Pulse is deployed, including:

- dashboard and service views
- traces, logs, metrics exploration
- detailed trace and service analysis screens

This app is used by one-command deploy (`deploy/docker-compose.yml`) as the `ui` service.

## Run

```bash
cd future-web
npm install
npm run dev
```

## Build

```bash
npm run build
```
