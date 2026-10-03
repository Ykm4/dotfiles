import type { EngineInterface, Register } from 'claude-code'

import type { MermaidPng } from '../types'

const png = { plugin: 'mermaid-image', key: 'png' } as const

// 端末に合わせる調整値。
// PX_PER_COL は図の CSS ピクセル何個を 1 列に収めるか（大きいほど図が小さくなる）。
// CELL_ASPECT はセルの幅÷高さ（Ghostty 13pt で約 0.5）。
const SCALE = 2
const PX_PER_COL = 6
const CELL_ASPECT = 0.5
const THEME = ['-t', 'dark', '-b', 'transparent']

const FENCE = /^ {0,3}```mermaid[ \t]*\n([\s\S]*?)\n {0,3}```[ \t]*$/gm

type Part = { md: string } | { src: string; raw: string }

/** 返答のテキストを、mermaid ブロックとそれ以外に分ける。 */
export const split = (text: string): Part[] => {
  const parts: Part[] = []
  let at = 0
  for (const m of text.matchAll(FENCE)) {
    if (m.index > at) parts.push({ md: text.slice(at, m.index) })
    parts.push({ src: m[1] ?? '', raw: m[0] })
    at = m.index + m[0].length
  }
  if (at < text.length) parts.push({ md: text.slice(at) })
  return parts
}

/** PNG の IHDR から幅と高さを読む（先頭 24 バイト = base64 の先頭 32 文字）。 */
export const pngSize = (base64: string) => {
  const b = Uint8Array.from(atob(base64.slice(0, 32)), c => c.charCodeAt(0))
  const v = new DataView(b.buffer)
  return { width: v.getUint32(16), height: v.getUint32(20) }
}

const hash = async (src: string) => {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode([...THEME, src].join('\n')))
  return [...new Uint8Array(d)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join('')
}

// ponytail: 生成中の重複起動をモジュール変数で防ぐ。ホットリロードで消えるが、そのときは 1 回余分に生成するだけ。
const inFlight = new Set<string>()

const generate = async ($: EngineInterface, id: string, src: string) => {
  const dir = `${await $.env.get('HOME')}/.cache/claude-mermaid-image`
  const out = `${dir}/${id}.png`
  let result: MermaidPng
  try {
    if (!(await $.fs.exists(out))) {
      await $.process.run(['mkdir', '-p', dir])
      await $.fs.write(`${dir}/${id}.mmd`, src)
      const r = await $.process.run(
        ['mise', 'run', 'mermaid', '--', '-i', `${id}.mmd`, '-o', `${id}.png`, '-s', String(SCALE), ...THEME],
        { cwd: dir, timeoutMs: 60_000 },
      )
      if (r.exitCode !== 0) throw new Error(r.stderr.trim().split('\n').slice(-3).join(' '))
    }
    const { base64 } = await $.fs.read(out, { as: 'bytes' })
    result = { path: out, ...pngSize(base64) }
  } catch (err) {
    result = { error: String(err) }
  }
  inFlight.delete(id)
  await $.state.set({ ...png, id }, result)
}

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const parts = split(e.props.text)
    if (!parts.some(p => 'src' in p)) return next(e)

    const { Box, Image } = $.ui.resolve(e)
    const maxCols = Math.min(255, (e.viewport?.columns ?? 80) - 4)
    const maxRows = Math.min(255, (e.viewport?.rows ?? 40) - 4)
    const nodes = []
    let md = ''
    const flush = async () => {
      if (md.trim() === '') return
      const isFirstOfReply = e.props.isFirstOfReply && nodes.length === 0
      nodes.push(await next({ ...e, props: { ...e.props, text: md, isFirstOfReply } }))
      md = ''
    }

    for (const p of parts) {
      if ('md' in p) {
        md += p.md
        continue
      }
      const id = await hash(p.src)
      const { value } = await $.state.get({ ...png, id })
      if (value === undefined || 'error' in value) {
        if (value === undefined && !inFlight.has(id)) {
          inFlight.add(id)
          $.clock.after(0, () => void generate($, id, p.src))
        }
        md += p.raw
        continue
      }
      await flush()
      // 縦長の図が画面の高さを超えないよう、高さの上限からも列数を絞る。
      const rowsPerCol = (value.height * CELL_ASPECT) / value.width
      const natural = Math.ceil(value.width / SCALE / PX_PER_COL)
      const columns = Math.max(1, Math.min(maxCols, natural, Math.floor(maxRows / rowsPerCol)))
      const rows = Math.max(1, Math.min(255, Math.round(columns * rowsPerCol)))
      nodes.push(
        <Box paddingLeft={2}>
          <Image source={{ file: value.path, format: 'png' }} columns={columns} rows={rows} alt="mermaid 図" />
        </Box>,
      )
    }
    await flush()
    return <Box flexDirection="column">{nodes}</Box>
  })
}
