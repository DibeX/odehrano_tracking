import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { lingui } from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  // Unprefixed BGG credentials are available only to server code. Runtime env wins.
  const serverEnv = loadEnv(mode, process.cwd(), "BGG_");
  if (process.env.BGG_API_TOKEN === undefined && serverEnv.BGG_API_TOKEN) {
    process.env.BGG_API_TOKEN = serverEnv.BGG_API_TOKEN;
  }
  return {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    plugins: [
      tanstackStart(),
      nitro(),
      // react's vite plugin must come after start's vite plugin
      viteReact({
        babel: {
          plugins: ["@lingui/babel-plugin-lingui-macro"],
        },
      }),
      tailwindcss(),
      lingui(),
    ],
  };
});
