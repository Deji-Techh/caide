import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";

const ReactCompilerConfig = {};

// Strip `crossorigin` from CSS <link> tags — Electron's file:// protocol
// treats opaque-origin requests with crossorigin as CORS failures.
function stripCrossorigin(): PluginOption {
  return {
    name: "strip-crossorigin",
    transformIndexHtml: {
      order: "post",
      handler(html: string) {
        return html
          .replace(
            /(<link[^>]*rel="?stylesheet"?[^>]*)crossorigin[^\s"'=]*(?:\s*=\s*"[^"]*")?/gi,
            "$1",
          )
          .replace(/\s{2,}/g, " ");
      },
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
      },
    }),
    tailwindcss(),
    stripCrossorigin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    cssCodeSplit: false,
    assetsDir: "assets",
  },
});
