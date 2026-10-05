import * as prettier from 'prettier/standalone'
import * as pluginBabel from 'prettier/plugins/babel'
import * as pluginEstree from 'prettier/plugins/estree'
import * as pluginHtml from 'prettier/plugins/html'
import * as pluginPostcss from 'prettier/plugins/postcss'
import * as pluginTypescript from 'prettier/plugins/typescript'
import type { LangKind } from '../editor/languages'

// Каждому нашему языку — свой parser у Prettier.
// 'plain' вернёт null — значит «форматировать нечего».
function parserFor(lang: LangKind): string | null {
  switch (lang) {
    case 'js':   return 'babel'
    case 'ts':   return 'typescript'
    case 'css':  return 'css'
    case 'html': return 'html'
    default:     return null
  }
}

// Плагины — общий список для всех языков, Prettier сам выберет нужный
const plugins = [
  pluginBabel,
  pluginEstree,
  pluginHtml,
  pluginPostcss,
  pluginTypescript,
]

export interface FormatResult {
  ok: boolean
  code: string
  error?: string
}

export async function formatCode(
  code: string,
  lang: LangKind,
): Promise<FormatResult> {
  const parser = parserFor(lang)
  if (!parser) {
    return { ok: false, code, error: 'Форматирование не поддерживается для этого языка' }
  }

  try {
    const formatted = await prettier.format(code, {
      parser,
      plugins,
      semi: false,          // без ; в конце строк
      singleQuote: true,    // одинарные кавычки
      tabWidth: 2,
      printWidth: 100,
      trailingComma: 'all',
      arrowParens: 'avoid',
    })

    // Prettier всегда добавляет \n в конце файла.
    // В редакторе это создаёт «пустую» последнюю строку — убираем.
    const trimmed = formatted.replace(/\n$/, '')

    return { ok: true, code: trimmed }
  } catch (err) {
    return {
      ok: false,
      code,
      error: (err as Error).message.split('\n')[0], // только первая строка ошибки
    }
  }
}
