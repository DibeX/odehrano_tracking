import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { lingui } from "@lingui/vite-plugin";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    react({ babel: { plugins: ["@lingui/babel-plugin-lingui-macro"] } }),
    lingui(),
  ],
  test: { environment: "node", include: ["src/**/*.test.{ts,tsx}"] },
});
