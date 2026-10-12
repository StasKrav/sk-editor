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
import { formatCode } from './format/prettier'
import { langFromFilename } from './editor/languages'
import { showContextMenu } from './file-manager/context-menu'
import { saveRootHandle, loadRootHandle, clearRootHandle } from './fs/handle-store'
import { registerKeybindings } from './keybindings'
import { EditorView } from '@codemirror/view'

// ── 1. DOM-элементы ─────────────────────────
const editorContainer = document.getElementById('editor-container')!
const tabBarEl = document.getElementById('tab-bar')!
const cursorPosEl = document.getElementById('cursor-pos')!
const statusMsgEl = document.getElementById('status-msg')!
const fileTreeEl = document.getElementById('file-tree')!
const tocListEl = document.getElementById('toc-list')!
const tocFilterEl = document.getElementById('toc-filter')!
const tocFilterInput = document.getElementById('toc-filter-input') as HTMLInputElement
const btnOpenFolder = document.getElementById('btn-open-folder')!
const btnOpenFile = document.getElementById('btn-open-file')!
const sidebarTabBtns = document.querySelectorAll<HTMLButtonElement>('.sidebar-tabs button')

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
  onClose: id => tabs.close(id),
})

// ── 5. Файловая система ─────────────────────
const fs = new BrowserFileSystem()

// ── 6. CRUD-операции (используются и в callbacks дерева, и в ПКМ-меню) ────

async function refreshAfterChange() {
  const root = await fs.refresh()
  if (root) tree.setRoot(root)
}

async function doDelete(entry: FileEntry) {
  const msg = entry.kind === 'dir'
    ? `Удалить папку «${entry.name}» со всем содержимым?`
    : `Удалить файл «${entry.name}»?`
  if (!confirm(msg)) return

  try {
    await fs.deleteEntry(entry.path)
    const tab = tabs.getTabs().find(t => t.filename === entry.path)
    if (tab) tabs.close(tab.id)
    await refreshAfterChange()
    setStatus(`Удалено: ${entry.path}`)
  } catch (err) {
    setStatus(`Ошибка удаления: ${(err as Error).message}`)
  }
}

async function doRename(entry: FileEntry) {
  const newName = prompt('Новое имя:', entry.name)
  if (!newName || newName === entry.name) return
  if (newName.includes('/')) {
    setStatus('Переименование не перемещает — только имя')
    return
  }

  const parentPath = entry.path.includes('/')
    ? entry.path.slice(0, entry.path.lastIndexOf('/'))
    : ''
  const newPath = parentPath ? `${parentPath}/${newName}` : newName

  try {
    await fs.renameEntry(entry.path, newPath)
    const tab = tabs.getTabs().find(t => t.filename === entry.path)
    if (tab) {
      tab.filename = newPath
      tab.language = langFromFilename(newPath)
      tabBar.render({ tabs: tabs.getTabs(), activeId: tabs.getActiveId() })
    }
    await refreshAfterChange()
    setStatus(`Переименовано: ${entry.name} → ${newName}`)
  } catch (err) {
    setStatus(`Ошибка переименования: ${(err as Error).message}`)
  }
}

async function doDuplicate(entry: FileEntry) {
  try {
    const newPath = await fs.duplicateEntry(entry.path)
    await refreshAfterChange()
    setStatus(`Создана копия: ${newPath}`)
  } catch (err) {
    setStatus(`Ошибка копирования: ${(err as Error).message}`)
  }
}

async function doCreateFile(dirPath: string, name: string) {
  const path = dirPath ? `${dirPath}/${name}` : name
  try {
    await fs.createFile(path)
    const root = await fs.refresh()
    if (root) tree.setRoot(root)
    if (dirPath) tree.expandPath(dirPath)
    const content = await fs.readFile(path)
    tabs.open(path, content)
    setStatus(`Создан: ${path}`)
  } catch (err) {
    setStatus(`Ошибка: ${(err as Error).message}`)
  }
}

