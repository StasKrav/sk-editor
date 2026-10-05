// Имена папок, которые всегда скрываем — слишком шумные
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.git',
  '.svn',
  '.hg',
])

// Имена файлов, которые всегда скрываем
const IGNORED_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
])

/**
 * Возвращает true, если запись нужно скрыть в дереве.
 */
export function shouldIgnore(name: string, kind: 'file' | 'dir'): boolean {
  if (name.startsWith('.')) return true
  if (kind === 'dir' && IGNORED_DIRS.has(name)) return true
  if (kind === 'file' && IGNORED_FILES.has(name)) return true
  return false
}
