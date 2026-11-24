const calendarDays = document.querySelector('.calendar-days');
const calendarMonth = document.querySelector('#calendar-month');
const bookingForm = document.querySelector('.booking-form');
const bookingStatus = document.querySelector('#booking-status');
const bookingError = document.querySelector('.booking-error');
const previousMonth = document.querySelector('[data-month-prev]');
const nextMonth = document.querySelector('[data-month-next]');
const monthName = document.createElement('span');
calendarMonth.append(monthName);
bookingStatus.innerHTML = '<span class="booking-check" aria-hidden="true">✓</span><span class="booking-confirmed-copy"><strong>Заявка оформлена</strong><span></span></span>';
const confirmedDate = bookingStatus.querySelector('.booking-confirmed-copy > span');
const weekdays = document.querySelector('.weekdays');
const calendarKey = document.querySelector('.calendar-key');
const dateSheet = document.createElement('div');
dateSheet.className = 'calendar-date-sheet';
weekdays.before(dateSheet);
dateSheet.append(weekdays, calendarDays, calendarKey);

bookingForm.id = 'booking-contact';
bookingForm.insertAdjacentHTML('beforebegin', `
  <section class="booking-slot" aria-labelledby="booking-slot-title" hidden>
    <h3 id="booking-slot-title">Время съёмки</h3>
    <button class="booking-slot-action" type="button" aria-controls="booking-contact" aria-pressed="false">
      Съёмка на весь день <span aria-hidden="true">↘</span>
    </button>
  </section>
`);
const bookingSlot = document.querySelector('.booking-slot');
const slotButton = document.querySelector('.booking-slot-action');

const omskDateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Omsk', year: 'numeric', month: 'numeric', day: 'numeric',
}).formatToParts();
const datePart = name => Number(omskDateParts.find(part => part.type === name).value);
const utcDate = (year, month, day) => new Date(Date.UTC(year, month, day));
const today = utcDate(datePart('year'), datePart('month') - 1, datePart('day'));
const monthAt = offset => utcDate(today.getUTCFullYear(), today.getUTCMonth() + offset, 1);
const dayKey = date => date.toISOString().slice(0, 10);
const dayLabel = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
});
const monthLabel = new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const demoBusyDays = new Set([8, 15, 24]);
const storagePrefix = 'roman-portfolio-demo:v1:shoot:';
let monthOffset = 0;
let chosenDate = null;
let saving = false;

function isReserved(date) {
  try {
    return localStorage.getItem(storagePrefix + dayKey(date)) !== null;
  } catch {
    return false;
  }
}

function availability(date) {
  if (date <= today) return 'past';
  if (demoBusyDays.has(date.getUTCDate()) || isReserved(date)) return 'busy';
  return 'open';
}

function describeDay(date, status) {
  const label = dayLabel.format(date);
  if (status === 'open') return label + ', доступно';
  if (status === 'busy') return label + ', занято';
  return label + ', недоступно для записи';
}

function markSelectedDate() {
  const selection = chosenDate ? dayKey(chosenDate) : '';
  calendarDays.querySelectorAll('button:enabled').forEach(day => {
    day.setAttribute('aria-pressed', String(day.dataset.date === selection));
  });
}

function displayCalendar() {
  const month = monthAt(monthOffset);
  const year = month.getUTCFullYear();
  const monthNumber = month.getUTCMonth();
  const firstWeekday = (month.getUTCDay() + 6) % 7;
  const count = utcDate(year, monthNumber + 1, 0).getUTCDate();
  const label = monthLabel.format(month);
  monthName.textContent = label[0].toLocaleUpperCase('ru-RU') + label.slice(1);
  previousMonth.disabled = monthOffset === 0;
  nextMonth.disabled = monthOffset === 2;

  const cells = document.createDocumentFragment();
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.append(document.createElement('span'));
  }
  for (let day = 1; day <= count; day += 1) {
    const date = utcDate(year, monthNumber, day);
    const status = availability(date);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = day;
    button.dataset.date = dayKey(date);
    button.dataset.state = status;
    button.setAttribute('aria-label', describeDay(date, status));
    button.disabled = status !== 'open';
    cells.append(button);
  }
  calendarDays.replaceChildren(cells);
  markSelectedDate();
}

function changeMonth(amount) {
  if (saving) return;
  monthOffset += amount;
  if (chosenDate && chosenDate.getUTCMonth() !== monthAt(monthOffset).getUTCMonth()) {
    chosenDate = null;
    bookingSlot.hidden = true;
    bookingForm.hidden = true;
  }
  displayCalendar();
  if (document.activeElement === document.body) {
    (amount > 0 ? previousMonth : nextMonth).focus();
  }
}

previousMonth.addEventListener('click', () => changeMonth(-1));
nextMonth.addEventListener('click', () => changeMonth(1));

calendarDays.addEventListener('click', event => {
  const day = event.target.closest('button');
  if (!day || day.disabled || saving) return;
  if (chosenDate && day.dataset.date === dayKey(chosenDate)) return;
  chosenDate = new Date(day.dataset.date + 'T00:00:00Z');
  markSelectedDate();
  bookingForm.querySelector('.selected-date').textContent = dayLabel.format(chosenDate);
  bookingStatus.hidden = true;
  bookingError.hidden = true;
  bookingForm.hidden = true;
  slotButton.setAttribute('aria-pressed', 'false');
  bookingSlot.hidden = false;
  if (event.detail === 0) slotButton.focus();
  else bookingSlot.scrollIntoView({ block: 'nearest' });
});

slotButton.addEventListener('click', event => {
  if (!chosenDate || saving || !bookingForm.hidden) return;
  slotButton.setAttribute('aria-pressed', 'true');
  bookingForm.hidden = false;
  if (event.detail === 0) bookingForm.elements.name.focus();
  else bookingForm.scrollIntoView({ block: 'nearest' });
});

