/**
 * Декларации для пакета codemirror-5-themes.
 * Пакет поставляет default-экспорт — объект «имя темы → CodeMirror Extension».
 */
declare module 'codemirror-5-themes' {
  import type { Extension } from '@codemirror/state'

  const themes: Record<string, Extension>

  export default themes
}