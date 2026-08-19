import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "mobile",
  publicDir: "../public",
  plugins: [react()],
  build: {
    outDir: "../mobile-dist",
    emptyOutDir: true,
  },
});
