# 作図部品のカタログ

Mermaidに型が無い図を、CSSだけで作るための部品。**要るものだけ**を`/* SLOT: EXTRA_STYLE */`にコピーする。使わない部品を貼らない。

いずれも`shell.html`のトークン（`--accent` `--alert` `--rule` `--ink-faint`など）を参照しているので、ライト・ダークとも自動で追随する。ライブラリは不要。

---

## 数値列つきガント

Mermaidの`gantt`は数値列を持てない。タスク名・見積り・期間を1つの表で見せたいときに使う。

判定は色だけに頼らず、`.chip`を併記する。

```html
<div class="scroller wide">
  <table class="gantt">
    <caption>実装フェーズ（週単位）</caption>
    <thead>
      <tr>
        <th scope="col">タスク</th>
        <th scope="col">見積り</th>
        <th scope="col" colspan="8">1週目 &mdash; 8週目</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">パーサ実装</th>
        <td class="num">5d</td>
        <td class="bar" colspan="8"><span style="--from:0; --to:2"></span></td>
      </tr>
      <tr>
        <th scope="row">集計ロジック</th>
        <td class="num">8d</td>
        <td class="bar" colspan="8"><span class="late" style="--from:2; --to:5"></span></td>
      </tr>
    </tbody>
  </table>
</div>
```

`--from`と`--to`は0起点の列番号。`colspan`の値が全体の列数になる。

```css
  table.gantt th[scope="row"] { font-weight: 600; white-space: nowrap; }
  table.gantt td.bar { position: relative; padding: 0.55rem 0; min-width: 16rem; }
  table.gantt td.bar::before {
    content: "";
    position: absolute; inset: 0;
    background: repeating-linear-gradient(
      to right, var(--rule) 0 1px, transparent 1px calc(100% / 8));
  }
  table.gantt td.bar span {
    position: relative;
    display: block;
    height: 1.1rem;
    margin-left: calc(var(--from) / 8 * 100%);
    width: calc((var(--to) - var(--from)) / 8 * 100%);
    background: var(--accent);
  }
  table.gantt td.bar span.late { background: var(--alert); }
  table.gantt td.bar span.late::after {
    content: "遅延";
    position: absolute; left: 100%; margin-left: 0.4rem;
    font-size: 0.7rem; color: var(--alert); white-space: nowrap;
  }
```

`8`は列数。列数を変えるならこの3箇所を揃えて直す。

---

## ウォーターフォール（増減の要因分解）

「前期からいくら増減して当期になったか」を要因ごとに見せる。経理の増減分析に使う。Mermaidに型は無い。

```html
<div class="scroller wide">
  <div class="waterfall" style="--max:20000">
    <div class="wf-col">
      <div class="wf-bar base" style="--h:10192"></div>
      <div class="wf-label">前期実績</div>
      <div class="wf-value">10,192</div>
    </div>
    <div class="wf-col">
      <div class="wf-bar up" style="--h:11382; --base:10192"></div>
      <div class="wf-label">売上増</div>
      <div class="wf-value up">+11,382</div>
    </div>
    <div class="wf-col">
      <div class="wf-bar down" style="--h:4229; --base:17345"></div>
      <div class="wf-label">費用増</div>
      <div class="wf-value down">&minus;4,229</div>
    </div>
    <div class="wf-col">
      <div class="wf-bar base" style="--h:17345"></div>
      <div class="wf-label">当期実績</div>
      <div class="wf-value">17,345</div>
    </div>
  </div>
</div>
```

`--max`は縦軸の最大値。`--h`は棒の高さ（増減の絶対値）。増減の棒は`--base`に「棒の下端の値」を書く。

増加の棒は直前の到達値が下端になる。減少の棒は減ったあとの値が下端になる。上の例なら、売上増の`--base`は前期実績の10,192、費用増の`--base`は当期実績の17,345である。ここを取り違えると段差がつながらない。

```css
  .waterfall {
    display: flex;
    align-items: flex-end;
    gap: 1rem;
    min-width: 26rem;
    height: 15rem;
    padding: 1rem;
    border: 1px solid var(--rule);
    background: var(--paper-sunk);
  }
  .wf-col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; }
  .wf-bar { width: 100%; height: calc(var(--h) / var(--max) * 11rem); }
  .wf-bar.base { background: var(--ink-faint); }
  .wf-bar.up { background: var(--accent); margin-bottom: calc(var(--base) / var(--max) * 11rem); }
  .wf-bar.down { background: var(--alert); margin-bottom: calc(var(--base) / var(--max) * 11rem); }
  .wf-label { font-size: 0.75rem; color: var(--ink-soft); margin-top: 0.5rem; text-align: center; }
  .wf-value {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 0.8rem;
    text-align: center;
  }
  .wf-value.up { color: var(--accent); }
  .wf-value.down { color: var(--alert); }
```

増減の向きは記号（`+`と`&minus;`）でも読めるようにする。色だけで示さない。

---

## ランキング・規模比較（横棒つき表）

