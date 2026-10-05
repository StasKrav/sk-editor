import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { syntaxHighlighting } from '@codemirror/language'
import {
  baseExtensions,
  createTabState,
  languageConf,
  highlightConf,
  darkHighlight,
  lightHighlight,
  type EditorTheme,
} from './extensions'
import type { EditorCallbacks } from './extensions'
import type { LangKind } from './languages'

export class CodeEditor {
  readonly view: EditorView
  private cb: EditorCallbacks
  private currentTheme: EditorTheme = 'dark'

  constructor(parent: HTMLElement, cb: EditorCallbacks = {}) {
    this.cb = cb

    const initial = EditorState.create({
      doc: '',
      extensions: [
        ...baseExtensions(cb, this.currentTheme),
        languageConf.of([]),
      ],
    })

    this.view = new EditorView({ state: initial, parent })
  }

  createState(content: string, language: LangKind): EditorState {
    return createTabState(content, language, this.cb, this.currentTheme)
  }

  setState(state: EditorState) {
    this.view.setState(state)
    this.applyTheme()
  }

  setHighlight(theme: EditorTheme) {
    this.currentTheme = theme
    this.applyTheme()
  }

  private applyTheme() {
    const style = this.currentTheme === 'light' ? lightHighlight : darkHighlight
    this.view.dispatch({
      effects: highlightConf.reconfigure(syntaxHighlighting(style)),
    })
  }

  focus() {
    this.view.focus()
  }
}
