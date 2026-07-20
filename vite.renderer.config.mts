import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";

const ReactCompilerConfig = {};

// Vite 5 adds `crossorigin` to CSS <link> tags, which blocks stylesheet loading
// on file:// protocol in Electron (opaque origin fails CORS check).
function electronCssFix(): PluginOption {
  return {
    name: "electron-css-fix",
    transformIndexHtml: {
      order: "post",
      handler(html: string) {
        return html.replace(
          /(<link[^>]*)crossorigin[^\s"'=]*(?:\s*=\s*"[^"]*")?/g,
          "$1",
        ).replace(/\s{2,}/g, " ");
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
      },
    }),
    tailwindcss(),
    electronCssFix(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
