import { normalizeDraft } from './model.js';
import { collectMediaEntries, setPath } from './lib/slug.js';
import { blobToDataURL, createMediaPacker } from './lib/media.js';

const packMedia = createMediaPacker();
const open = () => new Promise((resolve, reject) => {
  const request = indexedDB.open('codigo-do-amor', 2);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts');
    if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const result = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function readDraft() {
  const db = await open();
  try {
    const saved = await result(db.transaction('drafts').objectStore('drafts').get('current'));
    if (!saved) return null;
    // v1 records have inline media. The next successful save migrates atomically.
    const draft = normalizeDraft(saved.draft || saved, { allowReferences: saved.format === 2 });
    const entries = collectMediaEntries(draft).filter(entry => entry.value.startsWith('asset:'));
    if (entries.length) {
      const store = db.transaction('media').objectStore('media');
      const blobs = await Promise.all(entries.map(entry => result(store.get(entry.value.slice(6)))));
      for (let i = 0; i < entries.length; i++) {
        if (!(blobs[i] instanceof Blob)) throw new Error('missing-local-media');
        setPath(draft, entries[i].path, await blobToDataURL(blobs[i]));
      }
    }
    return draft;
  } finally { db.close(); }
}

export async function saveDraft(draft) {
  const packed = await packMedia(draft);
  const db = await open();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['drafts', 'media'], 'readwrite');
      const media = tx.objectStore('media');
      for (const [id, blob] of packed.assets) {
        const request = media.getKey(id);
        request.onsuccess = () => { if (request.result === undefined) media.put(blob, id); };
      }
      // Remove orphaned blobs only in the same successful transaction as the draft.
      const cursor = media.openKeyCursor();
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        if (!packed.assets.has(current.key)) media.delete(current.key);
        current.continue();
      };
      tx.objectStore('drafts').put({ format: 2, draft: packed.draft }, 'current');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('storage-aborted'));
    });
  } finally { db.close(); }
}
