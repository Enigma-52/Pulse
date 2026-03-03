import React from "react";

export const App: React.FC = () => {
  return (
    <div style={{ padding: "1.5rem", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Pulse</h1>
        <p style={{ margin: "0.25rem 0 0", color: "#555" }}>
          Minimal trace list shell (Phase 1 stub).
        </p>
      </header>
      <main>
        <section>
          <h2 style={{ fontSize: "1.2rem" }}>Traces</h2>
          <p style={{ color: "#666" }}>
            This view will show recent traces from the Query API. For now it is a static placeholder.
          </p>
        </section>
      </main>
    </div>
  );
};

