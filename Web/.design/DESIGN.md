# Editable Encyclopedia — Viking Design System

## Visual Theme & Atmosphere

**Mood:** Dark medieval forge — leather-bound manuscripts lit by torchlight. The interface evokes a war-room map table in a Nordic longhouse: dark, warm, with gold metalwork accents catching firelight.

**Philosophy:** Every surface feels like a physical material — dark leather, forged gold, aged parchment. No flat modern design; everything has texture, depth, and weight. Shadows are deep, highlights are warm gold, and interactive elements feel like metal clasps on a leather journal.

**Atmosphere keywords:** Viking, medieval, manuscript, forged metal, torchlight, leather, parchment, gold filigree, embossed, engraved.

---

## Colour Palette & Roles

### Core Palette (CSS Custom Properties)

| Role | Name | Hex/Value | Usage |
|------|------|-----------|-------|
| Background | Void Black | `#0a0908` | Page body, deepest layer |
| Background 2 | Coal | `#110f0b` | Secondary backgrounds |
| Background 3 | Ember Dark | `#18150f` | Tertiary backgrounds |
| Panel | Night Leather | `#16130e` | Panel base color |
| Panel 2 | Dark Leather | `#1c1812` | Panel gradient end |
| Paper | Parchment | `#e2d4b5` | Primary readable text |
| Paper 2 | Aged Paper | `#c4b08a` | Secondary text |
| Muted | Worn Gold | `#a08e6a` | Tertiary text, hints |
| Muted 2 | Tarnished | `#8a7858` | Quaternary text, disabled |
| Line | Dark Seam | `#3a3020` | Borders, dividers |
| Gold | Polished Gold | `#d8b35f` | Primary accent, values |
| Gold 2 | Aged Gold | `#b88c32` | Secondary accent |
| Gold 3 | Bright Gold | `#f4d892` | Highlights, active states |
| Red | War Blood | `#a15b5b` | Enemies, danger, war |
| Blue | Ice Steel | `#6d8cb1` | Politics, kingdoms |
| Green | Forest | `#5b8f69` | Peace, allies, connected |
| Fire Orange | Torch Flame | `#f4a830` | Live indicators, embers |
| Fire Red | Ember | `#d86030` | Fire effects |
| Fire Yellow | Flame Tip | `#ffd080` | Bright fire, sparks |
| Leather | Dark Hide | `#2a2018` | Card backgrounds |
| Leather 2 | Tanned Hide | `#342a1e` | Card gradient end |

### Extended Viking Palette (Inline Usage)

| Role | Hex | Usage |
|------|-----|-------|
| Viking Gold Bright | `#ecdcc0` | Hero text, active states, titles |
| Viking Gold Mid | `#d4b878` | Stat values, accent text |
| Viking Gold Frame | `#d4b050` | Shield frame gradient start |
| Viking Gold Dark | `#8b6914` | Shield frame gradient end |
| Muted Earth | `#9a8a68` | Section headers, labels |
| Deep Earth | `#6a5a42` | Faint labels, empty states |
| Dark Earth | `#8a7a5a` | Sidebar labels, subtitles |
| War Red Bright | `#c05040` | Enemy headers |
| War Red Glow | `#e8a090` | War badge text |
| Peace Green | `#609060` | Peace headers |
| Peace Green Glow | `#80a880` | Peace badge text |

### Viking Card Backgrounds

| Surface | Gradient | Usage |
|---------|----------|-------|
| Card Dark | `170deg, #1e1a14 → #141110` | Standard card surface |
| Card Warm | `170deg, #231e16 → #181410` | Featured/elevated cards |
| Card Hover | `170deg, #2a2218 → #1e1a14` | Hover state |
| Card Inner | `170deg, rgba(30,24,16,.5) → rgba(18,14,10,.6)` | Nested components |

---

## Typography

### Font Stack

| Role | Family | Fallback | Usage |
|------|--------|----------|-------|
| **Display** | `'Cinzel Decorative'` | `'Cinzel', Georgia, serif` | Hero titles, intro BANNERLORD |
| **Heading** | `'Cinzel'` | `Georgia, serif` | All headings, section titles, names, values |
| **Body** | `Georgia` | `'Times New Roman', serif` | Body text, descriptions |
| **UI** | System stack | `-apple-system, sans-serif` | Badges, meta, small labels |

