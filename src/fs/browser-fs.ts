import type { FileEntry, FileSystemProvider } from './types'

// File System Access API не входит в стандартный lib.dom.d.ts,
// поэтому объявим минимальные типы сами
declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite'
    }) => Promise<FileSystemDirectoryHandle>
  }
}

// Расширяем встроенный интерфейс, чтобы был доступ к values()
interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>
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
    const writable = await (handle as any).createWritable()
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
      const path = prefix ? `${prefix}/${entry.name}` : entry.name

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

    // Сортировка: сначала папки, потом файлы, обе группы по алфавиту
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
}
