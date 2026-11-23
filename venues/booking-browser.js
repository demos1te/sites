const sampleHours = {
  green: ['10:00', '12:00', '14:00', '16:00', '18:00'],
  reboot: ['12:00', '14:00', '16:00', '18:00', '20:00'],
  osmak: ['10:00', '12:00', '14:00', '16:00', '18:00'],
  sandbox: ['14:00', '16:00', '18:00', '20:00', '22:00'],
  evento: ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
  forma: ['11:00', '13:00', '15:00', '17:00', '19:00', '21:00'],
};

const STORE = 'slots';
const DATABASE = 'venue-booking-local-demo';
const SLOT_CONFLICT = 'Это время уже недоступно. Выберите другой час.';
const EVENT_CONFLICT = 'На эту дату есть событие. Выберите другой день или посмотрите афишу.';
const STORAGE_ERROR = 'Не удалось сохранить час в этом браузере.';
const amount = new Intl.NumberFormat('ru-RU');
const rubles = value => amount.format(value) + ' ₽';
const dateKey = date => date.toISOString().slice(0, 10);
const validTime = value => typeof value === 'string' && /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
const dayOfWeek = date => new Date(date + 'T12:00:00Z').getUTCDay();

function validDate(value) {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+date) && dateKey(date) === value;
}

function firstOfMonth(date, offset = 0) {
  const first = new Date(date.slice(0, 7) + '-01T00:00:00Z');
  first.setUTCMonth(first.getUTCMonth() + offset);
  return dateKey(first);
}

function nowIn(formatter) {
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return { date: [parts.year, parts.month, parts.day].join('-'), time: [parts.hour, parts.minute].join(':') };
}

function linkedEvent(entry) {
  if (!entry || entry.hidden || (entry.status && entry.status !== 'published')) return null;
  const title = entry.title ?? entry.label;
  const text = entry.text ?? entry.description;
  const { date, time } = entry;
  if (!validDate(date) || !validTime(time) || typeof title !== 'string' || !title.trim()) return null;
  try {
    const url = new URL(entry.link);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return { date, time, title: title.trim(), text: typeof text === 'string' ? text.trim() : '', link: url.href };
  } catch {
    return null;
  }
}

function futureEvents(entries, now) {
  const events = new Map();
  for (const { date, time, title, text, link } of entries) {
    if (date < now.date || (date === now.date && time <= now.time)) continue;
    if (!events.has(date)) events.set(date, []);
    events.get(date).push({ time, title, text, link });
  }
  for (const entries of events.values()) entries.sort((a, b) => a.time.localeCompare(b.time));
  return events;
}

function priceFor(site, pricing, kind, date) {
  if (site !== 'evento' || !pricing) return null;
  if (kind === 'visit') {
    const { firstHour, minuteAfterTwoHours } = pricing.visit ?? {};
    if (!Number.isFinite(firstHour)) return null;
    const extended = Number.isFinite(minuteAfterTwoHours)
      ? ' В таблице для визитов более 2 часов — ' + rubles(minuteAfterTwoHours) + '/мин.' : '';
    return { label: rubles(firstHour) + ' / 1 час', detail: rubles(firstHour) + ' за 1 час.' + extended };
  }
  const group = [0, 6].includes(dayOfWeek(date)) ? 'weekends' : 'weekdays';
  const rooms = (pricing.rental ?? []).filter(room =>
    typeof room?.label === 'string' && Number.isFinite(room[group]?.firstHour) && Number.isFinite(room[group]?.nextHour));
  if (!rooms.length) return null;
  const lowest = Math.min(...rooms.map(room => room[group].firstHour));
  const lines = rooms.map(room => room.label + ' · ' + rubles(room[group].firstHour) + ' за первый час, ' +
    rubles(room[group].nextHour) + ' за каждый следующий');
  return { label: 'от ' + rubles(lowest), detail: lines.join('\n') };
}

function scheduledHours(hours, date, now) {
  if (date < now.date || date >= firstOfMonth(now.date, 3)) return [];
  const weekday = dayOfWeek(date);
  const times = hours.length > 1 && weekday >= 1 && weekday <= 3 ? hours.slice(1) : hours;
  return date === now.date ? times.filter(time => time > now.time) : times;
}

function validContact(contact) {
  if (/^[+0-9(). -]+$/.test(contact)) {
    const digits = contact.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }
  return /^(?:@|https:\/\/t\.me\/)[A-Za-z0-9_]{3,32}$/.test(contact) || /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(contact);
}

function correctKind(site, kind) {
  return kind === 'rent' || (site === 'evento' && kind === 'visit');
}

