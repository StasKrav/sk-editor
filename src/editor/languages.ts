import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'

export type LangKind = 'html' | 'css' | 'js' | 'ts' | 'plain'

export function langExtension(kind: LangKind) {
  switch (kind) {
    case 'html': return html()
    case 'css':  return css()
    case 'js':   return javascript()
    case 'ts':   return javascript({ typescript: true })
    default:     return []
  }
}

export function langFromFilename(name: string): LangKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'html' || ext === 'htm') return 'html'
  if (ext === 'css') return 'css'
  if (ext === 'js' || ext === 'mjs' || ext === 'jsx') return 'js'
  if (ext === 'ts' || ext === 'tsx') return 'ts'
  return 'plain'
}