async function doCreateFolder(dirPath: string, name: string) {
  const path = dirPath ? `${dirPath}/${name}` : name
  try {
    await fs.createFolder(path)
    const root = await fs.refresh()
    if (root) tree.setRoot(root)
    if (dirPath) tree.expandPath(dirPath)
    setStatus(`Создана папка: ${path}`)
  } catch (err) {
    setStatus(`Ошибка: ${(err as Error).message}`)
  }
}

async function createNewFile() {
  const selectedPath = tree.getSelectedPath()
  const selectedKind = tree.getSelectedKind()
  const base = selectedKind === 'dir' && selectedPath ? selectedPath + '/' : ''

  const path = prompt('Имя файла (можно с путём):', base)
  if (!path) return

  // если введён путь — разбираем
  const lastSlash = path.lastIndexOf('/')
  const dirPath = lastSlash >= 0 ? path.slice(0, lastSlash) : ''
  const name = lastSlash >= 0 ? path.slice(lastSlash + 1) : path

  await doCreateFile(dirPath, name)
}

async function createNewFolder() {
  const path = prompt('Имя папки (можно с вложенностью, например src/utils):')
  if (!path) return

  const lastSlash = path.lastIndexOf('/')
  const dirPath = lastSlash >= 0 ? path.slice(0, lastSlash) : ''
  const name = lastSlash >= 0 ? path.slice(lastSlash + 1) : path

  await doCreateFolder(dirPath, name)
}

// ── 7. Дерево файлов ────────────────────────
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

  onDeleteRequest: doDelete,
  onRenameRequest: doRename,
  onDuplicateRequest: doDuplicate,

  onRootContextMenu: (x, y) => {
  showContextMenu(x, y, [
    {
      label: 'Новый файл в корне',
      action: () => {
        const name = prompt('Имя файла:')
        if (name) doCreateFile('', name)
      },
    },
    {
      label: 'Новая папка в корне',
      action: () => {
        const name = prompt('Имя папки:')
        if (name) doCreateFolder('', name)
      },
    },
    { separator: true },
    {
      label: 'Обновить дерево',
      action: async () => {
        try {
          const root = await fs.refresh()
          if (root) {
            tree.setRoot(root)
            setStatus('Дерево обновлено')
          }
        } catch (err) {
          setStatus(`Ошибка: ${(err as Error).message}`)
        }
      },
    },
  ])
},

  onContextMenu: (entry, x, y) => {
    const isDir = entry.kind === 'dir'

    const items: any[] = []

    if (isDir) {
      items.push({
        label: 'Новый файл',
        action: () => {
          const name = prompt('Имя файла:')
          if (name) doCreateFile(entry.path, name)
        },
      })
      items.push({
        label: 'Новая папка',
        action: () => {
          const name = prompt('Имя папки:')
          if (name) doCreateFolder(entry.path, name)
        },
      })
      items.push({ separator: true })
    }

    if (entry.kind === 'file') {
      items.push({
        label: 'Открыть',
        action: async () => {
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
      items.push({ separator: true })
    }

    items.push({
      label: 'Переименовать',
      action: () => doRename(entry),
    })
    items.push({
      label: 'Дублировать',
      action: () => doDuplicate(entry),
    })
    items.push({ separator: true })
    items.push({
      label: 'Удалить',
      danger: true,
      action: () => doDelete(entry),
    })

    showContextMenu(x, y, items)
  },
})

// ── 8. TOC ──────────────────────────────────
const toc = new TocView(tocListEl, {
  onSymbolClick(sym: TocSymbol) {
    const doc = editor.view.state.doc
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

// ── 9. Переключение вкладок панели Files / TOC ─
sidebarTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode as 'files' | 'toc'
    activateSidebarTab(mode)
  })
})

