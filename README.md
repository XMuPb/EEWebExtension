# EEWebExtension  
### The Living Archive of Calradia

> *"Every lord has a story. Every clan carries a legacy. Every kingdom rises and falls.  
> Now, their tales are written not just in blood and steel — but in a living manuscript  
> that breathes with the world itself."*

---

**EEWebExtension** transforms your Bannerlord encyclopedia into a **cinematic, real-time web experience**. While you conquer Calradia, a local web server runs silently in the background, serving a fully interactive encyclopedia to your browser — styled as a dark Viking manuscript illuminated by torchlight and forged gold.

Browse heroes, clans, kingdoms, and settlements. Read their histories as they unfold. Edit their stories, rename lords, rewrite lore, and track every war, every betrayal, every alliance — all from the comfort of your browser, your phone, or your tablet on the couch while the game runs on your PC.

This is not just a data viewer. This is your **war-room command table**, your **historian's desk**, and your **storyteller's journal** — all in one.

---

## What's New in v2.4.0 — The Immersion Overhaul

v2.4.0 transformed the web extension from "functional" into a **cinematic, data-dense, immersive campaign companion**. Every page got rebuilt with themed backdrops, auto-generated honorifics, animated counters, SVG gauges, and purpose-specific data panels. Highlights:

- 🎖 **9 themes** — Parchment / Iron / Oak + 6 Calradian culture themes (Empire / Desert / Highland / Steppe / Northern / Crimson)
- ⚙ **Unified Preferences modal** — Layout density, 5 font sizes, 4 font families, 9 themes, navigation style, sound FX with volume + 4 presets + per-event toggles + animated equalizer
- 🏆 **32 Achievements** with Glory rank progression (9 tiers) and **real reward grants** (Gold / Influence / Renown) via new server endpoint
- 📜 **Calradia map backdrop** on every polished page with parchment grain + drifting embers
- 🗺 **Live Campaign Map** — settlements, parties, kingdom borders, war arrows, calibration, bookmarks, plan mode
- 📊 **Stats Dashboard** with 9 charts (donuts, leaderboards, age pyramid, prosperity heatmap, wealth sparkline)
- 🏆 **Clan Power Rankings** — top-3 podium, filter chips, CSV export
- 👑 **Commander Hub** — 7 tabs (Character / Inventory / Party / Quests / Clan / Kingdom / Chronicle), each with immersive top-strip
- 💰 **Caravan Ledger trade routes** — category icons, animated arrows, best-market recommendation with profit multiplier
- ⚖ **Hero comparison** — skill radar overlay (up to 4 heroes) with best-stat highlighting and crowns
- 🎛 **Context-aware Player HUD** — auto-hides on browsing pages, stays visible where party state matters
- 🔔 **Themed Notifications** — filter chips, search, snooze, dismiss, NEW pills, bell swing animation
- 📜 **Changelog/About tabbed modal** — version timeline, features grid, credits, links

---

## What You Get

### A Full Encyclopedia in Your Browser

Open `http://127.0.0.1:8080/` and you're greeted by a **cinematic intro sequence** — Norse rune circles rotating behind forged gold lettering, embers drifting across the screen, a shimmer loading bar filling as the world data streams in. Click to enter, and the Living Archive opens before you.

### The Home Page — Your War Room

A dashboard that shows the state of your world at a glance:

- **Animated counters** that tick up to show total heroes, clans, settlements, and kingdoms — each number rising like a war tally
- **Summary statistics** — how many descriptions you've written, how many tags you've applied, how many journal entries chronicle your deeds
- **Live Chronicle** — a scrolling feed of game events happening right now. Wars declared, battles won, heroes captured, children born — every event categorized with color-coded icons (war in red, family in rose, politics in steel blue, crime in amber)
- **Quick navigation** to any section of the encyclopedia

### Heroes — Every Face, Every Story

A grid of hero cards, each showing:
- **Game-extracted portraits** or hand-crafted culture-specific artwork (12 cultures represented: Empire, Aserai, Battania, Khuzait, Sturgia, Vlandia, Nord, and more)
- **Occupation badges** — Lord, Wanderer, Companion, Gang Leader, Merchant, each with distinct styling
- **Culture color accents** — a warm strip at the top of each card matching their faction
- **Deceased indicators** — faded cards with skull badges for the fallen
- **Smart filtering** — filter by Alive, Dead, Noble, Companion, or any specific culture

Click any hero and the **detail view** unfolds:
- **Parallax portrait** with gold metallic frame
- **Traits and skills** in a compact sidebar with icon tiles
- **Info stats** — age, culture, kingdom, clan, occupation, all in forged gold cells
- **Lore section** — five rich text fields (Backstory, Personality, Goals, Relationships, Rumors) styled like manuscript pages with aged parchment texture
- **Relation Notes** — card-based notes for each friend and enemy, with portraits and edit buttons
- **Friends & Enemies** — portrait grids with metallic intensity bars showing relationship strength, color-coded green/red
- **Family** — linked family members with relationship labels (Spouse, Mother, Father, Sibling, Child)
- **Timeline** — chronological events from the game's chronicle, staggered entrance animations
- **LIVE badge** — a pulsing green dot confirming the view auto-syncs with the game every few seconds

### Clans — Banners and Bloodlines

Each clan card displays:
- **Shield-shaped banner** rendered from the game's actual banner code, framed in gold gradient with drop shadows
- **Tier badges** with embossed gold seal styling
- **War ember glow** — cards pulse with a red ember animation when the clan is at war
- **Member counts, strength, renown** — key stats at a glance

Clan detail views show members, territory (towns, castles, villages), wars, leader info, and kingdom affiliation — all with edit capabilities.

### Settlements — Prosperity and Power

Settlement cards show:
- **Type badges** — Town (gold crown), Castle (stone tower), Village (green field)
- **Metallic prosperity bars** with a forged metal sheen effect
- **Owner clan and kingdom** affiliation
- **Governor** information

Detail views reveal prosperity, loyalty, security, food stocks, garrison, militia, workshops, bound villages, and notables.

### Kingdoms — Diplomacy at a Glance

The kingdoms page features:
- **Featured Kingdom Cards** — expanded cards for major kingdoms with shield-framed banners, diplomacy shield grids showing ally/enemy relations, and inline culture/strength stats
- **War Board** — a dedicated section showing active wars between kingdoms, with paired cards and shared-enemy analysis
- **Peace Board** — peaceful relations mapped out with alliance indicators
- **Culture filters** — filter kingdoms by culture with count badges

Kingdom detail views include clan lists, fief inventories, military strength gauges, and full diplomatic status.

### Chronicle — The Living History

A full-page timeline of every notable event in your campaign:
- **Category filters** — War, Family, Politics, Crime, Economy, Military, General — each with a unique icon and color
- **Search** — find events by keyword
- **Color-coded entries** — instantly distinguish war declarations from weddings from crimes
- **Entity linking** — hero, clan, kingdom, and settlement names are clickable links that navigate to their detail pages
- **Real-time updates** — new events appear automatically without page refresh

---

## Editing — Rewrite History

Every detail view includes a full suite of editing tools. All changes sync instantly with the game's Editable Encyclopedia mod — what you write in the browser appears in the in-game encyclopedia, and vice versa.

### Hero Editing
| Action | Description |
|--------|-------------|
| **Edit Name & Title** | Rename any hero. Give them a title like "The Unbroken" or "Shield of the North" |
| **Edit Description** | Write a custom biography that replaces the game-generated text |
| **Edit Lore** | Five rich fields: Backstory, Personality, Goals, Relationships, Rumors |
| **Change Culture** | Reassign a hero to any culture — or type a custom one |
| **Change Occupation** | Lord, Wanderer, Merchant, Gang Leader, Artisan, Preacher, and more |
| **Edit Tags** | Comma-separated tags for organization and filtering |
| **Relation Notes** | Write notes about relationships with specific friends/enemies |

### Clan / Kingdom / Settlement Editing
| Action | Description |
|--------|-------------|
| **Edit Name** | Rename clans, kingdoms, and settlements |
| **Edit Description** | Custom descriptions and lore |
| **Edit Banner** | Paste a banner code to change the clan/kingdom sigil |
| **Edit Tags** | Organizational tags |
| **Add Journal** | Timestamped journal entries — your personal chronicle for any entity |

---

## The Viking Design System

The entire interface is built on a custom design system inspired by dark medieval manuscripts, Nordic forge-work, and Bannerlord's own visual language.

