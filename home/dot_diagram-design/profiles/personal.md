<!-- diagram-design-profile
name: Personal 水色
slug: personal
source-url: none
created: 2026-08-17
updated: 2026-08-18
notes: ykm4 ベースから派生。personal プロファイル識別用の水色アクセント #1d7899
-->
# Style Guide

**The single source of truth for colors, typography, and tokens.** Every diagram draws from this — not from hex values inlined in other reference files. If you want to change the visual skin of Diagram Design, change this file.

Current skin is the Ykm4 editorial palette — warm off-white paper, dark teal-grey ink, sky-blue accent, grey-green muted — derived 2026-08-17 from the `ykm4` base profile (accent swapped to visually identify the personal Claude profile). Swap these values (or run [`onboarding.md`](onboarding.md)) and every new diagram inherits the new skin without touching any type-specific logic.

To generate your own from a website URL, see [`onboarding.md`](onboarding.md).

---

## Tokens

### Semantic roles

Every token is referred to by **semantic role**, not by its hex value. Type references (`type-*.md`) and SKILL.md say `accent`, not `#f7591f`.

| Role | Purpose | Default (light) | Default (dark) |
|---|---|---|---|
| `paper` | Page background, default node fill | `#fbfaf6` (paper) | `#12171a` |
| `paper-2` | Diagram container bg, secondary fill | `#f2f1ea` (sunk) | `#1a2124` |
| `ink` | Primary text, primary stroke | `#1c2b2d` (ink) | `#e6ebe4` |
| `muted` | Secondary text, default arrow stroke | `#52625f` (ink-soft) | `#a3b0ab` |
| `soft` | Sublabels, boundary labels | `#636f6b` (ink-faint) | `#9aa8a3` |
| `rule` | Hairline borders | `#d8ded4` (rule) | `#2e393a` |
| `rule-solid` | Stronger borders, baselines | `rgba(28,43,45,0.30)` | `rgba(230,235,228,0.30)` |
| `accent` | Focal / 1–2 max per diagram | `#1d7899` (accent) | `#7fd0e8` |
| `accent-tint` | Fill for accent-bordered boxes | `rgba(29,120,153,0.08)` | `rgba(127,208,232,0.10)` |
| `link` | HTTP/API calls, external arrows | `#2e5aa8` | `#6a95d8` |

> **Brand palette source:** this skin maps to Ykm4's design system (`~/.config/claude/_shared/rules/design-system.md`) — `ink #1c2b2d`, `ink-soft #52625f`, `ink-faint #636f6b`, `paper #fbfaf6`, `sunk #f2f1ea`, `rule #d8ded4`, `accent #1d7899` (dark variants from the same table). The `rule-solid` and `accent-tint` tokens are derived (ink/accent at opacity); `link` keeps the shipped blue because the source system defines no link color and its `alert #a63a2b` carries a warning meaning. The accent replaces the base deep green #2f6f4e so diagrams are identifiable per Claude profile. AA contrast on light paper: ink 14.0, muted 6.1, soft 5.0, accent 4.8.

> **Note:** The pre-baked example HTML files in `assets/` were built under an earlier skin. Regenerating them against the current `style-guide.md` is a v5.1 task. New diagrams the skill produces will use the tokens above.

### Inversion rule (light → dark)

Any `rgba(28,43,45, X)` in light becomes `rgba(230,235,228, X)` in dark. Same opacities, RGB flipped. The accent gets a slight hue-shift brighter (`#1d7899` → `#7fd0e8`) to read on dark paper.

### Series palette (multi-series chart types only)

A small set of desaturated, editorial-tone colors for chart types that genuinely need to distinguish multiple overlapping entities (currently: **radar**). The "1-focal" rule still holds — `accent` is reserved for the focal series; the palette below covers the rest.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `series-1` | `#7c8f6f` (sage) | `#9caf8f` | Non-focal series |
| `series-2` | `#5e7a9b` (dusty-blue) | `#82a0c0` | Non-focal series |
| `series-3` | `#b8915a` (mustard) | `#d3ad7a` | Non-focal series |
| `series-4` | `#9c6b50` (rust-brown) | `#b88670` | Non-focal series |
| `series-5` | `#6e6479` (slate) | `#8d8298` | Non-focal series |

Fills sit at `0.18` opacity light, `0.22` dark; strokes use the full color. **Don't backfill these tokens to non-chart types** — architecture, swimlane, etc. continue to use muted-ink variants. The series palette is opt-in for diagrams where overlapping shapes demand distinguishable color, not a license to add color elsewhere.

### Terminal skin (opt-in alternate)

A self-contained palette for the terminal-window primitive (see [primitive-terminal.md](primitive-terminal.md)) — a CLI-chrome register for dev-tool posts and technical social cards. It does not replace the default skin above and isn't affected by onboarding; it's a second, fixed skin you opt into per-diagram.