### Type Scale

| Element | Size | Weight | Letter-spacing | Color |
|---------|------|--------|----------------|-------|
| Hero Title (BANNERLORD) | `clamp(55px,10vw,115px)` | 900 | 8px | Gold gradient `background-clip:text` |
| Page Name (detail) | 28-36px | 700 | 2-4px | `#ecdcc0` |
| Card Name | 16-17px | 700 | 0.5px | `#ecdcc0` |
| Section Header | 11-14px | 700 | 3-5px (uppercase) | `#9a8a68` |
| Body Text | 13-15px | 400 | normal | `#b0a080` to `#d0c0a0` |
| Label | 8-10px | 600-700 | 1.5-2.5px (uppercase) | `#6a5a42` to `#8a7a5a` |
| Badge | 9-11px | 700 | 1-2.5px (uppercase) | Contextual |

### Text Effects

- **Engraved:** `text-shadow: 0 2px 0 rgba(0,0,0,.4)` — pressed-in metal look
- **Gold Glow:** `text-shadow: 0 0 20px rgba(184,140,50,.1)` — warm ambient
- **Drop Shadow:** `text-shadow: 0 1px 3px rgba(0,0,0,.5)` — standard depth

---

## Component Styles

### Viking Card (`.fk-card`, `.sett-card`, `.clan-card`, `.hero-card`)

```
Background: linear-gradient(170deg, #1e1a14, #141110)
Border: 2px solid rgba(140,110,40,.25)
Border-radius: 6px
Box-shadow: 0 4px 16px rgba(0,0,0,.4), inset 0 0 30px rgba(0,0,0,.12)
Hover: border-color rgba(184,140,50,.45), gold outer glow 0 0 18px rgba(184,140,50,.08)
```

### Viking Panel (`.home-panel`, `.detail-right-rail`, `.side-header`, `.side-block`)

```
Background: linear-gradient(170deg, #231e16, #181410)
Border: 2px solid rgba(160,120,40,.35)
Box-shadow: 0 6px 20px rgba(0,0,0,.4), inset 0 0 40px rgba(0,0,0,.15), inset 0 1px 0 rgba(184,140,50,.1)
Inner frame: ::before at 6-8px inset, 1px solid rgba(184,140,50,.08-.12)
```

### Gold Shield Frame (Banners/Sigils)

```
Clip-path: polygon(4% 0, 96% 0, 100% 6%, 100% 70%, 50% 100%, 0 70%, 0 6%)
Frame gradient: linear-gradient(180deg, #dcc060, #b89830 30%, #8b6914 80%, #6a4e0e)
Padding: 3-8px (frame thickness)
Filter: drop-shadow(0 4px 12px rgba(0,0,0,.6)) drop-shadow(0 0 15px rgba(184,140,50,.12))
```

### Buttons (`.btn`, `.btn-edit`)

```
Background: linear-gradient(170deg, rgba(30,24,16,.5), rgba(18,14,10,.6))
Border: 1px solid rgba(140,110,40,.2)
Color: #9a8a68 → #d4b878 on hover
Font: 'Cinzel', serif, 10-11px, uppercase, letter-spacing 1.5px
Hover: shimmer sweep animation (::before skewX(-15deg) light sweep)
Box-shadow: 0 2px 6px rgba(0,0,0,.2)
```

### Gold Divider Lines

```
Height: 1px
Background: linear-gradient(90deg, transparent, rgba(184,140,50,.35) 10%, rgba(184,140,50,.35) 90%, transparent)
Ornament: ::before with '✦ ⚔ ✦' centered, background matching surface color
```

### Status Badges

| Type | Background | Border | Text Color |
|------|-----------|--------|------------|
| War/Enemy | `rgba(180,50,30,.25-.3)` | `rgba(200,60,40,.35-.5)` | `#e8a090` to `#ffc8b0` |
| Peace/Ally | `rgba(40,140,70,.15-.25)` | `rgba(46,160,80,.25-.35)` | `#90c4a0` to `#a0d8b0` |
| Neutral | `rgba(0,0,0,.2)` | `rgba(140,110,40,.12)` | `#8a7a5a` |

