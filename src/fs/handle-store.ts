import { get, set, del } from 'idb-keyval'

const HANDLE_KEY = 'root_dir_handle_v1'

export async function saveRootHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    await set(HANDLE_KEY, handle)
  } catch (e) {
    console.warn('Не удалось сохранить handle', e)
  }
}

export async function loadRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await get(HANDLE_KEY)) ?? null
  } catch {
    return null
  }
}

export async function clearRootHandle(): Promise<void> {
  try {
    await del(HANDLE_KEY)
  } catch { /* no-op */ }
}