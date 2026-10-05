import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { baseExtensions, createTabState, languageConf } from './extensions'
import type { EditorCallbacks } from './extensions'
import type { LangKind } from './languages'

export class CodeEditor {
  readonly view: EditorView
  private cb: EditorCallbacks

  constructor(parent: HTMLElement, cb: EditorCallbacks = {}) {
    this.cb = cb

    const initial = EditorState.create({
      doc: '',
      extensions: [
        ...baseExtensions(cb),
        languageConf.of([]),
      ],
    })

    this.view = new EditorView({ state: initial, parent })
  }

  /** Создать новое состояние для вкладки (используется TabManager'ом) */
  createState(content: string, language: LangKind): EditorState {
    return createTabState(content, language, this.cb)
  }

  /** Установить состояние — при переключении вкладок */
  setState(state: EditorState) {
    this.view.setState(state)
  }

  focus() {
    this.view.focus()
  }
}
