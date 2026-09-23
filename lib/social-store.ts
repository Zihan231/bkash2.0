// Demo/prototype storage: submissions live in this browser's IndexedDB, so the
// /admin page only sees submissions made from the same browser. Swap these
// functions for API calls when a real backend exists.

export interface SocialSubmission {
  id: string;
  name: string;
  college: string;
  contactNumber: string;
  bkashNumber: string;
  friendBkashNumber: string;
  screenshot: Blob;
  screenshotName: string;
  createdAt: string;
}

export type NewSocialSubmission = Omit<SocialSubmission, 'id' | 'createdAt'>;

const DB_NAME = 'bkash-social-campaign';
const DB_VERSION = 1;
const STORE = 'submissions';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser does not support local storage for submissions.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the submissions database.'));
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? new Error('Submissions database error.'));
      tx.onabort = () => reject(tx.error ?? new Error('Submissions database request was aborted.'));
    });
  } finally {
    db.close();
  }
}

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function addSubmission(data: NewSocialSubmission, createdAt = new Date()): Promise<SocialSubmission> {
  const record: SocialSubmission = { ...data, id: newId(), createdAt: createdAt.toISOString() };
  await run('readwrite', (store) => store.add(record));
  return record;
}

export async function listSubmissions(): Promise<SocialSubmission[]> {
  const rows = await run('readonly', (store) => store.getAll() as IDBRequest<SocialSubmission[]>);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteSubmission(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id));
}

export async function clearSubmissions(): Promise<void> {
  await run('readwrite', (store) => store.clear());
}
