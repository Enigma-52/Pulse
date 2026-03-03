import express from "express";
import { createClient, createExpressMiddleware } from "@pulse/node";

const app = express();
app.use(express.json());

const pulseClient = createClient({
  ingestUrl: process.env.PULSE_INGEST_URL ?? "http://localhost:8081/v1/ingest",
  apiKey: process.env.PULSE_API_KEY ?? "dev-api-key",
  serviceName: "demo-backend-node",
  environment: process.env.NODE_ENV ?? "development"
});

app.use(createExpressMiddleware(pulseClient));

app.get("/ok", async (_req, res) => {
  await pulseClient.withSpan("ok_handler", {}, async () => {
    res.status(200).json({ status: "ok" });
  });
});

app.get("/slow", async (_req, res) => {
  await pulseClient.withSpan("slow_handler", {}, async () => {
    const delay = 100 + Math.random() * 700;
    await new Promise((resolve) => setTimeout(resolve, delay));
    res.status(200).json({ status: "slow", delay: Math.round(delay) });
  });
});

app.get("/error", async (_req, res) => {
  try {
    await pulseClient.withSpan("error_handler", {}, async () => {
      if (Math.random() < 0.5) {
        throw new Error("Simulated error");
      }
      res.status(200).json({ status: "sometimes-error" });
    });
  } catch (err) {
    pulseClient.log("error", "Request failed", { error: String(err) });
    res.status(500).json({ error: "Internal error (simulated)" });
  }
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Demo backend listening on http://localhost:${port}`);
});

