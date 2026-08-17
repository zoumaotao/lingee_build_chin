import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const componentId = process.env.COMPONENT_ID || "employee";
const viewId = process.env.VIEW_ID || "ticket-draft";

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    __COMPONENT_ID__: JSON.stringify(componentId),
    __VIEW_ID__: JSON.stringify(viewId),
  },
  build: {
    outDir: path.resolve(__dirname, "components", componentId, viewId, "dist"),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: "index.[hash].js",
        chunkFileNames: "[name].[hash].js",
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith(".css") ? "index.[hash].css" : "[name].[hash].[ext]",
      },
    },
  },
});
