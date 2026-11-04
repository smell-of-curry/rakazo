# Grok Bot parity

Living checklist for keeping Rakazo's UI on the current Grok Bot. Source of truth is a screenshot of the installed Grok Bot app plus [the changelog](https://x.ai/changelog/bot). When those disagree with this file, update this file in the same change.

Last captured: Grok Bot v0.78.1 (27 Oct 2026), main window, 4 Nov 2026.

## Intake

One row per changelog bullet.

| Status | Meaning |
|---|---|
| `accept` | Port it. The PR extends the named Playwright spec and calls `captureScreenshot`. |
| `skip` | Leave it. The reason is in the row (X-only, commerce, seasonal, already here). |
| `done` | Shipped. Rakazo `CHANGELOG.md` gets the user-facing sentence. Do not copy Grok version numbers. |
| `uncertain` | Need another screenshot before deciding. |

Append only new `##` sections from the changelog. Compare the PR's frames to Grok by eye.

## Captured chrome (4 Nov 2026)

Grok's roster is a list, not a pin grid. Header is two white circles: search, plus. Sections are sentence case with a count on Archive. Rows are avatar, name, one-line preview, unread dot. A blue **More unreads** pill with an up arrow sits over the list when unread rows are scrolled above. Footer is the account photo, the display name, and a round grid button. Thread timestamps are centered (`Mon, Nov 2 8:29 AM`, `Yesterday 12:12 PM`). A teal **NEW** line splits unread messages. Bot bubbles are gray and wide, with a small avatar-and-name chip on the group. An answered choice stays as a white card with a green check. The composer is a pill: plus, `Message {Name}`, mic, green voice button. `⌘/` opens shortcuts.

## Rows

| Date | Grok | Area | Status | Rakazo | Why |
|---|---|---|---|---|---|
| 2026-11-04 | live window | Account name in the footer, round Connect apps | done | `SidebarFooter` | Matches the captured footer. Connected-app tiles left the footer; Connect apps still opens Integrations. |
| 2026-11-04 | live window | More unreads jump | done | `more-unreads.tsx` | Pill appears only when an unread row is above the scrollport. |
| 2026-11-04 | live window | Search and plus as white circles | done | `sidebar-header.tsx` | Activity and sidebar collapse stay, because those controls are how Activity mode and the icon rail open. |
| 2026-11-04 | live window | Section chevron only on hover | done | `sidebar-roster.tsx` | Resting header is the name, like Grok. |
| 2026-11-04 | live window | Archive label | done | `archived-chats.tsx` | Grok says Archive. The count was already there. |
| 2026-11-04 | 0.78 | ⌘/ shortcut sheet | done | `shortcut-sheet.tsx` | Lists the chords this shell already handles. |
| 2026-11-04 | live window | One Needs you pill on pins and rows | uncertain | `roster-status.ts` | This capture had no waiting bot. Compact rows already say Needs an answer or Needs you. |
| 2026-11-04 | 0.78 | Choice card keeps Something else | accept | `AskCard` | Not in this pass. Captured card showed only the chosen row with a green check. |
| 2026-11-04 | live window | One gate per bot; a human message resumes it | accept | run admission | Upstream starts another run beside `waiting_input`. |
| 2026-11-04 | live window | Peer menu of unique avatars | uncertain | `CollaborationMarker` | Not in this capture. Current UI opens a peer-messages overlay. |
| 2026-10-27 | 0.78.1 | Shopping cards, Shop Pay, subscription templates, X Money | skip | | Commerce and X checkout. |
| 2026-10-22 | 0.72 | Grok team admin, Security & compliance | skip | | Hosted Grok teams. Rakazo keeps spaces and organizations. |
