// src/toc/types.ts
export type SymbolKind =
  | 'function'
  | 'class'
  | 'method'
  | 'variable'
  | 'selector'
  | 'at-rule'
  | 'css-variable'
  | 'html-element'
  | 'html-id'
  | 'heading'

export interface TocSymbol {
  name: string
  kind: SymbolKind
  line: number          // 1-based
  col: number           // 0-based
  depth: number         // 0 = верхний уровень, 1 = метод класса и т.д.
}

export interface TocParser {
  parse(code: string): TocSymbol[]
}