// ── 10. FORMAT ──────────────────────────────
async function formatActiveTab() {
  const tab = tabs.getActive()
  if (!tab) {
    setStatus('Нет активной вкладки')
    return
  }

  tabs.persistActive()
  const code = editor.view.state.doc.toString()

  setStatus('Форматирование...')
  const result = await formatCode(code, tab.language)

  if (!result.ok) {
    setStatus(`Prettier: ${result.error}`)
    return
  }

  if (result.code === code) {
    setStatus('Уже отформатировано')
    return
  }

  editor.view.dispatch({
    changes: {
      from: 0,
      to: editor.view.state.doc.length,
      insert: result.code,
    },
  })

  setStatus('Отформатировано')
}

// ── 11. Сохранение ──────────────────────────
async function saveActiveTab() {
  const tab = tabs.getActive()
  if (!tab) {
    setStatus('Нет активной вкладки')
    return
  }

  tabs.persistActive()
  const content = editor.view.state.doc.toString()

  if (!tab.filename || tab.filename.startsWith('Untitled')) {
    await saveActiveTabAs()
    return
  }

  try {
    if (tab.fileHandle) {
      await fs.writeViaHandle(tab.fileHandle, content)
    } else {
      await fs.writeFile(tab.filename, content)
    }

    tab.modified = false
    tabBar.render({ tabs: tabs.getTabs(), activeId: tabs.getActiveId() })
    setStatus(`Сохранено: ${tab.filename}`)
  } catch (err) {
    setStatus(`Ошибка сохранения: ${(err as Error).message}`)
  }
}

async function saveActiveTabAs() {
  const tab = tabs.getActive()
  if (!tab) {
    setStatus('Нет активной вкладки')
    return
  }

  tabs.persistActive()
  const content = editor.view.state.doc.toString()

  try {
    const handle = await fs.saveAs(content, tab.filename)
    if (!handle) {
      setStatus('Сохранение отменено')
      return
    }
    tab.filename = handle.name
    tab.language = langFromFilename(handle.name)
    tab.fileHandle = handle
    tab.modified = false
    tabBar.render({ tabs: tabs.getTabs(), activeId: tabs.getActiveId() })
    setStatus(`Сохранено как: ${handle.name}`)
  } catch (err) {
    setStatus(`Ошибка сохранения: ${(err as Error).message}`)
  }
}

// ── 12. Реакция на смену вкладок ────────────
tabs.onChange(e => {
  tabBar.render(e)
  if (!tocListEl.hidden) updateToc()
})

// ── 13. Кнопка «Открыть папку» ──────────────
btnOpenFolder.addEventListener('click', async () => {
  try {
    const root = await fs.openProject()
    if (root) {
      tree.setRoot(root)
      tree.collapseAll()
      tree.focus()
      setStatus(`Проект открыт: ${root.name}`)

      const handle = (fs as any).rootHandle as FileSystemDirectoryHandle | null
      if (handle) await saveRootHandle(handle)
    }
  } catch (err) {
    setStatus(`Ошибка: ${(err as Error).message}`)
  }
})

// ── 14. Кнопка «Открыть файл» ───────────────
btnOpenFile.addEventListener('click', async () => {
  try {
    const file = await fs.openFile()
    if (!file) return

    tabs.openWithHandle(file.name, file.content, file.handle)
    setStatus(`Открыт: ${file.name}`)
  } catch (err) {
    setStatus(`Ошибка: ${(err as Error).message}`)
  }
})

// ── 15. Кнопка «Обновить дерево» ────────────
const btnRefreshTree = document.getElementById('btn-refresh-tree')!

btnRefreshTree.addEventListener('click', async () => {
  try {
    const root = await fs.refresh()
    if (!root) {
      setStatus('Папка проекта не открыта')
      return
    }
    tree.setRoot(root)
    setStatus('Дерево обновлено')
  } catch (err) {
    setStatus(`Ошибка: ${(err as Error).message}`)
  }
})

