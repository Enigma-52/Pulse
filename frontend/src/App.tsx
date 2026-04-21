import React from "react";

const sections = [
  {
    title: "Product Overview",
    description: "Understand Pulse, architecture, and core capabilities.",
    links: [
      { label: "Overview", path: "docs/overview.md" },
      { label: "Architecture", path: "docs/architecture.md" },
      { label: "Features", path: "docs/features.md" },
    ],
  },
  {
    title: "Get Started",
    description: "Run Pulse locally or deploy with one command.",
    links: [
      { label: "Local Development", path: "docs/local-dev.md" },
      { label: "MVP Scope", path: "docs/mvp-scope.md" },
      { label: "Install Inventory", path: "docs/install-includes.md" },
    ],
  },
  {
    title: "Developer Resources",
    description: "SDK and backend demo references.",
    links: [
      { label: "Node SDK", path: "docs/sdk-node.md" },
      { label: "Demo Backend", path: "docs/demo-backend-node.md" },
    ],
  },
] as const;

export const App: React.FC = () => {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Pulse Public Frontend</p>
        <h1>Production-grade observability without the stack sprawl.</h1>
        <p>
          This app is the public-facing frontend for landing pages and documentation entry points.
          The in-product dashboard UI lives in the separate <code>future-web</code> app.
        </p>
      </section>

      <section className="grid">
        {sections.map((section) => (
          <article key={section.title} className="card">
            <h2>{section.title}</h2>
            <p>{section.description}</p>
            <ul>
              {section.links.map((link) => (
                <li key={link.label}>
                  <span>{link.label}</span>
                  <code>{link.path}</code>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
};