大小や順位を見せる。数値を読ませつつ、長さで直感的に比較させる。

```html
<div class="scroller">
  <table class="ranked">
    <caption>費目別の支出（万円）</caption>
    <tbody>
      <tr style="--pct:100">
        <th scope="row">外注費</th>
        <td class="num">452</td>
        <td class="track"><span></span></td>
      </tr>
      <tr style="--pct:44">
        <th scope="row">地代家賃</th>
        <td class="num">198</td>
        <td class="track"><span></span></td>
      </tr>
      <tr style="--pct:18">
        <th scope="row">通信費</th>
        <td class="num">82</td>
        <td class="track"><span></span></td>
      </tr>
    </tbody>
  </table>
</div>
```

`--pct`は最大値を100としたときの割合。

```css
  table.ranked th[scope="row"] { font-weight: 400; white-space: nowrap; }
  table.ranked td.track { width: 60%; padding-left: 1rem; }
  table.ranked td.track span {
    display: block;
    height: 0.8rem;
    width: calc(var(--pct) * 1%);
    background: var(--accent);
    min-width: 2px;
  }
```

順位そのものが情報を持つときだけ番号を振る。単なる一覧に連番を付けない。

---

## 積み上げ棒（内訳の推移）

期ごとの内訳の変化を見せる。系列は3つまでに抑える。4つ以上なら「その他」にまとめる。

```html
<div class="scroller">
  <div class="stacked">
    <div class="st-col">
      <div class="st-seg s1" style="--v:45"><span>45</span></div>
      <div class="st-seg s2" style="--v:30"><span>30</span></div>
      <div class="st-seg s3" style="--v:25"><span>25</span></div>
      <div class="st-label">4月</div>
    </div>
    <div class="st-col">
      <div class="st-seg s1" style="--v:52"><span>52</span></div>
      <div class="st-seg s2" style="--v:28"><span>28</span></div>
      <div class="st-seg s3" style="--v:20"><span>20</span></div>
      <div class="st-label">5月</div>
    </div>
  </div>
</div>
<p class="legend">
  <span class="key s1"></span>外注費
  <span class="key s2"></span>地代家賃
  <span class="key s3"></span>その他
</p>
```

`--v`は各区間の値。合計が100になる必要はない。

```css
  .stacked { display: flex; gap: 1.5rem; align-items: flex-end; min-width: 20rem; padding: 1rem 0; }
  .st-col { flex: 1; display: flex; flex-direction: column; max-width: 5rem; }
  .st-seg {
    height: calc(var(--v) * 0.12rem);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.7rem;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  .st-seg.s1 { background: var(--accent); color: var(--paper); }
  .st-seg.s2 { background: var(--ink-faint); color: var(--paper); }
  .st-seg.s3 { background: var(--rule); color: var(--ink); }
  .st-label { font-size: 0.75rem; color: var(--ink-soft); text-align: center; padding-top: 0.5rem; }
  .legend { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; flex-wrap: wrap; }
  .legend .key { display: inline-block; width: 0.8rem; height: 0.8rem; margin-left: 0.8rem; }
  .legend .key.s1 { background: var(--accent); }
  .legend .key.s2 { background: var(--ink-faint); }
  .legend .key.s3 { background: var(--rule); }
```

区間の中に数値を書くので、色を判別できなくても読める。凡例だけに頼らない。

---

## 階段・ステップ（段階的な積み上げ）

フェーズごとに何が積み上がるかを見せる。時間軸ではなく到達段階を示すときに使う。

```html
<ol class="steps">
  <li style="--i:0"><strong>整える</strong>規約と共通シェルを置く</li>
  <li style="--i:1"><strong>作る</strong>用途別の手順をスキルにする</li>
  <li style="--i:2"><strong>回す</strong>実際の計画と調査で使う</li>
</ol>
```

```css
  ol.steps { list-style: none; padding: 0; gap: 0; }
  ol.steps li {
    border-left: 3px solid var(--accent);
    border-bottom: 1px solid var(--rule);
    background: var(--paper-sunk);
    padding: 0.9rem 1.1rem;
    margin-left: calc(var(--i) * 1.5rem);
  }
  ol.steps li strong {
    display: block;
    font-family: var(--font-display);
    color: var(--accent);
    margin-bottom: 0.2rem;
  }
  @media (max-width: 34rem) {
    ol.steps li { margin-left: 0; }
  }
```

段の数は4つまで。5つ以上なら表にする。狭い画面では字下げを消す。

---

## 共通の注意

- 部品を貼ったら、その部品が使う変数（`--max` `--pct` `--v`など）を必ず全要素に書く。抜けると高さ0や幅0になる。
- 数値は必ず本文にも書く。棒の長さだけで数値を読ませない。
- 色で系列を分けるときは、区間内の数値か凡例の語を併記する。
- 部品は`.scroller`か`overflow-x: auto`の入れ物に入れる。狭い画面で`body`を横スクロールさせない。
- 3系列を超えるなら、この部品ではなく表に切り替える。