// ── 16. Горячие клавиши ─────────────────────
registerKeybindings({
  editor,
  tabs,
  formatActiveTab,
  saveActiveTab,
  saveActiveTabAs,
  createNewFile,
  createNewFolder,
  openSearchPanel,
  closeSearchPanel, 
  activateSidebarTab,
  tree: {
    hasFocus: () => tree.hasFocus(),
    focus: () => tree.focus(),
    focusFirst: () => tree.focusFirst(),
  },
  toc: {
    hasFocus: () => toc.hasFocus(),
    focusFirst: () => toc.focusFirst(),
  },
  btnOpenFolder,
  btnOpenFile,
  fileTreeEl,
  setStatus,
})

// ── 17. Тема ────────────────────────────────
type ThemeName = 'zenburn' | 'light'

const themeSelect = document.getElementById('theme-select') as HTMLSelectElement

function applyTheme(name: ThemeName) {
  document.documentElement.dataset.theme = name
  localStorage.setItem('theme', name)
  themeSelect.value = name
  editor.setHighlight(name === 'light' ? 'light' : 'dark')
}

function getTheme(): ThemeName {
  const saved = localStorage.getItem('theme')
  return saved === 'light' ? 'light' : 'zenburn'
}

themeSelect.addEventListener('change', () => {
  const name = themeSelect.value as ThemeName
  applyTheme(name)
  setStatus(`Тема: ${name}`)
})

applyTheme(getTheme())

// ── 18. Изменение ширины сайдбара ───────────
const resizer = document.getElementById('resizer')!

const MIN_SIDEBAR = 160
const MAX_SIDEBAR = 600
const STORAGE_KEY = 'sidebar-width'

function setSidebarWidth(px: number) {
  const clamped = Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, px))
  document.documentElement.style.setProperty('--sidebar-width', `${clamped}px`)
  localStorage.setItem(STORAGE_KEY, String(clamped))
}

const savedWidth = parseInt(localStorage.getItem(STORAGE_KEY) ?? '', 10)
if (!isNaN(savedWidth)) setSidebarWidth(savedWidth)

let dragging = false

resizer.addEventListener('mousedown', e => {
  e.preventDefault()
  dragging = true
  resizer.classList.add('dragging')
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
})

window.addEventListener('mousemove', e => {
  if (!dragging) return
  setSidebarWidth(e.clientX)
})

window.addEventListener('mouseup', () => {
  if (!dragging) return
  dragging = false
  resizer.classList.remove('dragging')
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})

resizer.addEventListener('dblclick', () => {
  setSidebarWidth(260)
})

function activateSidebarTab(mode: 'files' | 'toc') {
  sidebarTabBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode)
  })

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
}

// ── 19. Панель поиска ───────────────────────
import {
  SearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
  openSearchPanel as cmOpenSearchPanel,
  closeSearchPanel as cmCloseSearchPanel,
} from '@codemirror/search'

const searchPanelEl = document.getElementById('search-panel')!
const searchInput = document.getElementById('search-input') as HTMLInputElement
const replaceInput = document.getElementById('replace-input') as HTMLInputElement
const searchNextBtn = document.getElementById('search-next')!
const searchPrevBtn = document.getElementById('search-prev')!
const searchReplaceBtn = document.getElementById('search-replace')!
const searchReplaceAllBtn = document.getElementById('search-replace-all')!
const searchCloseBtn = document.getElementById('search-close')!
const searchCaseChk = document.getElementById('search-case-sensitive') as HTMLInputElement

const statusBarEl = document.getElementById('status-bar')!

function applySearchQuery(moveToMatch = false) {
  const query = searchInput.value
  const caseSensitive = searchCaseChk.checked
  const replace = replaceInput.value

  editor.view.dispatch({
    effects: setSearchQuery.of(
      new SearchQuery({
        search: query,
        replace: replace,
        caseSensitive,
        literal: true,
      }),
    ),
  })

  if (moveToMatch && query.length > 0) {
    editor.view.dispatch({ selection: { anchor: 0, head: 0 } })
    findNext(editor.view)
  }
}

const SCROLL_MARGIN_TOP = 80

