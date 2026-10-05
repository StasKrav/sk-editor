import postcss from 'postcss'
import type { TocSymbol } from './types'

export function parseCss(code: string): TocSymbol[] {
  const symbols: TocSymbol[] = []
  let root
  try {
    root = postcss.parse(code)
  } catch {
    return symbols
  }

  root.walk(node => {
    if (node.type === 'rule') {
      const line = node.source?.start?.line ?? 1
      const col = node.source?.start?.column ?? 1
      symbols.push({
        name: node.selector,
        kind: 'selector',
        line,
        col: col - 1,
        depth: 0,
      })
    } else if (node.type === 'atrule') {
      const line = node.source?.start?.line ?? 1
      const col = node.source?.start?.column ?? 1
      const name = `@${node.name}${node.params ? ' ' + node.params : ''}`
      symbols.push({
        name,
        kind: 'at-rule',
        line,
        col: col - 1,
        depth: 0,
      })
    } else if (node.type === 'decl' && node.prop.startsWith('--')) {
      // CSS-переменные
      const line = node.source?.start?.line ?? 1
      const col = node.source?.start?.column ?? 1
      symbols.push({
        name: node.prop,
        kind: 'css-variable',
        line,
        col: col - 1,
        depth: 0,
      })
    }
  })

  // сортируем по позиции в файле (postcss может обходить не в порядке)
  symbols.sort((a, b) => a.line - b.line || a.col - b.col)
  return symbols
}
