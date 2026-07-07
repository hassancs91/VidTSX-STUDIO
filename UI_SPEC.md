# UI_SPEC.md — Visual design specification

> Claude: read this file before building ANY UI component.
> This defines the exact look and feel of VidTSX Studio.

## Design philosophy

VidTSX Studio looks like a professional creative tool — dark-themed like VS Code, Figma, or DaVinci Resolve. Clean, flat, no decoration. Every pixel of space serves a purpose. The UI should feel native to macOS/Windows, not like a web app crammed into a window.

---

## Color system

### App background layers (darkest → lightest)
```
--app-bg-deep:    #131316    (sidebar, title bar, deepest surfaces)
--app-bg-base:    #1a1a1e    (main content background)
--app-bg-surface: #222226    (panels, cards, elevated surfaces)
--app-bg-hover:   #2a2a2e    (hover states, subtle highlights)
--app-bg-active:  #2a2a30    (active/selected states)
--app-bg-player:  #0d0d0f    (video player/preview area — near black)
```

### Borders
```
--border-subtle:  #2a2a2e    (default borders between panels)
--border-hover:   #3a3a3e    (borders on hover)
--border-input:   #333333    (form input borders)
```

### Text
```
--text-primary:   #e0e0e0    (headings, primary content)
--text-secondary: #bbbbbb    (body text, labels)
--text-muted:     #999999    (secondary labels, descriptions)
--text-dim:       #666666    (placeholders, disabled text, timestamps)
--text-ghost:     #444444    (line numbers, very subtle hints)
```

### Accent colors
```
--accent-purple:  #7F77DD    (primary accent — buttons, active icons, progress bars)
--accent-purple-light: #c8b4ff  (active icon tint, selected text)
--accent-purple-bg: #1e1030  (subtle purple background tint)

--accent-green:   #5DCAA5    (success, "done" status, "free" badge)
--accent-green-bg: #085041   (green badge background)

--accent-amber:   #EF9F27    (warnings, storage bar, captions category)
--accent-red:     #F09595    (errors, destructive actions)
--accent-blue:    #85B7EB    (info, links)
```

### Badge colors
```
Free badge:  background: #085041, text: #5DCAA5
Pro badge:   background: #3C3489, text: #AFA9EC
```

---

## Typography

Use system fonts — no custom font loading needed in Electron.

```
--font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
--font-mono: "SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", monospace
```

### Scale
```
Title bar text:     11px, color: --text-muted
Sidebar icon label: 8px, color: --text-dim (active: --accent-purple-light)
Toolbar title:      13px, font-weight: 500, color: --text-secondary
Panel header:       11px, font-weight: 500, color: --text-muted, uppercase NOT used
Body text:          12px, color: --text-secondary
Small labels:       11px, color: --text-muted
Code (editor):      13px, font-family: --font-mono
Button text:        11px
Badge text:         9px
Timestamp/meta:     10px, color: --text-dim
```

---

## Layout structure

The app is a frameless Electron window with this structure:

```
┌─────────────────────────────────────────────────────────┐
│ Title bar (32px)                                         │
├──────┬──────────────────────────────────────────────────┤
│      │ Toolbar (40px)                                    │
│ Side │──────────────────────────────────────────────────│
│ bar  │                                                   │
│ 56px │ Content area (flex, fills remaining space)        │
│      │                                                   │
│      │                                                   │
│      │                                                   │
├──────┴──────────────────────────────────────────────────┤
│ (optional) Timeline bar (48px) — only on workspace/editor│
└─────────────────────────────────────────────────────────┘
```

### Title bar
- Height: 32px
- Background: --app-bg-deep
- Left side: three traffic light dots (decorative, 10px circles with 6px gap)
  - Red: #ff5f57, Yellow: #febc2e, Green: #28c840
  - On Windows: hide dots, use system title bar buttons
- Center: "VidTSX Studio" in 11px, --text-muted
- -webkit-app-region: drag (entire bar is draggable)

### Sidebar
- Width: 56px, fixed
- Background: --app-bg-deep
- Border-right: 0.5px solid --border-subtle
- Contains 7-8 icon buttons stacked vertically, 8px gap between
- Each icon button: 44x44px, border-radius: 8px, centered
  - Default: icon stroke --text-muted, label --text-dim
  - Hover: background --app-bg-hover
  - Active: background --app-bg-active, icon stroke --accent-purple-light, label --accent-purple-light
