import { resolve } from "node:path";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "renderer"),
      "@shared": resolve(__dirname, "shared"),
    },
  },
  optimizeDeps: { entries: ["index.html"] },
  plugins: [
    tailwindcss(),
    react(),
    // @vitejs/plugin-react v6 dropped its inline babel option, so the
    // React Compiler ships via @rolldown/plugin-babel using the
    // canonical preset exported by the react plugin itself.
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
