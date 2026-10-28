import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { search, highlightSelectionMatches } from '@codemirror/search'
import { Compartment, EditorSelection, EditorState } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'
import { langExtension, type LangKind } from './languages'
import { zenburnHighlight, solarizedLightHighlight } from './cm-highlight'
import { expandSelectionExtension } from 'codemirror-expand-selection'

export const languageConf = new Compartment()
export const highlightConf = new Compartment()

export const lightHighlight = solarizedLightHighlight
export const darkHighlight  = zenburnHighlight

export type EditorTheme = 'dark' | 'light'

export interface EditorCallbacks {
  onDocChanged?: (state: EditorState) => void
  onCursorChanged?: (line: number, col: number) => void
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--cm-bg)',
    color: 'var(--text-primary)',
  },
  '.cm-scroller': {
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    overflow: 'auto',
    scrollPaddingTop: '48px',   // ← запас сверху
  },
  '.cm-gutters': {
    backgroundColor: 'var(--cm-bg)',
    color: 'var(--text-muted)',
    borderRight: '1px solid var(--cm-bg)',
    minWidth: '4.5em',
    width: '4.5em',
    overflow: 'hidden',
  },
  '.cm-gutterElement': {
    padding: '0 8px 0 0',        // ← отступ справа, числа отодвинутся от края
    textAlign: 'center',          // ← выравнивание по правому краю
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--cm-active-line)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--cm-active-gutter)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--cm-selection)',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--cm-cursor)',
  },
  // Скрываем контейнер панелей CM — панель поиска у нас в статусбаре.
  // ВАЖНО: нельзя использовать display: none! CM при открытой панели читает
  // геометрию .cm-panels (getBoundingClientRect) в scrollMargin() при
  // прокрутке к совпадению поиска; display:none даёт нулевой прямоугольник,
  // из-за чего scrollRectIntoView ошибается и найденный фрагмент оказывается
  // ВЫШЕ верхней границы редактора. Поэтому прячем панель «мягко»:
  // вне потока, нулевой высоты и невидимой.
  '.cm-panels': {
    position: 'absolute',
    height: '0',
    overflow: 'hidden',
    visibility: 'hidden',
    pointerEvents: 'none',
  },
})

// ── Выделение всей функции (Ctrl+Alt+Space) ─────────────────
// Узлы синтаксического дерева, которые считаем «функцией»:
// JS/TS — объявления/выражения функций, стрелочные функции, методы и классы;
// CSS — правила и at-правила (аналог «блока»).
const FUNCTION_NODE_RE =
  /^(FunctionDeclaration|FunctionExpression|ArrowFunction|MethodDeclaration|ClassDeclaration|ClassExpression|PropertyDefinition|RuleSet|AtRule)$/

function findFunctionNode(state: EditorState): SyntaxNode | null {
  const { head } = state.selection.main
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(head, -1)
  while (node) {
    if (FUNCTION_NODE_RE.test(node.name)) return node
    node = node.parent
  }
  return null
}

// Расширяем выделение на «обёртку» функции, чтобы захватить имя:
// const foo = () => {} / const foo = function() {} → вся VariableDeclaration
// foo = () => {} в классе → вся PropertyDefinition
// export function foo() {} → вместе с ключевым словом export
function expandToStatement(node: SyntaxNode): SyntaxNode {
  let cur = node
  const parent = cur.parent
  if (
    parent &&
    (cur.name === 'ArrowFunction' || cur.name === 'FunctionExpression') &&
    (parent.name === 'VariableDeclaration' || parent.name === 'PropertyDefinition')
  ) {
    cur = parent
  }
  const p = cur.parent
  if (p && p.name.includes('Export')) cur = p
  return cur
}

export function selectFunction(view: EditorView): boolean {
  const node = findFunctionNode(view.state)
  if (!node) return false
  const target = expandToStatement(node)
  view.dispatch({
    selection: EditorSelection.single(target.from, target.to),
    scrollIntoView: true,
  })
  return true
}

export function baseExtensions(cb: EditorCallbacks, theme: EditorTheme = 'dark') {
  const style = theme === 'light' ? lightHighlight : darkHighlight
  return [
    lineNumbers(),
    highlightActiveLine(),
    bracketMatching(),
    indentOnInput(),
    highlightSelectionMatches(),
    // Фиктивная панель: подсветка совпадений в @codemirror/search активна,
    // только пока "открыта" панель поиска CM. Своя панель рисуется в статусбаре,
    // поэтому вместо дефолтного UI CM передаём пустую панель
    // (сам контейнер .cm-panels скрывается темой ниже).
    search({
      createPanel: () => ({ dom: document.createElement('div') }),
    }),
    history(),
    expandSelectionExtension(),
    keymap.of([
      indentWithTab,
      { key: 'Ctrl-Alt-Space', run: selectFunction },
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    EditorView.scrollMargins.of(() => ({ top: 48 })),
    editorTheme,
    highlightConf.of(syntaxHighlighting(style)),
    EditorView.updateListener.of(update => {
      if (update.docChanged) cb.onDocChanged?.(update.state)
      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head
        const line = update.state.doc.lineAt(pos)
        cb.onCursorChanged?.(line.number, pos - line.from + 1)
      }
    }),
  ]
}

export function createTabState(
  content: string,
  language: LangKind,
  cb: EditorCallbacks,
  theme: EditorTheme = 'dark',
) {
  return EditorState.create({
    doc: content,
    extensions: [
      ...baseExtensions(cb, theme),
      languageConf.of(langExtension(language)),
    ],
  })
}