### Gauge Circles (`.sd-gauge`)

```
SVG: 92px diameter, rotate(-90deg)
Track: rgba(255,255,255,.06) stroke
Fill: animated stroke-dasharray draw + pulsing glow
Center: icon + Cinzel value + uppercase label
Hover: scale(1.08)
```

### Filter/Pill Tags

```
Background: linear-gradient(170deg, rgba(30,24,16,.5), rgba(18,14,10,.6))
Border: 1px solid rgba(140,110,40,.12-.25)
Font: 'Cinzel', serif, 10px
Border-radius: 3-4px
Active: brighter border, gold color, inset glow
```

---

## Layout Principles

### Page Grid

| Layout | Columns | Max Width | Gap |
|--------|---------|-----------|-----|
| List pages | `300px sidebar + 1fr` | 1200px | 28px |
| Detail (no journal) | `320px rail + 1fr` | 1600px | 24px |
| Detail (with journal) | `300px rail + 1fr + 240px` | 1600px | 24px |
| Home content | Single column | 1200px | — |
| Card grid | `repeat(auto-fill, minmax(280px, 1fr))` | — | 14-18px |

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4-6px | Icon gaps, tight elements |
| sm | 8-10px | Chip gaps, small padding |
| md | 14-16px | Card padding, section gaps |
| lg | 20-24px | Section padding, panel padding |
| xl | 28-32px | Page padding, large gaps |
| 2xl | 40-48px | Featured card padding |

### Whitespace Philosophy

**Generous but intentional.** Breathing room around content sections. Featured/detail views have more space (40-48px padding) than list cards (12-16px). Gold divider lines create visual chapters between sections.

---

## Border & Shadow Patterns

### Border Hierarchy

| Level | Border | Usage |
|-------|--------|-------|
| **Frame** | `3px solid rgba(180,140,50,.5)` | Featured kingdom cards |
| **Panel** | `2px solid rgba(160,120,40,.3-.4)` | Panels, sidebar, detail rail |
| **Card** | `2px solid rgba(140,110,40,.25)` | Standard cards |
| **Subtle** | `1px solid rgba(140,110,40,.1-.15)` | Nested components, stat boxes |
| **Divider** | `1px solid rgba(184,140,50,.1-.2)` | Section separators |

### Shadow Hierarchy

| Level | Shadow | Usage |
|-------|--------|-------|
| **Deep** | `0 8px 24px rgba(0,0,0,.5)` | Featured cards, panels |
| **Medium** | `0 4px 16px rgba(0,0,0,.4)` | Standard cards |
| **Subtle** | `0 2px 8px rgba(0,0,0,.2-.3)` | Nested elements, badges |
| **Inner** | `inset 0 0 30-40px rgba(0,0,0,.12-.15)` | Atmospheric depth |
| **Gold glow** | `0 0 15-20px rgba(184,140,50,.08-.12)` | Hover states |

---

## Animation Tokens

### Entrance Animations

| Name | Transform | Duration | Usage |
|------|-----------|----------|-------|
| Rise | `translateY(20-24px) scale(.95)` → normal | 0.4-0.6s ease-out | Cards, counters |
| Slide-in Left | `translateX(-12px)` → normal | 0.4-0.5s ease-out | Timeline events |
| Slide-in Right | `translateX(16px)` → normal | 0.5s ease-out | Journal panel |
| Scale-in | `scale(.5-.6)` → normal | 0.6s ease-out | Gauges |
| Unfurl | `scaleY(.95)` → normal | 0.6s ease-out | Chronicle panel |

### Ambient Animations (Infinite)

| Name | Effect | Duration | Usage |
|------|--------|----------|-------|
| Gold Glow Pulse | Box-shadow intensity oscillates | 4-6s | Counters, cards |
| Shimmer Sweep | Diagonal light sweeps across | 4-7s | Active nav, titles, buttons |
| Line Sweep | Gold gradient slides left→right | 4-8s | Top bars, dividers |
| Fire Ember Pulse | Scale 1→1.15→1 with glow | 2s | Live dots, status indicators |
| War Ember | Border + shadow red pulse | 2.5s | At-war cards |
| Gauge Glow | Drop-shadow intensity oscillates | 3s | Gauge fills |
| Seal Rotate | 360deg rotation | 12-30s linear | Decorative rings |

