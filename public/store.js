const open = () => new Promise((resolve, reject) => {
  const r = indexedDB.open('codigo-do-amor', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('drafts');
  r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
});
export async function readDraft() {
  const db = await open();
  return new Promise((resolve, reject) => { const r = db.transaction('drafts').objectStore('drafts').get('current'); r.onsuccess = () => { resolve(r.result); db.close(); }; r.onerror = () => { reject(r.error); db.close(); }; });
}
export async function saveDraft(draft) {
  const db = await open();
  return new Promise((resolve, reject) => { const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(draft, 'current'); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; tx.onabort = () => { db.close(); reject(tx.error); }; });
}
