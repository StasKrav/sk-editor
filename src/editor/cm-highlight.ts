import { HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

/**
 * Подсветка синтаксиса на основе каноничной палитры Zenburn
 * (цвета взяты из оригинальной темы CodeMirror 5 / Vim).
 */
export const zenburnHighlight = HighlightStyle.define([
  // Комментарии
  { tag: tags.comment,                 color: '#7f9f7f' },
  { tag: tags.lineComment,             color: '#7f9f7f' },
  { tag: tags.blockComment,            color: '#7f9f7f' },
  { tag: tags.docComment,              color: '#7f9f7f' },

  // Ключевые слова
  { tag: tags.keyword,                 color: '#f0dfaf', fontWeight: 'bold' },
  { tag: tags.controlKeyword,          color: '#f0dfaf', fontWeight: 'bold' },
  { tag: tags.moduleKeyword,           color: '#f0dfaf', fontWeight: 'bold' },
  { tag: tags.operatorKeyword,         color: '#f0dfaf' },
  { tag: tags.definitionKeyword,       color: '#f0dfaf' },
  { tag: tags.self,                    color: '#f0dfaf', fontStyle: 'italic' },

  // Строки
  { tag: tags.string,                  color: '#cc9393' },
  { tag: tags.special(tags.string),    color: '#cc9393' },
  { tag: tags.regexp,                  color: '#cc9393' },
  { tag: tags.character,               color: '#cc9393' },

  // Числа и литералы
  { tag: tags.number,                  color: '#8cd0d3' },
  { tag: tags.bool,                    color: '#8cd0d3' },
  { tag: tags.null,                    color: '#8cd0d3' },

  // Функции
  { tag: tags.function(tags.variableName),                  color: '#93e0e3' },
  { tag: tags.function(tags.propertyName),                  color: '#93e0e3' },
  { tag: tags.function(tags.definition(tags.variableName)), color: '#93e0e3' },

  // Переменные
  { tag: tags.variableName,            color: '#dcdccc' },
  { tag: tags.definition(tags.variableName), color: '#dcdccc' },
  { tag: tags.local(tags.variableName),color: '#dcdccc' },
  { tag: tags.special(tags.variableName), color: '#dfaf8f' },

  // Типы и классы
  { tag: tags.typeName,                color: '#8cd0d3' },
  { tag: tags.className,               color: '#8cd0d3' },
  { tag: tags.namespace,               color: '#8cd0d3' },

  // Свойства и атрибуты
  { tag: tags.propertyName,            color: '#dcdccc' },
  { tag: tags.attributeName,           color: '#dfaf8f' },
  { tag: tags.attributeValue,          color: '#cc9393' },

  // Операторы и пунктуация
  { tag: tags.operator,                color: '#f0efd0' },
  { tag: tags.punctuation,             color: '#dcdccc' },
  { tag: tags.bracket,                 color: '#dcdccc' },

  // HTML-теги
  { tag: tags.tagName,                 color: '#93e0e3' },
  { tag: tags.angleBracket,            color: '#dcdccc' },

  // Ошибки
  { tag: tags.invalid,                 color: '#cc9393', textDecoration: 'underline wavy' },
])

/**
 * Подсветка для светлой темы Solarized Light.
 */
export const solarizedLightHighlight = HighlightStyle.define([
  { tag: tags.comment,                 color: '#93a1a1', fontStyle: 'italic' },
  { tag: tags.lineComment,             color: '#93a1a1', fontStyle: 'italic' },
  { tag: tags.blockComment,            color: '#93a1a1', fontStyle: 'italic' },
  { tag: tags.docComment,              color: '#93a1a1', fontStyle: 'italic' },

  { tag: tags.keyword,                 color: '#859900', fontWeight: 'bold' },
  { tag: tags.controlKeyword,          color: '#859900', fontWeight: 'bold' },
  { tag: tags.moduleKeyword,           color: '#859900', fontWeight: 'bold' },
  { tag: tags.operatorKeyword,         color: '#859900' },
  { tag: tags.definitionKeyword,       color: '#859900' },
  { tag: tags.self,                    color: '#859900', fontStyle: 'italic' },

  { tag: tags.string,                  color: '#2aa198' },
  { tag: tags.special(tags.string),    color: '#2aa198' },
  { tag: tags.regexp,                  color: '#dc322f' },
  { tag: tags.character,               color: '#2aa198' },

  { tag: tags.number,                  color: '#d33682' },
  { tag: tags.bool,                    color: '#d33682' },
  { tag: tags.null,                    color: '#d33682' },

  { tag: tags.function(tags.variableName),                  color: '#268bd2' },
  { tag: tags.function(tags.propertyName),                  color: '#268bd2' },
  { tag: tags.function(tags.definition(tags.variableName)), color: '#268bd2' },

  { tag: tags.variableName,            color: '#586e75' },
  { tag: tags.definition(tags.variableName), color: '#586e75' },
  { tag: tags.local(tags.variableName),color: '#586e75' },
  { tag: tags.special(tags.variableName), color: '#cb4b16' },

  { tag: tags.typeName,                color: '#b58900' },
  { tag: tags.className,               color: '#b58900' },
  { tag: tags.namespace,               color: '#b58900' },

  { tag: tags.propertyName,            color: '#586e75' },
  { tag: tags.attributeName,           color: '#b58900' },
  { tag: tags.attributeValue,          color: '#2aa198' },

  { tag: tags.operator,                color: '#859900' },
  { tag: tags.punctuation,             color: '#586e75' },
  { tag: tags.bracket,                 color: '#586e75' },

  { tag: tags.tagName,                 color: '#268bd2' },
  { tag: tags.angleBracket,            color: '#93a1a1' },

  { tag: tags.invalid,                 color: '#dc322f', textDecoration: 'underline wavy' },
])
