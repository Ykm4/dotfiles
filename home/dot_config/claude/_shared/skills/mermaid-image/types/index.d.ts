/** 生成済みの PNG（width/height はピクセル）か、生成の失敗。 */
export type MermaidPng = { path: string; width: number; height: number } | { error: string }

declare module 'claude-code' {
  interface PluginState {
    'mermaid-image': { png: StateFamily<MermaidPng> }
  }
}
