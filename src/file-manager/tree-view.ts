import type { FileEntry } from '../fs/types'

export interface TreeViewCallbacks {
  onFileClick: (entry: FileEntry) => void
}

export class TreeView {
  private el: HTMLElement
  private cb: TreeViewCallbacks
  private root: FileEntry | null = null
  private selectedPath: string | null = null
  private selectedKind: 'file' | 'dir' | null = null

  constructor(el: HTMLElement, cb: TreeViewCallbacks) {
    this.el = el
    this.cb = cb

    this.el.addEventListener('click', e => {
      const target = e.target as HTMLElement
      const row = target.closest('.tree-row') as HTMLElement | null
      if (!row) return

      const path = row.dataset.path!
      const kind = row.dataset.kind as 'file' | 'dir'

      this.selectedPath = path
      this.selectedKind = kind 
      this.render()

      if (kind === 'file') {
        const entry = this.findEntry(this.root, path)
        if (entry) this.cb.onFileClick(entry)
      } else {
        // для папок — toggle раскрытия
        const entry = this.findEntry(this.root, path)
        if (entry) {
          ;(entry as any).__collapsed = !(entry as any).__collapsed
          this.render()
        }
      }
    })
  }

  setRoot(root: FileEntry | null) {
    this.root = root
    this.selectedPath = null
    this.render()
  }

  getSelectedPath(): string | null {
    return this.selectedPath
  }
  
  getSelectedKind(): 'file' | 'dir' | null {
    return this.selectedKind
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
      // корень — рисуем только детей
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

    const iconEl = document.createElement('span')
    iconEl.className = 'tree-icon'
    iconEl.textContent = icon

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
