import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-onboarding",
  ],
  framework: "@storybook/react-vite",
  viteFinal: (viteConfig) => {
    // Storybook inherits the app's vite.config.ts. The PWA plugin is a deploy
    // concern (service worker + manifest) and breaks the storybook build —
    // its workbox step rejects storybook's own 3.2MB manager runtime — so
    // strip every vite-plugin-pwa:* plugin from the storybook build.
    viteConfig.plugins = viteConfig.plugins
      ?.flat()
      .filter(
        (plugin) =>
          !(
            plugin &&
            typeof plugin === "object" &&
            "name" in plugin &&
            typeof plugin.name === "string" &&
            plugin.name.startsWith("vite-plugin-pwa")
          )
      )
    return viteConfig
  },
}
export default config
