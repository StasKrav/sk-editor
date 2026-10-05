import { parse } from '@babel/parser'
import type { TocSymbol } from './types'

export function parseJs(code: string, isTs = false): TocSymbol[] {
  const symbols: TocSymbol[] = []

  let ast
  try {
    ast = parse(code, {
      sourceType: 'module',
      errorRecovery: true,        // не падать на недописанном коде
      plugins: [
        ...(isTs ? ['typescript' as const] : []),
        'jsx',
        'decorators-legacy',
        'classProperties',
        'topLevelAwait',
      ],
    })
  } catch {
    // если файл не парсится вообще — вернём пустой TOC,
    // редактор продолжит работать
    return symbols
  }

  walk(ast.program, symbols, 0)
  return symbols
}

function walk(node: any, out: TocSymbol[], depth: number) {
  if (!node || typeof node !== 'object') return

  switch (node.type) {
    case 'FunctionDeclaration':
      if (node.id?.name && node.loc) {
        out.push({
          name: node.id.name,
          kind: 'function',
          line: node.loc.start.line,
          col: node.loc.start.column,
          depth,
        })
      }
      break

    case 'ClassDeclaration':
    case 'ClassExpression':
      if (node.id?.name && node.loc) {
        out.push({
          name: node.id.name,
          kind: 'class',
          line: node.loc.start.line,
          col: node.loc.start.column,
          depth,
        })
        // методы класса — на уровень глубже
        for (const member of node.body?.body ?? []) {
          if (member.type === 'ClassMethod' || member.type === 'ClassProperty') {
            const key = member.key
            const name =
              key?.type === 'Identifier' ? key.name
              : key?.type === 'StringLiteral' ? key.value
              : null
            if (name && member.loc) {
              out.push({
                name: `${node.id.name}.${name}`,
                kind: 'method',
                line: member.loc.start.line,
                col: member.loc.start.column,
                depth: depth + 1,
              })
            }
          }
        }
        return // не идём вглубь generic-обходом
      }
      break

    case 'VariableDeclarator': {
      const id = node.id
      const init = node.init
      const name = id?.type === 'Identifier' ? id.name : null
      if (name && init) {
        if (
          init.type === 'ArrowFunctionExpression' ||
          init.type === 'FunctionExpression'
        ) {
          out.push({
            name,
            kind: 'function',
            line: node.loc.start.line,
            col: node.loc.start.column,
            depth,
          })
        } else if (init.type === 'ClassExpression') {
          out.push({
            name,
            kind: 'class',
            line: node.loc.start.line,
            col: node.loc.start.column,
            depth,
          })
        } else {
          out.push({
            name,
            kind: 'variable',
            line: node.loc.start.line,
            col: node.loc.start.column,
            depth,
          })
        }
      }
      break
    }

    case 'ExportNamedDeclaration':
    case 'ExportDefaultDeclaration':
      // заглядываем внутрь экспорта
      if (node.declaration) walk(node.declaration, out, depth)
      return
  }

  // обходим детей
  for (const key in node) {
    if (key === 'loc' || key === 'start' || key === 'end') continue
    const child = node[key]
    if (Array.isArray(child)) {
      for (const c of child) walk(c, out, depth)
    } else if (child && typeof child === 'object') {
      walk(child, out, depth)
    }
  }
}
