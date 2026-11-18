# AliveLine — design system

Reference: the **Notion Calendar** interaction model and visual restraint, applied to our own brand.
We borrow *principles and layout patterns*, never its name, logo, icons or exact screens.
Source of truth for phase 7 (and any UI change after it). Tokens live in `frontend/src/index.css` (`@theme`).

---

## 1. What makes Notion Calendar feel the way it does (analysis)
| Trait | What it looks like | What we take |
|---|---|---|
| **Chrome disappears** | White canvas, no cards or shadows on the main surface; structure comes from 1px hairlines in warm grey | Hairline grid, no boxed cards in the app shell |
| **Content is the only colour** | UI is grayscale; colour appears only on events and the "now" marker | Colour only on work blocks, deadline chips, status dots and the today marker |
| **Pastel events, dark text** | Event = rounded rect with a light tint fill, a darker same-hue text, a stronger tint when selected | `WorkBlock` uses status tint + status text colour |
| **Dense, small type** | 12–14px Inter, medium weight for titles, grey secondary text; tabular numbers | Same scale (§3) |
| **Three-zone layout** | Left sidebar (mini month + calendar list), top bar (Today, ‹ ›, month title, view switch), main time grid; detail opens in a right-side panel, not a new page | Same shell (§5) |
| **Keyboard first** | `T` today, `←/→` or `J/K` move period, `W/D/M` views, `⌘K` command menu, `Esc` closes panel | `T`, `←/→`, `W`/`L`, `N` new, `Esc` (§7) |
| **Today is unmistakable** | Today's date number in a filled red circle, red current-time line | Today = filled accent circle on the date number + tinted column header |
| **Calm motion** | 120–180 ms fades/slides, no bounce | Same (§6) |

Adaptation to our domain: we schedule **hours per day**, not clock times. So the week grid has **no hour rows**.
Each day column stacks work blocks whose **height is proportional to hours**, up to the user's daily capacity
(a faint capacity line shows where the day is "full"). Deadlines sit in an **all-day row** at the top, like all-day events.

## 2. Colour tokens (light theme; dark theme is out of scope v1)
Warm Notion-like greys plus muted, desaturated hues.

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#FFFFFF` | app canvas |
| `--color-bg-subtle` | `#F7F7F5` | sidebar, hover rows, inputs |
| `--color-bg-hover` | `#EFEFED` | hover on buttons/rows |
| `--color-line` | `#E9E9E7` | hairlines, grid lines, borders |
| `--color-line-strong` | `#D9D9D6` | input borders, focused separators |
| `--color-text` | `#37352F` | primary text |
| `--color-text-2` | `#787774` | secondary text, labels |
| `--color-text-3` | `#A5A29C` | placeholders, disabled, weekend dates |
| `--color-accent` | `#16A34A` | brand "alive" green: primary button, today circle, focus ring, logo pulse |
| `--color-accent-tint` | `#E8F5EC` | today column header, selected nav item |

Status palette (each: **tint** fill / **text** / **solid** for dots and selected state):
| Status | Tint | Text | Solid |
|---|---|---|---|
| `critical` | `#FBE4E4` | `#9F2F2D` | `#E03E3E` |
| `time_to_start` | `#FAEBDD` | `#8A4B0F` | `#D9730D` |
| `can_wait` | `#EAEAE8` | `#5A5955` | `#9B9A97` |
| `done` | `#DDEDEA` | `#2B6A5E` (+ line-through) | `#0F7B6C` |

Course colours (left 3px stripe on blocks + sidebar dot), assigned by `course_id % 6`:
blue `#2F80ED`, purple `#9065B0`, pink `#C14C8A`, teal `#0F7B6C`, yellow `#CB912F`, brown `#9F6B53`.

Rule: never more than **status tint + course stripe** on one element. Text on tints must stay ≥ 4.5:1 contrast.

## 3. Typography
Font: **Inter** (Google Fonts, `font-feature-settings: "cv11", "ss01"`), fallback `system-ui, -apple-system, Segoe UI, sans-serif`. Numbers: `tabular-nums`.

