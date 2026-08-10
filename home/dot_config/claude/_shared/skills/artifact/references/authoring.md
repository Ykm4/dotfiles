# アーティファクトの作法

同じディレクトリの`shell.html`を起点にページを組むときの共通の決まり。配色と書体の定義は`~/.claude/rules/design-system.md`にある。Mermaidに型が無い図をCSSで作る部品は、同じディレクトリの`parts.md`にある。

---

## テンプレートから始める

シェルをゼロから書き直さない。シェルが一貫性そのものであり、毎回組み直せば毎回違う見た目になる。

置換するもの。

| プレースホルダ | 中身 |
|---|---|
| `{{TAB_TITLE}}` | ブラウザタブ用の短い題 |
| `{{TITLE}}` | 見出し |
| `{{EYEBROW}}` | 分類と日付 |
| `{{SUMMARY}}` | 要旨を2〜4文 |
| `<!-- SLOT: BODY -->` | 本体 |
| `<!-- SLOT: FOOTER -->` | 出典・元ファイル・生成日 |
| `/* SLOT: EXTRA_STYLE */` | この成果物だけに要るCSS |

用意済みのクラス（作り直さない）。

| クラス | 用途 |
|---|---|
| `.verdict` | 結論の囲み。先頭に`.verdict-label`を置き、見出しは直下の`strong`に限る |
| `.note` | 注意・落とし穴の囲み。先頭に`.note-label`を置く |
| `.diagram` | 図の入れ物。中に`<pre class="mermaid">`を置く |
| `.scroller` | 表の入れ物。列が多い表は`.scroller wide`にする |
| `td.num` | 数値列。等幅・右寄せ・桁揃え |
| `td.name` | 識別子の列 |
| `.ok` / `.no` | 良し悪し。記号が自動で付く |
| `.chip` / `.chip.on` / `.chip.warn` | 状態。線種でも区別できる |
| `pre.code` | コードブロック |

金額など大きな単独数値を`.verdict > strong`や`td.num`に入れない。桁揃えは縦に並ぶ列にだけ効かせる。

## 差し込む文字列のエスケープ

プレースホルダは素のHTMLに差し込まれるため、エスケープは書き手の責任になる。

- 差し込む文字列の`&` `<` `>`は実体参照にする（`&amp;` `&lt;` `&gt;`）。
- 不要な項目は値を空にせず、その要素ごと削除する。空要素は`gap`を消費して空白が残る。

## Mermaidの書式

図はMermaidの記法だけを書く。ランタイムは公開時に自動注入されるので、ライブラリを同梱しない。

### 色を指定しない

注入されるランタイムは、テーマ切替のたびにページの背景色を読んで全図を再描画する。図に固定色を焼き込むと、片方のテーマで読めなくなる。`config`フロントマターや`%%{init}%%`で`themeVariables`を書かない。

図の文字は`document.body`の`font-family`を継承するので、日本語フォントは自動で揃う。

### 改行は実体参照で書く

`<pre class="mermaid">`の中身はHTMLとしてパースされ、ランタイムは`textContent`を読む。生の`<br/>`はBR要素になって`textContent`から消えるため、ラベルが連結される。

- 改行は`&lt;br/&gt;`と書く。
- 矢印は`--&gt;`と書く。
- ラベルは常にダブルクオートで囲む。`A[基盤]`ではなく`A["基盤"]`と書く。

### 日本語が通る図種

日本語ラベルで確認済みなのは次の15種。

- 構造を描くもの — `flowchart` `sequenceDiagram` `stateDiagram-v2` `erDiagram` `architecture-beta` `block-beta`
- 量を描くもの — `pie` `xychart-beta` `treemap` `radar-beta` `quadrantChart`
- 時間を描くもの — `gantt` `timeline` `journey` `kanban`
- 発想を整理するもの — `mindmap`

`block-beta`は`columns N`でグリッドを作り、`block:ID:N`でネストと列スパンを指定する。層や責務の分離を描くときに使う。

```
block-beta
  columns 3
  ui["UI 層"]:3
  block:core:2
    columns 2
    parser["parser.ts"]
    mapper["mapper.ts"]
  end
  store["store.ts"]
```

Mermaidに型が無い図（ウォーターフォール・数値列つきガント・ランキング・積み上げ棒・階段）は`parts.md`の部品をCSSで貼る。

図種ごとの注意。

- sankey-betaは非ASCIIラベルをクオートしてもパースできない。資金の流れはflowchartか素のSVGで描く。
- xychart-betaはカテゴリをクオートする（`x-axis ["4月", "5月"]`）。クオートを外すと字句エラーになる。
- architecture-betaはグループ名もクオートする（`group api(cloud)["基盤"]`）。
- requirementDiagramは識別子を英数字にし、`text:`の値をクオートする。
- gitGraphはブランチ名に日本語を使えない。`commit id: "初期化"`のようにクオートした値なら通る。

図が公開後にコードのまま見えていたらパース失敗のサインである。ランタイムは失敗時にソースをそのまま残す。

### 図側から変えられないもの

- `securityLevel`は`strict`固定である。`htmlLabels`や`click`ハンドラに頼る記法は使わない。
- 1つの図のソースは50,000文字未満に収める。`maxTextSize`も図側から緩められない。
- 1図あたり15ノード以下に収める。超えるなら図を分ける。

## チャート

- 素のインラインSVGを第一候補とする。
- 公開時に自動注入されるChart.jsランタイムを使うときは、次の2つを両方置く。
- `<script type="application/json" id="primary-chart-spec" data-chart-runtime>`にスペックを書く。
- `<canvas id="primary-chart">`を描画先にする。
- Chart.jsランタイムは1ページ1枚だけ描画する。`type`は`line` `bar` `donut`の3つに限る（`doughnut`と書くと`line`にフォールバックする）。
- 2枚目以降が要るなら自前で`new Chart`するか、表と横棒に置き換える。
- 二軸グラフは作らない。
- chartistとuPlotはCDNが使えず全文をインライン展開するしかないため原則使わない。HighchartsとApexChartsは業務利用に有償ライセンスが要るため使わない。

## 公開

ファイルはスクラッチパッドに書く。Artifactツールで公開してURLを伝える。元になった資料は書き換えない。

- `favicon`に絵文字を1〜2個必ず渡す。同じ成果物を更新するときは変えない。
- `description`に中身を1文で渡す。ギャラリーのカード副題になる。
- 再公開は同じファイルパスで行うと同じURLに上書きされる。初回公開時にパスを控え、改訂時も同じパスに書く。別の会話から更新するときは`url`パラメータに既存URLを渡す。

## 公開前の自己点検

- `{{` `}}` `SLOT`の3語が1つも残っていないこと。テンプレート先頭の運用コメントごと消す。
- 375px幅で`body`が横スクロールしないこと。
- 表の数値列に`class="num"`が付いていること。
- 良し悪し・状態が色だけでなく記号か語でも読めること。
- Markdownアーティファクト（`.md`）では配色と書体を制御できない。デザインを効かせたい成果物は必ず`.html`で書く。
