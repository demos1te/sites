import { demoTransport } from './hosted-init.js';

const weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthFormat = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function todayKey(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone })
    .formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return [values.year, values.month, values.day].join('-');
}

function monthDate(month) {
  return new Date(month + '-01T12:00:00Z');
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function shiftMonth(month, amount) {
  const date = monthDate(month);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return dateKey(date).slice(0, 7);
}

function capitalize(text) {
  return text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);
}

function makeButton(text, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.className = className;
  return button;
}

export function bookingSection({ embedded = false, site = '' } = {}) {
  return `<section class="${embedded ? 'booking booking-embedded' : 'section booking'}"${embedded ? '' : ' id="booking"'} aria-labelledby="booking-title">
    ${embedded ? '' : '<span id="request" class="booking-anchor" aria-hidden="true"></span><span id="calendar" class="booking-anchor" aria-hidden="true"></span>'}
    <h2 id="booking-title">Выбрать дату</h2>
    ${site === 'evento' ? `<div class="booking-kinds" role="group" aria-label="Тип записи">
      <button type="button" data-booking-kind="visit" aria-pressed="false">Прийти в гости</button>
      <button type="button" data-booking-kind="rent" aria-pressed="false">Арендовать зал</button>
    </div>` : ''}
    <div class="booking-layout">
      <div class="booking-month">
        <div class="booking-month-header">
          <button type="button" data-booking-prev aria-label="Предыдущий месяц">‹</button>
          <h3 data-booking-month aria-live="polite"></h3>
          <button type="button" data-booking-next aria-label="Следующий месяц">›</button>
        </div>
        <div class="booking-week" aria-hidden="true">${weekdayNames.map(day => `<span>${day}</span>`).join('')}</div>
        <div class="booking-days" role="group" aria-label="Даты" data-booking-days></div>
        <p data-booking-month-status role="status"></p><button class="button secondary" type="button" data-booking-retry hidden>Повторить</button>
      </div>
      <div class="booking-panel">
        <p data-booking-instruction>${embedded ? 'Выберите день, чтобы увидеть программу или свободные часы.' : 'Выберите день, чтобы увидеть свободные часы.'}</p>
        <div class="booking-times" data-booking-time-panel hidden>
          <h3 data-booking-date></h3>
          <div role="group" aria-label="Свободное время" data-booking-times></div>
          <p data-booking-time-status role="status"></p>
          <div class="booking-events" data-booking-events hidden></div>
        </div>
        <form class="booking-form" data-booking-form hidden novalidate>
          <p class="booking-rate" data-booking-rate></p>
          <label>Имя<input type="text" name="name" autocomplete="name" required maxlength="100" aria-describedby="booking-name-error"></label>
          <small id="booking-name-error" data-booking-error="name"></small>
          <label>Телефон или Telegram<input type="text" name="contact" autocomplete="off" required maxlength="160" aria-describedby="booking-contact-error"></label>
          <small id="booking-contact-error" data-booking-error="contact"></small>
          <button type="submit" class="button primary">Оформить заявку</button>
        </form>
        <p class="booking-result" data-booking-result role="status" tabindex="-1"></p>
        <button type="button" class="button secondary" data-booking-again hidden>Выбрать другую дату</button>
      </div>
    </div>
    <dialog class="booking-success-dialog" aria-labelledby="booking-success-title" data-booking-dialog>
      <button class="booking-dialog-close" type="button" aria-label="Закрыть" data-booking-close autofocus>×</button>
      <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="27" pathLength="1"></circle>
        <path class="booking-check" d="M21 32.5 28.5 40 44 24" pathLength="1"></path>
      </svg>
      <h3 id="booking-success-title">Заявка оформлена</h3>
    </dialog>
  </section>`;
}

