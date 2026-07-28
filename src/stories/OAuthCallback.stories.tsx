import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter, Route, Routes } from "react-router"
import { OAuthCallback } from "@/pages/OAuthCallback"

function encodeOAuthResult(result: object): string {
  const json = JSON.stringify(result)
  const bytes = new TextEncoder().encode(json)
  const binary = String.fromCharCode(...Array.from(bytes))
  return window
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
}

function StoryHarness({ oauthResult }: { oauthResult: object | null }) {
  // The callback page reads the hash in a useState initializer on mount, so it
  // must be primed during render — an effect would run too late.
  // eslint-disable-next-line react-hooks/immutability
  window.location.hash = oauthResult
    ? `oauth_result=${encodeOAuthResult(oauthResult)}`
    : ""

  return (
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <Routes>
        <Route path="/auth/callback" element={<OAuthCallback />} />
      </Routes>
    </MemoryRouter>
  )
}

const meta = {
  component: OAuthCallback,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof OAuthCallback>

export default meta

type Story = StoryObj<typeof meta>

export const Invalid: Story = {
  render: () => <StoryHarness oauthResult={null} />,
}

export const Connected: Story = {
  render: () => (
    <StoryHarness
      oauthResult={{
        type: "oauth:connected",
        provider: "google",
        refresh_token: "1//refresh-token-sample",
      }}
    />
  ),
}

export const Error: Story = {
  render: () => (
    <StoryHarness
      oauthResult={{
        type: "oauth:error",
        provider: "google",
        error: "provider_error",
      }}
    />
  ),
}
