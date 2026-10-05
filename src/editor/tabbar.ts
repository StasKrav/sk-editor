import type { Tab, TabChangeEvent } from './tabs'

export interface TabBarCallbacks {
  onActivate: (id: string) => void
  onClose: (id: string) => void
}

export class TabBar {
  private el: HTMLElement
  private cb: TabBarCallbacks

  constructor(el: HTMLElement, cb: TabBarCallbacks) {
    this.el = el
    this.cb = cb
    this.el.addEventListener('click', e => {
      const target = e.target as HTMLElement
      const closeBtn = target.closest('.tab-close') as HTMLElement | null
      const tabEl = target.closest('.tab') as HTMLElement | null
      if (!tabEl) return
      const id = tabEl.dataset.id!
      if (closeBtn) {
        e.stopPropagation()
        this.cb.onClose(id)
      } else {
        this.cb.onActivate(id)
      }
    })
  }

  render(event: TabChangeEvent) {
    this.el.innerHTML = ''
    for (const tab of event.tabs) {
      const div = document.createElement('div')
      div.className = 'tab' + (tab.id === event.activeId ? ' active' : '')
      div.dataset.id = tab.id

      const name = document.createElement('span')
      name.className = 'tab-name'
      name.textContent = tab.filename || 'Untitled'

      const close = document.createElement('span')
      close.className = 'tab-close'
      close.textContent = '×'
      close.title = 'Закрыть'

      div.append(name, close)
      this.el.appendChild(div)
    }
  }
}