### Visual Identity
- **Void Black** backgrounds (`#0a0908`) with warm leather panel gradients
- **Polished Gold** accents (`#d8b35f`) — borders, values, highlights, interactive elements
- **Parchment** text (`#e2d4b5`) on dark surfaces — readable, warm, immersive
- **Cinzel** serif font — ornamental headings that feel carved in stone
- **Georgia** body text — classical manuscript readability

### Atmospheric Effects
- **Ember particles** — floating fire motes drift across the screen
- **Gold spark trail** — your cursor leaves a trail of golden sparks
- **Shimmer sweep** — buttons and nav items shimmer with a diagonal light sweep on hover
- **Gold glow pulse** — cards and counters breathe with a slow ambient gold glow
- **Scroll-reveal** — sections and cards animate into view as you scroll down
- **War ember** — cards for entities at war pulse with a red ember border
- **Seal rotation** — decorative Norse elements rotate slowly in the footer

### Component Library
- **Viking Cards** — dark leather gradient backgrounds, 2px gold borders, inset atmospheric shadows, hover lift with gold glow
- **Shield Frames** — `clip-path: polygon()` shield shapes with gold gradient borders for banners
- **Gold Dividers** — gradient lines with centered ornament symbols
- **Gauge Circles** — SVG gauges with animated stroke-draw and pulsing glow
- **Forged Buttons** — dark leather with Cinzel uppercase text, shimmer sweep on hover
- **Status Badges** — war (red), peace (green), neutral (muted) with matching backgrounds

---

## Live Sync — The World Breathes

When you open a detail view, a **LIVE** badge appears in the corner. Every 8 seconds (configurable), the view silently re-fetches data from the running game and updates:

- **Stats change** — a hero gains a level, a settlement's prosperity rises, a kingdom's strength shifts
- **Timeline grows** — a new battle, a marriage, a betrayal appears in the chronicle
- **Friends become enemies** — diplomacy shifts reflected in real-time
- **Names update** — if you edit a name in-game, the web reflects it within seconds

You can watch the world evolve while you play. Open the web on a second monitor, or on your phone propped up next to your screen, and see the Living Archive update as events unfold.

---

## Player HUD — Context-Aware

A persistent stats bar pinned to the bottom of the viewport showing your player character's live data:

- **Gold** — your current denars
- **Speed** — party movement speed
- **Health** — current HP
- **Troops** — party size
- **Food** — stock remaining
- **Morale** — army spirit
- **Influence** — political power
- **Wage** — daily cost

**Context-aware visibility** — the HUD automatically appears on pages where party state is relevant (Home / Commander / Map / Detail views) and hides on browsing pages (Heroes / Clans / Settlements / Kingdoms lists / Chronicle / Stats / API) so you get more screen space when you don't need the live stats. Slides up/down with a smooth cubic-bezier animation on page transitions.

Each stat has its own color and animates when values change.

---

## Commander Hub — Your Full Command Center

The Commander page is a 7-tab dashboard for managing everything about your hero and party:

### Character Tab
- **Auto-generated title ribbon** — honorific based on renown + combat/leader ratings ("Legendary Champion", "Battle Master", "Master of Arms", etc.)
- **Level-up banner** — pulsing gold notification when you have unspent attribute or focus points
- **XP progress ring** — SVG donut showing progress to next level with current XP
- **Hero switcher** — browse stats for any clan member, not just the player
- **Attribute chips** with + buttons for point allocation
- **Skills grid** grouped by attribute, each with focus pip editor and perk tree
- **Build Planner** — preview how spending points would change your character before committing
- **Compare Heroes** button to side-by-side any clan member

### Inventory Tab (4 modes)
- **Inventory Title Ribbon** + **dual gauges** (Gold + Carry Weight) + **heaviest items ribbon**
- **Equipment mode** — Gear Score medallion, Auto-Equip button, paper-doll slot view
- **Inventory mode** — category filter chips (Goods / Food / Gear / Mounts) with live counts
- **Party mode** — per-member gear score bars showing power rating
- **Trade mode** — Best Market recommendation with profit multiplier and Travel button

### Party Tab
- **Power/Capacity gauges** — SVG rings showing party strength and how full the troop limit is
- **Readiness indicator** — 3-point check (Food / Morale / Capacity) → READY / CAUTIOUS / STRAINED / CRITICAL
- **Army composition bars** — Infantry / Ranged / Cavalry / Horse Archer percentages
- **Economy panel** — wages, treasury, "can afford X days"
- **Supplies panel** — food, morale, speed, days remaining

### Quests Tab
- **Questmaster title** — auto-generated from active/completed counts
- **Active/Next Due gauges** — SVG rings with urgency coloring
- **Potential Rewards chips** — optimistic total + risk-adjusted expected value
- **Biggest Prize** indicator showing the highest single-quest reward
- **Deadline Map** — horizontal timeline with each quest as a positioned dot, red danger zone for <3 days, orange warn zone for 3-7 days
- **Filter chips**: Active / Completed / All
- **Sort dropdown**: Time Remaining / Name / Giver

### Clan Tab (4 sub-tabs)
- **Clan honorific** — "Royal Dynasty" / "Great House" / "Notable Noble House" / "Growing Warband"
- **Tier / Influence / Solvency gauges**
- **Tier progress bar** showing renown needed for next tier
- **Members / Parties / Fiefs / Other** sub-tabs, each with themed summary strip

### Kingdom Tab (5 sub-tabs)
- **Kingdom title** — "Dominant Empire" / "Foremost Power" / "Great Power" / "Waning Realm"
- **Rank / Fiefs / Wars gauges** — including rank among all kingdoms
- **Active Wars strip** — red panel with every enemy kingdom as a clickable chip
- **Clans / Fiefs / Policies / Armies / Diplomacy** sub-tabs with summary strips

### Chronicle Tab
- **Chronicler honorific** — "Saga of an Age" / "Epic Chronicle" / "A Storied Life"
- **Category stats row** — dynamic cards for battles / sieges / deaths / family / tourneys / quests
- **Filter chips** — 10 categories with live counts
- **Vertical gold timeline** with date markers and category-colored entry icons

---

## Preferences — Unified Settings Modal

Click ⚙ in the topbar (or sidebar rail) to open the themed Preferences modal with 5 option cards:

### Layout Density
3 visual preview cards showing stacked-bar illustrations at each density:
- **Compact** — ~75% spacing, see more at a glance
- **Normal** — balanced default
- **Comfortable** — ~115% spacing, extra breathing room

### Typography
- **5 font sizes**: X-Small (13px) / Small (14px) / Normal (16px) / Large (17px) / X-Large (19px)
- **4 font families** with live Aa previews:
  - **Classical** — Cinzel + Georgia (default)
  - **Medieval** — UnifrakturMaguntia + Cinzel (blackletter with fallback)
  - **Manuscript** — Palatino Linotype + Book Antiqua
  - **System** — native platform fonts for readability
- **3 line-spacing options**: Tight (1.35) / Normal (1.6) / Loose (1.85)
- **Live preview box** rendering sample text in the selected combination

### Color Theme (9 themes)
3×3 grid of themed preview cards, each with 4-color swatches and a tagline:

| Theme | Accent | Inspired By |
|---|---|---|
| **Parchment** | Gold `#d4b878` | Classic default |
| **Iron** | Steel `#a8b4c4` | Cool forged steel |
| **Oak** | Brown `#d8a050` | Warm forest wood |
| **Imperial** | Purple `#a878d0` | Empire culture |
| **Desert** | Sand `#e8c450` | Aserai culture |
| **Highland** | Green `#80c078` | Battania culture |
| **Steppe** | Teal `#68c0c0` | Khuzait culture |
| **Northern** | Winter blue `#6090d0` | Sturgia culture |
| **Crimson** | Burgundy `#d06048` | Vlandia culture |

Each theme rewrites the full CSS variable palette (`--bg`, `--panel`, `--gold`, `--paper`, `--leather`). Smooth opacity cross-fade when switching.

### Navigation Style
- **Top Bar** — default horizontal nav
- **Sidebar Rail** — vertical 220px rail with collapse-to-66px toggle, mini player HUD, notification badges, calendar widget, drifting embers, Calradia map backdrop

### Sound Effects
- **Master toggle**
- **Volume slider** (0-100%) with iOS-style gold knob and live preview tone on drag
- **4 Sound Themes**: Default / Horn / Parchment / Steel (each with distinct oscillator + frequency patterns)
- **Per-event toggles** — separate on/off for Click / Hover / Open events
- **Test buttons** for each event type
- **Animated 7-bar equalizer** that pulses on every sound played

