<!-- diagram-design-profile
name: 方眼ロゴカード
slug: logo-card-grid
source-url: none
created: 2026-08-25
updated: 2026-08-26
notes: 方眼紙+ロゴカード様式の技術スタック図スキン。自作サンプルは ~/.diagram-design/references/logo-card-grid.svg
-->
# Style Guide

**The single source of truth for colors, typography, and tokens.** Every diagram draws from this — not from hex values inlined in other reference files. If you want to change the visual skin of Diagram Design, change this file.

Current skin is **方眼ロゴカード (Logo Card Grid)** — graph-paper background, white logo cards with rounded corners, blue primary-flow arrows with monospace labels, and vendor-brand-colored group containers. This skin is for product/tech-stack architecture diagrams, not corporate editorial figures.

## 参照画像

本プロファイルの正本は、本文の言語化（トークン表と「Logo-card conventions」）である。見た目の具体例は、本プロファイル自身の様式で描いた自作サンプル`~/.diagram-design/references/logo-card-grid.svg`を参照する。

**サンプルの構図:**

- 主要フロー（青実線矢印・左→右）: User（browser）→ `HTTPS` → React（frontend spa）→ `fetch` → Hono（http server）→ `SQL` → Cloudflare D1（sqlite db）
- グループ: オレンジ枠のCloudflareグループの中に、破線のWorkers Runtimeグループを入れ子にする。
- 配置: ReactとHonoはWorkers Runtimeの中、D1はCloudflareグループ直下に置く。
- 下段: 青枠のMonorepoグループにpnpm・Vite・Vitest・TypeScript・GitHub・Wranglerのカードを横一列に並べる。
- デプロイ線: WranglerからCloudflareグループへ`deploy`のグレー点線矢印を上向きに引く。

サンプルは実行フローと補助線しか含まない。失敗経路（`alert`）と監視・通知（`watch`）の見本は本文の「Arrows」の表を正とする。

---

## Tokens

### Semantic roles

Every token is referred to by **semantic role**, not by its hex value.

| Role | Purpose | Default (light) | Default (dark) |
|---|---|---|---|
| `paper` | Page background (behind the grid), default node fill | `#f6f8fb` | `#0f141a` |
| `paper-2` | Diagram container bg, secondary fill | `#edf1f7` | `#161d24` |
| `ink` | Primary text, primary stroke | `#1f2a37` | `#e5eaf0` |
| `muted` | Secondary text, secondary arrow stroke | `#5b6774` | `#9aa7b4` |
| `soft` | Sublabels, boundary labels | `#8a94a1` | `#7d8894` |
| `rule` | Hairline borders, grid lines | `#dfe6ee` | `#26303a` |
| `rule-solid` | Stronger borders, baselines | `rgba(31,42,55,0.30)` | `rgba(229,234,240,0.30)` |
| `accent` | Primary-flow arrows and their labels | `#2f7df6` | `#6ea8ff` |
| `accent-tint` | Fill for accent-bordered boxes | `rgba(47,125,246,0.08)` | `rgba(110,168,255,0.10)` |
| `link` | HTTP/API calls, external arrows | `#2f7df6` | `#6ea8ff` |
| `alert` | Failure-path arrows and their labels | `#CE0000` | `#FF7171` |
| `watch` | Monitoring / alarm-notification arrows and their labels | `#A58000` | `#FFC700` |

> **Style exceptions (documented, intentional):**
> 1. `link` equals `accent` — 平常時のフローはすべて同じ青で引く。
> 2. **矢印の色は意味を持つ**（`accent`＝実行フロー、`alert`＝失敗経路、`watch`＝監視・通知、`muted`＝補助）。この4色以外の線色は使わない。詳細は「Arrows」の表を参照する。
> 3. Group containers use **vendor brand colors**（"Logo-card conventions"を参照）。
>
> 意味色は線とその矢印ラベルにだけ使う。カードの塗り・枠・本文には持ち込まない（カードの識別はロゴが担うため）。
>
> `alert` と `watch` は、デジタル庁が公開するダッシュボードのカラーパレットから採る（`alert` はセマンティックカラーの Error / Red 900 `#CE0000`、`watch` はチャートの Yellow 800 `#A58000`）。色覚多様性とコントラストの検証を経た公開値であり、赤と黄で色相が離れているため失敗と監視を取り違えにくい。出典: <https://www.digital.go.jp/resources/dashboard-guidebook/color-palette/color-code>
>
> 背景 `paper` に対するコントラストは `alert` 5.5:1、`watch` 3.5:1、`accent` 3.7:1 である。線（図形）の 3:1 は全て満たす。9px の矢印ラベルで AA（4.5:1）まで上げたい場合は `watch` を `#8A6B00` に落とす（黄の色相は保ったまま 4.7:1 になる）。

