import type { FileEntry, FileSystemProvider } from './types'
import { shouldIgnore } from './ignore'

// `window.showDirectoryPicker` отсутствует в lib.dom.d.ts — объявляем сами.
// Остальные типы FS API (FileSystemDirectoryHandle, FileSystemFileHandle,
// FileSystemWritableFileStream) уже входят в lib.dom, дублировать их нельзя —
// локальное объявление интерфейса затеняло бы глобальный полный тип.
declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite'
    }) => Promise<FileSystemDirectoryHandle>

    showSaveFilePicker?: (options?: {
      suggestedName?: string
      types?: { description?: string; accept: Record<string, string[]> }[]
    }) => Promise<FileSystemFileHandle>

    showOpenFilePicker?: (options?: {
      types?: { description?: string; accept: Record<string, string[]> }[]
      multiple?: boolean
    }) => Promise<FileSystemFileHandle[]>
  }
}

export class BrowserFileSystem implements FileSystemProvider {
  readonly name = 'Browser (File System Access API)'

  private rootHandle: FileSystemDirectoryHandle | null = null
  private rootName = ''

  async openProject(): Promise<FileEntry | null> {
    if (!window.showDirectoryPicker) {
      throw new Error('File System Access API не поддерживается этим браузером')
    }

    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    this.rootHandle = handle
    this.rootName = handle.name

    return await this.readDir(handle, '', handle.name)
  }

  async openFile(): Promise<{
    name: string
    content: string
    handle: FileSystemFileHandle
  } | null> {
    if (!window.showOpenFilePicker) {
      throw new Error('File System Access API не поддерживается этим браузером')
    }
  
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Код',
            accept: {
              'text/plain': ['.txt', '.md'],
              'text/html': ['.html', '.htm'],
              'text/css': ['.css'],
              'text/javascript': ['.js', '.mjs', '.jsx'],
              'text/typescript': ['.ts', '.tsx'],
              'application/json': ['.json'],
            },
          },
        ],
        multiple: false,
      })
  
      const file = await handle.getFile()
      const content = await file.text()
  
      return { name: handle.name, content, handle }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null
      throw err
    }
  }

  async writeViaHandle(
    handle: FileSystemFileHandle,
    content: string,
  ): Promise<void> {
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
  }

  async refresh(): Promise<FileEntry | null> {
    if (!this.rootHandle) return null
    return await this.readDir(this.rootHandle, '', this.rootName)
  }

  async readFile(path: string): Promise<string> {
    const handle = await this.resolveFile(path)
    const file = await handle.getFile()
    return await file.text()
  }

  async writeFile(path: string, content: string): Promise<void> {
    const handle = await this.resolveFile(path, /* create */ true)
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
  }

  // ── внутренние помощники ─────────────────────

  private async readDir(
    dir: FileSystemDirectoryHandle,
    prefix: string,
    displayName: string,
  ): Promise<FileEntry> {
    const children: FileEntry[] = []
  
    for await (const entry of dir.values()) {
      const kind: 'file' | 'dir' = entry.kind === 'directory' ? 'dir' : 'file'

      // ── фильтр ─────────────────────────────
      if (shouldIgnore(entry.name, kind)) continue

      const path = prefix ? `${prefix}/${entry.name}` : entry.name

      // сужение по дискриминанту entry.kind,
      // чтобы TS видел точный тип в каждой ветке
      if (entry.kind === 'directory') {
        children.push(await this.readDir(entry, path, entry.name))
      } else {
        children.push({
          name: entry.name,
          path,
          kind: 'file',
        })
      }
    }
  
    children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  
    return {
      name: displayName,
      path: prefix,
      kind: 'dir',
      children,
    }
  }

  private async resolveFile(
    path: string,
    create = false,
  ): Promise<FileSystemFileHandle> {
    if (!this.rootHandle) throw new Error('Проект не открыт')

    const parts = path.split('/')
    const fileName = parts.pop()!

    let dir: FileSystemDirectoryHandle = this.rootHandle
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part)
    }

    return await dir.getFileHandle(fileName, { create })
  }

  async saveAs(
    content: string,
    suggestedName = 'untitled.txt',
  ): Promise<FileSystemFileHandle | null> {
    if (!window.showSaveFilePicker) {
      throw new Error('File System Access API не поддерживается')
    }
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          { description: 'Text', accept: { 'text/plain': ['.txt', '.md'] } },
          { description: 'HTML', accept: { 'text/html': ['.html', '.htm'] } },
          { description: 'CSS',  accept: { 'text/css': ['.css'] } },
          { description: 'JavaScript', accept: { 'text/javascript': ['.js', '.mjs'] } },
          { description: 'TypeScript', accept: { 'text/typescript': ['.ts', '.tsx'] } },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      return handle
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null
      throw err
    }
  }
}
