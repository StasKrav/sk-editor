export interface FileEntry {
  name: string
  path: string          // относительный путь от корня проекта
  kind: 'file' | 'dir'
  children?: FileEntry[] // только для dir
}

export interface FileSystemProvider {
  /** Открыть папку проекта. Возвращает корень дерева. */
  openProject(): Promise<FileEntry | null>

  /** Прочитать файл. */
  readFile(path: string): Promise<string>

  /** Записать файл. */
  writeFile(path: string, content: string): Promise<void>

  /** Обновить дерево (перечитать папки, которые изменились). */
  refresh?(): Promise<FileEntry | null>

  /** Название провайдера для статусбара. */
  readonly name: string
}