| Role | Size / line | Weight |
|---|---|---|
| Page title (month "November 2026", landing h1 scales up) | 20 / 28 | 600 |
| Section / drawer title | 16 / 24 | 600 |
| Body, inputs | 14 / 20 | 400 |
| UI label, sidebar item, block title | 13 / 18 | 500 |
| Meta (hours, dates, column weekday) | 12 / 16 | 400–500, `--color-text-2` |
| Tiny (badge, kbd) | 11 / 14 | 500, uppercase off |

## 4. Space, shape, elevation
- Spacing scale 4px: 4, 8, 12, 16, 24, 32, 48. App shell paddings 12–16px; landing 24–48px.
- Radius: 4px (blocks, chips, inputs, buttons), 6px (popovers, drawer inner cards), full (avatars, today circle, dots).
- Borders 1px `--color-line`. **No shadows** on the canvas. Only floating layers get a shadow:
  `--shadow-pop: 0 0 0 1px rgba(15,15,15,.05), 0 3px 6px rgba(15,15,15,.1), 0 9px 24px rgba(15,15,15,.2)` (menus, drawer, toasts).
- Focus: 2px `--color-accent` ring with 1px white offset; never remove outlines without a replacement.

## 5. Layout & components

### App shell (`/app/*`, desktop ≥ 1024px)
```
┌──────────── 240px ────────────┬─────────────────────────────────────────────────────────────┐
│ ● AliveLine         [avatar▾] │ [Today] ‹ ›  November 2026          [Week|List]  [+ New]   │ ← TopBar 48px
│ ┌ mini month ───────────────┐ ├─────────────────────────────────────────────────────────────┤
│ │ M T W T F S S             │ │      Mon 16   Tue 17  (Wed 18)  Thu 19  Fri 20  Sat  Sun    │ ← day headers
│ │ …            (18) …       │ │ due  [▲ Lab 3]                 [▲ Essay]                    │ ← deadline row
│ └───────────────────────────┘ ├─────────────────────────────────────────────────────────────┤
│ TODAY · 3h                    │ ┌──────┐ ┌──────┐ ┌──────┐                                 │
│  ▪ 2h Lab 3          critical │ │Lab 3 │ │Lab 3 │ │Essay │                                 │ ← WorkBlocks
│  ▪ 1h Essay       time to st. │ │ 2h   │ │ 1h   │ │ 2h   │                                 │   height ∝ hours
│ COURSES                       │ ├──────┤ └──────┘ └──────┘   - - - capacity 3h - - - - -    │
│  ● OOAD   ● Calculus  …       │ │Essay │                                                     │
│ ───────────                   │ │ 1h   │                                                     │
│ ⤓ Import .ics   ⚙ Settings    │ └──────┘                                                     │
└───────────────────────────────┴─────────────────────────────────────────────────────────────┘
                                                      Drawer (400px, slides from right) on click
```
- **Sidebar** (`--color-bg-subtle`, right hairline): logo; `MiniMonth` (click a date → jump week; dots under days with deadlines; today = accent circle); **Today** list (the core answer: what to work on now, with hours + status dot); **Courses** list with colour dots (click toggles visibility); footer links Import, Settings, Sign out.
- **TopBar**: `Today` button (outlined), ‹ › icon buttons, period title (20/600), view switch segmented control `Week | List`, primary `+ New` (accent).
- **WeekGrid**: 7 equal columns, hairline separators, weekend columns `--color-text-3` header; today column header gets `--color-accent-tint` and the date number in an accent circle. Past days slightly dimmed (`opacity .6` on blocks).
  - **Deadline row** (all-day): `DeadlineChip` = 20px chip, status tint, `▲`/flag glyph + title, truncated; overflow → "+2".
  - **Day body**: stacked `WorkBlock`s, height `= hours × 28px` (min 24px), 2px gap; dashed `--color-line-strong` capacity line at `capacity × 28px`; over-capacity days never happen by algorithm, but unscheduled hours show a red "⚠ 3h unscheduled" note on the deadline chip.
