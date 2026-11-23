import { initial, assets } from './browser-seed.js?v=1';

const name = 'anna-sushkova-demo-v1';
const trackedUrls = new Map();
let database;

function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('state');
      request.result.createObjectStore('photos');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error('Браузер не разрешил сохранить правки.'));
  });
  return database;
}

function openRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function complete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || Error('Не удалось сохранить правки.'));
  });
}

export async function getState() {
  const db = await openDatabase();
  const saved = await openRequest(db.transaction('state').objectStore('state').get('site'));
  return saved || { revision: 0, draft: structuredClone(initial), published: structuredClone(initial) };
}

async function resizePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
    throw Error('Выберите JPG, PNG или WebP до 12 МБ.');
  }
  let image;
  try {
    image = await createImageBitmap(file);
    const size = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * size));
    canvas.height = Math.max(1, Math.round(image.height * size));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .85));
    if (!blob) throw Error();
    return blob;
  } catch {
    throw Error('Не удалось открыть фото. Попробуйте другой файл.');
  } finally {
    image?.close();
  }
}

export async function perform(action, payload) {
  const db = await openDatabase();
  if (action === 'photo') {
    const blob = await resizePhoto(payload);
    const key = crypto.randomUUID().replaceAll('-', '');
    const transaction = db.transaction('photos', 'readwrite');
    transaction.objectStore('photos').put(blob, key);
    await complete(transaction);
    return { key };
  }
  const transaction = db.transaction('state', 'readwrite');
  const finished = complete(transaction);
  const store = transaction.objectStore('state');
  const current = await openRequest(store.get('site')) || { revision: 0, draft: initial, published: initial };
  if (payload.revision !== current.revision) {
    await finished;
    throw Error('Правки уже менялись в другой вкладке. Обновите страницу.');
  }
  const draft = action === 'discard' ? current.published : payload.draft;
  const published = action === 'publish' ? draft : current.published;
  const next = { revision: current.revision + 1, draft, published };
  store.put(next, 'site');
  await finished;
  return next;
}

export async function getPhoto(key) {
  if (assets[key]) return assets[key];
  if (!key || key.startsWith('color-')) return null;
  if (!trackedUrls.has(key)) {
    const db = await openDatabase();
    const blob = await openRequest(db.transaction('photos').objectStore('photos').get(key));
    if (blob) trackedUrls.set(key, { src: URL.createObjectURL(blob) });
  }
  return trackedUrls.get(key) || null;
}
