// Local-only progress photos in IndexedDB. Nothing here is ever uploaded.
export type Photo = { id: number; ts: number; data: string }
const open = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open('habitai', 1)
  r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' })
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
})
const run = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => {
  const db = await open()
  return new Promise<T>((res, rej) => { const r = f(db.transaction('photos', mode).objectStore('photos')); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
}
export const listPhotos = async () => (await run('readonly', s => s.getAll() as IDBRequest<Photo[]>)).sort((a, b) => a.ts - b.ts)
export const addPhoto = (data: string) => run('readwrite', s => s.put({ id: Date.now(), ts: Date.now(), data }))
export const deletePhoto = (id: number) => run('readwrite', s => s.delete(id))
export const clearGallery = () => run('readwrite', s => s.clear())