- **WorkBlock**: radius 4, status tint fill, 3px left course stripe, title 13/500 truncated, "2h" meta; hover → `--color-bg-hover` overlay; selected → status solid border 1px. Click → Drawer.
- **ListView** (also the mobile default): sections **Critical → Time to start → Can wait → Done (collapsed)**; rows 40px with hairline separators: status dot · title · course · "start Tue 17" · "due Fri 20" · hours. No cards.
- **Drawer** (right, 400px, `--shadow-pop`): title (inline editable), course, deadline, description; **Estimate panel**: AI hours + rationale in grey 12px, editable hours stepper (0.5 step), "Re-estimate" ghost button with spinner; window summary "Start Tue 17 → finish Thu 19 · time to start"; footer: Mark done, Delete (ghost red, inline confirm). `Esc` closes.
- **Empty state** (no assignments): centered in grid, 1 line + two buttons: `+ Add assignment`, `Import Moodle calendar`.
- **Primitives**: `Button` (primary accent / secondary outlined `--color-line-strong` / ghost), 32px tall (28px in TopBar), 13/500. `Input` 32px, `--color-bg-subtle` fill, hairline border, focus ring. `Kbd` (11px, bordered). `StatusDot` 8px. `Toast` bottom-center pop for errors (`detail`) and "Saved".

### Other screens
- **Auth** (`/signin`, `/signup`): centered 360px column on white, logo above, title 20/600, inputs + full-width primary; secondary link below. No card border.
- **Settings**: same shell, single narrow column (480px), grouped rows with hairlines: name, daily capacity (slider 0.5–12 + value), buffer days (stepper 0–7).
- **Import**: same shell, narrow column: steps "Moodle → Calendar → Export → .ics" as a numbered list, dropzone (dashed `--color-line-strong`, 120px), result summary row (created / updated / skipped) + progress "Estimating 4/12 with AI…".
- **Landing** (`/`): white, generous space; hero h1 40–56px/600 "Know when to start, not just when it's due", sub 16px grey; **a static WeekGrid preview** (real component with demo data) as the hero visual; 3-step row (Collect → Estimate → Start on time); early-access form (inline email + button); footer.

### Responsive
- ≥ 1024: full shell. 768–1023: sidebar collapses to icon rail (toggle), grid shows 7 days narrower.
- < 768: no sidebar (menu sheet), TopBar compact, **ListView default**, Week view becomes a **3-day** swipeable grid; Drawer becomes a bottom sheet (90vh).

## 6. Motion
Durations 120 ms (hover, press), 180 ms (drawer/sheet slide, popover fade), easing `cubic-bezier(.2,.8,.2,1)`.
Respect `prefers-reduced-motion` (no slide, just fade). Loading: skeleton blocks in grey `--color-bg-hover`;
first request may take ~15 s (Aurora wake-up) → after 3 s show "Waking up the server…" under the spinner.

## 7. Keyboard
`T` today · `←`/`→` previous/next week · `W` week view · `L` list view · `N` new assignment · `Esc` close drawer/sheet ·
`⌘/Ctrl+Enter` save in drawer. Shortcuts are disabled while typing in inputs; shown as `Kbd` hints in tooltips.

## 8. Accessibility
Contrast ≥ 4.5:1 for text (status texts above are chosen for that on their tints). Status is never colour-only: dot + text label
in ListView, `aria-label="Lab 3, 2 hours, critical"` on blocks. Grid is a list of days (`role="list"`) for screen readers;
drawer is a dialog with focus trap; all controls reachable by Tab.

## 9. Don'ts
No Notion name, logo, icons or illustrations · no drop shadows on the canvas · no more than one accent colour ·
no gradients · no emoji as UI icons (inline SVG 16px, 1.5px stroke) · no full-page modals for editing (use the drawer).