All changes apply instantly with live preview. **Reset to Defaults** button in the footer.

---

## Achievements — Glory Rank Progression

The Home page features a **32-achievement system** across 7 categories, with a **9-tier Glory rank** progression and **real reward grants** that actually modify your save.

### Categories
- **⚔ Combat** (7) — First Blood, Veteran, Champion, Master of War, Siege Veteran, Wall Breaker, Survivor
- **💰 Economy** (4) — Coin Purse, Wealthy, Rich Lord, Treasury
- **👑 Politics** (7) — Sworn Vassal, Influencer, Power Broker, Fief Holder, Landed Lord, Realm Builder, Throne Claimant
- **🏆 Renown** (4) — Local Hero, Notable, Renowned, Legendary
- **💍 Family** (3) — Wedlock, Heir Apparent, Family Patriarch
- **🛡 Diplomacy** (3) — Warmonger, Peacemaker, Allied
- **🗺 Explorer** (4) — Cartographer, Realm Tracker, Chronicle Reader, Historian

### Reward System
Each achievement grants a real reward when claimed:
- **Gold** — 300 to 50,000 denars (direct `Hero.Gold` property write)
- **Influence** — 50 to 400 (via `ChangeClanInfluenceAction.Apply`)
- **Renown** — 25 to 300 (via `GainRenownAction.Apply`)
- **Glory** — cosmetic counter for rank progression

Claim rewards individually or use the **🎁 Claim All** button in the header.

### Glory Ranks
As you accumulate glory, your title rises:

| Rank | Glory | Visual |
|---|---|---|
| Wanderer | 0 | Bronze |
| Initiate | 25 | Tarnished gold |
| Squire | 75 | Dim gold |
| Knight | 150 | Warm gold |
| Captain | 300 | Bright gold |
| Lord | 500 | Rich gold |
| Champion | 800 | Radiant gold |
| Marshal | 1200 | Shining gold |
| Legend | 1800 | White-gold |

Anti-double-claim protection via `localStorage.achievements_claimed` — claimed achievements can't be re-claimed on subsequent sessions.

---

## Stats Dashboard — 9 Charts

The dedicated Stats page gives you a full campaign dashboard with:

- **Animated counter cards** — Heroes / Clans / Kingdoms / Towns / Castles / Villages / Battles / Sieges / Deaths / Tournaments / Weddings / Wars
- **Kingdom Strength leaderboard** — top 8 with animated horizontal bars and banner thumbnails
- **Settlement Distribution donut** — towns/castles/villages with center totals
- **Hero Cultures donut** — top 8 cultures by hero count
- **Battle Outcomes donut** — victories/sieges/deaths breakdown
- **Hero Gender donut**
- **Age Pyramid** — men left, women right, 7 brackets with animated bars
- **Most Mentioned Heroes** — top 10 by chronicle mention count with portraits
- **Settlement Prosperity Heatmap** — 60 settlements colored by prosperity
- **Wealthiest Clans table** with banners
- **Wealth Over Time sparkline** — auto-records gold/influence every 60s to localStorage, renders dual-line history chart
- **Delta indicators** — ▲▼ arrows showing change vs last visit
- **Auto-refresh** — optional 30s tick

---

## Rankings — Top-3 Podium

Dedicated Rankings page with a **top-3 podium** (silver-gold-bronze layout with roman numeral medals), filter chips (At War / At Peace / My Kingdom / Independent / Minor Factions), search, group-by-kingdom toggle, and **CSV export** of the full leaderboard.

Each clan row shows:
- Rank with gold for top 3
- Leader portrait thumbnail
- Clan banner
- Name + member count + kingdom
- Tier badge (T1-T6, gradient-colored)
- Strength / Renown / Influence / Wealth columns
- **Trend arrows** ▲▼ comparing to last visit
- Animated bar fill

Player clan highlighted with gold left-border and "YOU" badge.

---

## Trade Routes — The Caravan Ledger

Click 💰 in the topbar to open the **Caravan Ledger** modal:

- **Animated camel** icon in the header (bobs + rotates)
- **Stat counters** — Total Routes / Max Profit / Avg Profit / Unique Items
- **Category filter chips** — All / High Profit / 🍞 Food / 🧵 Cloth / ⚔ Weapons / 🐎 Beasts / 🪙 Goods / Misc
- **Search** by item or town name
- **Sort** by Profit / Margin% / Item / Buy Town / Sell Town
- **Route cards** with 3-column layout: Buy Town | Item + arrow + margin | Sell Town
- **Profit pills** — visual intensity scales with profit (huge/big/normal tiers)
- **Category icons** auto-detected from item name via regex
- **Click any town** to track it on the map

---

## Compare Heroes

Click ⚖ in the topbar to open the **Heroes Compare** modal:

- **Portrait search** — find heroes by name with live dropdown (up to 4)
- **Hero cards** with culture-colored portrait border and banner thumbnails
- **Stat Comparison grid** — matrix layout, best stat per row gets 👑 crown + gold glow
- **Skill Radar Overlay** — 8-axis SVG chart with up to 4 heroes layered as translucent polygons, 4-color palette, drop-shadow glows
- **Color-coded legend**

---

## Notifications Panel

Themed bell icon in the topbar. Opens a 420px panel with:

- **Priority counts strip** — Critical / High / Med / Low
- **Filter chips** — All / Critical / High / Med / Low
- **Search** by title or description
- **Snooze 1h** button — hides badge for 60 minutes
- **Clear all** button
- **NEW pills** on unseen notifications
- **Per-item dismiss** buttons (appears on hover)
- **Bell swing animation** when new notifications arrive

State persisted via localStorage: `notifSeen`, `notifDismissed`, `notifSnoozedUntil`.

---

## Detail Views — 4 Entity Types

All four detail views (Hero / Settlement / Clan / Kingdom) share a unified pattern:

### Top Section
- **Title Ribbon** with auto-generated honorific
- **Quick Actions toolbar** — Family Tree / Compare / Open Clan / Open Kingdom / Travel / Track on Map
- **Animated stat badges** — counters tick up cubic-ease

### Hero-Specific
- **Skill Radar** — 8-axis SVG chart of top skills

### Clan-Specific
- **Members ribbon** — scrolling portraits of clan members
- **Wars strip** — red-themed panel showing enemy factions

### Kingdom-Specific
- **Member Clans ribbon** — sorted by tier, banner thumbnails
- **Active Wars strip** — each enemy as a clickable chip

### All Entity Types
- **Recent Events** — last 5 chronicle entries mentioning the entity, with themed icons per event type
- **Timeline section** — shows first 10 entries, "Show all N" button expands a scrollable inner box (420px max) so the page never stretches unbounded
- **Journal rail** (non-hero entities) — right sidebar, max-height with internal scroll, newest-first, entry count badge

---

## Culture Pantheon Panels

When you filter Heroes / Clans / Settlements / Kingdoms by culture, a **Cultural Pantheon panel** replaces the default spotlight:

- **Per-culture theming** — each Calradian culture gets its own accent color (Empire purple, Aserai sand, Battania green, Khuzait teal, Sturgia blue, Vlandia red) that flows through via CSS variables
- **Culture icon** — 🏛 / 🏜 / 🌿 / 🐎 / ❄ / 🏰
- **Lore tagline** — flavor description
- **Stat cards** — Heroes / Clans / Kingdoms / Settlements / Fiefs of that culture
- **Most Renowned Heroes** — top 5 with portraits
- **Strongest Clans** — top 5 with banner thumbs
- **Notable Settlements** — top 5 by prosperity

---

## Kingdoms War Room / Hall of Peace

On the Kingdoms list page:

### War Room (when "At War" filter is active)
- **Red-themed panel** with flickering torch icon
- **Active war count** and **total forces engaged** in the header
- **Battle Theatre cards** — each war as a 1-vs-1 layout: kingdom A banner + ruler portrait | pulsing ⚔ center + dual strength bars | kingdom B banner + ruler portrait
- **Advantage indicator** — "X ADVANTAGE" or "EVEN" based on strength ratio
- Click either side to open kingdom detail

### Hall of Peace (when "At Peace" filter is active)
- **Green-themed panel** with floating dove icon
- **Stability percentage** — % of kingdoms currently at peace
- **Peace cards** for each peaceful realm with ruler info, fiefs, strength

---

## Sidebar Rail — Collapsible Nav