### Inversion rule (light → dark)

Any `rgba(31,42,55, X)` in light becomes `rgba(229,234,240, X)` in dark. Same opacities, RGB flipped. The accent shifts brighter (`#2f7df6` → `#6ea8ff`) to read on dark paper. Logo assets swap to their `_dark` variants where available (`~/.diagram-design/assets/logos/`).

### Series palette (multi-series chart types only)

A small set of desaturated colors for chart types that genuinely need to distinguish multiple overlapping entities (currently: **radar**). `accent` is reserved for the focal series; the palette below covers the rest.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `series-1` | `#7c8f6f` (sage) | `#9caf8f` | Non-focal series |
| `series-2` | `#5e7a9b` (dusty-blue) | `#82a0c0` | Non-focal series |
| `series-3` | `#b8915a` (mustard) | `#d3ad7a` | Non-focal series |
| `series-4` | `#9c6b50` (rust-brown) | `#b88670` | Non-focal series |
| `series-5` | `#6e6479` (slate) | `#8d8298` | Non-focal series |

Fills sit at `0.18` opacity light, `0.22` dark; strokes use the full color. Don't backfill these tokens to non-chart types.

### Terminal skin (opt-in alternate)

A self-contained palette for the terminal-window primitive — unchanged from the shipped default and unaffected by this skin.

| Token | Hex | Purpose |
|---|---|---|
| `terminal-page` | `#0a0a0a` | Page background behind the window |
| `terminal-paper` | `#141414` | Window body, node fill |
| `terminal-bar` | `#1b1b1b` | Titlebar strip |
| `terminal-border` | `#2b2b2b` | Window border, hairlines |
| `terminal-ink` | `#f5f5f5` | Primary text, primary stroke |
| `terminal-muted` | `#9a9a9a` | Secondary text, sublabels, ring stroke |
| `terminal-soft` | `#5c5c5c` | Tertiary — inactive dots, spokes |
| `terminal-accent` | `#ff5a36` | The one accent — focal station, prompt sign, active dot |
| `terminal-accent-tint` | `rgba(255,90,54,0.12)` | Fill for accent-bordered boxes |

**1-accent rule still holds inside the terminal skin.**

---

## Typography

| Role | Family | Size | Weight | Usage |
|---|---|---|---|---|
| `title` | Hiragino Sans (sans) | 1.5rem | 700 | Page H1 |
| `node-name` | Hiragino Sans | 13px | 700 | Product name under each logo card |
| `sublabel` | ui-monospace (SFMono) | 9.5px | 400, lowercase | Role caption under the name (`frontend / ssr`, `http server`) |
| `eyebrow` | ui-monospace (SFMono) | 10px | 700, tracked 0.16em, uppercase | Group labels on container borders |
| `arrow-label` | ui-monospace (SFMono) | 9px | 500, tracked 0.04em | Arrow annotations (`HTTPS`, `query`, `SQL`) |
| `callout` | Hiragino Sans *italic* | 13px | 400 | Editorial asides only |

### Font stack

System stacks only — no external stylesheet, no `<link>`. CSP-safe.

```css
--font-title: "Hiragino Sans", "Yu Gothic", system-ui, sans-serif;
--font-body: "Hiragino Sans", "Yu Gothic", system-ui, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
```

**Load-bearing rule:** mono is for *technical* content — role captions, protocols, arrow labels, group labels. Product names go in the body sans, bold. No serif in this skin: the reference style is entirely sans + mono.

---

## Stroke, radius, spacing

| Token | Value | Use |
|---|---|---|
| `stroke-thin` | `1` | Grid lines, hairlines |
| `stroke-default` | `1` | Card borders |
| `stroke-strong` | `1.5` | Group containers, primary-flow arrows |
| `radius-sm` | `8` | Small tags |
| `radius-md` | `14` | Logo cards |
| `radius-lg` | `18` | Group containers |
| `grid` | `4` | Every coord, size, and gap is divisible by 4 (hard rule) |

Rounded corners are intentional in this skin. Do not "correct" them to radius 0 — the owner's corporate design rules (sharp corners, one accent) do not apply to this skin.

---

## Node type → treatment

