import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router"

import {
  CodeBlock,
  DocCallout,
  DocGroup,
  DocInlineLink,
  DocLink,
  DocLinkGroup,
  DocLinkList,
  DocList,
  DocPageDescription,
  DocPageHeader,
  DocPageTitle,
  DocSectionContent,
  DocSectionTitle,
  type DocCalloutTone,
} from "@/components/style/DocStyle"

const ALL_TONES: DocCalloutTone[] = [
  "info",
  "success",
  "warning",
  "tip",
  "danger",
  "note",
  "learn",
]

const meta = {
  title: "Style/DocStyle",
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 640 } },
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="mx-auto max-w-2xl py-6">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  tags: ["autodocs"],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** A typical doc page: header, sections, callout, list and code block. */
export const FullPage: Story = {
  render: () => (
    <DocGroup>
      <DocPageHeader>
        <DocPageTitle>Triggers</DocPageTitle>
        <DocPageDescription>
          Triggers re-add a task to today on a schedule, without duplicating
          the task itself.
        </DocPageDescription>
      </DocPageHeader>

      <DocSectionTitle className="px-4">How it works</DocSectionTitle>
      <DocSectionContent id="how-it-works">
        <p>
          A trigger fires at the start of the day and places a fresh run of the
          task on your board. See{" "}
          <DocInlineLink to="/docs/repeat">repeat rules</DocInlineLink> for the
          quota-based alternative.
        </p>
        <DocCallout tone="info" title="Triggers never duplicate tasks">
          Firing twice on the same day is coalesced into a single run.
        </DocCallout>
        <DocList ordered>
          <li>
            <b>Enable</b> — flip the trigger switch on the task.
          </li>
          <li>
            <b>Pick a rule</b> — daily, weekly or a custom interval.
          </li>
          <li>
            <b>Done</b> — the task shows up on the scheduled days.
          </li>
        </DocList>
        <CodeBlock>{`{ "mode": "daily", "interval": 1 }`}</CodeBlock>
      </DocSectionContent>
    </DocGroup>
  ),
}

/** Every callout tone with its default icon and accent colour. */
export const Callouts: Story = {
  render: () => (
    <DocSectionContent>
      {ALL_TONES.map((tone) => (
        <DocCallout key={tone} tone={tone} title={`A "${tone}" callout`}>
          Body copy explaining the {tone} message in one or two sentences.
        </DocCallout>
      ))}
      <DocCallout tone="note" title="Title-only callout" />
    </DocSectionContent>
  ),
}

/** Link lists used on the docs index page, plus unordered DocList. */
export const ListsAndLinks: Story = {
  render: () => (
    <DocSectionContent>
      <DocList>
        <li>
          <b>Repeat</b> — quota-based scheduling with debt tracking.
        </li>
        <li>
          <b>Trigger</b> — calendar-based re-adding.
        </li>
      </DocList>
      <DocLinkList>
        <DocLinkGroup title="Scheduling">
          <DocLink to="/docs/repeat">Repeat rules</DocLink>
          <DocLink to="/docs/trigger">Triggers</DocLink>
        </DocLinkGroup>
        <DocLinkGroup title="Planning">
          <DocLink to="/docs/planner">The planner</DocLink>
        </DocLinkGroup>
      </DocLinkList>
    </DocSectionContent>
  ),
}
