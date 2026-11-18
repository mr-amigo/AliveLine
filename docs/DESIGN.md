# AliveLine — design system

Reference: **Notion** (the workspace app) and **Notion Calendar**, copied as closely as possible in look and feel —
palette, type, spacing, sidebar, page header, database views, side peek, tags, callouts, buttons.
Only our own name and logo are used; no Notion name, logo, illustrations or copied icon artwork.
Source of truth for any UI change. Tokens live in `frontend/src/index.css` (`@theme`).

---

## 1. What we copy from Notion
| Notion trait | What it looks like | Where in AliveLine |
|---|---|---|
| **Warm-grey sidebar** | 240px, `#F7F7F5`, workspace row on top, 30px rows, 14/500 `#5F5E5B`, grey 12px section labels | `Sidebar` (workspace row, Planner/Import/Settings, mini month, Today, Courses, Log out) |
| **Borderless top bar** | 44px, breadcrumbs `Page / Sub` (16px line icon before Page), actions right, no hairline | `TopBar` |
| **Page header** | 40px bold title, grey description, 96px side gutters (full width) or 708px column | `PageHeader` on Planner, Import, Settings |
| **Database view bar** | View tabs (icon + name, 2px dark underline on active), blue **New** button right, hairline under | Planner `Calendar` / `List` tabs |
| **Calendar view** | Hairline cells, weekends `#FBFBFA`, today's date in a red circle, items as white cards with soft shadow; range picker top right | `WeekGrid` (Day / 3 days / Week), `MonthGrid`, `DeadlineChip` cards |
| **Calendar events** | Pastel tint fill, coloured left bar, dark same-hue text | `WorkBlock` (status tint + course bar) |
| **Table view** | 34px rows, vertical + horizontal hairlines, column headers with grey property icons, grouped by select with tag + count | `ListView` |
| **Select tags** | 20px pill, radius 4, pastel bg + dark text | `Tag` (status, course) |
| **Side peek** | Panel slides from right, `»` close, huge editable title, property rows (icon · label · value), body text below a hairline | `AssignmentDrawer` |
| **Callout block** | Tinted bg (`#F1F1EF` grey, red, orange, green), icon left, radius 4 | `Alert`, `EstimatePanel` |
| **Buttons & inputs** | Blue `#2383E2` filled, white with inset hairline, ghost grey; inputs with faint fill + inset outline, blue double-ring focus | `Button`, `IconButton`, `Input`, `Textarea`, `Stepper` |
| **Dark snackbar** | `#2F2F2F` toast with white 14px text, bottom centre | `Toast` |
| **Login page** | 320px column, bold 24px title + grey bold subtitle, full-width blue button | `AuthForm` |

Domain adaptation: we plan **hours per day**, not clock times, so the week grid has **no hour rows**. Each day stacks
work blocks whose **height ∝ hours** up to the daily capacity (dashed capacity line). Deadlines sit in the all-day row.

## 2. Colour tokens (light theme only)
| Token | Value | Use |
|---|---|---|
| `bg` | `#FFFFFF` | page canvas, peek, cards |
| `bg-subtle` | `#F7F7F5` | sidebar |
| `bg-weekend` | `#FBFBFA` | weekend columns |
| `bg-hover` | `rgba(55,53,47,.08)` | hover on rows, buttons, inputs (works on white and sidebar) |
| `bg-press` | `rgba(55,53,47,.16)` | active/pressed |
| `line` | `#E9E9E7` | hairlines, table/grid lines |
| `line-strong` | `#DDDCDA` | dashed capacity line, dropzone |
| `text` | `#37352F` | primary text |
| `text-sidebar` | `#5F5E5B` | sidebar rows |
| `text-2` | `#787774` | secondary text, property labels |
| `text-3` | `#9B9A97` | placeholders, icons, section labels |
| `accent` / `accent-hover` | `#2383E2` / `#0077D4` | primary button, links, focus |
| `accent-tint` | `#E7F3F8` | dropzone drag-over |
| `select` | `rgba(35,131,226,.14)` | selected table row |
| `today` | `#EB5757` | today circle (grid + mini month), error dot in toast |
| `ink` | `#2F2F2F` | toast background |
| `callout` / `-red` / `-orange` / `-green` | `#F1F1EF` / `#FDEBEC` / `#FBECDD` / `#EDF3EC` | callouts |

