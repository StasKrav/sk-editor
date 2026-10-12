/**
 * В lib.dom.d.ts интерфейсы FileSystemHandle / FileSystemDirectoryHandle
 * описаны без методов queryPermission и requestPermission,
 * хотя в Chromium они есть и активно используются.
 * Дополняем глобальные типы через declaration merging.
 */
interface FileSystemHandle {
  queryPermission?(options?: {
    mode?: 'read' | 'readwrite'
  }): Promise<PermissionState>

  requestPermission?(options?: {
    mode?: 'read' | 'readwrite'
  }): Promise<PermissionState>
}