An alternate navigation mode (toggle in Preferences → Navigation Style):

- **Calradia map backdrop** + parchment grain + drifting embers
- **Animated gold shield logo** with shimmer sweep
- **Mini Player HUD** at the top — live portrait + name + gold/influence/troops/HP
- **Calendar widget** — season icon, game date, "Spring in Calradia" subtitle
- **Navigation links** with active-page indicator and **notification badges** (red pulsing count on Home for critical notifs, Kingdoms for active wars)
- **Search input**
- **4×3 Action grid** — command palette, keyboard help, sound, preferences, about, compare, trade, back-to-top
- **Status pill** at bottom
- **Collapse to 66px icon-only** mode — hides text, centers icons, persists via localStorage

---

## Configuration

All settings live in the Editable Encyclopedia MCM menu under **9. Extensions / EEWebExtension**.

### Web Server
| Setting | Default | What It Does |
|---------|---------|-------------|
| Enable Web Extension | ON | Master toggle for the web server |
| Web Server Port | 8080 | Change if port 8080 is taken |
| Auto-Open Browser | OFF | Launches your browser when you load a campaign |
| Allow External Access | OFF | Open the server to your local network — browse on your phone |
| Enable Editing from Web | ON | Set to OFF for read-only mode (safe for streaming) |
| Enable Portrait Extraction | ON | Extract hero face renders from the game engine |

### Live Sync
| Setting | Default | What It Does |
|---------|---------|-------------|
| Live Sync on Detail Views | ON | Auto-refresh detail pages with game data |
| Live Sync Interval | 8 seconds | How often to poll (2-60s range) |
| Live Chronicle Updates | ON | Push new events to the home page feed |

### Web Display
| Setting | Default | What It Does |
|---------|---------|-------------|
| Show HUD Stats | ON | Player stats bar at the top |
| Show Intro Screen | ON | The cinematic Viking intro animation |
| Show Ember Particles | ON | Floating fire motes (disable for performance) |
| Show Gold Spark Trail | ON | Cursor spark effect (disable for performance) |
| Enable Sound Effects | ON | Subtle UI sounds on hover and click |
| Enable Scroll Animations | ON | Cards animate into view on scroll |
| Cards Per Page | 60 | How many cards per list page (20-200) |

### Quick Actions
| Button | What It Does |
|--------|-------------|
| Open Web Encyclopedia | Launches `http://127.0.0.1:8080/` in your default browser |

---

## REST API

The web server exposes **60+ REST endpoints** covering every editing capability of the Editable Encyclopedia mod. All responses are JSON. The API runs at `http://127.0.0.1:8080/api/`.

<details>
<summary><strong>Core Data (10 endpoints)</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Server health check + game metadata |
| GET | `/api/heroes` | All heroes (name, culture, clan, kingdom, age, occupation, portrait) |
| GET | `/api/hero/{id}` | Full hero detail (stats, traits, skills, friends, enemies, family, lore, timeline) |
| GET | `/api/clans` | All clans (name, culture, tier, strength, members, wars, banner) |
| GET | `/api/clan/{id}` | Clan detail (leader, members, territory, kingdom, wars) |
| GET | `/api/kingdoms` | All kingdoms (name, ruler, clans, fiefs, strength, diplomacy) |
| GET | `/api/kingdom/{id}` | Kingdom detail (leader, clans, fiefs, wars, troop counts) |
| GET | `/api/settlements` | All settlements (name, type, culture, owner, prosperity, garrison) |
| GET | `/api/settlement/{id}` | Settlement detail (all stats, workshops, notables, bound villages) |
| GET | `/api/chronicle` | All chronicle events (entity, date, text) |
</details>

<details>
<summary><strong>Descriptions (4 endpoints)</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entity/{id}/description` | Get custom description |
| PUT | `/api/entity/{id}/description` | Set custom description |
| GET | `/api/descriptions` | All descriptions |
| GET | `/api/descriptions/count` | Total count |
</details>

<details>
<summary><strong>Names, Titles & Banners (4 endpoints)</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entity/{id}/name` | Get custom name & title |
| PUT | `/api/entity/{id}/name` | Set name and/or title |
| GET | `/api/entity/{id}/banner` | Get custom banner code |
| PUT | `/api/entity/{id}/banner` | Set banner code |
</details>

<details>
<summary><strong>Cultures & Occupations (6 endpoints)</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hero/{id}/culture` | Get hero culture |
| PUT | `/api/hero/{id}/culture` | Set hero culture |
| GET | `/api/hero/{id}/occupation` | Get hero occupation |
| PUT | `/api/hero/{id}/occupation` | Set hero occupation |
| GET | `/api/cultures` | All custom culture assignments |
| GET | `/api/occupations` | All custom occupation assignments |
</details>

<details>
<summary><strong>Lore Fields (3 endpoints)</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hero/{id}/lore` | All lore fields for a hero |
| GET | `/api/hero/{id}/field/{key}` | Get one lore field |
| PUT | `/api/hero/{id}/field/{key}` | Set lore field (backstory, personality, goals, relationships, rumors) |
</details>

<details>
<summary><strong>Tags (12 endpoints)</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entity/{id}/tags` | Get entity tags |
| PUT | `/api/entity/{id}/tags` | Set entity tags |
| GET | `/api/tags` | All tags |
| GET | `/api/tags/unique` | All unique tag names |
| GET | `/api/tags/usage` | Tag usage counts |
| GET | `/api/tags/objects/{tag}` | Entities with specific tag |
| POST | `/api/tags/rename` | Rename tag globally |
| POST | `/api/tags/remove` | Remove tag globally |
| POST | `/api/tags/merge` | Merge two tags into one |
| POST | `/api/tags/add-bulk` | Add tag to multiple entities |
| POST | `/api/tags/remove-bulk` | Remove tag from multiple entities |
| POST | `/api/tags/clear-all` | Nuclear option: clear all tags |
</details>

<details>
<summary><strong>Tag Categories, Presets & Notes (10 endpoints)</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tag-categories` | All categories |
| PUT | `/api/tag-category/{name}` | Create/update category |
| DELETE | `/api/tag-category/{name}` | Delete category |
| GET | `/api/tag-presets` | All presets |
| PUT | `/api/tag-preset/{name}` | Create/update preset |
| DELETE | `/api/tag-preset/{name}` | Delete preset |
| POST | `/api/tag-preset/{name}/apply` | Apply preset to entity |
| GET | `/api/tag-note/{objectId}/{tag}` | Get tag note |
| PUT | `/api/tag-note/{objectId}/{tag}` | Set tag note |
| GET | `/api/tag-notes/{objectId}` | All tag notes for entity |
</details>

<details>
<summary><strong>Journal (5 endpoints)</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entity/{id}/journal` | Get journal entries |
| POST | `/api/entity/{id}/journal` | Add new entry |
| PUT | `/api/entity/{id}/journal` | Edit entry by index |
| DELETE | `/api/entity/{id}/journal/{index}` | Delete entry by index |
| DELETE | `/api/entity/{id}/journal` | Clear all entries |
</details>

<details>
<summary><strong>Relation Notes, History & Tags (8 endpoints)</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/relation-note/{heroId}/{targetId}` | Get relation note |
| PUT | `/api/relation-note/{heroId}/{targetId}` | Set relation note |
| GET | `/api/relation-notes` | All relation notes |
| GET | `/api/relation-notes/count` | Total count |
| GET | `/api/relation-history/{heroId}/{targetId}` | Relation change history |
| GET | `/api/relation-history-for/{targetId}` | All history for a hero |
| GET | `/api/relation-note-tag/{heroId}/{targetId}` | Get auto-tag + suggestion |
| PUT | `/api/relation-note-tag/{heroId}/{targetId}` | Set tag and/or lock |
</details>

<details>
<summary><strong>Auto-Tag Thresholds (4 endpoints)</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auto-tag-threshold/{heroId}` | Get per-hero thresholds |
| PUT | `/api/auto-tag-threshold/{heroId}` | Set enemy/friend thresholds |
| GET | `/api/auto-tag-thresholds` | All thresholds |
| GET | `/api/auto-tags/{objectId}` | Get auto-generated tags |
</details>

<details>
<summary><strong>Custom Cultures & Lore Templates (7 endpoints)</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/culture-definitions` | All custom culture definitions |
| PUT | `/api/culture-definition/{id}` | Create/update culture definition |
| DELETE | `/api/culture-definition/{id}` | Delete culture definition |
| GET | `/api/lore-templates/roles` | Available template roles |
| GET | `/api/lore-templates/keys` | Available field keys |
| GET | `/api/lore-template/{fieldKey}/{heroId}` | Get resolved lore template |
| GET | `/api/lore-templates/role/{role}` | All templates for a role |
</details>

