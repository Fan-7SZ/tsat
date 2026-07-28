/// <reference types="vitest/config" />
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import istanbul from "vite-plugin-istanbul"
import { VitePWA } from "vite-plugin-pwa"
import pkg from "./package.json"

// https://vite.dev/config/
import { fileURLToPath } from "node:url"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { playwright } from "@vitest/browser-playwright"
const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url))

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    // E2E coverage instrumentation. `requireEnv: true` means the plugin only
    // instruments when VITE_COVERAGE=true is set (see test:e2e:coverage);
    // without it dev/build behave exactly as before (the plugin never applies
    // to `vite build` at all).
    istanbul({
      include: "src/*",
      exclude: ["node_modules", "test/"],
      extension: [".ts", ".tsx"],
      requireEnv: true,
    }),
    VitePWA({
      injectRegister: "auto",
      registerType: "autoUpdate",
      includeAssets: [
        "pwa-192x192.png",
        "pwa-512x512.png",
        "pwa-1024x1024.png",
      ],
      manifest: {
        name: "TSAT",
        short_name: "TSAT",
        description: "A transaction splitting and scheduling tool",

        display: "standalone",
        start_url: "/",
        scope: "/",
        id: "tz.tsat.app",
        theme_color: "#ffffff",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        navigateFallback: "index.html",
        // Never let a hashed asset fall back to index.html. Serving HTML in
        // place of a missing chunk turns a clean 404 into a MIME-type error
        // that no caller can catch, and the host already does exactly that for
        // unknown paths — the worker must not repeat it.
        navigateFallbackDenylist: [/^\/assets\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "unsafe-none",
    },
  },
  test: {
    coverage: {
      // istanbul (not v8) so vitest and the e2e instrumentation share one
      // statement map — coverage:merge then combines them exactly.
      provider: "istanbul",
      // Don't wipe the reports directory: e2e coverage dumps live in
      // coverage/e2e and must survive a vitest coverage run so
      // scripts/merge-coverage.mjs can combine both.
      clean: false,
      include: ["src/**/*.{ts,tsx}"],
      // Fixture/story code is not product code — keep it out of the denominator.
      exclude: [
        "src/stories/**",
        "src/testing/**",
        "src/vite-env.d.ts",
      ],
      reporter: ["text-summary", "html", "json"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["test/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
    ],
  },
})
