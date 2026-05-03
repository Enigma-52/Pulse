import { AlarmClockCheck, BarChart3, Binary, Gauge, Lock, Orbit, Radar, Route, ShieldCheck, Sparkles, Zap } from "lucide-react";

type IconType = typeof Sparkles;

export const navSections = [
  { id: "capabilities", label: "Capabilities" },
  { id: "workflow", label: "Workflow" },
  { id: "proof", label: "Proof" },
] as const;

export const heroStats = [
  { label: "Deploy", value: "Self-hosted in minutes" },
  { label: "Telemetry", value: "Traces, logs, metrics unified" },
  { label: "Incident Loop", value: "Symptom to source, one flow" },
] as const;

export const capabilities: Array<{ title: string; body: string; icon: IconType }> = [
  {
    title: "Request-first debugging",
    body: "Follow a real request path across services and see exactly where latency and failures accumulate.",
    icon: Route,
  },
  {
    title: "One operational narrative",
    body: "Traces, logs, and metrics stay in one context so teams stop jumping across disconnected tools.",
    icon: Orbit,
  },
  {
    title: "Fast interrogation",
    body: "Filter, pivot, and compare quickly with a UI shaped for incident response, not report generation.",
    icon: Radar,
  },
  {
    title: "Composable backend",
    body: "Ingestion, stream processing, storage, and query remain separated for cleaner reliability tuning.",
    icon: Binary,
  },
  {
    title: "Calm interface",
    body: "High contrast, clear hierarchy, and restrained motion keep attention on signal quality.",
    icon: Gauge,
  },
  {
    title: "Security posture",
    body: "Runs inside your boundary with a deployment model teams can reason about and control.",
    icon: Lock,
  },
] as const;

export const workflow = [
  {
    step: "01",
    title: "Instrument once",
    body: "Ship telemetry from your service without adding operational drag.",
    icon: Zap,
  },
  {
    step: "02",
    title: "Watch behavior live",
    body: "Track latency shifts, error spikes, and service drift in one surface.",
    icon: AlarmClockCheck,
  },
  {
    step: "03",
    title: "Resolve with confidence",
    body: "Go from symptom to source faster, with less guesswork and less context switching.",
    icon: ShieldCheck,
  },
] as const;

export const proofPoints = [
  {
    title: "Built for product velocity",
    body: "Teams can adopt it without spinning up a dedicated observability program.",
    icon: Sparkles,
  },
  {
    title: "Built for engineering rigor",
    body: "The architecture matches how reliable telemetry systems are actually operated.",
    icon: BarChart3,
  },
  {
    title: "Built for long-term fit",
    body: "Starts compact, expands cleanly, and avoids premature platform sprawl.",
    icon: ShieldCheck,
  },
] as const;