export function bindBooking(root, site, { timeZone = 'Europe/Moscow', kind: initialKind = 'rent', initialDate = '' } = {}) {
  const select = (name) => root.querySelector(`[data-booking-${name}]`);
  const calendar = select('days');
  const form = select('form');
  const result = select('result');
  const dialog = select('dialog');
  const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'long', timeZone });
  const fullDateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone });
  const now = todayKey(timeZone);
  const firstMonth = now.slice(0, 7);
  const lastMonth = shiftMonth(firstMonth, 2);
  const useInitialDate = /^\d{4}-\d{2}-\d{2}$/.test(initialDate) && initialDate >= now &&
    initialDate.slice(0, 7) <= lastMonth;
  let month = useInitialDate ? initialDate.slice(0, 7) : firstMonth;
  let dates = new Map();
  let date = useInitialDate ? initialDate : '';
  let time = '';
  let occasion = '';
  let kind = site === 'evento' && initialKind === 'visit' ? 'visit' : 'rent';
  let waiting = false;
  let completed = false;
  let fetchVersion = 0;
  let attempt;
  const transport = demoTransport(site);

  function updateHeader() {
    select('month').textContent = capitalize(monthFormat.format(monthDate(month)));
    select('prev').disabled = month <= firstMonth || waiting;
    select('next').disabled = month >= lastMonth || waiting;
    root.querySelectorAll('[data-booking-kind]').forEach(button => {
      button.disabled = waiting;
      button.setAttribute('aria-pressed', String(button.dataset.bookingKind === kind));
    });
  }

  function updateDays() {
    const current = monthDate(month);
    const following = monthDate(shiftMonth(month, 1));
    const fragment = document.createDocumentFragment();
    const mondayIndex = (current.getUTCDay() + 6) % 7;
    for (let i = 0; i < mondayIndex; i++) {
      const blank = document.createElement('span');
      blank.setAttribute('aria-hidden', 'true');
      fragment.append(blank);
    }
    while (current < following) {
      const key = dateKey(current);
      const button = makeButton(current.getUTCDate(), 'booking-day');
      button.dataset.date = key;
      button.disabled = waiting || !dates.has(key);
      button.setAttribute('aria-pressed', String(date === key));
      const hasEvents = Boolean(dates.get(key)?.events?.length);
      button.classList.toggle('has-events', hasEvents);
      button.setAttribute('aria-label', fullDateFormat.format(current) + (hasEvents ? ', есть событие' : ''));
      if (key === now) button.dataset.today = '';
      fragment.append(button);
      current.setUTCDate(current.getUTCDate() + 1);
    }
    calendar.replaceChildren(fragment);
  }

  function showEvents(events) {
    const list = select('events');
    list.hidden = !events.length;
    list.replaceChildren();
    for (const event of events) {
      const item = document.createElement('article');
      const title = document.createElement('h4');
      title.textContent = event.title;
      if (event.time) {
        const hour = document.createElement('p');
        hour.textContent = event.time;
        item.append(hour);
      }
      item.append(title);
      if (event.text) {
        const description = document.createElement('p');
        description.textContent = event.text;
        item.append(description);
      }
      if (typeof event.link === 'string' && /^https:\/\//i.test(event.link)) {
        const link = document.createElement('a');
        link.href = event.link;
        link.textContent = 'О событии';
        link.className = 'button secondary';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        item.append(link);
      }
      list.append(item);
    }
  }

  function updateTimes() {
    select('instruction').hidden = Boolean(date) || completed;
    select('time-panel').hidden = !date || completed;
    form.hidden = !time || completed;
    if (!date || completed) return;
    const label = dateFormat.format(new Date(date + 'T12:00:00Z'));
    select('date').textContent = capitalize(label);
    const day = dates.get(date);
    const hours = day?.times || [];
    const events = day?.events || [];
    select('times').hidden = events.length > 0;
    showEvents(events);
    select('times').replaceChildren(...hours.map(hour => {
      const button = makeButton(hour, 'booking-time');
      button.dataset.time = hour;
      button.disabled = waiting;
      button.setAttribute('aria-pressed', String(time === hour));
      const price = day?.prices?.[hour];
      if (price?.label) {
        const amount = document.createElement('small');
        amount.className = 'booking-time-price';
        amount.textContent = price.label;
        button.append(amount);
      }
      return button;
    }));
    select('time-status').textContent = hours.length || events.length ? '' : 'На этот день свободных часов нет.';
    select('rate').textContent = time ? (day?.prices?.[time]?.detail || '') : '';
  }

  async function loadMonth({ keepDate = false } = {}) {
    const version = ++fetchVersion;
    if (!keepDate) {
      date = '';
      time = '';
      attempt = undefined;
    }
    dates = new Map();
    updateHeader();
    updateDays();
    updateTimes();
    select('retry').hidden = true;
    select('month-status').textContent = 'Загрузка…';
    try {
      const parameters = new URLSearchParams({ month });
      if (site === 'evento' || site === 'forma') parameters.set('kind', kind);
      const response = await transport.month(parameters);
      if (!response.ok) throw Error();
      const payload = await response.json();
      if (version !== fetchVersion) return;
      dates = new Map(payload.days.map(day => [day.date, day]));
      if (date && !dates.has(date)) date = '';
      select('month-status').textContent = dates.size ? '' : 'В этом месяце свободных часов нет.';
      updateDays();
      updateTimes();
    } catch {
      if (version !== fetchVersion) return;
      select('month-status').textContent = 'Не удалось загрузить часы.';
      select('retry').hidden = false;
    }
  }

  function clearErrors() {
    form.querySelectorAll('[data-booking-error]').forEach(node => { node.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach(node => node.removeAttribute('aria-invalid'));
  }

  function fieldError(name, text) {
    const field = form.elements.namedItem(name);
    if (!field) return;
    field.setAttribute('aria-invalid', 'true');
    root.querySelector(`[data-booking-error="${name}"]`).textContent = text;
  }

  function resetResult() {
    result.textContent = '';
    select('again').hidden = true;
    completed = false;
  }

  for (const [name, direction] of [['prev', -1], ['next', 1]]) {
    select(name).addEventListener('click', () => {
      month = shiftMonth(month, direction);
      resetResult();
      loadMonth();
    });
  }
  select('retry').addEventListener('click', () => loadMonth({ keepDate: true }));
  root.querySelectorAll('[data-booking-kind]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.bookingKind === kind || waiting) return;
    kind = button.dataset.bookingKind;
    resetResult();
    time = '';
    attempt = undefined;
    loadMonth({ keepDate: true });
  }));
  calendar.addEventListener('click', event => {
    const button = event.target.closest('[data-date]');
    if (!button || button.disabled) return;
    if (date !== button.dataset.date || completed) {
      date = button.dataset.date;
      time = '';
      attempt = undefined;
      clearErrors();
      resetResult();
      calendar.querySelectorAll('[data-date]').forEach(day => day.setAttribute('aria-pressed', String(day === button)));
      updateTimes();
    }
  });
  select('times').addEventListener('click', event => {
    const button = event.target.closest('[data-time]');
    if (!button || button.disabled) return;
    if (time === button.dataset.time) return;
    time = button.dataset.time;
    attempt = undefined;
    resetResult();
    updateTimes();
    Array.from(select('times').children).find(node => node.dataset.time === time)?.focus();
  });
  select('again').addEventListener('click', () => {
    resetResult();
    time = '';
    date = '';
    attempt = undefined;
    updateDays();
    updateTimes();
    calendar.querySelector('button:not(:disabled)')?.focus();
  });
  form.addEventListener('input', () => {
    if (!waiting) attempt = undefined;
  });
  select('close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => select('again').focus({ preventScroll: true }));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (waiting || !date || !time || completed) return;
    clearErrors();
    const name = form.elements.name.value.trim();
    const contact = form.elements.contact.value.trim();
    if (!name) fieldError('name', 'Напишите ваше имя.');
    if (!contact) fieldError('contact', 'Оставьте телефон или Telegram.');
    if (!name || !contact) {
      form.querySelector('[aria-invalid="true"]').focus();
      return;
    }
    attempt ||= { date, time, name, contact, idempotency: crypto.randomUUID(), ...(occasion ? { occasion } : {}),
      ...(site === 'evento' || site === 'forma' ? { kind } : {}) };
    waiting = true;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Оформляем…';
    updateHeader();
    calendar.querySelectorAll('button').forEach(button => { button.disabled = true; });
    select('times').querySelectorAll('button').forEach(button => { button.disabled = true; });
    result.textContent = '';
    try {
      const response = await transport.submit(attempt);
      const payload = await response.json();
      if (response.status === 409) {
        time = '';
        attempt = undefined;
        await loadMonth({ keepDate: true });
        result.textContent = 'Это время уже занято. Выберите другое.';
        return;
      }
      if (!response.ok || !payload.ok) {
        if (payload.errors?.name) fieldError('name', payload.errors.name);
        if (payload.errors?.contact) fieldError('contact', payload.errors.contact);
        result.textContent = payload.error || 'Не удалось оформить заявку. Попробуйте ещё раз.';
        attempt = undefined;
        return;
      }
      const day = dates.get(date);
      if (day) {
        day.times = day.times.filter(hour => hour !== time);
        if (!day.times.length) dates.delete(date);
      }
      completed = true;
      attempt = undefined;
      form.reset();
      select('again').hidden = false;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else result.textContent = 'Заявка оформлена';
    } catch {
      result.textContent = 'Не удалось оформить заявку. Попробуйте ещё раз.';
    } finally {
      waiting = false;
      submit.disabled = false;
      submit.textContent = 'Оформить заявку';
      updateHeader();
      updateDays();
      updateTimes();
    }
  });

  loadMonth({ keepDate: useInitialDate });
  return {
    chooseOccasion(value) { occasion = typeof value === 'string' ? value : ''; }
  };
}

for (const mount of document.querySelectorAll('[data-venue-booking]')) {
  const { site, timeZone } = mount.dataset;
  const query = new URLSearchParams(location.search);
  mount.innerHTML = bookingSection({ embedded: true, site });
  bindBooking(mount.querySelector('.booking'), site, { timeZone, kind: query.get('kind'), initialDate: query.get('day') || '' });
}
