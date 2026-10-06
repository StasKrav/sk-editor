import type { FileEntry } from '../fs/types'

export interface TreeViewCallbacks {
  onFileClick: (entry: FileEntry) => void
  onSelectionChange?: (path: string | null) => void
}

export class TreeView {
  private el: HTMLElement
  private cb: TreeViewCallbacks
  private root: FileEntry | null = null
  private selectedPath: string | null = null
  private selectedKind: 'file' | 'dir' | null = null
  private focused = false

  constructor(el: HTMLElement, cb: TreeViewCallbacks) {
    this.el = el
    this.cb = cb

    this.el.tabIndex = 0                       // ← делает дерево фокусируемым
    this.el.style.outline = 'none'

    this.el.addEventListener('click', e => {
      const target = e.target as HTMLElement
      const row = target.closest('.tree-row') as HTMLElement | null
      if (!row) return

      this.el.focus()                          // ← фокус на дерево
      this.handleRowClick(row)
    })

    this.el.addEventListener('focus', () => {
      this.focused = true
      this.el.classList.add('focused')
      // если ничего не выделено — выделяем первый элемент
      if (!this.selectedPath && this.root) {
        const flat = this.flatten()
        if (flat.length > 0) {
          this.selectedPath = flat[0].path
          this.selectedKind = flat[0].kind
          this.render()
        }
      }
    })

    this.el.addEventListener('blur', () => {
      this.focused = false
      this.el.classList.remove('focused')
    })

    this.el.addEventListener('keydown', e => {
      if (!this.focused) return

      const flat = this.flatten()
      if (flat.length === 0) return

      const idx = flat.findIndex(n => n.path === this.selectedPath)

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          const next = idx < 0 ? 0 : Math.min(idx + 1, flat.length - 1)
          this.selectNode(flat[next])
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          const prev = idx < 0 ? 0 : Math.max(idx - 1, 0)
          this.selectNode(flat[prev])
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          this.handleRight(flat, idx)
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          this.handleLeft(flat, idx)
          break
        }
        case 'Enter': {
          e.preventDefault()
          this.handleEnter(flat, idx)
          break
        }
      }
    })
  }

  // ─── Публичные геттеры ───────────────────────

  setRoot(root: FileEntry | null) {
    this.root = root
    this.render()
  }

  getSelectedPath(): string | null { return this.selectedPath }
  getSelectedKind(): 'file' | 'dir' | null { return this.selectedKind }

  focus() {
    this.el.focus()
  }

  focusFirst() {
    this.el.focus()
    const flat = this.flatten()
    if (flat.length === 0) return
  
    // если есть сохранённое выделение и оно всё ещё видимо — оставляем
    const existing = flat.find(n => n.path === this.selectedPath)
    if (existing) {
      this.selectNode(existing)
    } else {
      this.selectNode(flat[0])
    }
  }

  hasFocus(): boolean {
    return this.focused
  }

  // ─── Внутренние обработчики ──────────────────

  private handleRowClick(row: HTMLElement) {
    const path = row.dataset.path!
    const kind = row.dataset.kind as 'file' | 'dir'

    this.selectedPath = path
    this.selectedKind = kind
    this.render()

    if (kind === 'file') {
      const entry = this.findEntry(this.root, path)
      if (entry) this.cb.onFileClick(entry)
    } else {
      this.toggleCollapse(path)
    }
  }

  private handleRight(flat: FileEntry[], idx: number) {
    if (idx < 0) return
    const node = flat[idx]

    if (node.kind === 'dir') {
      const collapsed = (node as any).__collapsed === true
      if (collapsed) {
        // раскрыть
        ;(node as any).__collapsed = false
        this.render()
      } else {
        // уже раскрыта — перейти на первого ребёнка
        const newFlat = this.flatten()
        const newIdx = newFlat.findIndex(n => n.path === node.path)
        if (newIdx >= 0 && newIdx + 1 < newFlat.length) {
          // следующий элемент — первый ребёнок
          const next = newFlat[newIdx + 1]
          if (next.path.startsWith(node.path + '/')) {
            this.selectNode(next)
          }
        }
      }
    } else {
      // файл — открыть
      this.cb.onFileClick(node)
    }
  }

  private handleLeft(flat: FileEntry[], idx: number) {
    if (idx < 0) return
    const node = flat[idx]

    if (node.kind === 'dir') {
      const collapsed = (node as any).__collapsed === true
      if (!collapsed) {
        // свернуть
        ;(node as any).__collapsed = true
        this.render()
      } else {
        // уже свёрнута — перейти к родителю
        this.goToParent(node.path)
      }
    } else {
      // файл — перейти к родителю
      this.goToParent(node.path)
    }
  }

  private handleEnter(flat: FileEntry[], idx: number) {
    if (idx < 0) return
    const node = flat[idx]
    if (node.kind === 'file') {
      this.cb.onFileClick(node)
    } else {
      this.toggleCollapse(node.path)
    }
  }

  private toggleCollapse(path: string) {
    const entry = this.findEntry(this.root, path)
    if (!entry) return
    ;(entry as any).__collapsed = !(entry as any).__collapsed
    this.render()
  }

  private goToParent(path: string) {
    const parentPath = path.includes('/')
      ? path.slice(0, path.lastIndexOf('/'))
      : ''
    if (parentPath === '' && this.root?.path === '') {
      // родитель — корень, не выделяем
      return
    }
    const parent = this.findEntry(this.root, parentPath)
    if (parent) {
      this.selectNode(parent)
    }
  }

  private selectNode(node: FileEntry) {
    this.selectedPath = node.path
    this.selectedKind = node.kind
    this.render()
    this.scrollIntoView()
    this.cb.onSelectionChange?.(node.path)
  }

  private scrollIntoView() {
    const row = this.el.querySelector<HTMLElement>(
      `.tree-row[data-path="${CSS.escape(this.selectedPath ?? '')}"]`
    )
    row?.scrollIntoView({ block: 'nearest' })
  }

  // ─── Вспомогательные ─────────────────────────

  /**
   * Плоский список видимых узлов (с учётом свёрнутых папок).
   * Порядок — как в дереве сверху вниз.
   */
  private flatten(): FileEntry[] {
    const out: FileEntry[] = []
    const walk = (node: FileEntry) => {
      if (node.path === '') {
        // корень — только дети
        for (const child of node.children ?? []) walk(child)
        return
      }
      out.push(node)
      if (node.kind === 'dir' && (node as any).__collapsed !== true) {
        for (const child of node.children ?? []) walk(child)
      }
    }
    if (this.root) walk(this.root)
    return out
  }

  private findEntry(node: FileEntry | null, path: string): FileEntry | null {
    if (!node) return null
    if (node.path === path) return node
    if (node.children) {
      for (const child of node.children) {
        const found = this.findEntry(child, path)
        if (found) return found
      }
    }
    return null
  }

  private render() {
    this.el.innerHTML = ''
    if (!this.root) {
      const empty = document.createElement('div')
      empty.className = 'tree-empty'
      empty.textContent = 'Файл → Открыть папку проекта…'
      this.el.appendChild(empty)
      return
    }
    this.renderNode(this.root, 0)
  }

  private renderNode(node: FileEntry, depth: number) {
    if (node.kind === 'dir' && node.path !== '') {
      const collapsed = (node as any).__collapsed === true
      const row = this.makeRow(node, depth, collapsed ? '▶' : '▼')
      this.el.appendChild(row)

      if (!collapsed && node.children) {
        for (const child of node.children) {
          this.renderNode(child, depth + 1)
        }
      }
    } else if (node.path === '') {
      if (node.children) {
        for (const child of node.children) {
          this.renderNode(child, depth)
        }
      }
    } else {
      const row = this.makeRow(node, depth, '')
      this.el.appendChild(row)
    }
  }

  private makeRow(node: FileEntry, depth: number, icon: string): HTMLElement {
    const row = document.createElement('div')
    row.className = 'tree-row'
    if (this.selectedPath === node.path) row.classList.add('selected')
    row.dataset.path = node.path
    row.dataset.kind = node.kind
    row.style.paddingLeft = `${depth * 12 + 8}px`

    const nameEl = document.createElement('span')
    nameEl.className = 'tree-name'
    nameEl.textContent = node.name

    if (icon) {
      const iconEl = document.createElement('span')
      iconEl.className = 'tree-icon'
      iconEl.textContent = icon
      row.append(iconEl, nameEl)
    } else {
      row.append(nameEl)
    }

    return row
  }
}
