# Grok Bot parity spec

Single source of truth for how Rakazo looks and behaves on web, Electron, and
iOS. Workers implement against this file; when the code and this file
disagree, fix the code or fix this file in the same PR. Numbers are CSS px at
1x. Mobile uses the same scale in points.

## Principles

- The product is a messaging app for a roster of bots. Every surface is
  iMessage-shaped: roster left, thread center, one optional pane right.
- Monochrome chrome. Ink (`primary`) is the only strong color in chrome; the
  bot's identity color lives only in its avatar. Status uses `warning`
  (needs you), `destructive`, `success`.
- One type scale, one radius scale, one spacing rhythm. No arbitrary
  `text-[Npx]` outside `packages/ui-web/src/styles.css`.
- Progressive disclosure. Nothing explains itself; controls appear when they
  are relevant (hover, active run, pending gate).
- Every visible string is UI and is listed here or in a component's own
  spec comment. Do not invent copy.

## Type scale

Defined once as Tailwind theme tokens in `packages/ui-web/src/styles.css`
(`--text-*`), used as `text-caption` etc. Font stack stays system UI
(`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`);
mono is `ui-monospace, SFMono-Regular, Menlo, monospace`.

| token     | size / line-height | weight  | use |
|-----------|--------------------|---------|-----|
| `micro`   | 10 / 12            | 500     | title capsule, Needs you pill, unread count |
| `caption` | 11 / 14            | 400/500 | section headers (uppercase, tracking 0.06em), timestamps, meta rows, pin names (500) |
| `small`   | 12 / 16            | 400     | row preview, helper text, routine schedule line |
| `body`    | 13 / 18            | 400/600 | roster row name (600), thread bubbles, composer, settings fields, buttons |
| `title`   | 15 / 20            | 600     | pane headers ("Routines", bot name in settings) |
| `display` | 20 / 24            | 600     | onboarding / empty states only |

Body letter-spacing `-0.011em`. Inline code: `small` mono, `text-destructive`
on `bg-destructive/10`, radius `sm`, padding `0 4px`.

## Color and shape

Tokens in `packages/ui-tokens/src/index.ts`. Changes for parity:

- Light `chatUser` = `#1A1A1A` (ink), `chatUserForeground` = `#FFFFFF`. User
  bubbles are black on light, `#2B2B31` on dark (unchanged).
- Bot bubble = `muted`.
- Sidebar = `sidebar`; selected row / pin = `sidebarAccent` with radius `lg`.
- Radii: `sm` 6, `md` 10, `lg` 12, bubble 18, pill `full`.

## Roster (left sidebar)

Width 280 (collapsible; collapsed state restores via the existing control).

1. Top bar, 44 tall: traffic-light clearance on macOS, `+` icon button right
   (new bot / group / space menu). Collapse control is hover-revealed, not
   persistent. No bell.
2. Search field: pill, 32 tall, `bg-muted`, magnifier 14, placeholder
   `Search`. Opens the command palette (`Cmd+K`).
3. Pinned grid: 3 columns, gap 4. Cell = avatar 52, name `caption` 500
   (1 line, truncate), then either the Needs you pill or the title capsule.
   Selected cell = `bg-sidebar-accent`, radius `lg`.
4. Sections: header = `caption` uppercase muted, padding 10/8, chevron only
   on hover. Sections come from `groupBotsForSidebar`; last section is
   `Unassigned`.
5. Row, 52 tall, padding 8/10, radius `lg`: avatar 36; line 1 = name `body`
   600 + time `caption` muted right; line 2 = preview `small` muted, one line.
   Preview text is `{Sender}: {text}` for group chats, `{text}` for DMs;
   for a bot that messaged a peer, `Messaged {Peer}: {text}`. Unread = 6px
   ink dot left of the time. Needs you = pill replaces the time.
