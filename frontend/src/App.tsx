import type { ReactNode } from "react";
import { BrowserRouter, Link, NavLink, Route, Routes } from "react-router-dom";
import { ArrowRight, ChevronRight, Menu, Search, WandSparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { capabilities, heroStats, navSections, proofPoints, workflow } from "./content/siteContent";
import mintConfig from "../docs/mint.json";
import introMdx from "../docs/introduction.mdx?raw";
import quickstartMdx from "../docs/quickstart.mdx?raw";

const shellClass = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

const docsPages = [
  { slug: "introduction", title: "Introduction", category: "Start", body: introMdx },
  { slug: "quickstart", title: "Quickstart", category: "Start", body: quickstartMdx },
] as const;

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-foreground">
      <div className="aurora-bg" />
      <div className="grain-layer" />
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/46 backdrop-blur-2xl">
        <div className={`${shellClass} flex h-16 items-center gap-4`}>
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl border border-white/12 bg-white/6">
              <WandSparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="font-display text-sm tracking-[0.18em] uppercase text-white">Pulse</div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-white/42">Observability</div>
            </div>
          </Link>

          <nav className="ml-auto hidden items-center gap-7 text-sm text-white/66 md:flex">
            {navSections.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="transition hover:text-white">
                {item.label}
              </a>
            ))}
            <NavLink to="/docs" className={({ isActive }) => `transition hover:text-white ${isActive ? "text-white" : ""}`}>
              Docs
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3 md:ml-0">
            <Link to="/docs" className="hidden rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm text-white/84 transition hover:border-white/22 hover:bg-white/12 md:inline-flex">
              Open docs
            </Link>
            <a href="#capabilities" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/92">
              View product <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/10">
      <div className={`${shellClass} py-16 sm:py-20 lg:py-24`}>
        <div className="grid gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div className="reveal">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/72">
              <span className="h-1.5 w-1.5 rounded-full bg-white/75" />
              Built for high-pressure production teams
            </div>
            <h1 className="font-display mt-6 max-w-4xl text-5xl leading-[1.01] tracking-[-0.04em] text-balance text-white sm:text-6xl lg:text-7xl">
              The observability UI your team actually wants to use.
              <span className="block text-white/68">Dark. Precise. Incident-first.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[1.03rem] leading-8 text-white/68">
              Pulse turns telemetry into decisions fast. No dashboard clutter, no novelty motion, no noisy visual gimmicks. Just a clean command surface for debugging real systems.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link to="/docs" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/92">
                Read docs <ChevronRight className="h-4 w-4" />
              </Link>
              <a href="#workflow" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-5 py-3 text-sm font-semibold text-white/88 transition hover:border-white/24 hover:bg-white/12">
                See workflow
              </a>
            </div>
          </div>

          <div className="reveal reveal-delay-1 cinematic-panel rounded-[30px] p-6">
            <div className="mb-4 text-xs uppercase tracking-[0.2em] text-white/45">Live system posture</div>
            <div className="grid gap-3 md:grid-cols-3">
              {heroStats.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/12 bg-black/45 p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">{item.label}</div>
                  <div className="mt-2 text-sm font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/38">Error rate</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">0.14%</div>
                <div className="mt-4 h-16 border border-white/10 bg-[rgba(255,255,255,0.02)] p-2">
                  <div className="h-full w-full border border-dashed border-white/20" />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/38">P95 latency</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">182ms</div>
                <div className="mt-4 h-16 border border-white/10 bg-[rgba(255,255,255,0.02)] p-2">
                  <div className="h-full w-full border border-dashed border-white/20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Capabilities() {
  return (
    <section id="capabilities" className="border-t border-white/10">
      <div className={`${shellClass} py-20 sm:py-24`}>
        <div className="reveal max-w-2xl">
          <div className="text-xs uppercase tracking-[0.24em] text-white/44">Feature Grid</div>
          <h2 className="font-display mt-4 text-3xl tracking-[-0.04em] text-white sm:text-4xl">Bento layout, serious product narrative.</h2>
        </div>
        <div className="mt-12 bento-grid">
          {capabilities.map((item, idx) => (
            <article key={item.title} className={`feature-card bento-item-${idx + 1} reveal reveal-delay-${(idx % 3) + 1}`}>
              <div className="flex items-center justify-between">
                <item.icon className="h-5 w-5 text-white/68" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">Module {idx + 1}</span>
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/63">{item.body}</p>
              <div className="mt-6 h-24 rounded-xl border border-white/10 bg-black/45 p-2">
                <div className="h-full w-full border border-dashed border-white/15" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section id="workflow" className="border-t border-white/10">
      <div className={`${shellClass} py-20 sm:py-24`}>
        <div className="reveal max-w-2xl">
          <div className="text-xs uppercase tracking-[0.24em] text-white/44">Workflow</div>
          <h2 className="font-display mt-4 text-3xl tracking-[-0.04em] text-white sm:text-4xl">A three-step path from telemetry to action.</h2>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {workflow.map((item, idx) => (
            <div key={item.title} className={`cinematic-panel rounded-[24px] p-6 reveal reveal-delay-${(idx % 3) + 1}`}>
              <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-xs tracking-[0.16em] text-white/58">{item.step}</div>
              <item.icon className="h-5 w-5 text-white/72" />
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/62">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Proof() {
  return (
    <section id="proof" className="border-t border-white/10">
      <div className={`${shellClass} py-20 sm:py-24`}>
        <div className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr]">
          <div className="reveal">
            <div className="text-xs uppercase tracking-[0.24em] text-white/44">Why it sells</div>
            <h2 className="font-display mt-4 text-3xl tracking-[-0.04em] text-white sm:text-4xl">Shorter MTTR, lower tool fatigue, cleaner operational posture.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {proofPoints.map((item, idx) => (
              <div key={item.title} className={`feature-card reveal reveal-delay-${(idx % 3) + 1}`}>
                <item.icon className="h-5 w-5 text-white/68" />
                <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/62">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DocsLayout() {
  return (
    <div className={`${shellClass} py-10 sm:py-14`}>
      <div className="grid gap-8 lg:grid-cols-[0.3fr_0.7fr]">
        <aside className="glass-card rounded-[28px] p-5 lg:sticky lg:top-24 lg:h-fit">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/44">
            <Menu className="h-3.5 w-3.5" />
            Mintlify-style docs
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-white/56">
              <Search className="h-4 w-4" />
              Search docs
            </div>
          </div>
          <div className="mt-4 text-xs uppercase tracking-[0.16em] text-white/38">{mintConfig.name}</div>
          <div className="mt-1 text-lg font-semibold text-white">{mintConfig.navigation[0]?.group}</div>
          <div className="mt-5 space-y-3">
            {docsPages.map((doc) => (
              <NavLink
                key={doc.slug}
                to={`/docs/${doc.slug}`}
                className={({ isActive }) =>
                  `block rounded-2xl border px-4 py-3 text-sm transition ${
                    isActive ? "border-white/22 bg-white/10 text-white" : "border-white/10 bg-black/25 text-white/76 hover:border-white/20 hover:bg-white/8 hover:text-white"
                  }`
                }
              >
                <div className="font-medium">{doc.title}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/38">{doc.category}</div>
              </NavLink>
            ))}
          </div>
        </aside>

        <article className="glass-card rounded-[28px] p-6 sm:p-9">
          <Routes>
            <Route
              path="/"
              element={
                <div className="rounded-[24px] border border-white/10 bg-black/30 p-6">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/44">Docs home</div>
                  <h2 className="font-display mt-3 text-4xl tracking-[-0.04em] text-white">Clean docs, ready to scale.</h2>
                  <p className="mt-3 max-w-2xl text-base leading-8 text-white/62">
                    Structured around `mint.json` and MDX pages so you can migrate full documentation content without redesigning the frontend shell.
                  </p>
                </div>
              }
            />
            {docsPages.map((doc) => (
              <Route
                key={doc.slug}
                path={doc.slug}
                element={
                  <div className="prose prose-invert max-w-none prose-headings:tracking-[-0.02em] prose-p:text-white/72 prose-li:text-white/72 prose-strong:text-white prose-a:text-white">
                    <div className="mb-8">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/44">{doc.category}</div>
                      <h2 className="mt-3 text-4xl font-semibold text-white">{doc.title}</h2>
                    </div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.body}</ReactMarkdown>
                  </div>
                }
              />
            ))}
          </Routes>
        </article>
      </div>
    </div>
  );
}

function HomePage() {
  return (
    <>
      <Hero />
      <Capabilities />
      <Workflow />
      <Proof />
    </>
  );
}

export const App = () => {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/docs/*" element={<DocsLayout />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
};