### Hover Transitions

| Element | Effect | Duration |
|---------|--------|----------|
| Cards | `translateY(-4 to -5px)`, border brighten, gold glow | 0.3-0.35s |
| Shield items | `translateY(-4px) scale(1.08)`, brightness(1.15) | 0.25s |
| Nav icons | `scale(1.15)`, gold drop-shadow | 0.3s |
| Buttons | Shimmer sweep trigger, border brighten | 0.3s |
| Stat boxes | `translateY(-2 to -3px)`, border brighten | 0.25s |
| Links | Color brighten, gold underline appear | 0.2s |

### Stagger Patterns

- **List items:** 0.04-0.06s per item (max 0.8s total)
- **Grid cards:** 0.1s per card (4 cards = 0.1-0.4s)
- **Stat boxes:** 0.07s per stat (6 stats = 0.15-0.5s)
- **Dashboard counters:** 0.1s per counter

---

## Design System Notes for Generation

When generating new pages or components for this project, apply these rules:

```
SURFACE: Use `linear-gradient(170deg, #1e1a14, #141110)` for card backgrounds.
BORDER: Use `2px solid rgba(140,110,40,.25)` for cards, brighten to .45 on hover.
RADIUS: Use `6px` for cards/panels, `4px` for buttons/badges, `3px` for pills.
SHADOW: Always include `inset 0 0 30px rgba(0,0,0,.12)` for atmospheric depth.
TEXT: Use 'Cinzel', serif for headings, values, labels. Georgia for body text.
GOLD: Values in `#d4b878`, headings in `#ecdcc0`, labels in `#8a7a5a`.
DIVIDERS: Gold gradient lines with centered ✦ ornament symbols.
SHIELDS: Use clip-path polygon with gold gradient frame (4-8px padding).
HOVER: translateY(-4px), border brighten, gold box-shadow glow.
ANIMATE: Entrance with translateY + scale, ambient with gold glow pulse.
BUTTONS: Dark leather gradient, Cinzel font, shimmer sweep on hover.
EMPTY: Dark leather tint background with italic muted text.
SECTION HEADS: Cinzel 11-14px, uppercase, letter-spacing 3px, gold underline, ✦ ornament.
```

---

## v2.4.0 Addendum — Immersion Overhaul Patterns

The v2.4.0 release introduced a handful of new visual patterns that should be reused (not reinvented) for future work. This section documents them.

### 9-Theme System (Theme Variants)

The base palette above remains the **Parchment** theme. 8 additional variants are activated via `html.theme-{id}` classes and override CSS custom properties. Theme IDs: `parchment` (default, no class), `iron`, `oak`, `empire`, `aserai`, `battania`, `khuzait`, `sturgia`, `vlandia` (each Calradian culture).

**Rules for theme-aware components:**
- Use `var(--accent)` / `var(--accent-glow)` for gold-role colors when you want them to follow the theme
- Hardcode `#d4b878` / `rgba(184,140,50,.X)` when the element should **always** look Viking-gold regardless of theme
- Certain components (Scribe's Codex scroll, Quick Search palette) are **theme-invariant** by design — they use hardcoded parchment overrides so they feel like real in-world artifacts
- Theme switch triggers `body.theme-switching` for 600ms → use that class to suppress animations during the transition

### Parchment Scroll Container

A new high-drama container used for the Scribe's Codex keyboard help overlay. When content should feel like an unfurled scroll:

```
OUTER: linear-gradient(180deg, #e8d4a0 → #b89858) — aged parchment base
OVERLAY 1: repeating-linear-gradient fiber texture at mix-blend-mode: multiply, 75% opacity
OVERLAY 2: 4 radial-gradient burnt corners at mix-blend-mode: multiply
FINIALS: Top + bottom carved wooden bars (28px) with metal bosses (SVG)
BORDER: 3px solid #6a4820 (dark oak) on left/right edges only
SHADOW: 0 30px 70px rgba(0,0,0,.85) — heavy drop shadow (filter, not box)
INNER PANELS: linear-gradient(180deg, rgba(255,240,200,.25), rgba(180,130,60,.08)) — embossed parchment inserts
PANEL BORDER: 1px solid rgba(100,55,15,.35) with inset highlight
```

Used for: keyboard help overlay. Reuse for: compendium entries, lore popups, any "this is a real scroll" moment.

### Embossed Gold Key (`kbd` styling)

For any keyboard shortcut key glyph — always use this exact recipe, never the generic `kbd` default:

```
BACKGROUND: linear-gradient(180deg, #f4e0a0 0%, #d4b060 45%, #a87830 70%, #8a5818 100%)
BORDER: 1px solid #5a3010
BOX-SHADOW:
  inset 0 1px 1px rgba(255,240,200,.8),   /* top highlight */
  inset 0 -2px 2px rgba(80,40,10,.45),    /* bottom shadow */
  inset 0 0 0 1px rgba(120,70,20,.3),     /* bevel */
  0 1px 2px rgba(40,20,5,.5)              /* drop */
COLOR: #2a1608 (very dark inked text)
TEXT-SHADOW: 0 1px 0 rgba(255,240,200,.5) — engraved into metal
FONT: Cinzel, 10px, weight 600
HOVER: translateY(-1px) + outer gold glow 0 0 8px rgba(220,180,110,.4)
```

Used for: Scribe's Codex, Quick Search footer hints, `.kbd-inline`, `.qs-num` (numbered result shortcuts).

### Floating Hint Chip (Prefix Affordance)

Used when awaiting a second keystroke (G+X Gmail-style nav). A fixed-position pill at `bottom: 100px; left: 50%` showing the pressed key + available options. The pressed key pulses with animated box-shadow to sell that it's being held:

```
CHIP: linear-gradient(180deg, rgba(28,16,6,.98), rgba(14,8,2,.98))
BORDER: 2px solid rgba(212,184,120,.7)
ANIMATION: kbdKeyGlow 1s alternate — box-shadow oscillates between .4 and .75 intensity
SCREEN RING: body.kbd-awaiting::after — inset 0 0 0 2px rgba(184,140,50,.35) pulsing at .9s
```

Reuse for: any "waiting for second input" affordance — menu driller, multi-select confirm, etc.

### Drifting Ember Particles (CSS-Only)

GPU-composited ember particles that rise from the bottom of a container. No JS needed — 15 `<span>` children with `nth-child` animation staggers:

```
PARENT: position relative, overflow hidden
CHILD: position absolute, bottom -20px, width 3px, height 3px, border-radius 50%
BACKGROUND: radial-gradient(circle, #f8ecc8, #e8c468, rgba(184,140,50,0))
BOX-SHADOW: 0 0 8px #f8ecc8, 0 0 16px rgba(240,200,120,.4)
ANIMATION: linear infinite, 12-21s duration, staggered delays
KEYFRAMES: translateY(0 → -100vh) with subtle X drift and opacity fade in/out
```

Used on: map page, home page, login intro. Reuse for: any "this scene has atmosphere" moment.

### Theme-Invariant Overlay Pattern

When a container should **always** look like aged parchment regardless of the global theme:

```css
html[class*="theme-"] .my-container,
html.theme-iron .my-container,
html.theme-oak .my-container {
  background: linear-gradient(180deg, #e8d4a0 0%, #b89858 100%) !important;
}
```

Used for: Scribe's Codex parchment scroll. Reuse for: map, journal entries, dialog popups — anywhere the parchment metaphor outranks the UI accent color.

### Fuzzy Search Result Row (Quick Search Pattern)

For any searchable list with multi-category results:

```
ROW: display:flex, gap:14px, padding:10px 22px, border-left:3px solid transparent
ACTIVE: gradient 90deg from rgba(120,80,32,.55) → rgba(30,18,6,.35), border-left gold
ICON TILE: 28px square, radial-gradient(circle at 35% 35%, rgba(184,140,50,.25), rgba(50,30,10,.4)), 1px gold border, 4px radius
NAME: Cinzel 14px, #e8d8b8 (active: #f8ecc8 + 0 0 12px gold text-shadow)
SUB: Cinzel 10.5px, #8a7a58, italic
HIGHLIGHT (<mark class="qs-hl">): linear-gradient(180deg, rgba(240,200,120,.5), rgba(200,140,50,.35)), color #fff4d4, text-shadow 0 0 6px gold
TYPE BADGE: 3px 8px pill, 8.5px letter-spaced, per-type color (heroes red-gold, clans green, kingdoms gold, holds blue, pages purple, actions red)
KEYBOARD HINT NUMBER (.qs-num): embossed gold kbd pattern, opacity .6 inactive / 1 active
```

### Arrival Burst Effect (Teleport / Portal / Summon)

A one-shot dramatic arrival animation dropped into a container via JS. 3 expanding rings + 1 rotating star + 12 radial ember spokes, all centered:

```
CONTAINER: position absolute, translate(-50%,-50%), pointer-events none, z-index 60
RING × 3: 0 → 180px border, opacity 1 → 0, .12s stagger between rings
  - Ring 1: rgba(240,200,120,.85)
  - Ring 2: rgba(255,220,160,.7) delay .12s
  - Ring 3: rgba(220,160,80,.55) delay .24s
STAR: font-size 42px, color #f8ecc8, text-shadow 0 0 20px/40px/60px gold
  - Animation: scale 0 → 1.4 → .9, rotate 0 → 360deg, cubic-bezier(.34,1.56,.64,1)
EMBERS × 12: 4px circles, 30° rotated via --a custom property
  - Animation: translateX 0 → 90px, opacity 1 → 0, 1.3s ease-out
TOTAL DURATION: 1.6s, then remove element
```

Used for: map teleport arrival. Reuse for: achievement unlock, rank-up, battle victory summary, any "this is a moment" beat.

### Title Cartouche (Context Banner)

A floating banner at the top of a major view showing its name + live context:

```
SHAPE: Custom SVG path (elongated hexagon with notched edges)
FILL: rgba(28,18,8,.92)
STROKE: 1.4px #d4b878
SIZE: 360×46px, position absolute top 18px, left 50% translateX(-50%)
TITLE: Cinzel 15px, weight 700, letter-spacing 4px, #f4e4c0, 0 0 15px gold text-shadow
SUBTITLE: Cinzel 10px italic, #c8a870, letter-spacing 1.8px
KICKERS: ✦ stars flanking the title, color #d4b878, animation mapCartK 3.5s (opacity .55 → 1, scale 1 → 1.12)
DROP SHADOW: filter drop-shadow(0 6px 14px rgba(0,0,0,.6))
```

Used for: map page ("CALRADIA — [KINGDOM]" + game date). Reuse for: detail view headers, stats dashboard title, chronicle timeline marker.

### Compass Rose (Decorative Instrument)

A small functional instrument in a corner of a map-like view:

```
SIZE: 108×108 SVG
FACE: radial-gradient from rgba(60,40,16,.4) → rgba(0,0,0,.85)
RING: 56r circle, 1.2 gold stroke
NEEDLE: 2 polygon halves — gold (north) + dark (south), 60,60 center pivot, ±3° infinite wander animation
CARDINAL LETTERS: N in #f4e4c0 weight 700, S/E/W in #c8a870
CENTER BOSS: gold circle with dark dot
FLOAT ANIMATION: translateY 0 → -3px, 6s alternate infinite
HOVER FILTER: drop-shadow 0 8px 24px rgba(240,200,120,.55)
```

Reuse for: any "instrument" that suggests analog precision — game clock, wind indicator, mood meter.

### Notes for Future Additions

- **Always** use `Cinzel` for UI chrome; reserve Georgia for long-form body only
- **Always** use the embossed gold key pattern for keyboard shortcuts — never raw `<kbd>` defaults
- **Prefer** CSS-driven animations over JS (ember particles, compass wander, ring pulses) — GPU compositor handles these without main-thread cost
- **When in doubt**, use `mix-blend-mode: multiply` for texture layers (grain, fibers, burnt edges) — it darkens the background where the texture is drawn, giving real-material feel
- **Arrival / departure** effects should last **no more than 1.6s** — longer feels sluggish, shorter feels accidental
- **Parchment scrolls** should always have **drop-shadow filter** rather than `box-shadow` so the shadow follows the rounded scroll shape