6. Footer rows, 36 tall: `Integrations` (plug icon) and the account row
   (user avatar 22 + display name). No "Owner" label; if the user has no
   name, show the email local part.

## Bot avatar

One component per platform, same model: `packages/ui-web/src/bot-avatar.tsx`
and `apps/mobile/components/bot-avatar.tsx`.

- Photo first: `imageSrc` (authenticated `/api/bots/:id/avatar?v=`) → round,
  `object-cover`.
- Otherwise a geometric mascot: shape from `bot.avatarShape` (`hexagon`,
  `triangle`, `square`, `pill`, `circle`, `drop`, `blob`, `cloud`) in the
  bot's `color` with two ink eyes. Shape defaults from a stable hash of the
  bot id when unset. Paths and the 12-color list are ported from upstream PR
  #856 (`packages/ui-web/src/bot-avatar.tsx` there).
- No robot visor, no organic morphing, no eye animation, no spinning ring.
  Working state is shown elsewhere (thread typing row, sidebar time slot
  text `Working…`), never on the avatar.
- Groups: two member avatars stacked, `+N` overflow badge.
- Avatar Studio (bot settings → tap avatar): two tabs `Bot` (shape grid +
  color dots) and `Upload` (file picker → existing avatar upload API), footer
  `Reset` and `Done`. Ported from #856 `avatar-studio-popover.tsx`, minus
  the `::shape_` color-string hack and data-URL-in-color storage.

## Thread

- Header 44 tall: avatar 20 + name `body` 500; right: computer toggle and
  overflow. Computer icon is `primary` when a computer session is live.
- Day separators and timestamps centered `caption` muted, formatted
  `Tue, Sep 8 11:23 AM` (today: `11:23 AM`, this week: `Tue 11:23 AM`).
- Bubbles: max-width 72%, padding 8/12, radius 18, `body`. Bot = `bg-muted`
  left; user = `bg-chat-user text-chat-user-foreground` right. Consecutive
  bubbles from the same sender collapse to gap 2 and lose the tail-side
  radius (radius 6 on the inner corners).
- Peer traffic collapses to one centered `caption` row:
  `{n} messages with {avatar} {Name}` (multiple peers: `Ken and Ally`).
  Click opens a menu of unique peers (avatar + name).
- System rows (routine created/updated, memory saved) are centered `caption`
  muted with a 12px icon: `Updated routine · {name}`.
- Hover actions (react, reply, more) appear at the bubble's outer edge on
  hover only; never reserve space for them.
- Status row while a run is active: a bot bubble with a three-dot pulse.
  While rate limited: `Rate limited · retrying in {seconds}s`. While waiting
  on the computer: `Setting up {Name}'s computer…`.
- Find in chat: `Cmd+F` opens a floating pill top-right of the thread
  (search input, `↑` `↓`, `×`); matches highlight in bubbles.

## Composer

Pill, 40 tall, `bg-card` with `border`, inset 6: left `+` in a 28 outlined
circle (attachments, slash actions), placeholder `Message {Name}` `body`
muted, right slot = mic in a 28 ink circle when empty; send arrow (ink) when
text is present; stop square while a run is active. Draft survives gates,
navigation, and errors. Errors show inline under the composer in
`small text-destructive`.

## Human gates ("Needs you")

Backend truth is `run.status ∈ {waiting_input, waiting_takeover}` plus the
single unanswered gate message for that run. Exactly one predicate,
`needsYou(threadSnapshot)` in `packages/core/src/human-gate.ts`, feeds the
sidebar pill, the thread card, mobile, and push text. Nothing else derives it.

Invariants (enforced in `packages/adapters` + `packages/db`, covered by
tests):

1. One pending gate per bot. A new ask/takeover/approval while one is pending
   is rejected and the run is requeued; peer `bot_message`s and routine
   wakeups do not start a second run on a waiting bot.
2. Answering resumes. `threads.answer` marks the block answered and enqueues
   `run.continue` atomically; a failed enqueue is repaired by the reconciler.