function showBookingError(text) {
  bookingError.textContent = text;
  bookingError.hidden = false;
}

function saveBooking(date, details) {
  const key = storagePrefix + dayKey(date);
  if (localStorage.getItem(key) !== null) return false;
  localStorage.setItem(key, JSON.stringify(details));
  return true;
}

bookingForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!chosenDate || bookingForm.hidden || saving) return;
  const formData = new FormData(bookingForm);
  const name = formData.get('name').trim();
  const contact = formData.get('contact').trim();
  if (name.length < 2 || contact.length < 4) {
    showBookingError('Укажите имя, телефон или Telegram.');
    bookingForm.elements[name.length < 2 ? 'name' : 'contact'].focus();
    return;
  }

  const date = chosenDate;
  const button = bookingForm.querySelector('button[type="submit"]');
  saving = true;
  button.disabled = true;
  try {
    const save = () => saveBooking(date, { name, contact });
    const saved = navigator.locks
      ? await navigator.locks.request(storagePrefix + dayKey(date), save)
      : save();
    if (!saved) {
      displayCalendar();
      showBookingError('Этот день уже выбран. Укажите другую дату.');
      return;
    }
    chosenDate = null;
    bookingForm.reset();
    bookingSlot.hidden = true;
    bookingForm.hidden = true;
    confirmedDate.textContent = dayLabel.format(date) + ' Сохранено в этом браузере.';
    bookingStatus.hidden = false;
    displayCalendar();
    bookingStatus.focus();
  } catch {
    showBookingError('Браузер не разрешил сохранить заявку. Попробуйте ещё раз.');
  } finally {
    saving = false;
    button.disabled = false;
  }
});

displayCalendar();

const heroControl = document.querySelector('.hero-cta');
const opaqueControls = matchMedia('(prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)');
const glassTargets = [heroControl, previousMonth, calendarMonth, nextMonth, dateSheet, bookingSlot, bookingForm, bookingStatus].filter(Boolean);
const visibleOptics = new Set();
const glassLayers = new Map();
const failedOptics = new WeakSet();
let glassEngine;
let glassAlignFrame = 0;

function placeLens(layer, { left, top }, width, height) {
  const style = layer.backdrop.style;
  style.width = width + 'px';
  style.height = height + 'px';
  style.transform = `translate3d(${-left}px, ${-top}px, 0)`;
}

function alignGlassLayers() {
  glassAlignFrame = 0;
  const width = document.documentElement.clientWidth;
  const height = window.innerHeight;
  const changes = Array.from(glassLayers.values(), layer => [layer, layer.pixels.getBoundingClientRect()]);
  for (const [layer, rect] of changes) placeLens(layer, rect, width, height);
}

function scheduleGlassAlignment() {
  if (glassLayers.size && !glassAlignFrame) glassAlignFrame = requestAnimationFrame(alignGlassLayers);
}

function updateOptic(control) {
  const layer = glassLayers.get(control);
  const enabled = visibleOptics.has(control) && !opaqueControls.matches;
  if (!enabled && layer) {
    layer.glass.destroy();
    layer.lens.remove();
    glassLayers.delete(control);
    delete control.dataset.glass;
  }
  if (!enabled || layer || !glassEngine || failedOptics.has(control)) return;
  const hero = control === heroControl;
  const small = hero || control.closest('.calendar-head');
  const prefix = hero ? 'cta-lens' : 'booking-optic';
  const lens = document.createElement('span');
  const pixels = document.createElement('span');
  const backdrop = document.createElement('span');
  lens.className = prefix;
  pixels.className = prefix + '-pixels';
  backdrop.className = hero ? 'cta-backdrop' : prefix + '-backdrop';
  lens.setAttribute('aria-hidden', 'true');
  pixels.append(backdrop);
  lens.append(pixels);
  control.prepend(lens);
  try {
    const glass = glassEngine(pixels, {
      fit: true,
      radius: Math.min(parseFloat(getComputedStyle(control).borderTopLeftRadius), control.offsetHeight / 2),
      refraction: small ? 19 : 23,
      bezel: small ? .74 : .34,
      curvature: small ? 2.5 : 4,
      chroma: .14,
      specular: .7,
      specularWidth: 1.8,
      mapScale: .9,
    });
    const mounted = { lens, pixels, backdrop, glass };
    glassLayers.set(control, mounted);
    placeLens(mounted, pixels.getBoundingClientRect(), document.documentElement.clientWidth, window.innerHeight);
    control.dataset.glass = 'active';
  } catch {
    lens.remove();
    failedOptics.add(control);
  }
}

if ('IntersectionObserver' in window && 'ResizeObserver' in window) {
  const inViewport = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) visibleOptics.add(target);
      else visibleOptics.delete(target);
      updateOptic(target);
    }
  }, { rootMargin: '60px 0px' });
  const responsiveLayout = new ResizeObserver(scheduleGlassAlignment);
  for (const target of glassTargets) {
    inViewport.observe(target);
    responsiveLayout.observe(target);
    target.addEventListener('animationend', scheduleGlassAlignment);
  }
  window.addEventListener('scroll', scheduleGlassAlignment, { passive: true });
  window.addEventListener('resize', scheduleGlassAlignment);
  opaqueControls.addEventListener('change', () => glassTargets.forEach(updateOptic));
  import('./portfolio-gallery-glass.js').then(module => {
    glassEngine = module.createGlass;
    glassTargets.forEach(updateOptic);
  }).catch(() => {
    // Native controls keep their tinted fallback when refraction is unavailable.
  });
}
