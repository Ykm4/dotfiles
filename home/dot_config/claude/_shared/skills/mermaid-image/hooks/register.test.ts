import { expect, test } from 'claude-code/testing'

import { pngSize, split } from './register'

test('mermaid ブロックとそれ以外に分ける', () => {
  const text = '前\n```mermaid\ngraph TD\n  A-->B\n```\n間\n```ts\nx\n```\n```mermaid\nsequenceDiagram\n```'
  expect(split(text)).toEqual([
    { md: '前\n' },
    { src: 'graph TD\n  A-->B', raw: '```mermaid\ngraph TD\n  A-->B\n```' },
    { md: '\n間\n```ts\nx\n```\n' },
    { src: 'sequenceDiagram', raw: '```mermaid\nsequenceDiagram\n```' },
  ])
})

test('閉じていない mermaid ブロックはそのまま', () => {
  expect(split('```mermaid\ngraph TD')).toEqual([{ md: '```mermaid\ngraph TD' }])
})

test('PNG の IHDR から幅と高さを読む', () => {
  const b = new Uint8Array(24)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  const v = new DataView(b.buffer)
  v.setUint32(16, 1234)
  v.setUint32(20, 567)
  expect(pngSize(btoa(String.fromCharCode(...b)))).toEqual({ width: 1234, height: 567 })
})
