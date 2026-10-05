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
}

export class TocView {
  private el: HTMLElement
  private cb: TocViewCallbacks
  private symbols: TocSymbol[] = []
  private filter = ''

  constructor(el: HTMLElement, cb: TocViewCallbacks) {
    this.el = el
    this.cb = cb

    this.el.addEventListener('click', e => {
      const target = e.target as HTMLElement
      const row = target.closest('.toc-row') as HTMLElement | null
      if (!row) return
      const line = parseInt(row.dataset.line!, 10)
      const symbol = this.symbols.find(s => s.line === line)
      if (symbol) this.cb.onSymbolClick(symbol)
    })
  }

  setSymbols(symbols: TocSymbol[]) {
    this.symbols = symbols
    this.render()
  }

  setFilter(filter: string) {
    this.filter = filter.toLowerCase()
    this.render()
  }

  private render() {
    this.el.innerHTML = ''

    if (this.symbols.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'tree-empty'
      empty.textContent = 'Нет символов в этом файле'
      this.el.appendChild(empty)
      return
    }

    const filtered = this.filter
      ? this.symbols.filter(s => s.name.toLowerCase().includes(this.filter))
      : this.symbols

    if (filtered.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'tree-empty'
      empty.textContent = 'Ничего не найдено'
      this.el.appendChild(empty)
      return
    }

    for (const sym of filtered) {
      const row = document.createElement('div')
      row.className = 'toc-row'
      row.dataset.line = String(sym.line)
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
    }
  }
}
