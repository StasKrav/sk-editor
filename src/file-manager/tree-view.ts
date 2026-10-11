import type { FileEntry } from '../fs/types'

export interface TreeViewCallbacks {
  onFileClick: (entry: FileEntry) => void
  onSelectionChange?: (path: string | null) => void
  onDeleteRequest?: (entry: FileEntry) => void
  onRenameRequest?: (entry: FileEntry) => void
  onDuplicateRequest?: (entry: FileEntry) => void
  onContextMenu?: (entry: FileEntry, x: number, y: number) => void
  onRootContextMenu?: (x: number, y: number) => void  
}

export class TreeView {
  private el: HTMLElement
  private cb: TreeViewCallbacks
  private root: FileEntry | null = null
  private selectedPath: string | null = null
  private selectedKind: 'file' | 'dir' | null = null
  private focused = false
  private expandedPaths = new Set<string>()

  constructor(el: HTMLElement, cb: TreeViewCallbacks) {
    this.el = el
    this.cb = cb

    this.el.tabIndex = 0
    this.el.style.outline = 'none'

    this.el.addEventListener('click', e => {
      const target = e.target as HTMLElement
      const row = target.closest('.tree-row') as HTMLElement | null
      if (!row) return

      this.el.focus()
      this.handleRowClick(row)
    })

    this.el.addEventListener('contextmenu', e => {
  const target = e.target as HTMLElement
  const row = target.closest('.tree-row') as HTMLElement | null

  e.preventDefault()

  if (!row) {
    // ПКМ на пустом месте — меню корня
    this.cb.onRootContextMenu?.(e.clientX, e.clientY)
    return
  }

  const path = row.dataset.path!
  const kind = row.dataset.kind as 'file' | 'dir'
  const node = this.findEntry(this.root, path)
  if (!node) return

  this.selectedPath = path
  this.selectedKind = kind
  this.render()

  this.cb.onContextMenu?.(node, e.clientX, e.clientY)
})

    this.el.addEventListener('focus', () => {
      this.focused = true
      this.el.classList.add('focused')
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

      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.key === 'd') {
        e.preventDefault()
        if (idx < 0) return
        this.cb.onDuplicateRequest?.(flat[idx])
        return
      }

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
        case 'Delete': {
          e.preventDefault()
          if (idx < 0) return
          this.cb.onDeleteRequest?.(flat[idx])
          break
        }
        case 'F2': {
          e.preventDefault()
          if (idx < 0) return
          this.cb.onRenameRequest?.(flat[idx])
          break
        }
      }
    })
  }

  // ─── Публичные методы ───────────────────────

  setRoot(root: FileEntry | null) {
    this.root = root
    this.render()
  }

  expandPath(path: string) {
    this.expandedPaths.add(path)
    this.render()
  }

  collapseAll() {
    this.expandedPaths.clear()
    this.render()
  }

  getSelectedPath(): string | null {
    return this.selectedPath
  }

  getSelectedKind(): 'file' | 'dir' | null {
    return this.selectedKind
  }

  focus() {
    this.el.focus()
  }

  focusFirst() {
    this.el.focus()
    const flat = this.flatten()
    if (flat.length === 0) return

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
      const expanded = this.expandedPaths.has(node.path)
      if (!expanded) {
        this.expandedPaths.add(node.path)
        this.render()
      } else {
        const newFlat = this.flatten()
        const newIdx = newFlat.findIndex(n => n.path === node.path)
        if (newIdx >= 0 && newIdx + 1 < newFlat.length) {
          const next = newFlat[newIdx + 1]
          if (next.path.startsWith(node.path + '/')) {
            this.selectNode(next)
          }
        }
      }
    } else {
      this.cb.onFileClick(node)
    }
  }

  private handleLeft(flat: FileEntry[], idx: number) {
    if (idx < 0) return
    const node = flat[idx]

    if (node.kind === 'dir') {
      const expanded = this.expandedPaths.has(node.path)
      if (expanded) {
        this.expandedPaths.delete(node.path)
        this.render()
      } else {
        this.goToParent(node.path)
      }
    } else {
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
    if (this.expandedPaths.has(path)) {
      this.expandedPaths.delete(path)
    } else {
      this.expandedPaths.add(path)
    }
    this.render()
  }

  private goToParent(path: string) {
    const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    if (parentPath === '' && this.root?.path === '') {
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
      `.tree-row[data-path="${CSS.escape(this.selectedPath ?? '')}"]`,
    )
    row?.scrollIntoView({ block: 'nearest' })
  }

  // ─── Вспомогательные ─────────────────────────

  private flatten(): FileEntry[] {
    const out: FileEntry[] = []
    const walk = (node: FileEntry) => {
      if (node.path === '') {
        for (const child of node.children ?? []) walk(child)
        return
      }
      out.push(node)
      if (node.kind === 'dir' && this.expandedPaths.has(node.path)) {
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
      const expanded = this.expandedPaths.has(node.path)
      const row = this.makeRow(node, depth, expanded ? '▼' : '▶')
      this.el.appendChild(row)

      if (expanded && node.children) {
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