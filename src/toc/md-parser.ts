// src/toc/md-parser.ts
import type { TocSymbol } from './types'

export function parseMarkdown(code: string): TocSymbol[] {
  const out: TocSymbol[] = []
  const lines = code.split('\n')

  let inFence = false
  let fenceMarker = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // отслеживаем ограждения ``` / ~~~
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/)
    if (fenceMatch) {
      if (!inFence) {
        inFence = true
        fenceMarker = fenceMatch[2][0]
      } else if (fenceMatch[2][0] === fenceMarker) {
        inFence = false
      }
      continue
    }
    if (inFence) continue

    // ATX-заголовки: # .. ######
    const atx = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/)
    if (atx) {
      out.push({
        name: atx[2],
        kind: 'heading',      // или завести 'heading' в SymbolKind
        line: i + 1,
        col: atx[1].length,    // после решёток
        depth: atx[1].length - 1,
      })
      continue
    }

    // Setext: следующая строка === или ---
    if (i + 1 < lines.length && line.trim()) {
      const next = lines[i + 1]
      if (/^=+\s*$/.test(next)) {
        out.push({ name: line.trim(), kind: 'function', line: i + 1, col: 0, depth: 0 })
      } else if (/^-+\s*$/.test(next) && line.trim().length > 0 && !/^\s*[-*+]\s/.test(line)) {
        out.push({ name: line.trim(), kind: 'function', line: i + 1, col: 0, depth: 1 })
      }
    }
  }

  return out
}