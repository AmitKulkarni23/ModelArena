import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const MONO = '"JetBrains Mono", "Fira Code", "Courier New", monospace';
console.log(
  "%cModelArena",
  `font-size:18px;font-weight:700;color:#6366f1;font-family:${MONO}`,
);
console.log(
  "%cBenchmarking LLMs objectively since 2025.\n%cBuilt on OpenRouter · React · Rust",
  `color:#475569;font-family:${MONO}`,
  `color:#94a3b8;font-family:${MONO}`,
);

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
