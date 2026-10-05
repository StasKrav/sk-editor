import './style.css'
import { CodeEditor } from './editor/editor'
import { TabManager } from './editor/tabs'
import { TabBar } from './editor/tabbar'
import { BrowserFileSystem } from './fs/browser-fs'
import { TreeView } from './file-manager/tree-view'
import { parseToc } from './toc'
import { TocView } from './toc/toc-view'
import type { FileEntry } from './fs/types'
import type { TocSymbol } from './toc/types'

// ── 1. DOM-элементы ─────────────────────────
const editorContainer = document.getElementById('editor-container')!
const tabBarEl         = document.getElementById('tab-bar')!
const cursorPosEl      = document.getElementById('cursor-pos')!
const statusMsgEl      = document.getElementById('status-msg')!
const fileTreeEl       = document.getElementById('file-tree')!
const tocListEl        = document.getElementById('toc-list')!
const tocFilterEl      = document.getElementById('toc-filter')!
const tocFilterInput   = document.getElementById('toc-filter-input') as HTMLInputElement
const btnOpenFolder    = document.getElementById('btn-open-folder')!
const sidebarTabBtns   = document.querySelectorAll<HTMLButtonElement>('.sidebar-tabs button')

// ── 2. Статусбар ────────────────────────────
function setStatus(msg: string) {
  statusMsgEl.textContent = msg
}

// ── 3. Редактор ─────────────────────────────
const editor = new CodeEditor(editorContainer, {
  onCursorChanged(line, col) {
    cursorPosEl.textContent = `${line}:${col}`
  },
  onDocChanged() {
    tabs.markModified()
    scheduleTocUpdate()
  },
})

// ── 4. Вкладки ──────────────────────────────
const tabs = new TabManager(editor)

const tabBar = new TabBar(tabBarEl, {
  onActivate: id => tabs.activate(id),
  onClose:    id => tabs.close(id),
})

// ── 5. Файловая система ─────────────────────
const fs = new BrowserFileSystem()

// ── 6. Дерево файлов ────────────────────────
const tree = new TreeView(fileTreeEl, {
  async onFileClick(entry: FileEntry) {
    try {
      const existing = tabs.getTabs().find(t => t.filename === entry.path)
      if (existing) {
        tabs.activate(existing.id)
        return
      }
      const content = await fs.readFile(entry.path)
      tabs.open(entry.path, content)
      setStatus(`Открыт: ${entry.path}`)
    } catch (err) {
      setStatus(`Ошибка: ${(err as Error).message}`)
    }
  },
})

// ── 7. TOC ──────────────────────────────────
const toc = new TocView(tocListEl, {
  onSymbolClick(sym: TocSymbol) {
    const doc = editor.view.state.doc
    // на всякий случай защитимся от выхода за пределы документа
    const lineNo = Math.min(Math.max(sym.line, 1), doc.lines)
    const line = doc.line(lineNo)
    const pos = Math.min(line.from + sym.col, line.to)
    editor.view.dispatch({
      selection: { anchor: pos, head: pos },
      scrollIntoView: true,
    })
    editor.focus()
  },
})

function updateToc() {
  const tab = tabs.getActive()
  if (!tab) {
    toc.setSymbols([])
    return
  }
  tabs.persistActive()
  const code = tab.state.doc.toString()
  const symbols = parseToc(code, tab.language)
  toc.setSymbols(symbols)
}

let tocTimer: number | null = null
function scheduleTocUpdate() {
  if (tocListEl.hidden) return
  if (tocTimer !== null) clearTimeout(tocTimer)
  tocTimer = window.setTimeout(() => {
    updateToc()
    tocTimer = null
  }, 300)
}

tocFilterInput.addEventListener('input', () => {
  toc.setFilter(tocFilterInput.value)
})

// ── 8. Переключение вкладок панели Files / TOC ─
sidebarTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode as 'files' | 'toc'
    sidebarTabBtns.forEach(b => b.classList.toggle('active', b === btn))

    if (mode === 'files') {
      fileTreeEl.hidden = false
      tocFilterEl.hidden = true
      tocListEl.hidden = true
    } else {
      fileTreeEl.hidden = true
      tocFilterEl.hidden = false
      tocListEl.hidden = false
      updateToc()
    }
  })
})

// ── 9. Реакция на смену вкладок ─────────────
tabs.onChange(e => {
  tabBar.render(e)
  if (!tocListEl.hidden) updateToc()
})

// ── 10. Кнопка «Открыть папку» ──────────────
btnOpenFolder.addEventListener('click', async () => {
  try {
    const root = await fs.openProject()
    if (root) {
      tree.setRoot(root)
      setStatus(`Проект открыт: ${root.name}`)
    }
  } catch (err) {
    setStatus(`Ошибка: ${(err as Error).message}`)
  }
})

// ── 11. Горячие клавиши ─────────────────────
window.addEventListener('keydown', async e => {
  const ctrl = e.ctrlKey || e.metaKey

  // Ctrl+S — сохранить активную вкладку
  if (ctrl && e.key === 's') {
    e.preventDefault()
    const tab = tabs.getActive()
    if (!tab) return

    if (!tab.filename || tab.filename.startsWith('Untitled')) {
      setStatus('Save As пока не реализован')
      return
    }

    try {
      tabs.persistActive()
      const content = editor.view.state.doc.toString()
      await fs.writeFile(tab.filename, content)
      tab.modified = false
      // принудительно перерисуем панель вкладок, чтобы убрать «●»
      tabBar.render({ tabs: tabs.getTabs(), activeId: tabs.getActiveId() })
      setStatus(`Сохранено: ${tab.filename}`)
    } catch (err) {
      setStatus(`Ошибка сохранения: ${(err as Error).message}`)
    }
    return
  }

  // Ctrl+O — открыть папку
  if (ctrl && e.key === 'o') {
    e.preventDefault()
    btnOpenFolder.click()
    return
  }

  // Ctrl+N — новая пустая вкладка
  if (ctrl && e.key === 'n') {
    e.preventDefault()
    tabs.openUntitled()
    setStatus('Новая вкладка')
    return
  }

  // Ctrl+W — закрыть активную вкладку
  if (ctrl && e.key === 'w') {
    e.preventDefault()
    const id = tabs.getActiveId()
    if (id) tabs.close(id)
    return
  }
})

// ── 12. Стартовое состояние ─────────────────
setStatus('Готово. Откройте папку проекта (Ctrl+O)')
