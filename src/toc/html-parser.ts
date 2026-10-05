import { parse } from 'parse5'
import type { TocSymbol } from './types'

export function parseHtml(code: string): TocSymbol[] {
  const symbols: TocSymbol[] = []
  let doc
  try {
    doc = parse(code, { sourceCodeLocationInfo: true })
  } catch {
    return symbols
  }

  walk(doc, symbols, 0)
  return symbols
}

function walk(node: any, out: TocSymbol[], depth: number) {
  if (!node) return

  if (node.nodeName && node.tagName && node.sourceCodeLocation) {
    const loc = node.sourceCodeLocation
    const tag = node.tagName

    // берём id, если есть
    const attrs = node.attrs ?? []
    const idAttr = attrs.find((a: any) => a.name === 'id')
    const dataToc = attrs.find((a: any) => a.name === 'data-toc')

    // Интересные для TOC элементы:
    // - всё с id
    // - всё с data-toc
    // - структурные теги: section, article, nav, header, footer, main, aside
    const structural = ['section', 'article', 'nav', 'header', 'footer', 'main', 'aside']

    if (idAttr || dataToc) {
      out.push({
        name: idAttr ? `#${idAttr.value}` : dataToc.value || `<${tag}>`,
        kind: 'html-id',
        line: loc.startLine,
        col: loc.startCol - 1,
        depth,
      })
    } else if (structural.includes(tag)) {
      out.push({
        name: `<${tag}>`,
        kind: 'html-element',
        line: loc.startLine,
        col: loc.startCol - 1,
        depth,
      })
    }

    // для script/style — идём внутрь через дочерние узлы
    const children = node.childNodes ?? []
    for (const child of children) {
      walk(child, out, depth + 1)
    }
  } else {
    const children = node.childNodes ?? []
    for (const child of children) {
      walk(child, out, depth)
    }
  }
}