| Type | Fill | Stroke |
|---|---|---|
| `focal` (1–2 max) | `#ffffff` | `accent` |
| `backend` | `#ffffff` | `rule` |
| `store` | `#ffffff` | `rule` |
| `external` | `paper-2` | `rule` |
| `input` | `#ffffff` | `rule` |
| `optional` | `#ffffff @ 0.6` | `rule` dashed `4,3` |
| `security` | `accent-tint` | `accent @ 0.50` dashed `4,4` |

In this style, node differentiation comes from the **logo**, not the fill — nearly every card is white on the grid paper. Type distinctions above are fallbacks for nodes without a logo.

---

## Logo-card conventions (this skin's core)

The six rules that make a diagram look like the reference image:

1. **Graph-paper background (default ON).** `paper` fill with a square grid of `rule`-colored 1px lines every 32px (light: full `rule`; dark: `rule @ 0.6`). This replaces the dot-pattern option — the grid is the identity of this skin.
2. **Node = logo card.** A 64×64 (up to 80×80) white card, `rule` 1px border, `radius-md`, subtle shadow allowed (`0 1px 2px rgba(31,42,55,0.06)`). The official product logo sits centered at ~55% of card height. Below the card: `node-name` (bold sans), then `sublabel` (mono lowercase role, `soft` color).
3. **Logo assets.** Use official SVGs from `~/.diagram-design/assets/logos/`, embedded as data URIs (artifact CSP blocks external images). Prefer `_light`/`_dark` variants to match the theme. Missing logo → render the card with the product's initial letter in `ink` bold instead; never substitute an unofficial lookalike.
4. **Group containers carry vendor brand colors.** Border `stroke-strong` in the vendor's primary color + fill at ~6–8% of the same color + `radius-lg`. The label sits ON the top border: small logo + `eyebrow` text in the vendor color (e.g. Cloudflare `#f6821f`). Nested execution boundaries (runtime, VPC) use the same color but **dashed** border and no fill. Neutral/conceptual groups (monorepo, CI) use `accent` or `muted` as their border color.
5. **Arrows carry meaning in both color and texture.** 次の4本だけを使い分ける。矢印ラベルは線と同じ色にし、線から6〜10px離す。

   | 意味 | Token | 線種 | 太さ | 用途 |
   |---|---|---|---|---|
   | 実行フロー | `accent` | 実線 | 1.75 | 平常時に実体（リクエスト・イベント・データ）が通る経路 |
   | 失敗経路 | `alert` | 破線 `6 4` | 1.5 | 失敗イベントの退避（DLQ行き）、再試行を使い切った後の経路 |
   | 監視・通知 | `watch` | 一点鎖線 `10 3 2 3` | 1.5 | メトリクスの監視、アラームの通知 |
   | 補助 | `muted` | 点線 `2 3` | 1.25 | ログ出力、デプロイ時の値解決、デプロイ・設定の適用 |

   - 色だけで意味を伝えない。色覚多様性では赤とグレーが近づくため、線種と太さでも必ず分ける。
   - 失敗と監視はどちらも異常系だが線を分ける。失敗は実体が流れる経路、監視は観測と通知であり、止まっている層が違うためである。
   - 4本を全部使う必要はない。図に出てこない意味の線は凡例からも省く。
   - ベンダー色がオレンジ系（AWS `#ff9900`・Cloudflare `#f6821f`）のときは、`watch` の線がゾーン枠と紛れないよう、監視線をゾーン枠から離して引く。
6. **Layout.** The primary request flow runs left → right on one straight lane. Supporting services hang below the lane with vertical/dashed connectors. The toolchain (runtime, build, lint, hooks, IaC) lives in its own group at the bottom, cards in one horizontal row. Whitespace is generous — cards never touch a group border.

---

## Customizing the skin

1. **Edit by hand** — change the hex values in the tables above.
2. **Brand handoff** — paste design-token JSON into a new section and map to the semantic roles.
3. **Client profiles** — save and switch named skins with `profiles.md`.

### Constraints (don't break these)

- **Contrast**: `ink` must hit WCAG AA on `paper`. `muted` must hit AA on `paper` for 11px+ text.
- **Three documented color families only**: 意味を持つ線色4種（`accent` / `alert` / `watch` / `muted`）、ゾーン枠のベンダー色、中立ランプ。これ以外の色は使わない。意味色をカードの塗りや枠へ広げない。
- **Sans + mono**: two families. No serif, no JetBrains Mono, no webfonts.
- **Grid is quiet**: grid lines must read as paper texture, never compete with card borders. If a screenshot at 50% zoom shows the grid louder than the cards, lighten `rule` usage.
- **Logos are trademarks**: official assets only, identification purposes only, no recoloring or distortion.