<details>
<summary><strong>Import / Export (9 endpoints)</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/export` | Export everything to shared JSON |
| POST | `/api/import` | Import from shared JSON |
| POST | `/api/import-detailed` | Import with per-section breakdown |
| POST | `/api/export/heroes` | Export hero descriptions |
| POST | `/api/export/clans` | Export clan descriptions |
| POST | `/api/export/kingdoms` | Export kingdom descriptions |
| POST | `/api/export/settlements` | Export settlement descriptions |
| POST | `/api/export/banners` | Export banner codes |
| POST | `/api/import/banners` | Import banners only |
</details>

<details>
<summary><strong>Portraits, Banners & Utilities (12 endpoints)</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/portraits` | List custom + extracted portraits |
| POST | `/api/hero/{id}/portrait` | Upload custom portrait PNG |
| GET | `/api/hero/{id}/portrait` | Check if portrait exists |
| POST | `/api/extract-portraits` | Extract all game portraits |
| GET | `/api/banners` | List exported banner PNGs |
| GET | `/api/statistics` | Basic stats |
| GET | `/api/statistics/detailed` | 20+ detailed stat fields |
| GET | `/api/entity/{id}/timestamp` | Last edit timestamp |
| GET | `/api/shared-file-path` | Shared file location |
| POST | `/api/purge-orphans` | Clean up deleted hero data |
| POST | `/api/reset-all` | Reset all descriptions |
| GET | `/api/web-settings` | MCM settings for the web |
</details>

---

## Installation

### Quick Start

1. Install [Editable Encyclopedia](../EditableEncyclopedia/) if you haven't already
2. Copy the `EEWebExtension/` folder into:
   ```
   Steam/steamapps/common/Mount & Blade II Bannerlord/Modules/
   ```
3. In the Bannerlord launcher, enable **EEWebExtension** (make sure it loads after EditableEncyclopedia)
4. Launch a campaign (new or saved)
5. Open your browser to **http://127.0.0.1:8080/**
6. The Living Archive awaits

### Phone / Tablet Access

1. In MCM settings, enable **Allow External Access** under 9. Extensions / EEWebExtension / Web Server
2. Find your PC's local IP (run `ipconfig` in Command Prompt, look for IPv4 Address)
3. On your phone/tablet, open `http://YOUR_PC_IP:8080/`
4. Browse the encyclopedia from the couch while the game runs

### Requirements

- Mount & Blade II: Bannerlord v1.2.x or v1.3.x
- Editable Encyclopedia mod (loaded before EEWebExtension)
- Native, SandBoxCore, Sandbox, StoryMode (base game modules)
- Bannerlord.Harmony v2.4.2.225+

---

## Module Structure

```
EEWebExtension/
  SubModule.xml                 Module manifest & load order
  README.md                     This file
  bin/
    Win64_Shipping_Client/
      EEWebExtension.dll        C# server, API routes, banner/portrait export
  Web/
    index.html                  SPA shell (nav, modals, intro overlay, HUD)
    css/
      style.css                 Viking design system (~14,000 lines after v2.4.0 rebuild)
    js/
      app.js                    Application logic (~17,000 lines after v2.4.0 rebuild)
      api.js                    REST API client (60+ methods)
      banner.js                 Client-side SVG banner renderer
      banner_colors.js          Banner color palette lookup
    bg.png                      Cinematic Viking longhouse background
    bannerlord_hero.png         Hero page banner
    bannerlord_clan.png         Clan page banner
    bannerlord_settlement.png   Settlement page banner
    bannerlord_kingdoms.png     Kingdom page banner
    bannerlord_chronicle.png    Chronicle page banner
    logo.jpg                    Nav bar brand logo
    Hero/
      bannerlord_hero_viking.png  Fallback portrait (Viking warrior)
    Potraits/                   Culture portrait packs
      Aserai/                   Desert warriors
      Battania/                 Forest clans
      Khuzait/                  Steppe riders
      Nord/                     Norse Vikings
      Northern_Empire/          Roman-inspired
      Southern_Empire/          Byzantine-inspired
      Western_Empire/           Late Roman
      Mixed Empire/             Cross-culture
      Sturgia/                  Slavic warriors
      Vlandia/                  Feudal knights
    Settlement/
      Town.png                  Town type image
      Castle.png                Castle type image
      Village.png               Village type image
    Skills/                     18 skill icons (Athletics, Bow, etc.)
    Traits/                     Trait icons (Valor, Honor, etc.)
    Perks/                      Perk icons
    BannerIcons/                Banner icon sprites for rendering
    Banners/                    (runtime) Exported banner PNGs
    Portraits/                  (runtime) Extracted game portrait PNGs
    .design/
      DESIGN.md                 Visual design system documentation
```

---

## Technical Architecture

### Server Side (C#)

- **`EEWebExtensionEntry.cs`** — `MBSubModuleBase` entry point. Starts the web server on `OnGameStart`, registers `WebExportBehavior` as a campaign behavior, processes main-thread queue on `OnApplicationTick`
- **`EncyclopediaWebServer.cs`** — `HttpListener`-based REST server on a background thread. Handles static file serving, API routing (60+ endpoints), portrait extraction via game engine reflection, banner PNG rendering, and color palette extraction from `BannerManager`
- **`WebExportBehavior`** — Campaign behavior that detects when the player reaches the campaign map (via `ScreenManager.TopScreen` reflection) before starting banner/portrait export. Prevents export during character creation

### Client Side (Vanilla JS)

- **No frameworks, no build step, no npm** — pure HTML/CSS/JS served as static files
- **`app.js`** (~4800 lines) — SPA router, page renderers, detail views, edit modals, live sync polling, visual effects (particles, sparks, scroll reveals, parallax), sound system
- **`api.js`** — Typed API client wrapping all 60+ REST endpoints with `fetch()`
- **`style.css`** (~4000 lines) — Complete Viking design system with CSS custom properties, animations, responsive layout

### Data Flow

```
Game (C#)                    Web Server (C#)               Browser (JS)
  Hero.Name ──────────>  GET /api/heroes ─────────>  Store.heroes[]
  EditBehavior ────────> GET /api/hero/{id} ──────>  openDetail()
  SetCustomName() <───── PUT /api/entity/{id}/name <── editName()
  Banner.Serialize() ──> ExportBanners() ─────────>  <img src="Banners/id.png">
  ThumbnailCreator ────> ExtractPortraits() ──────>  <img src="Portraits/id.png">
```

### Key Design Decisions

1. **Custom data merging** — All list/detail API responses merge custom names, titles, cultures, and banners from `EncyclopediaEditBehavior.Instance` so the web always shows the latest custom values
2. **MapScreen detection** — Banner export only starts when `ScreenManager.TopScreen.GetType().Name.Contains("MapScreen")` — prevents export during character creation or menus
3. **Live sync** — `setInterval` polling (not WebSocket) because the game server doesn't support push notifications. The `isSync` flag on `openDetail()` suppresses loading spinners and preserves scroll position
4. **Banner rendering** — Server-side PNG generation using `System.Drawing.Bitmap`. Parses banner codes, composites background mesh + icon layers with correct colors from `BannerManager.GetColor()`
5. **Portrait color correction** — Game renders portraits in linear color space; the server applies sRGB gamma correction on-the-fly when serving portrait PNGs

---

## Changelog

### v2.4.0 — The Immersion Overhaul (2026-04-15)

**A massive UI/UX rebuild that transforms every page into a themed, data-dense, immersive experience.**

#### New — Shared Visual Language
- **Calradia map backdrop** on every polished page (`#page-X::before` with `brightness(.16) saturate(.45) sepia(.3) blur(2.5px); opacity:.32`)
- **Parchment grain noise overlay** via SVG data URI, `mix-blend-mode:overlay`
- **Warm radial gradients** — layered `rgba(244,168,48,.08)` and `rgba(184,140,50,.07)` pools
- **Drifting ember particles** on dashboard containers via `statEmberRise` keyframe
- **Gold knotwork dividers** — inline SVG separators between sections
- **`.hd-title-ribbon` class** — reusable auto-generated honorific ribbons with gold border + shimmer sweep animation
- **`.hd-badges` + `.hd-badge`** — animated counter card grid with `data-count-target` → `animateCounters` cubic-ease tick-up
- **`.hd-actions` + `.hd-action-btn`** — themed quick-action toolbar with hover lift and shimmer
- **`.hp-stats-row` + `.hp-toolbar`** — list page quick-stat cards and filter chip toolbars
- **Culture color variables** (`--hd-accent`, `--hd-glow`, `--cult-color`) thread per-entity theming through shared CSS

