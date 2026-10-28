import type { CodeEditor } from './editor/editor'
import type { TabManager } from './editor/tabs'

export interface KeybindingsDeps {
  editor: CodeEditor
  tabs: TabManager

  // Колбэки из main.ts
  formatActiveTab: () => void | Promise<void>
  saveActiveTab: () => void | Promise<void>
  saveActiveTabAs: () => void | Promise<void>
  createNewFile: () => void | Promise<void>
  createNewFolder: () => void | Promise<void>

  openSearchPanel: () => void
  closeSearchPanel: () => void

  activateSidebarTab: (mode: 'files' | 'toc') => void

  tree: {
    hasFocus: () => boolean
    focus: () => void
    focusFirst: () => void
  }
  toc: {
    hasFocus: () => boolean
    focusFirst: () => void
  }

  // DOM-элементы
  btnOpenFolder: HTMLElement
  btnOpenFile: HTMLElement
  fileTreeEl: HTMLElement

  setStatus: (msg: string) => void
}

/**
 * Регистрирует все горячие клавиши приложения.
 * Возвращает функцию для снятия обработчика.
 */
export function registerKeybindings(deps: KeybindingsDeps): () => void {
  const handler = async (e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey
    const searchOpen = !document.getElementById('search-panel')?.hidden

    // ── Ctrl+F — открыть поиск / Escape — закрыть ─────────────
    if (ctrl && !e.shiftKey && !e.altKey && e.code === 'KeyF') {
      e.preventDefault()
      deps.openSearchPanel()
      return
    }

    if (e.key === 'Escape' && searchOpen) {
      e.preventDefault()
      deps.closeSearchPanel()
      return
    }

    // ── Переключение вкладок: Ctrl+1..9, Ctrl+0 ───────────────
    if (ctrl && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
      e.preventDefault()
      const idx = parseInt(e.key, 10) - 1
      const list = deps.tabs.getTabs()
      if (idx < list.length) deps.tabs.activate(list[idx].id)
      return
    }

    if (ctrl && e.key === '0') {
      e.preventDefault()
      const list = deps.tabs.getTabs()
      if (list.length > 0) deps.tabs.activate(list[list.length - 1].id)
      return
    }

    // ── Форматирование ────────────────────────────────────────
    if (ctrl && e.shiftKey && e.code === 'KeyF') {
      e.preventDefault()
      await deps.formatActiveTab()
      return
    }

    // ── Сохранение ────────────────────────────────────────────
    if (ctrl && e.code === 'KeyS' && !e.shiftKey) {
      e.preventDefault()
      await deps.saveActiveTab()
      return
    }

    if (ctrl && e.shiftKey && e.code === 'KeyS') {
      e.preventDefault()
      await deps.saveActiveTabAs()
      return
    }

        // ── Закрыть активную вкладку (Alt+W) ──────────────────────
    if (e.altKey && !ctrl && !e.shiftKey && e.code === 'KeyW') {
      e.preventDefault()
      const active = deps.tabs.getActive()
      if (!active) return

      if (active.modified) {
        const ok = confirm(
          `«${active.filename}» изменён. Закрыть без сохранения?`,
        )
        if (!ok) return
      }

      deps.tabs.close(active.id)
      deps.setStatus(`Закрыто: ${active.filename}`)
      return
    }

    // ── Открытие проекта / файла ──────────────────────────────
    if (ctrl && e.code === 'KeyO' && !e.shiftKey) {
      e.preventDefault()
      deps.btnOpenFolder.click()
      return
    }

    if (e.altKey && !ctrl && e.code === 'KeyO') {
      e.preventDefault()
      deps.btnOpenFile.click()
      return
    }

    // ── Создание файла / папки ────────────────────────────────
    if (e.altKey && !ctrl && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      deps.createNewFile()
      return
    }

    if (e.altKey && !ctrl && e.key.toLowerCase() === 'm') {
      e.preventDefault()
      deps.createNewFolder()
      return
    }

    // ── Сайдбар + фокус ───────────────────────────────────────
    if (e.altKey && !ctrl && e.key === '1') {
      e.preventDefault()
      deps.activateSidebarTab('files')

      if (deps.tree.hasFocus()) {
        deps.editor.focus()
        deps.setStatus('Фокус: редактор')
      } else {
        deps.tree.focusFirst()
        deps.setStatus('Фокус: файлы')
      }
      return
    }

    if (e.altKey && !ctrl && e.key === '2') {
      e.preventDefault()
      deps.activateSidebarTab('toc')

      if (deps.toc.hasFocus()) {
        deps.editor.focus()
        deps.setStatus('Фокус: редактор')
      } else {
        deps.toc.focusFirst()
        deps.setStatus('Фокус: оглавление')
      }
      return
    }

    // ── Escape из дерева — обратно в редактор ─────────────────
    if (e.key === 'Escape' && document.activeElement === deps.fileTreeEl) {
      e.preventDefault()
      deps.editor.focus()
      return
    }
  }

  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}

