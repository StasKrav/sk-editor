import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { bracketMatching, indentOnInput, foldGutter } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { langExtension, type LangKind } from './languages'
import themes from 'codemirror-5-themes'
import { syntaxHighlighting } from '@codemirror/language'
import { zenburnHighlight } from './cm-highlight'


// Один compartment на всё приложение — язык активной вкладки
export const languageConf = new Compartment()

export interface EditorCallbacks {
  onDocChanged?: (state: EditorState) => void
  onCursorChanged?: (line: number, col: number) => void
}

export function baseExtensions(cb: EditorCallbacks) {
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
    themes['zenburn'],                 // фон, gutter — UI
    syntaxHighlighting(zenburnHighlight), // ← подсветка токенов
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': { overflow: 'auto' },
      '.cm-gutters': {
        minWidth: '3.5em',
        width: '3.5em',
        overflow: 'hidden',
      },
    }),
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

export function createTabState(content: string, language: LangKind, cb: EditorCallbacks) {
  return EditorState.create({
    doc: content,
    extensions: [
      ...baseExtensions(cb),
      languageConf.of(langExtension(language)),
    ],
  })
}