#### New — 9 Color Themes
- **Parchment** (default gold) / **Iron** (steel) / **Oak** (warm brown)
- **Imperial** (Empire purple) / **Desert** (Aserai sand) / **Highland** (Battania green)
- **Steppe** (Khuzait teal) / **Northern** (Sturgia blue) / **Crimson** (Vlandia burgundy)
- Each theme rewrites 14 CSS variables on `<html>` including `--bg`, `--panel`, `--paper`, `--gold`, `--leather`
- Smooth `.theme-switching` opacity cross-fade on swap
- Theme preview grid with 4-color swatches and per-theme tagline in Preferences modal

#### New — Unified Preferences Modal
- Replaces 5 scattered topbar buttons (theme cycle, font size, compact, sidebar, sound) with one themed ⚙ modal
- **Layout Density** with 3 visual preview cards (Compact / Normal / Comfortable) showing stacked-bar illustrations at actual spacing ratios
- **Typography** card with 5 font sizes (X-Small→X-Large), 4 font families (Classical/Medieval/Manuscript/System) with live Aa previews, 3 line-spacing levels, live sample text box
- **Color Theme** 3×3 grid with per-theme glow and active-state checkmark
- **Navigation Style** segment (Top Bar / Sidebar Rail)
- **Sound Effects** full panel: master toggle, volume slider (0-100%), 4 sound presets (Default/Horn/Parchment/Steel) with per-event toggles, test buttons, animated 7-bar equalizer
- Live preview — every change applies instantly, no Apply button
- **Reset to Defaults** in footer

#### New — Achievements + Glory Rank System
- **32 achievements** across 7 categories (Combat / Economy / Politics / Renown / Family / Diplomacy / Explorer)
- **9 Glory ranks** (Wanderer → Initiate → Squire → Knight → Captain → Lord → Champion → Marshal → Legend)
- **Real reward grants** via new `POST /api/player/grantreward` C# endpoint:
  - **Gold** — direct `Hero.Gold` property write (with fallback to `ChangeHeroGold` and `_gold` field)
  - **Influence** — reflection on `ChangeClanInfluenceAction.Apply(clan, amount)`
  - **Renown** — reflection on `GainRenownAction.Apply(hero, amount, false)` with 2/3-arg overload tolerance
- **Per-card Claim button** with pulsing gold animation
- **🎁 Claim All** header button that sequentially grants every unclaimed reward
- **Anti-double-claim** via `localStorage.achievements_claimed`
- **Toast notifications** sequenced for newly-unlocked achievements on page load

#### New — Stats Dashboard
- Full dedicated `/stats` page with 9 charts
- **Kingdom Strength leaderboard** with animated horizontal bars
- **Settlement Distribution / Hero Cultures / Battle Outcomes / Hero Gender donut charts** (pure SVG, no library)
- **Age Pyramid** — men left, women right, 7 age brackets
- **Most Mentioned Heroes** list from chronicle text scanning
- **Settlement Prosperity Heatmap** — 60 settlements colored by prosperity
- **Wealthiest Clans table** with banners and animated bars
- **Wealth Over Time sparkline** — auto-records every 60s to `localStorage.wealthHistory`, renders dual-line chart
- **Delta indicators** ▲▼ comparing to last visit via `localStorage.statsPrev`
- **Animated toolbar** with Refresh / Auto-refresh 30s / Reset Baseline

#### New — Rankings Page
- **Top-3 Podium** with silver-gold-bronze layout, roman numeral medals, radial metallic backgrounds
- **Summary cards** — Total Clans / Avg Strength / Total Members / Total Wealth / Your Rank
- **Filter chips** — All / At War / At Peace / My Kingdom / Independent / Minor Factions
- **Search** by clan name
- **Group by Kingdom** toggle
- **Show All / Top 60** toggle for pagination
- **📥 CSV Export** — downloads full rankings with all metrics
- **Per-row leader portraits**, **tier badges** (T1-T6 gradient colored), **trend arrows** comparing to last visit
- **Player clan highlight** with gold left-border and "YOU" badge

#### New — API Docs Page
- **Animated terminal** cycling through endpoint paths with typewriter effect
- **Live base-URL bar** with reachability blip (green pulse when server is responsive)
- **Summary counter cards** — GET/POST/PUT/DELETE totals
- **Filter chips** per HTTP method
- **Search** by path or description
- **Sticky section rail** (left) with per-section counts
- **▶ Try It** button on GET endpoints — fires real fetch, shows live JSON response in terminal-style modal with status, time, byte count, 50KB truncation
- **📋 Copy URL / cURL** buttons per endpoint
- **📥 Postman Collection Export** — downloads Postman v2.1 JSON

#### New — Home Page
- **6 Quick Action buttons** — Live Map / Commander / Stats / Rankings / Trade / Compare (themed with per-button color accent)
- **Royal Calendar** widget — floating season icon, big date, in-game clock with blinking colon
- **Treasury sparkline** — reads `wealthHistory`, dual-line gold+influence chart with min/peak/samples stats
- **Faction Power bars** — top 8 kingdoms with animated bars and your kingdom highlighted
- **Weekly Highlights** — top 5 significant chronicle events (war > capture > death > peace > siege > marriage)
- **News from Calradia** — auto-generated state summary (war count, sieges, strongest realm, wealthiest house, etc.)
- **Achievements panel** with Glory rank header + category-grouped cards
- **Quote of the Day** — 12 Calradian proverbs, deterministic per day
- **Season particles** — winter snow / autumn leaves / spring petals / summer embers auto-detected from game date

#### New — Commander Hub
- **7 tabs** — Character / Inventory / Party / Quests / Clan / Kingdom / Chronicle
- **Each tab has a themed top strip** with auto-generated honorific + gauges + stat counters
- **Character tab** — Title ribbon, XP progress ring (SVG donut), level-up pulsing banner
- **Inventory tab** — Gold + Weight gauges, heaviest items ribbon, 4 modes (Equipment / Inventory / Party / Trade) each with their own mode toolbar
- **Inventory Equipment mode** — Gear Score medallion + Auto-Equip button
- **Inventory Inventory mode** — category filter chips (All / Goods / Food / Gear / Mounts)
- **Inventory Party mode** — per-member gear score bars
- **Inventory Trade mode** — Best Market recommendation card with profit delta
- **Party tab** — Power + Capacity SVG gauges, Readiness 3-check indicator (READY/CAUTIOUS/STRAINED/CRITICAL)
- **Quests tab** — Active + Deadline gauges, reward chips (optimistic + risk-adjusted), biggest prize highlight, deadline timeline with danger/warn zones
- **Clan tab** — Tier/Influence/Solvency gauges, tier progress bar, 4 sub-tabs (Members / Parties / Fiefs / Other) each with summary strips
- **Kingdom tab** — Rank/Fiefs/Wars gauges, Active Wars strip, 5 sub-tabs (Clans / Fiefs / Policies / Armies / Diplomacy) each with summary strips
- **Chronicle tab** — Category stats row, filter chips, vertical timeline with date markers and colored entry icons

#### New — List Pages (Heroes / Clans / Settlements / Kingdoms)
- **Daily spotlight cards** — Hero/Clan/Settlement/Kingdom of the Day (deterministic per day)
- **Hall of Fame / Top Houses / Most Prosperous / Great Powers ribbons** — top 8 scrolling strips
- **Quick filter chips** above the grid
- **Sort dropdowns** — Default / Name / Renown / Age / Level / Tier / Strength / Wealth / Members / Prosperity
- **View toggle** — Grid / Compact
- **🎲 Surprise Me button** — opens a random entity
- **Animated stat counters** (7 per page)

#### New — Kingdoms War Room / Hall of Peace
- **War Room mode** (when "At War" filter is active) — red-themed panel with flickering torch, Battle Theatre cards showing each war as A-vs-B with dual strength bars + advantage indicator
- **Hall of Peace mode** (when "At Peace" filter is active) — green-themed panel with floating dove, stability percentage, peaceful realm cards

