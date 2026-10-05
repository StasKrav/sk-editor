import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { bracketMatching, indentOnInput, foldGutter, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { langExtension, type LangKind } from './languages'
import { zenburnHighlight, solarizedLightHighlight } from './cm-highlight'

export const languageConf = new Compartment()
export const highlightConf = new Compartment()

export const lightHighlight = solarizedLightHighlight
export const darkHighlight  = zenburnHighlight

export type EditorTheme = 'dark' | 'light'

export interface EditorCallbacks {
  onDocChanged?: (state: EditorState) => void
  onCursorChanged?: (line: number, col: number) => void
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--cm-bg)',
    color: 'var(--text-primary)',
  },
  '.cm-scroller': {
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    overflow: 'auto',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--cm-gutter-bg)',
    color: 'var(--text-muted)',
    borderRight: '1px solid var(--border)',
    minWidth: '3.5em',
    width: '3.5em',
    overflow: 'hidden',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--cm-active-line)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--cm-active-gutter)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--cm-selection)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--text-primary)',
  },
})

export function baseExtensions(cb: EditorCallbacks, theme: EditorTheme = 'dark') {
  const style = theme === 'light' ? lightHighlight : darkHighlight
  return [
    lineNumbers(),
    highlightActiveLine(),
    foldGutter(),
    bracketMatching(),
    indentOnInput(),
    highlightSelectionMatches(),
    history(),
    keymap.of([
      indentWithTab,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
    ]),
    editorTheme,
    highlightConf.of(syntaxHighlighting(style)),
    EditorView.updateListener.of(update => {
      if (update.docChanged) cb.onDocChanged?.(update.state)
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head
        const line = update.state.doc.lineAt(pos)
        cb.onCursorChanged?.(line.number, pos - line.from + 1)
      }
    }),
  ]
}

export function createTabState(
  content: string,
  language: LangKind,
  cb: EditorCallbacks,
  theme: EditorTheme = 'dark',
) {
  return EditorState.create({
    doc: content,
    extensions: [
      ...baseExtensions(cb, theme),
      languageConf.of(langExtension(language)),
    ],
  })
}
