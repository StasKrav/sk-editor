import { parseJs } from './js-parser'
import { parseCss } from './css-parser'
import { parseHtml } from './html-parser'
import type { TocSymbol } from './types'
import type { LangKind } from '../editor/languages'
import { parseMarkdown } from './md-parser'

export function parseToc(code: string, language: LangKind): TocSymbol[] {
  switch (language) {
    case 'js':   return parseJs(code, false)
    case 'ts':   return parseJs(code, true)
    case 'css':  return parseCss(code)
    case 'html': return parseHtml(code)
    case 'md':   return parseMarkdown(code)
    default:     return []
  }
}

export type { TocSymbol } from './types'