#### New — Cultural Pantheon Panels
- When a culture filter is active on any list page, replaces the default spotlight with a themed Pantheon
- **Per-culture theming** via CSS variables — Empire purple, Aserai sand, Battania green, Khuzait teal, Sturgia blue, Vlandia red
- **Lore taglines** and **culture icons** (🏛 🏜 🌿 🐎 ❄ 🏰)
- **Top 5 renowned heroes / strongest clans / notable settlements** of that culture

#### New — Detail Views (Hero / Settlement / Clan / Kingdom)
- **Auto-generated Title Ribbon** — honorific computed from entity state
- **Quick Action buttons** — Family Tree / Compare / Open Owner / Open Kingdom / Travel / Track on Map
- **Animated stat badges** — age / level / renown / influence / friends / enemies / family / journal
- **Hero Skill Radar Chart** — 8-axis SVG with cubic-ease scale-in animation
- **Clan Members ribbon** — scrolling portraits
- **Clan/Kingdom Wars strip** — red-themed enemy list
- **Kingdom Member Clans ribbon** — sorted by tier with banner thumbs
- **Recent Events** — last 5 chronicle entries mentioning the entity

#### New — Compare Heroes Modal
- **Add Random button**, **Clear All**, **Max 4 heroes**
- **Culture-themed portrait rings** and clan banner thumbnails
- **Stat Comparison matrix** — best stat per row gets 👑 crown + gold glow highlight
- **Skill Radar Overlay** — 8-axis SVG with up to 4 heroes as translucent polygons (gold/green/blue/pink palette)
- **Color-coded legend**

#### New — Trade Routes (Caravan Ledger)
- Dedicated themed modal replacing the basic table view
- **Animated camel icon** in header
- **Stat counters** — Routes / Max Profit / Avg Profit / Unique Items
- **Category filter chips** — All / High Profit / Food / Cloth / Weapons / Beasts / Goods / Misc (auto-detected via regex)
- **Search** by item or town
- **Sort dropdown** — Profit / Margin% / Item / Buy Town / Sell Town
- **Route cards** with 3-column layout, dashed arrow with gold arrowhead, margin% label, profit pills with 3-tier intensity (huge / big / normal)
- **Click town to track on map**

#### New — Notifications Panel
- **Priority counts strip** — Critical / High / Med / Low
- **Filter chips** and **search**
- **Snooze 1h** button and **Clear all**
- **NEW pills** on unseen notifications (tracked via `localStorage.notifSeen`)
- **Per-item dismiss** buttons (hover reveal)
- **Bell swing animation** when new notifications arrive

#### New — Changelog/About Modal
- Tabbed modal replacing the flat changelog page
- **📜 Changelog tab** — vertical version timeline with gold dot markers, status tags (LIVE/MAJOR/RELEASE), bullet lists
- **✨ Features tab** — grid of feature cards
- **❤ Credits tab** — big gold-bordered card with author medallion, built-with section, special thanks, license
- **🔗 Links tab** — GitHub / Steam Workshop / Discord / API Docs / Map / Rate the Mod buttons

#### New — Sidebar Rail Navigation
- Alternate 220px vertical nav replacing the topbar
- **Calradia map backdrop** + parchment grain + drifting embers
- **Animated gold shield logo** with shimmer sweep
- **Mini Player HUD** — live portrait, gold, influence, troops, HP
- **Calendar widget** — season icon, game date, subtitle
- **Navigation links** with active-page gold-glowing indicator and **notification badges**
- **Search input**
- **4×3 action grid** with 12 themed quick-action icons
- **Status pill** with player name + date
- **Collapse to 66px icon-only** mode (persistent via `localStorage.railCollapsed`)

#### New — Context-Aware Player HUD
- **Auto-hides on browsing pages** (Heroes/Clans/Settlements/Kingdoms/Chronicle/Stats/API/Rankings)
- **Visible on campaign-action pages** (Home/Commander/Map/Detail)
- Smooth cubic-bezier slide-in/out transition on page change
- Body class `.hide-hud` drives visibility

#### New — Universal Themed Tooltips
- Native `title=""` attributes intercepted and re-rendered in the themed `.game-tooltip`
- On mouseover: stashes original title to `data-orig-title`, removes live attribute, shows themed popup
- On mouseout: restores title for accessibility
- No HTML changes needed — works retroactively across the entire site
- `data-tip-name` structured tooltips still take priority

#### New — Detail View Limits
- **Timeline section** now shows first 10 entries in preview (newest first), with **Show all N entries** button that expands a scrollable inner box (420px max-height)
- **Journal rail** capped at `calc(100vh - 300px)` with internal scroll and gold-themed custom scrollbar
- **Entry count badges** on section headers

#### New — 5 Density Modes + Smooth Transitions
- **Compact / Normal / Comfortable** density levels affect stat cards, spotlights, ribbons, dashboards, commander sub-tabs
- Smooth `transition:padding .3s ease` on body
- Scale pulse animation when switching density

#### Changed — Chronicle Page Rebuild
- **Today in Calradia card** with most recent event at the top
- **8 animated stat cards** (battles / sieges / deaths / marriages / births / tournaments / wars)
- **3-widget row** — Events Through Time SVG bubble chart (bucketed by season), Event Types donut, Most Mentioned Heroes list
- **Quill scratch animation** in the widget corner
- **Quick filter chips** — All / War / Family / Politics / Crime / Battles / Deaths / Marriages
- **🎲 Random Event** button flashes a random entry in a toast
- **📥 Export TXT** — downloads full chronicle as plain text
- **Server-side deduplication** across timeline/journal/chronicle

#### Changed — Topbar and Footer
- **Topbar**: height 62px → 52px, padding tightened, page padding-top adjusted to 62px
- **Topbar scrolled state**: 54px → 46px
- **Footer**: padding `56px/48px` → `16px/18px` (saved 70px vertical), column layout → row, ornamental borders/seal/swords/subtitle hidden, kept only title + info line with solid gold text (fixed gradient-clip invisibility)

#### Fixed — Critical Bugs
- **Photo Mode removed** — deleted entirely (toggle, CSS, watermark, caption, toolbar) per user request
- **OBS Overlay Mode removed**
- **Medieval cursor always-on** — no longer a toggle, applied at document load
- **Modal containing-block bug** — removed `filter:` on body theme variants and `transform:perspective()` on `.hero-banner` that were breaking `position:fixed` modals (Changelog/About appearing at page bottom)
- **Chronicle entity-tag markup** — Weekly Highlights now use `textToHtml()` instead of `esc()` so chronicle tags like `<h:id>Name</h>` render as clickable links instead of raw `&lt;h:id&gt;`
- **`\u{25B6;}` typo** in sound events test button caused `SyntaxError` that killed the entire `app.js` parse, leaving browser stuck on "Connecting..." — fixed to `\u{25B6}`
- **`allKingdoms` variable collision** in Kingdom tab between outer function-scoped `var` in Diplomacy and inner `const` — renamed to `kdTopStripAllKingdoms`
- **Kingdom ruler field** — was reading `data.leader` but API returns `data.ruler`, fixed in Kingdoms page Spotlight, War Room battle cards, and Hall of Peace cards
- **Clan Rankings bar always 0%** — was reading `c.gold` but API returns `c.wealth`, fixed in field lookup, sort key, max calculation, and row cell
- **Rankings banners missing** — was using SVG fallback only, now uses pre-rendered PNGs from `Banners/{clanId}.png` with SVG fallback
- **Rankings podium medals clipped** — card had `overflow:hidden` for shimmer effect; moved shimmer to inner wrapper so medals can sit above the card edge without clipping
- **Sound update breaking server connection** — was actually client-side JS syntax error (`\u{25B6;}`); server was healthy, browser just couldn't parse app.js
- **Quest category detection** — wars now detected before "captured" regex, sieges before "captured", prevents misclassification
- **Chronicle entries showing raw `<k:id>` markup** — Quest tab and Weekly Highlights now pipe through `textToHtml()`
- **Native `title` tooltips broke single-line display** — added `.game-tooltip > .gtt-header:only-child{border-bottom:none}` for clean rendering when there's just a title, no body
- **Clan Parties role assignment only worked for main party** — added `partyId` parameter to `HandleAssignRole` C# method and `/api/player/partyroles/detail` endpoint, plus JS pre-selection of current assignments in dropdowns. Now companion parties with their own role slots can be managed from the Clan → Parties tab

