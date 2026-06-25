import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    build: { outDir: "dist", emptyOutDir: true },
    server: {
      proxy: {
        "/api/models": {
          target: env.MODELS_LAMBDA_URL ?? "http://localhost:9001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/api/benchmark": {
          target: env.ORCHESTRATOR_LAMBDA_URL ?? "http://localhost:9002",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
