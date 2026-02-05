import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        about: "about.html",
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
