import { EditorView, Decoration, ViewPlugin, WidgetType } from '@codemirror/view'
import { RangeSetBuilder, EditorState } from '@codemirror/state'

/**
 * Виджет — вертикальная линия на уровне отступа.
 * Используется через Decoration.widget в начале строки.
 */
class IndentGuideWidget extends WidgetType {
  constructor(readonly level: number, readonly isActive: boolean) {
    super()
  }

  eq(other: IndentGuideWidget): boolean {
    return this.level === other.level && this.isActive === other.isActive
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-indent-guide'
    if (this.isActive) span.classList.add('cm-indent-guide-active')
    span.style.left = `${this.level}ch`
    return span
  }

  ignoreEvent(): boolean {
    return false
  }
}

function buildIndentGuides(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>()
  const { state } = view
  const tabSize = state.facet(EditorState.tabSize)

  // активная строка — где курсор
  const activeLine = state.doc.lineAt(state.selection.main.head).number

  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)
    const indent = line.text.match(/^[ \t]*/)?.[0] ?? ''
    if (!indent) continue

    // сколько уровней отступа
    let levels = 0
    let col = 0
    for (const ch of indent) {
      if (ch === '\t') {
        col += tabSize - (col % tabSize)
        levels = Math.ceil(col / tabSize)
      } else {
        col++
        if (col % tabSize === 0) levels++
      }
    }

    // рисуем маркер в начале строки — по одному на уровень
    for (let lvl = 0; lvl < levels; lvl++) {
      builder.add(
        line.from,
        line.from,
        Decoration.widget({
          widget: new IndentGuideWidget(lvl, i === activeLine),
          side: -1,
        })
      )
    }
  }

  return builder.finish()
}

export const indentGuides = ViewPlugin.fromClass(
  class {
    decorations

    constructor(view: EditorView) {
      this.decorations = buildIndentGuides(view)
    }

    update(update: any) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildIndentGuides(update.view)
      }
    }
  },
  {
    decorations: v => v.decorations,
  }
)
