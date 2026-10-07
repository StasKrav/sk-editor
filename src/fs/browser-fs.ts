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

  async createFile(path: string): Promise<void> {
    if (!this.rootHandle) throw new Error('Проект не открыт')
  
    const parts = path.split('/').filter(Boolean)
    const fileName = parts.pop()
    if (!fileName) throw new Error('Пустое имя файла')
  
    let dir: FileSystemDirectoryHandle = this.rootHandle
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true })
    }
  
    // create: true не перезапишет существующий
    await dir.getFileHandle(fileName, { create: true })
  }
  
  async createFolder(path: string): Promise<void> {
    if (!this.rootHandle) throw new Error('Проект не открыт')
  
    const parts = path.split('/').filter(Boolean)
    if (parts.length === 0) throw new Error('Пустое имя папки')
  
    let dir: FileSystemDirectoryHandle = this.rootHandle
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true })
    }
  }

  async renameEntry(oldPath: string, newPath: string): Promise<void> {
    if (!this.rootHandle) throw new Error('Проект не открыт')
  
    // находим исходный handle
    const srcParts = oldPath.split('/').filter(Boolean)
    const srcName = srcParts.pop()!
    let srcDir: FileSystemDirectoryHandle = this.rootHandle
    for (const part of srcParts) {
      srcDir = await srcDir.getDirectoryHandle(part)
    }
  
    // определяем, папка это или файл
    const srcDirHandle = await srcDir.getDirectoryHandle(srcName).catch(() => null)
    const srcFileHandle = srcDirHandle
      ? null
      : await srcDir.getFileHandle(srcName)
  
    if (srcDirHandle) {
      // это папка — рекурсивно копируем содержимое
      await this.copyDirRecursive(srcDirHandle, newPath)
      await srcDir.removeEntry(srcName, { recursive: true })
    } else if (srcFileHandle) {
      // это файл
      const file = await srcFileHandle.getFile()
      const content = await file.text()
      await this.createFile(newPath)
      await this.writeFile(newPath, content)
      await srcDir.removeEntry(srcName)
    } else {
      throw new Error('Файл или папка не найдены')
    }
  }

  async copyEntry(srcPath: string, destPath: string): Promise<void> {
    if (!this.rootHandle) throw new Error('Проект не открыт')
  
    const srcParts = srcPath.split('/').filter(Boolean)
    const srcName = srcParts.pop()!
    let srcDir: FileSystemDirectoryHandle = this.rootHandle
    for (const part of srcParts) {
      srcDir = await srcDir.getDirectoryHandle(part)
    }
  
    const srcDirHandle = await srcDir.getDirectoryHandle(srcName).catch(() => null)
  
    if (srcDirHandle) {
      // папка
      await this.copyDirRecursive(srcDirHandle, destPath)
    } else {
      // файл
      const srcFileHandle = await srcDir.getFileHandle(srcName)
      const file = await srcFileHandle.getFile()
      const content = await file.text()
      await this.createFile(destPath)
      await this.writeFile(destPath, content)
    }
  }

  async duplicateEntry(path: string): Promise<string> {
    const parts = path.split('/').filter(Boolean)
    const name = parts.pop()!
    const parentPath = parts.join('/')
  
    const dotIdx = name.lastIndexOf('.')
    const baseName = dotIdx > 0 ? name.slice(0, dotIdx) : name
    const ext = dotIdx > 0 ? name.slice(dotIdx) : ''
  
    let copyName = `${baseName} copy${ext}`
    let n = 2
    while (await this.exists(parentPath ? `${parentPath}/${copyName}` : copyName)) {
      copyName = `${baseName} copy ${n}${ext}`
      n++
    }
  
    const newPath = parentPath ? `${parentPath}/${copyName}` : copyName
    await this.copyEntry(path, newPath)
    return newPath
  }

  async exists(path: string): Promise<boolean> {
    try {
      if (!this.rootHandle) return false
      const parts = path.split('/').filter(Boolean)
      const name = parts.pop()!
      let dir: FileSystemDirectoryHandle = this.rootHandle
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part)
      }
      // пробуем как файл
      await dir.getFileHandle(name)
      return true
    } catch {
      try {
        // пробуем как папку
        const parts = path.split('/').filter(Boolean)
        const name = parts.pop()!
        let dir: FileSystemDirectoryHandle = this.rootHandle!
        for (const part of parts) {
          dir = await dir.getDirectoryHandle(part)
        }
        await dir.getDirectoryHandle(name)
        return true
      } catch {
        return false
      }
    }
  }
  
  private async copyDirRecursive(
    srcDir: FileSystemDirectoryHandle,
    destPath: string,
  ): Promise<void> {
    await this.createFolder(destPath)
  
    for await (const entry of srcDir.values()) {
      const childPath = `${destPath}/${entry.name}`
      if (entry.kind === 'directory') {
        await this.copyDirRecursive(entry, childPath)
      } else {
        const file = await entry.getFile()
        const content = await file.text()
        await this.createFile(childPath)
        await this.writeFile(childPath, content)
      }
    }
  }

  async deleteEntry(path: string): Promise<void> {
    if (!this.rootHandle) throw new Error('Проект не открыт')
  
    const parts = path.split('/').filter(Boolean)
    const name = parts.pop()
    if (!name) throw new Error('Пустое имя')
  
    let dir: FileSystemDirectoryHandle = this.rootHandle
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part)
    }
  
    await dir.removeEntry(name, { recursive: true })
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