Status = Notion select colours (**tint** tag bg / **text** tag fg / **solid** dots, rings, callout icons):
| Status | Notion colour | Tint | Text | Solid |
|---|---|---|---|---|
| `critical` | red | `#FFE2DD` | `#5D1715` | `#D44C47` |
| `time_to_start` | orange | `#FADEC9` | `#49290E` | `#D9730D` |
| `can_wait` | gray | `#E3E2E0` | `#32302C` | `#9B9A97` |
| `done` | green | `#DBEDDB` | `#1C3829` | `#448361` |

Course colours (hash of course name → index; solid for bars/checkboxes, tag bg + text for table tags):
blue `#337EA9`/`#D3E5EF`/`#183347`, purple `#9065B0`/`#E8DEEE`/`#412454`, pink `#C14C8A`/`#F5E0E9`/`#4C2337`,
green `#448361`/`#DBEDDB`/`#1C3829`, yellow `#CB912F`/`#FDECC8`/`#402C1B`, brown `#9F6B53`/`#EEE0DA`/`#442A1E`.

Rule: one element carries at most **status tint + course bar**. Tag text on tag bg stays ≥ 4.5:1.

## 3. Typography
Font: Notion's system stack — `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI",
Helvetica, "Apple Color Emoji", Arial, sans-serif`. No web font. Numbers: `.tnum`.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `page` | 40 / 48 | 700, −0.01em | page title (30px on mobile), landing h1 scales to 64 |
| `h1` | 30 / 39 | 700 | peek title, landing sections, mobile page title |
| `h2` | 24 / 31 | 700 / 600 | auth title + subtitle, import counters |
| `title` | 20 / 26 | 500–600 | landing sub-headings |
| `section` | 16 / 24 | 400–500 | page description, body text in peek, lists |
| `body` | 14 / 20 | 400–500 | **default UI size**: sidebar, buttons, table, properties |
| `label` | 13 / 18 | 500 | rare compact UI |
| `meta` | 12 / 16 | 400–500 | section labels, block titles, hints |
| `tiny` | 11 / 14 | 500 | avatar letter, kbd |

## 4. Space, shape, elevation
- 4px grid. Sidebar `px-2`, rows 30px. Page gutters `px-6 md:px-12 xl:px-24` (`PAGE_X`); narrow pages 708px (`NARROW`).
  Page header top 32/48px.
- Radius: 4px (buttons, tags, inputs, blocks, callouts), 6px (sidebar rows, toast), 12px (landing preview, mobile sheet).
- No shadows on the canvas except Notion cards. Shadows:
  `card` `0 0 0 1px rgba(15,15,15,.1), 0 2px 4px rgba(15,15,15,.1)` (deadline cards, landing preview) ·
  `peek` very soft (side peek) · `pop` `0 0 0 1px rgba(15,15,15,.05), 0 3px 6px rgba(15,15,15,.1), 0 9px 24px rgba(15,15,15,.2)` (menu, sheet, toast) ·
  `outline` inset 1px (inputs) · `btn` inset 1px `rgba(55,53,47,.16)` (secondary buttons, stepper) ·
  `focus` `inset 0 0 0 1px rgba(35,131,226,.57), 0 0 0 2px rgba(35,131,226,.35)` (inputs). Other focus: 2px blue outline.
- Sidebar edge: `inset -1px 0 0 rgba(15,15,15,.04)` instead of a border.

## 5. Layout & components

### App shell (`/app/*`, ≥ 1024px)
```
┌──────── 240px #F7F7F5 ────────┬──────────────────────────────────────────────────────────────┐
│ [A] Artem’s AliveLine          │ ▦ Planner / November 2026       [Week ▾]                     │ ← TopBar 44px, no border
│ ▤ Planner                      │                                                              │
│ ⤒ Import                       │                                                              │ ← PageHeader
│ ⚙ Settings                     │      Planner                                    (40px bold) │
│ November 2026          ‹ ›     │      When to start each assignment…            (16px grey) │
│ M T W T F S S                  │                                                              │
│ …  (18)  …     ← red circle    │      ▦ Calendar   ☰ List                      [+ New]      │ ← view tabs, underline
│ Today                    3h    │      ─────────────────────────────────────────────────────── │
│ ● Lab 3                  2h    │      November 2026                        ‹  Today  ›        │
│ ● Essay                  1h    │      ┌Mon 16┬Tue 17┬(18)──┬Thu 19┬Fri 20┬Sat 21┬Sun 22┐      │
│ Courses                        │      │[●Lab3]│      │      │[●Ess]│      │░░░░░░│░░░░░░│      │ ← deadline cards
│ ☑ OOAD                         │      │▌Lab 3│▌Lab 3│▌Essay│      │      │░░░░░░│░░░░░░│      │ ← work blocks
│ ☑ Calculus                     │      │- - - - - - - - - 3h / day - - - - - - - - - - - │      │
│ ⇥ Log out                      │      └──────┴──────┴──────┴──────┴──────┴──────┴──────┘      │
└────────────────────────────────┴──────────────────────────────────────────────────────────────┘
                                                   Side peek (520px) slides in from the right on click
```
- **Sidebar**: workspace row (20px dark square with initial + “{name}’s AliveLine”); nav rows with grey icons, active row
  `bg-hover` + `text`; `MiniMonth` (visible range shaded except in Month view, deadline dots, today red; a click opens that date in the current range); **Today** section (status dot · title ·
  hours) — the core answer; **Courses** with Notion checkboxes in course colour (click toggles visibility); **Log out** at bottom.
- **TopBar**: breadcrumbs (16px line icon + page name / current period); Planner calendar: range picker `Day · 3 days · Week · Month`
  (secondary-style select) right. Mobile: menu button left.
- **PageHeader**: title, grey description (no icon).
- **View bar**: tabs `Calendar` (last range used, remembered) / `List` (L), blue `+ New` (N). Calendar toolbar below: period title
  14/600 left, `‹ Today ›` ghost right (moves one period). URL `?view=day|3day|week|month|list&date=YYYY-MM-DD` (date omitted = today).
- **Callouts above the grid**: “won’t be finished in time” (red) and “N rough estimates · Estimate all with AI” (grey, sparkle icon).
- **WeekGrid** (Day = 1, 3 days = 3, Week = 7 columns): column top hairline, column hairlines, weekend `bg-weekend`; header `Mon` + date number, today in a 24px
  red circle; past blocks `opacity .6`. Week = 3-day scroll-snap under 768px.
  - **Deadline row**: `DeadlineChip` = white Notion card (`shadow-card`, 22px, always one line) with status dot + title (+ due time in
    Day / 3 days); Week shows 2 + “+N more”.
  - **Day body**: `WorkBlock` height `hours × 32px` (min 40), 2px gap, dashed capacity line + “3h / day”.
- **MonthGrid**: weekday header, 7 hairline columns, cells min 112px (80 mobile); date number (click → Day view), **load bar**
  (4px `bg-hover` track, fill = planned / capacity in the day's most urgent status colour, hours label 11px), deadline chips
  (2 + “+N more”; status dots under 768px). Days outside the month: grey numbers, deadlines only.
- **WorkBlock**: radius 4, status tint, 3px course bar, title 12/500 up to 2 lines, hours 12 at 70% (beside the title when
  short, bottom line when ≥ 56px); hover/press darken overlay; selected 1px status ring.
- **ListView** (mobile default): Notion table — header row with icons `Aa Name · Status · Course · Start · Due · Hours`;
  groups Critical → Time to start → Can wait → Done (collapsed toggle) shown as tag + count; 34px rows, status and course as tags;
  selected row `select` blue.
- **Side peek** (`AssignmentDrawer`, 520px; bottom sheet 90vh on mobile): `»` close + “Assignment”; 30px bold title input
  (placeholder “Untitled assignment”); properties: **Status** (tag + start → finish), **Course** (datalist), **Due** (date + Kyiv
  time + relative), **Source**; overload callout; **Estimate callout** (sparkle line icon; label AI estimate / Your estimate / Rough estimate, the last with “Estimate with AI”; hours stepper, Re-estimate,
  rationale); hairline; borderless 16px description. Footer: Save (⌘↵) · Mark done · delete icon with inline confirm.
- **Empty state**: centred line + `+ Add assignment` / `Import Moodle calendar`.
- **Primitives**: `Button` primary/secondary/ghost/danger, 32px (28px `sm`), 14/500, radius 4. `IconButton` 28px grey.
  `Tag`. `Input` 32px. `Alert` = callout. `Stepper` 28px with inset outline. `Kbd` grey text. `Toast` dark snackbar.

### Other screens
- **Auth**: 320px column, logo, bold title + grey bold subtitle (24px), inputs, full-width 36px blue button, blue underlined link.
- **Settings**: narrow page, “My plan” heading with hairline, rows label 14 + grey hint, control right.
- **Import**: narrow page, numbered list (16px), dashed dropzone 120px, counters row, AI progress line, callouts.
- **Landing**: white, 64px bold headline (40 mobile), 20px grey sub (16 mobile), blue + outlined CTAs above the fold at 375px,
  live `WeekGrid` preview in a 12px-radius card, three steps, early-access form (success → `/thanks`), footer.
  Under 768px a fixed bottom bar with the blue CTA slides in once the hero buttons scroll away.
- **Public layout** (`SiteLayout`): logo header with Sign in / Get started (Open planner when signed in); footer with Privacy ·
  Terms · Contact · email. Text pages (Privacy, Terms, Contact, Thanks, 404) = 756px column, 40px title, 16/1.6 body, 20px h2.
- **Meta**: `usePageMeta(title, description)` per route → “Title · AliveLine”; favicon svg + png 32/180; OG image 1200×630.

### Responsive
≥ 1024 full shell · < 1024 sidebar opens as overlay from the menu button · < 768 list view default, Week swipes 3 days,
Month shows deadline dots, peek → bottom sheet.

## 6. Motion
120 ms hover/press, 180 ms peek/sheet slide and fades, easing `cubic-bezier(.2,.8,.2,1)`. `prefers-reduced-motion` → fades only.
Skeletons in `bg-hover`; after 3 s show “Waking up the server…” (Aurora resume).

## 7. Keyboard
`T` today · `←`/`→` previous/next period · `D` day · `3` three days · `W` week · `M` month · `L` list · `N` new · `Esc` close peek · `⌘/Ctrl+Enter` save. Off while typing.

## 8. Accessibility
Text ≥ 4.5:1 (tag palettes chosen for it). Status never colour-only: tag text or `aria-label` on dots/blocks. Grid is
`role="list"`; view bar is a `tablist`; peek is a dialog with focus trap; everything reachable by Tab.

## 9. Don'ts
No Notion name, logo or illustrations · **no emoji anywhere in the UI or UI copy** (product owner's rule): icons are inline SVG 16px, 1.5px stroke ·
no gradients · no canvas shadows except Notion cards · one accent (blue) · no full-page modals for editing (use the peek) ·
no colours or sizes outside this file.
