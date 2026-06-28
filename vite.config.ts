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
          manualChunks: {
            charts: ["recharts"],
            motion: ["framer-motion"],
            excel: ["xlsx"],
            scanner: ["@ericblade/quagga2", "html5-qrcode", "jsqr"],
          },
        },
      },
    },
  },
});
