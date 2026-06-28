import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "vercel",
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("recharts")) return "charts";
            if (id.includes("framer-motion")) return "motion";
            if (id.includes("xlsx")) return "excel";
            if (
              id.includes("quagga2") ||
              id.includes("html5-qrcode") ||
              id.includes("jsqr")
            ) {
              return "scanner";
            }
          },
        },
      },
    },
  },
});