function scrollMatchIntoView() {
  const view = editor.view
  const pos = view.state.selection.main.head

  view.dispatch({
    effects: EditorView.scrollIntoView(pos, {
      y: 'start',
      yMargin: SCROLL_MARGIN_TOP,
    }),
  })
}

function doFindNext() {
  applySearchQuery()
  findNext(editor.view)
  scrollMatchIntoView()
}

function doFindPrev() {
  applySearchQuery()
  findPrevious(editor.view)
  scrollMatchIntoView()
}

function doReplace() {
  applySearchQuery()
  replaceNext(editor.view)
  findNext(editor.view)
  scrollMatchIntoView()
}

function doReplaceAll() {
  applySearchQuery()
  replaceAll(editor.view)
}

searchNextBtn.addEventListener('click', doFindNext)
searchPrevBtn.addEventListener('click', doFindPrev)
searchReplaceBtn.addEventListener('click', doReplace)
searchReplaceAllBtn.addEventListener('click', doReplaceAll)
searchCloseBtn.addEventListener('click', closeSearchPanel)

searchInput.addEventListener('input', () => applySearchQuery(true))
searchCaseChk.addEventListener('change', () => applySearchQuery())
replaceInput.addEventListener('input', () => applySearchQuery())

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (e.shiftKey) doFindPrev()
    else doFindNext()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closeSearchPanel()
  }
})

replaceInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault()
    doReplace()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closeSearchPanel()
  }
})


function openSearchPanel() {
  cmOpenSearchPanel(editor.view)
  searchPanelEl.hidden = false
  statusBarEl.classList.add('searching')

  const sel = editor.view.state.selection.main
  if (!sel.empty) {
    const text = editor.view.state.sliceDoc(sel.from, sel.to)
    if (text.length < 100 && !text.includes('\n')) {
      searchInput.value = text
    }
  }

  searchInput.focus()
  searchInput.select()
  applySearchQuery()
}

function closeSearchPanel() {
  cmCloseSearchPanel(editor.view)
  searchPanelEl.hidden = true
  statusBarEl.classList.remove('searching')
  editor.focus()
}

// ── 20. Восстановление сессии ───────────────
async function restoreSession() {
  const handle = await loadRootHandle()
  if (!handle) {
    setStatus('Готово. Откройте папку проекта (Ctrl+O)')
    return
  }

  fs.setRootHandle(handle)

  if (await fs.checkPermission()) {
    try {
      const root = await fs.refresh()
      if (root) {
        tree.setRoot(root)
        tree.focus()
        setStatus(`Проект восстановлен: ${fs.getRootName()}`)
      }
    } catch (err) {
      setStatus(`Ошибка восстановления: ${(err as Error).message}`)
    }
  } else {
    showRestoreBanner(handle)
  }
}

function showRestoreBanner(handle: FileSystemDirectoryHandle) {
  const banner = document.createElement('div')
  banner.className = 'restore-banner'
  banner.innerHTML = `
    <span>Восстановить доступ к папке <b></b>?</span>
    <button class="btn-primary">Восстановить</button>
    <button class="btn-ghost">Забыть</button>
  `
  ;(banner.querySelector('b') as HTMLElement).textContent = handle.name

  banner.querySelector('.btn-primary')!.addEventListener('click', async () => {
    const ok = await fs.requestPermission()
    banner.remove()
    if (ok) {
      try {
        const root = await fs.refresh()
        if (root) {
          tree.setRoot(root)
          tree.focus()
          setStatus(`Проект восстановлен: ${fs.getRootName()}`)
        }
      } catch (err) {
        setStatus(`Ошибка: ${(err as Error).message}`)
      }
    } else {
      setStatus('Доступ не получен')
    }
  })

  banner.querySelector('.btn-ghost')!.addEventListener('click', async () => {
    await clearRootHandle()
    banner.remove()
    setStatus('Восстановление отменено. Откройте папку заново (Ctrl+O)')
  })

  document.body.appendChild(banner)
}

// Запуск восстановления после инициализации
restoreSession()
