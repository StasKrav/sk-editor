import type { EditorState } from '@codemirror/state'
import type { CodeEditor } from './editor'
import { langFromFilename } from './languages'
import type { LangKind } from './languages'

export interface Tab {
  id: string
  filename: string
  language: LangKind
  state: EditorState
  modified: boolean
}

export interface TabChangeEvent {
  tabs: Tab[]
  activeId: string | null
}

export class TabManager {
  private tabs: Tab[] = []
  private activeId: string | null = null
  private listeners: ((e: TabChangeEvent) => void)[] = []
  private nextId = 1

  constructor(private editor: CodeEditor) {}

  onChange(fn: (e: TabChangeEvent) => void) {
    this.listeners.push(fn)
  }

  private emit() {
    this.listeners.forEach(fn =>
      fn({ tabs: this.tabs, activeId: this.activeId })
    )
  }

  getTabs(): Tab[] { return this.tabs }
  getActiveId() { return this.activeId }
  getActive(): Tab | null {
    return this.tabs.find(t => t.id === this.activeId) ?? null
  }

  open(filename: string, content: string): string {
    const existing = this.tabs.find(t => t.filename === filename)
    if (existing) {
      this.activate(existing.id)
      return existing.id
    }

    const language = langFromFilename(filename)
    const state = this.editor.createState(content, language)
    const tab: Tab = {
      id: `tab-${this.nextId++}`,
      filename,
      language,
      state,
      modified: false,
    }
    this.tabs.push(tab)
    this.activate(tab.id)
    return tab.id
  }

  openUntitled(): string {
    const n = this.tabs.filter(t => t.filename.startsWith('Untitled')).length + 1
    const id = `tab-${this.nextId++}`
    const state = this.editor.createState('', 'plain')
    this.tabs.push({
      id,
      filename: `Untitled-${n}`,
      language: 'plain',
      state,
      modified: false,
    })
    this.activate(id)
    return id
  }

  activate(id: string) {
    if (this.activeId === id) return
    this.persistActive()
    this.activeId = id
    const tab = this.getActive()
    if (tab) this.editor.setState(tab.state)
    this.emit()
    this.editor.focus()
  }

  close(id: string) {
    const idx = this.tabs.findIndex(t => t.id === id)
    if (idx === -1) return

    const wasActive = this.activeId === id
    this.tabs.splice(idx, 1)

    if (wasActive) {
      const next = this.tabs[idx] ?? this.tabs[idx - 1] ?? null
      if (next) {
        this.activeId = next.id
        this.editor.setState(next.state)
      } else {
        this.activeId = null
        this.editor.setState(this.editor.createState('', 'plain'))
      }
    }
    this.emit()
  }

  markModified() {
    const tab = this.getActive()
    if (tab && !tab.modified) {
      tab.modified = true
      this.emit()
    }
  }

  persistActive() {
    const tab = this.getActive()
    if (tab) tab.state = this.editor.view.state
  }
}
