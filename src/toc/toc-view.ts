import type { TocSymbol } from './types'

export interface TocViewCallbacks {
  onSymbolClick: (symbol: TocSymbol) => void
}

const ICONS: Record<string, string> = {
  function: '⚡',
  class: '🏛',
  method: '▸',
  variable: '▪',
  selector: '🎯',
  'at-rule': '📦',
  'css-variable': '🎨',
  'html-element': '□',
  'html-id': '#',
  heading: '#',
}

export class TocView {
  private el: HTMLElement
  private cb: TocViewCallbacks
  private symbols: TocSymbol[] = []
  private filter = ''
  private selectedIndex = -1
  private focused = false

  constructor(el: HTMLElement, cb: TocViewCallbacks) {
    this.el = el
    this.cb = cb

    this.el.tabIndex = 0
    this.el.style.outline = 'none'

    this.el.addEventListener('click', e => {
      const target = e.target as HTMLElement
      const row = target.closest('.toc-row') as HTMLElement | null
      if (!row) return

      this.el.focus()
      const idx = Number(row.dataset.index)
      this.selectedIndex = idx
      this.render()
      this.cb.onSymbolClick(this.symbols[idx])
    })

    this.el.addEventListener('focus', () => {
      this.focused = true
      this.el.classList.add('focused')
    })

    this.el.addEventListener('blur', () => {
      this.focused = false
      this.el.classList.remove('focused')
    })

    this.el.addEventListener('keydown', e => {
      if (!this.focused) return
      const visible = this.getVisible()

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          if (visible.length === 0) return
          this.selectedIndex = Math.min(this.selectedIndex + 1, visible.length - 1)
          if (this.selectedIndex < 0) this.selectedIndex = 0
          this.render()
          this.scrollIntoView()
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          if (visible.length === 0) return
          this.selectedIndex = Math.max(this.selectedIndex - 1, 0)
          this.render()
          this.scrollIntoView()
          break
        }
        case 'Enter': {
          e.preventDefault()
          if (this.selectedIndex >= 0 && this.selectedIndex < visible.length) {
            this.cb.onSymbolClick(visible[this.selectedIndex])
            // опционально: вернуть фокус в редактор
            this.el.blur()
          }
          break
        }
      }
    })
  }

  setSymbols(symbols: TocSymbol[]) {
    const changed =
      symbols.length !== this.symbols.length ||
      symbols.some((s, i) => {
        const old = this.symbols[i]
        return !old || old.name !== s.name || old.line !== s.line
      })
  
    this.symbols = symbols
  
    // сбрасываем выделение, только если данные реально изменились
    if (changed) {
      this.selectedIndex = -1
    }
  
    this.render()
  }

  setFilter(filter: string) {
    this.filter = filter.toLowerCase()
    this.selectedIndex = -1
    this.render()
  }

  /** Фокусирует список и выделяет первый символ */
  focusFirst() {
    this.el.focus()
    const visible = this.getVisible()
    if (visible.length === 0) return
  
    if (this.selectedIndex >= 0 && this.selectedIndex < visible.length) {
      this.render()
      this.scrollIntoView()
      return
    }
  
    this.selectedIndex = 0
    this.render()
    this.scrollIntoView()
  }

  /** Возвращает true, если TOC сейчас в фокусе */
  hasFocus(): boolean {
    return this.focused
  }

  private getVisible(): TocSymbol[] {
    if (!this.filter) return this.symbols
    return this.symbols.filter(s => s.name.toLowerCase().includes(this.filter))
  }

  private scrollIntoView() {
    const row = this.el.querySelector<HTMLElement>(
      `.toc-row[data-index="${this.selectedIndex}"]`
    )
    row?.scrollIntoView({ block: 'nearest' })
  }

  private render() {
    this.el.innerHTML = ''
    const visible = this.getVisible()

    if (visible.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'tree-empty'
      empty.textContent = this.symbols.length === 0
        ? 'Нет символов в этом файле'
        : 'Ничего не найдено'
      this.el.appendChild(empty)
      return
    }

    visible.forEach((sym, i) => {
      const row = document.createElement('div')
      row.className = 'toc-row'
      if (i === this.selectedIndex) row.classList.add('selected')
      row.dataset.index = String(i)
      row.style.paddingLeft = `${sym.depth * 12 + 8}px`

      const icon = document.createElement('span')
      icon.className = `toc-icon toc-icon-${sym.kind}`
      icon.textContent = ICONS[sym.kind] ?? '·'

      const name = document.createElement('span')
      name.className = 'toc-name'
      name.textContent = sym.name

      const line = document.createElement('span')
      line.className = 'toc-line'
      line.textContent = `:${sym.line}`

      row.append(icon, name, line)
      this.el.appendChild(row)
    })
  }
}