function validate(site, fields) {
  const errors = {};
  if (!validDate(fields.date)) errors.date = 'Выберите дату в календаре.';
  if (!validTime(fields.time)) errors.time = 'Выберите время.';
  if (!correctKind(site, fields.kind ?? 'rent')) errors.kind = 'Выберите формат записи.';
  if (typeof fields.name !== 'string' || !fields.name.trim() || fields.name.trim().length > 100)
    errors.name = 'Укажите имя, до 100 символов.';
  if (typeof fields.contact !== 'string' || fields.contact.trim().length > 200 || !validContact(fields.contact.trim()))
    errors.contact = 'Укажите номер телефона, Telegram или почту.';
  if (typeof fields.idempotency !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(fields.idempotency))
    errors.idempotency = 'Не удалось подготовить запрос. Обновите страницу.';
  return errors;
}

let opening;
function openCalendar() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: ['site', 'date', 'time'] });
        store.createIndex('by-attempt', ['site', 'idempotency'], { unique: true });
      };
      request.onerror = () => reject(Error(STORAGE_ERROR));
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          opening = undefined;
        };
        resolve(database);
      };
    }).catch(error => {
      opening = undefined;
      throw error;
    });
  }
  return opening;
}

async function occupiedHours(site, start, end) {
  const database = await openCalendar();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly');
    const range = IDBKeyRange.bound([site, start], [site, end], false, true);
    const query = tx.objectStore(STORE).getAll(range);
    tx.onabort = () => reject(Error(STORAGE_ERROR));
    tx.oncomplete = () => resolve(new Set(query.result.map(row => row.date + '@' + row.time)));
  });
}

function slotResponse(status, payload) {
  return { status, payload };
}

function conflict(field, message) {
  return slotResponse(409, { error: message, errors: { [field]: message } });
}

function confirmed(status, token) {
  return slotResponse(status, { ok: true, id: token.slice(-12) });
}

async function reserve(site, slot, isAvailable) {
  const database = await openCalendar();
  // A single read/write transaction spans the checks and write, including across open tabs.
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const attempt = store.index('by-attempt').get([site, slot.idempotency]);
    let result;
    tx.onabort = () => reject(Error(STORAGE_ERROR));
    tx.oncomplete = () => resolve(result);
    attempt.onsuccess = () => {
      if (attempt.result) {
        result = confirmed(200, slot.idempotency);
        return;
      }
      const rejection = isAvailable();
      if (rejection) {
        result = rejection;
        return;
      }
      const hour = store.get([site, slot.date, slot.time]);
      hour.onsuccess = () => {
        if (hour.result) {
          result = conflict('time', SLOT_CONFLICT);
          return;
        }
        store.add(slot).onsuccess = () => { result = confirmed(201, slot.idempotency); };
      };
    };
  });
}

export function createDemoBooking({ site, context = {} }) {
  if (!Object.hasOwn(sampleHours, site)) throw Error('Площадка не найдена.');
  const timeZone = context.tz || (site === 'evento' ? 'Europe/Ulyanovsk' : 'Europe/Moscow');
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const customHours = Array.isArray(context.times) ? [...new Set(context.times.filter(validTime))].sort() : [];
  const hours = customHours.length ? customHours : sampleHours[site];
  const entries = Array.isArray(context.events) ? context.events.map(linkedEvent).filter(Boolean) : [];

  async function month(firstMonth, kind = 'rent') {
    const first = firstMonth + '-01';
    if (!validDate(first) || !correctKind(site, kind)) throw Error('Выберите месяц и формат записи.');
    const now = nowIn(formatter);
    if (first < firstOfMonth(now.date) || first >= firstOfMonth(now.date, 3)) return { month: firstMonth, days: [] };
    const end = firstOfMonth(first, 1);
    const booked = await occupiedHours(site, first, end);
    const events = futureEvents(entries, now);
    const days = [];
    const cursor = new Date(first + 'T00:00:00Z');
    for (let date = first; date < end; date = dateKey(cursor)) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if (date < now.date) continue;
      if (events.has(date)) {
        days.push({ date, times: [], events: events.get(date) });
        continue;
      }
      const times = scheduledHours(hours, date, now).filter(time => !booked.has(date + '@' + time));
      if (!times.length) continue;
      const price = priceFor(site, context.pricing, kind, date);
      const prices = price ? { prices: Object.fromEntries(times.map(time => [time, price])) } : {};
      days.push({ date, times, ...prices });
    }
    return { month: firstMonth, days };
  }

  async function submit(fields = {}) {
    const errors = validate(site, fields);
    if (Object.keys(errors).length) return slotResponse(422, { error: 'Проверьте выделенные поля.', errors });
    const { date, time, idempotency } = fields;
    // Name and contact are validated in memory and never copied to persistent storage.
    return reserve(site, { site, date, time, idempotency }, () => {
      const now = nowIn(formatter);
      if (futureEvents(entries, now).has(date)) return conflict('date', EVENT_CONFLICT);
      if (!scheduledHours(hours, date, now).includes(time)) return conflict('time', SLOT_CONFLICT);
      return null;
    });
  }

  return { month, submit };
}