3. Cancel/stop closes the gate. Cancelling a run marks its pending blocks
   `dismissed`; the sidebar clears immediately.
4. No orphan waits. A run cannot be leased out of `waiting_*` without an
   answer or a takeover release. A pause that fails to persist fails the run
   with a visible error instead of leaving it `running` with no card.
5. Steering while waiting is delivered. A user message during `waiting_*`
   lands in the thread and is injected at resume; the card stays.
6. The computer never sleeps under `waiting_takeover`.

Cards (all in thread, from the bot, `bg-card border`, radius `lg`, padding
12, `body`):

- Question (`ask_user`): question text; options as full-width outlined rows;
  a free-text field is always present (placeholder `Type an answer`); submit
  with `Send`. After answering: card dims to 60%, chosen row keeps a check,
  others fade; free-text answer stays visible.
- Secret (`request_secret`): label + description, masked field
  (placeholder `Paste value`), `Save securely`. After: field shows `Saved`,
  footer `Stored securely, never shown to your bot`.
- Approval (tool needs consent): `{Name} wants to {action}` with `Allow once`
  · `Always allow` · `Deny`.
- Computer handoff (`request_takeover`): reason text, `Open computer`
  button. In the computer pane: `Take control` → (user finishes) → `Done`
  returns control and resumes. `Skip` resumes without the step.

Sidebar: pill `Needs you` (`micro`, `text-warning bg-warning/15`) replaces
the title capsule (pin) or time (row) while a gate is pending. Thread shows
the card only; no duplicate banner above the composer.

## Computer pane (right)

Width 360, `bg-background`, left `border`.

- Header 44: title `{Name}'s computer` `body` 500; right: settings gear,
  close. Status chip under the title: `Live`, `Sleeping`, `Setting up…`,
  `Needs you`; never the raw run status string.
- Screen preview 16:10, radius `lg`, click to open full screen. Full screen
  keeps the pane header and shows `Take control` / `Done` / `Skip` when a
  handoff is pending.
- `Routines` header `title` with `+`. Row 48: clock icon 16, name `body`,
  schedule `small` muted (`Every day at 8:00 AM`, `Weekdays at 6:00 PM`,
  `Paused`). Active run: `Running` chip + `Stop` button on the row.

## Bot settings (right pane, `Settings`)

Sections, each a `title` header with grouped fields:

- Profile: avatar (opens Avatar Studio), `Name`, `Title`, `Description`.
- Instructions: multi-line `Instructions` (separate field from description).
- Model: model picker, thinking level, memory scope.
- Computer: `Team` / `Private`, `Recover`, `Reset`.
- Notifications toggle.
- Danger: `Clear conversation`, `Delete bot`.

Auto-save on blur with a `Saved` toast state; no Save button.

## Connections (Integrations)

Two tabs: `Marketplace` (catalog cards: logo 32, name, one-line
description, `Connect`) and `Installed` (rows with status chip
`Connected` / `Waiting for authorization` / `Disabled`, `Reopen`, `Remove`).
In-thread connect card mirrors the row and gets the same copy.

## Mobile mapping (iOS)

Same scale in points, same copy. Roster = Expo Router `index` with native
large title `Bots`, pinned grid + sectioned list; thread = same bubble
rules; computer and settings = native sheets. Native pickers/menus/alerts
replace popovers. Where SwiftUI has the pattern, use it; do not rebuild web
chrome in RN.

## Testing bar

- Component tests use `@testing-library/react` with `jsdom` (web) and
  render assertions on roles/text; no `readFileSync` source sniffing.
- Every card state above has a render test; `needsYou` and gate invariants
  have unit tests in `packages/core` / `packages/adapters` / `packages/db`.
- Playwright e2e covers: roster (pin + rows + Needs you), thread parity
  screenshot, each gate card, computer pane, settings, connections.