| Token | Hex | Purpose |
|---|---|---|
| `terminal-page` | `#0a0a0a` | Page background behind the window |
| `terminal-paper` | `#141414` | Window body, node fill |
| `terminal-bar` | `#1b1b1b` | Titlebar strip |
| `terminal-border` | `#2b2b2b` | Window border, hairlines |
| `terminal-ink` | `#f5f5f5` | Primary text, primary stroke (same white-smoke as default `ink`) |
| `terminal-muted` | `#9a9a9a` | Secondary text, sublabels, ring stroke |
| `terminal-soft` | `#5c5c5c` | Tertiary — inactive dots, spokes |
| `terminal-accent` | `#ff5a36` | The one accent — focal station, prompt sign, active dot |
| `terminal-accent-tint` | `rgba(255,90,54,0.12)` | Fill for accent-bordered boxes |

**1-accent rule still holds.** Everything that isn't `terminal-ink` or `terminal-muted`/`terminal-soft` should be `terminal-accent` — never introduce a second hue.

---

## Typography

| Role | Family | Size | Weight | Usage |
|---|---|---|---|---|
| `title` | Hiragino Mincho ProN (serif) | 1.75rem | 400 | Page H1 |
| `node-name` | Hiragino Sans | 12px | 600 | Human-readable labels |
| `sublabel` | ui-monospace (SFMono) | 9px | 400 | Port, protocol, URL, field type |
| `eyebrow` | ui-monospace (SFMono) | 7–8px | 500, tracked 0.18em, uppercase | Type tags, axis labels |
| `arrow-label` | ui-monospace (SFMono) | 8px | 400, tracked 0.06em | Arrow annotations |
| `callout` | Hiragino Mincho ProN *italic* | 14px | 400 | Editorial asides only |

### Font stack

System stacks only — no external stylesheet, no `<link>`. This skin must stay CSP-safe (the owner's artifact rules forbid webfonts).

```css
--font-title: "Hiragino Mincho ProN", "Yu Mincho", serif;
--font-body: "Hiragino Sans", "Yu Gothic", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
```

**Load-bearing rule:** Mono is for *technical* content (ports, commands, URLs, field types). Names go in the body sans (Hiragino Sans). Page title is mincho (serif). Italic mincho is reserved for annotation callouts (see [primitive-annotation.md](primitive-annotation.md)) — Japanese mincho has no true italic, so the browser synthesizes an oblique; that is acceptable. **Never JetBrains Mono** as a blanket "dev" font.

---

## Stroke, radius, spacing

| Token | Value | Use |
|---|---|---|
| `stroke-thin` | `0.8` | Tag-box outlines, leaf nodes |
| `stroke-default` | `1` | Most strokes |
| `stroke-strong` | `1.2` | Emphasis strokes |
| `radius-sm` | `0` | Small tags |
| `radius-md` | `0` | Node boxes |
| `radius-lg` | `0` | Containers, rings |
| `grid` | `4` | Every coord, size, and gap is divisible by 4 (hard rule) |

Radius is `0` across all sizes by owner mandate — the source design system forbids rounded corners (sharp corners, 1px rules). Do not "restore" shipped 4/6/8 values when editing this guide.

---

## Node type → treatment

Semantic role combinations — reference these by name in type specs.

| Type | Fill | Stroke |
|---|---|---|
| `focal` (1–2 max) | `accent-tint` | `accent` |
| `backend` | `#ffffff` (white) | `ink` |
| `store` | `ink @ 0.05` | `muted` |
| `external` | `ink @ 0.03` | `ink @ 0.30` |
| `input` | `muted @ 0.10` | `soft` |
| `optional` | `ink @ 0.02` | `ink @ 0.20` dashed `4,3` |
| `security` | `accent @ 0.05` | `accent @ 0.50` dashed `4,4` |

---

## Customizing the skin

Four options:

1. **Run onboarding** — see [`onboarding.md`](onboarding.md). Drop a URL; the skill extracts the palette + fonts and rewrites this file.
2. **Edit by hand** — change the hex values in the tables above. Run the pre-output taste gate afterward to verify the accent still reads as "focal" against the new paper color.
3. **Brand handoff** — paste your existing design-token JSON into a new section here and map its tokens to the semantic roles above.
4. **Client profiles** — save and switch named skins, or bind one to a project, using [`profiles.md`](profiles.md).

### Constraints (don't break these)

- **Contrast**: `ink` must hit WCAG AA on `paper`. `muted` must hit AA on `paper` for 11px+ text.
- **One accent**: pick one color for `accent`. Two accents erases the focal signal.
- **No rainbow palette**: if your brand ships 8 colors, pick 3 (paper, ink, accent). The rest become `muted` variants.
- **Serif + sans + mono**: three families, not more. If brand typography is all sans, keep Instrument Serif for `title` and `callout` anyway — the contrast is load-bearing.
- **Paper is warm-neutral, not pure white**: pure white turns the design sterile. Pick a cream, bone, or light grey with a hint of warmth.
- **Dot pattern is optional, not default**: the 22×22 dot pattern is an opt-in "dotted paper" variant (good for long-form editorial hero diagrams). The default background is a clean `paper` fill, no pattern. When the pattern is enabled, it should sit at ~10% opacity of `ink` on `paper` — visible but quiet.
- **Container is clean by default**: the diagram sits directly on the page paper, no secondary container background or border. A framed variant (`paper-2` bg + `rule` border + square corners (radius 0) + padding) is available as an opt-in for card-heavy layouts, but don't reach for it by default — the extra chrome fights the figure.
