import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App interno com dados por usuário: renderização dinâmica comum (sem Cache Components).
  serverExternalPackages: ["@electric-sql/pglite", "@anthropic-ai/claude-agent-sdk", "pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