- Icon: 18x18px SVG, stroke-width: 1.5, stroke-linecap: round
- Label: 8px text below icon, 1px gap

### Sidebar icons (draw these as simple SVG paths)
```
Files:       folder shape (rect with tab)
Editor:      code brackets (< >)
Store:       2x2 grid of squares
Media:       image frame with mountain/sun
Captions:    rectangle with text lines
Transcribe:  microphone shape
Render:      play triangle
Settings:    gear (circle with small lines) — at bottom, separated by spacer
```

### Toolbar
- Height: 40px
- Background: --app-bg-surface (#222226 or slightly different per screen)
- Border-bottom: 0.5px solid --border-subtle
- Left: screen title (13px, font-weight: 500)
- Right: action buttons (import, render, etc.)
- Horizontal padding: 12px

### Content area
- Background: --app-bg-base
- Padding: 12px
- Flexible layout — each screen defines its own content layout

---

## Component specifications

### Buttons

**Primary button (purple)**
```css
background: #7F77DD;
color: #ffffff;
border: none;
border-radius: 6px;
padding: 4px 10px;
font-size: 11px;
cursor: pointer;
/* hover: opacity 0.9 */
```

**Secondary button (outline)**
```css
background: transparent;
color: #bbbbbb;
border: 0.5px solid #3a3a3e;
border-radius: 6px;
padding: 4px 10px;
font-size: 11px;
cursor: pointer;
/* hover: background #2a2a2e */
```

### Panel
Elevated surface within the content area.
```css
background: #222226;
border: 0.5px solid #2a2a2e;
border-radius: 8px;
overflow: hidden;
```

Panel header row:
```css
padding: 8px 10px;
border-bottom: 0.5px solid #2a2a2e;
font-size: 11px;
font-weight: 500;
color: #999999;
```

### Inputs

**Text input**
```css
height: 26px;
background: #1a1a1e;       /* or #2a2a2e for on-surface */
border: 0.5px solid #333333;
border-radius: 6px;
color: #bbbbbb;
font-size: 11px;
padding: 0 8px;
/* focus: border-color #7F77DD */
```

**Select dropdown** — same style as text input with arrow indicator.

**Range slider** — thin track (4px, #2a2a2e), accent-colored fill, small round thumb.

### Badges

Small pill-shaped labels.
```css
font-size: 9px;
padding: 1px 5px;
border-radius: 4px;
/* Free: bg #085041, color #5DCAA5 */
/* Pro:  bg #3C3489, color #AFA9EC */
```

### Progress bar
```css
height: 4px;
background: #2a2a2e;
border-radius: 2px;
/* fill: var(--accent-purple) for active, var(--accent-green) for complete */
```

### File tree item
```css
display: flex;
align-items: center;
gap: 6px;
padding: 4px 10px;
font-size: 12px;
color: #bbbbbb;
border-radius: 4px;
cursor: pointer;
/* hover: background #2a2a2e */
/* selected: background #2a2a30, color #c8b4ff */
```

### Context menu
Native Electron context menu (Menu.buildFromTemplate) — do NOT build custom HTML context menus. Native menus match the OS and are more reliable.

---

## Screen layouts

### Workspace screen (home)
```
┌──────────────┬────────────────────────────────────────┐
│ File tree     │ Video player (Remotion)                 │
│ panel         │ (dark bg, centered composition)         │
│ width: 200px  │                                         │
│               │                                         │
│ - Folders     │ [composition name + resolution overlay] │
│   - Files     │                                         │
│               ├────────────────────────────────────────┤
│               │ Timeline bar                            │
│               │ [play] [00:02.10] [===●-------] [06:00]│
└──────────────┴────────────────────────────────────────┘
```
- File tree: Panel with header "Project files"
- Tree items: folder icon + name, expandable. Files indented 14px per level.
- Player area: background --app-bg-player, centered text when no file selected
- Timeline: 48px bar below player, play button (28px circle), time displays (monospace 11px), scrub bar

### Editor screen
```
┌────────────────────────────────────┬──────────────┐
│ Code editor (Monaco)                │ Props panel   │
│                                     │ width: 180px  │
│ [line numbers] [TSX code]           │               │
│                                     │ title: "Hello"│
│                                     │ color: [■]    │
│                                     │ direction: ▼  │
├────────────────────────────────────│ duration: 6s  │
│ Live preview (small player)         │               │
│ height: ~180px                      │ -- Output --  │
│                                     │ Format: ▼     │
│                                     │ Resolution: ▼ │
└────────────────────────────────────┴──────────────┘
```
- Code editor fills left side, dark theme (vs-dark)
- Props panel: scrollable sidebar, label-value rows with 11px text
- Props row: label (--text-muted) left, input right
- Color props: small 16px square swatch + hex input
- Divider between code and preview: resizable (use simple drag handle)

### Template store screen
```
┌──────────────────────────────────────────────────────┐
│ Toolbar: [search input] [All] [Intros] [Social] ...  │
├──────────────────────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │
│ │ thumb  │ │ thumb  │ │ thumb  │ │ thumb  │         │
│ │ 80px h │ │        │ │        │ │        │         │
│ ├────────┤ ├────────┤ ├────────┤ ├────────┤         │
│ │name  F │ │name  P │ │name  F │ │name  P │         │
│ │category│ │category│ │category│ │category│         │
│ └────────┘ └────────┘ └────────┘ └────────┘         │
│ (grid: auto-fill, minmax(140px, 1fr), gap: 10px)     │
└──────────────────────────────────────────────────────┘
```
- Template card: background --app-bg-surface, border-radius: 8px, 0.5px border
- Thumbnail area: 80px tall, colored background with composition name text centered
  - Use category-specific colors: Intros=#1e1030, Social=#1a0d0d, Data viz=#1a1008, etc.
- Info area: 6px 8px padding, name (11px, --text-primary, weight 500), category (10px, --text-dim)
- Free/Pro badge: floated right of the name
- Category filter pills: styled like secondary buttons, smaller (10px font, 4px 8px padding)
- Hover: border color brightens to #444

### Media library screen
```
┌──────────────────────────────────────────────────────┐
│ Toolbar: [title]                          [Upload]   │
├──────────────────────────────────────────────────────┤
│ Storage: [████████░░░░░░░░░░░] 38 MB / 100 MB       │
│                                                       │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌─ ─┐ │
│ │ icon │ │ icon │ │ icon │ │ icon │ │ icon │ │ + │ │
│ │      │ │      │ │      │ │      │ │      │ │   │ │
│ │name  │ │name  │ │name  │ │name  │ │name  │ │drop│ │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └─ ─┘ │
│                                                       │
│ Copy URL: https://media.vidtsx.com/user/logo.png      │
└──────────────────────────────────────────────────────┘
```
- Storage bar: 6px height, --app-bg-hover track, --accent-amber fill
- Media grid: auto-fill, minmax(90px, 1fr), gap 8px
- Media item: square (aspect-ratio: 1), --app-bg-hover background, 6px border-radius
  - Centered icon (20px SVG) + filename (10px) below
  - Last item: dashed border, "+" icon, "Drop files" label — drop zone
- URL helper text: 11px, --text-dim, monospace for the URL portion (--accent-purple)

### Caption generator screen
```
┌──────────────────────────────────────────────────────┐
│ Toolbar: [title]                                      │
├──────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌──┐│
│ │ Step 1       │ │ Step 2       │ │ Step 3        │ │4 ││
│ │ Add audio    │ │ Transcribe   │ │ Caption style │ │  ││
│ │              │ │              │ │               │ │  ││
│ │ [drop zone]  │ │ [model pills]│ │ [template     │ │  ││
│ │              │ │ tiny base sm │ │  thumbnails]  │ │  ││
│ └─────────────┘ └─────────────┘ └──────────────┘ └──┘│
└──────────────────────────────────────────────────────┘
```
- 4 step cards side by side (flex-wrap for narrow windows)
- Each step: Panel component with step number (--accent-purple, 10px, font-weight 500)
- Step title: 12px, --text-primary, weight 500
- Step description: 11px, --text-muted
- Whisper model pills: small buttons, green border for downloaded, default border for not downloaded
- Caption template thumbnails: small 56x32px cards, selected has purple border

### Render queue screen
```
┌──────────────────────────────────────────────────────┐
│ Toolbar: [title]                    [Clear completed] │
├──────────────────────────────────────────────────────┤
│ [icon] GlitchIntro.tsx    MP4 1080p  [████████] Done │
│ [icon] SlideReveal.tsx    MP4 1080p  [█████░░░] 67%  │
│ [icon] BoldCaptions.tsx   WebM 1080p [░░░░░░░░] Queue│
│ [icon] ReelsCTA.tsx       MP4 vert   [████████] Done │
└──────────────────────────────────────────────────────┘
```
- Each render job is a row with: icon (32px colored square with play icon), info (name + format), progress bar (80px), status text
- Row: 8px 12px padding, border-bottom 0.5px
- Status colors: Done = --accent-green, Active = --accent-purple, Queued = --text-dim, Error = --accent-red
- "Done" rows: add "Open file" button (secondary style, small)

### Settings screen
```
┌──────────────────────────────────────────────────────┐
│ Toolbar: [title: Settings]                            │
├──────────────────────────────────────────────────────┤
│ API key                                               │
│ [vtsx_●●●●●●●●●●●abc]  [Verify] [Change]            │
│ Status: ✓ Connected as hasan@...                      │
│                                                       │
│ License                                               │
│ Tier: Pro  Expires: Dec 2026  [Manage →]              │
│                                                       │
│ Output                                                │
│ Default folder: ~/Videos/VidTSX  [Browse]             │
│                                                       │
│ Whisper models                                        │
│ tiny (75MB) [✓ Downloaded]                            │
│ base (142MB) [✓ Downloaded]                           │
│ small (466MB) [Download]                              │
│ medium (1.5GB) [Download]                             │
│ large (3GB) [Download]                                │
│                                                       │
│ About                                                 │
│ VidTSX Studio v1.0.0 · learnwithhasan.com             │
└──────────────────────────────────────────────────────┘
```
- Section headers: 13px, --text-primary, weight 500, 16px margin-top between sections
- Form rows: label left (--text-muted, 12px), value right
- Settings content: max-width 500px, centered or left-aligned

---

## Interaction patterns

### Drag and drop
- Drop zone: dashed border (0.5px dashed --border-input), centered icon + text
- On drag-over: border color → --accent-purple, background → --accent-purple-bg
- Accept .tsx files on workspace, any file on media library, audio/video on captions

### Toasts / notifications
- Bottom-right corner, small cards (--app-bg-surface with border)
- Auto-dismiss after 3 seconds
- Types: success (green left accent), error (red left accent), info (blue left accent)

### Loading states
- Spinner: small CSS spinner (16px), --accent-purple
- Skeleton: pulsing --app-bg-hover rectangles matching expected content shape
- Never block the entire screen — show loading inline where content will appear

### Empty states
- Centered in the content area
- Large icon (48px, --text-ghost), title (14px, --text-muted), description (12px, --text-dim)
- Primary action button below: "Import TSX file", "Upload media", etc.

### Modals / dialogs
- Use native Electron dialogs (dialog.showOpenDialog, dialog.showMessageBox) for file pickers and confirmations
- For custom modals (purchase prompt, API key entry): overlay with semi-transparent black bg, centered card

---

## Animation

Keep animations minimal and functional. This is a creative tool, not a marketing site.

```
Transitions:  150ms ease for hovers, color changes
Screen switch: instant (no page transitions)
Progress bar:  smooth width transition (200ms)
Sidebar icon:  no animation, instant state change
Panel resize:  live drag, no animation needed
```

No spring animations, no bouncing, no fade-in on mount. The app should feel instant.

---

## Responsive behavior

The app has a minimum window size of 900x600px. Below that, things can get cramped.

At narrow widths (< 1100px):
- Props panel in editor: collapse to bottom sheet or hide behind toggle
- Caption steps: wrap to 2x2 grid instead of 4 across
- Template grid: fewer columns (auto-fill handles this)

At very wide widths (> 1400px):
- Content has max-width constraints to prevent overly stretched layouts
- File tree can be wider if user resizes (add resize handle)

---

## Z-index layers
```
Base content:      0
Panels:            1
Toolbar:           10
Sidebar:           20
Modals:            100
Toasts:            200
```

---

## Dark theme Tailwind v4 setup

Since we use Tailwind v4 with CSS-first config, define the theme in the main CSS file:

```css
@import "tailwindcss";

@theme {
  --color-app-deep: #131316;
  --color-app-base: #1a1a1e;
  --color-app-surface: #222226;
  --color-app-hover: #2a2a2e;
  --color-app-active: #2a2a30;
  --color-app-player: #0d0d0f;

  --color-accent: #7F77DD;
  --color-accent-light: #c8b4ff;
  --color-accent-green: #5DCAA5;
  --color-accent-amber: #EF9F27;
  --color-accent-red: #F09595;

  --color-border: #2a2a2e;
  --color-border-hover: #3a3a3e;
  --color-border-input: #333333;
}
```

Then use these as Tailwind classes: `bg-app-deep`, `text-accent`, `border-border`, etc.