#### Fixed — Smaller Issues
- Topbar "Editable Encyclopedia" text was too large (shrunk from 14px → 12px)
- Topbar nav menu was left-aligned (now centered via flex:1 on brand + topbar-right)
- Quest page redundant with Commander → Chronicle (removed Quest top-level page)
- Sidebar nav mode hid the page content (wasted 72px top padding when topbar is hidden — removed)
- HUD broke in sidebar nav mode (`left:210px` clobbered the `translateX(-50%)` centering — fixed with `calc(50% + 105px)`)
- Music toggle removed (Ambient music feature deleted per user request)
- Settlement prosperity heatmap missing images — now uses `Settlement/Town.png` / `Castle.png` as background with color tint overlay
- Rewards always showed 0 — fixed field name (`wealth` not `gold`)

#### New API Endpoints
- `POST /api/player/grantreward` — grants gold/influence/renown/glory to the player's hero (used by Achievements claim flow)
- `GET /api/player/partyroles/detail?partyId=X` — returns current role assignments for any clan party, not just main party
- Updated `POST /api/player/assignrole` — now accepts optional `partyId` body param to target specific clan parties

#### Removed
- **Photo Mode** — all code, CSS, UI toggles
- **OBS Overlay Mode** — all code, CSS, UI toggles
- **Medieval Cursor toggle** — now always on
- **Ambient Background Music** — all synth code, UI toggles
- **Quests dedicated page** — replaced by Commander → Chronicle integration
- **4 scattered topbar buttons** (theme cycle, font size, compact, sidebar nav) — consolidated into Preferences modal

---

### v2.3.5 — Bug Fix Release (2026-04-11)
- Fixed `isLoading` detection that was breaking initialization on fresh saves
- Fixed Living Chronicle popup appearing on every load
- Fixed name persistence visually after save + reload (Settlements, Clans, Kingdoms)
- Fixed settlement/clan/kingdom timeline duplicates (display-level dedup via `StripEntityMarkers`)
- Fixed Chronicle cross-object duplicates (HashSet keyed on `date + stripped_text`)
- Fixed journal duplicate accumulation on load
- Fixed stale lore edit replaying on description confirm (added `_popupGeneration` counter)
- Fixed custom settlement names not showing on map after save+load (Harmony prefix on `SettlementNameplateVM.RefreshValues()`)
- Added mid-game rename/banner-edit info messages explaining when updates require save+reload

### v2.3.0 — Culture Overhaul, Intro Dialog, 60+ Endpoints (2026-04-08)
- Culture display overhaul — custom cultures now visually update on Hero/Settlement/Clan/Kingdom Info sections
- `ApplyCulture()` sets `hero.Culture` and `hero.CharacterObject.Culture` via reflection + auto-updates owned settlements
- Party name update — custom names now update `PartyBase.<CustomName>k__BackingField` for map tooltip
- New Game Intro Dialog — "The Living Chronicle" appears on every new campaign (not save loads), lists keyboard shortcuts, includes Discord bug report link
- Culture Safety System — validation on save, orphan cleanup on load, null guard on settlement culture, thread-safe settlement tracking
- Fixed 5 Substring crashes in RelationNotesSectionInjector, SearchPanel, EncyclopediaEditBehavior
- Fixed dictionary enumeration crash in `PurgeOrphanedCustomEntries()`
- Fixed browser launch (3-method fallback: `cmd /c start` → `UseShellExecute` → `explorer.exe`)
- Fixed banner export timing (waits for `Campaign.TimeControlMode != Stop`)
- MCM Group Ordering fix (Extensions section now correctly at bottom of MCM)

### v2.2.0 — EEWebExtension Extracted as Separate DLL (2026-04-07)
- EEWebExtension extracted from main mod into its own DLL — install/remove independently
- 17 new MCM settings under **9. Extensions / EEWebExtension** group
- Web Server settings (port, auto-open, external access, read-only, portrait extraction)
- Live Sync settings (interval, chronicle updates)
- Web Display settings (HUD, intro, embers, spark trail, sounds, scroll animations, cards-per-page)
- New `GET /api/web-settings` endpoint — returns MCM configuration as JSON to the web app
- Custom data merging in all list/detail APIs (heroes, clans, kingdoms, settlements now return custom names/cultures/banners)
- Fixed party tooltip not showing custom names (3-method fallback: `SetCustomName` → `_customName` field → `_name` field)

---

### v1.0.0 — The Living Archive (2026-04-07)

**Initial Release**

#### Web Interface
- Full single-page application with 6 main pages (Home, Heroes, Clans, Settlements, Kingdoms, Chronicle)
- Viking/medieval dark theme with 62 color tokens, 4 font tiers, 12+ animation types
- Cinematic intro sequence with Norse rune circles, forged gold titles, and shimmer loading bar
- Responsive layout supporting desktop and mobile browsers
- Scroll-reveal animations, parallax effects, ember particles, gold spark cursor trail
- Subtle UI sound effects on hover, click, and navigation

#### Home Page
- Animated stat counters (heroes, clans, settlements, kingdoms)
- Live Chronicle feed with real-time event updates
- Summary statistics panel with description/tag/journal counts
- Viking-styled panels with gold ornamental dividers

#### List Pages
- Hero cards with game-extracted portraits, occupation badges, culture colors, deceased indicators
- Clan cards with shield-shaped banner frames, tier badges, war ember glow animations
- Settlement cards with type badges (Town/Castle/Village), prosperity bars
- Kingdom featured cards with diplomacy shield grids, war/peace boards
- Smart filtering by status, culture, type, and diplomacy
- Pagination with configurable cards-per-page

#### Detail Views
- 4 full detail views: Hero, Clan, Settlement, Kingdom
- 3-column layout with left rail (portrait/stats), main content, and right rail (journal)
- Live sync (LIVE badge) — auto-refresh every 8 seconds with game data
- Relation notes section with portrait cards and inline editing
- Friends/Enemies grids with metallic intensity bars
- Family section with relationship type labels and icons
- Lore section with manuscript texture and first-letter styling
- Timeline with staggered entrance animations
- Info stats in forged gold cells with tooltips

#### Editing
- Edit Name & Title (heroes get both, others get name only)
- Edit Description with textarea modal
- Edit Lore — 5 fields: Backstory, Personality, Goals, Relationships, Rumors
- Change Culture — dropdown from game cultures + custom input
- Change Occupation — dropdown of Bannerlord occupation types
- Edit Banner — paste banner code for clans/kingdoms/settlements
- Edit Tags — comma-separated with autocomplete suggestions
- Add Journal Entries — timestamped personal notes
- Relation Notes — per-friend/enemy notes with edit button on each card
- All edits sync instantly with the in-game Editable Encyclopedia

#### API
- 60+ REST endpoints covering every capability of the Editable Encyclopedia mod
- Core entity data (heroes, clans, kingdoms, settlements, chronicle)
- Full CRUD for descriptions, names, titles, banners, cultures, occupations
- Lore field read/write with template support
- Complete tag system (CRUD, bulk ops, rename, merge, categories, presets, notes)
- Journal management (add, edit by index, delete by index, clear)
- Relation notes and relation history
- Relation note tags with auto-suggestion and locking
- Auto-tag thresholds (per-hero customizable)
- Custom culture definitions
- Import/export (full and per-section)
- Portrait upload and game portrait extraction
- Banner PNG export from banner codes
- Detailed statistics (20+ fields)
- Web settings endpoint (reads MCM configuration)

#### Server
- C# HttpListener on configurable port (default 8080)
- MCM integration — 17 configurable settings under 9. Extensions/EEWebExtension
- Enable/disable from MCM, configurable port, external access toggle
- Auto-open browser option
- Read-only mode toggle
- Banner export waits for MapScreen (no export during character creation)
- Old banners and portraits cleared on new session/save load
- Portrait color correction (linear to sRGB gamma)
- CORS headers for local development

#### Player HUD
- Persistent stats bar showing Gold, Influence, Health, Troops, Morale, Speed
- Per-stat colors with animated value changes
- 5-second auto-refresh

#### Performance
- Scroll-reveal via IntersectionObserver (no scroll listeners)
- MutationObserver for dynamic content re-initialization
- Lazy image loading on card grids
- Background thread for banner/portrait export
- Configurable sync interval to balance responsiveness vs CPU

---

## Author

**XMuPb**

- Discord: [discord.com/users/404393620897136640](https://discord.com/users/404393620897136640)

---

*"The ink of the scholar is more sacred than the blood of the martyr."*  
*— In the halls of Calradia, both flow freely.*
