export interface ContextMenuItem {
  label?: string
  action?: () => void
  danger?: boolean
  separator?: boolean
}

export function showContextMenu(
  x: number,
  y: number,
  items: ContextMenuItem[],
) {
  // закрыть предыдущее меню, если есть
  document.querySelector('.ctx-menu')?.remove()

  const menu = document.createElement('div')
  menu.className = 'ctx-menu'
  menu.style.left = `${x}px`
  menu.style.top = `${y}px`

  for (const item of items) {
    if (item.separator) {
      const sep = document.createElement('div')
      sep.className = 'ctx-sep'
      menu.appendChild(sep)
      continue
    }

    const el = document.createElement('div')
    el.className = 'ctx-item'
    if (item.danger) el.classList.add('danger')
    el.textContent = item.label ?? ''
    el.addEventListener('click', () => {
      menu.remove()
      item.action?.()
    })
    menu.appendChild(el)
  }

  document.body.appendChild(menu)

  // корректировка позиции, если меню вылезло за экран
  const rect = menu.getBoundingClientRect()
  if (rect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - rect.width - 4}px`
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - rect.height - 4}px`
  }

  // закрытие по клику вне меню или Esc
  const close = (e: MouseEvent | KeyboardEvent) => {
    if (e instanceof KeyboardEvent || !menu.contains(e.target as Node)) {
      menu.remove()
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }
  setTimeout(() => {
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
  }, 0)
}