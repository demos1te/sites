import { bookingSection, bindBooking } from './booking.js';
import { renderGallery, bindGalleries } from './four-carousel.js';

const slug = document.body.dataset.venue || location.pathname.split('/').pop()?.replace(/\.html$/, '');
const isBath = slug === 'osmak';
const isClub = slug === 'sandbox';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

const labels = {
  green: { name: 'Светлый лофт', city: 'Москва', formats: 'Поводы собраться', gallery: 'Зал и детали', details: 'О пространстве' },
  reboot: { name: 'Камерный лофт', city: 'Красногорск', formats: 'Что можно устроить', gallery: 'Лофт изнутри', details: 'О пространстве' },
  osmak: { name: 'Банный клуб', city: 'Одинцово', gallery: 'Парная и детали', details: 'О банном клубе' },
  sandbox: { name: 'Музыкальное пространство', city: 'Санкт-Петербург', formats: 'События в клубе', gallery: 'Зал, свет и звук', details: 'О пространстве' },
};
const dateLabel = new Intl.DateTimeFormat('ru-RU', { month: 'long', day: 'numeric', timeZone: 'Europe/Moscow' });
let data;
let booking;

function safeUrl(value, image = false) {
  if (!value || typeof value !== 'string' || /[\u0000-\u0020\\]/.test(value)) return '';
  if (image && /^\.\/[A-Za-z0-9_-]+\.webp$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (image) return url.protocol === 'https:' && url.origin === location.origin ? url.href : '';
    return ['https:', 'tel:', 'mailto:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function photo(source, alt, className = '', variants = {}) {
  const url = safeUrl(source, true);
  if (!url) return '<div class="photo-missing"></div>';
  const eager = className === 'hero-image';
  const srcSet = Object.entries(variants || {}).map(([width, item]) => {
    const variant = safeUrl(item, true);
    return variant && /^\d+$/.test(width) ? `${variant} ${width}w` : '';
  }).filter(Boolean).join(', ');
  return `<img class="${className}" src="${escape(url)}" alt="${escape(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"${srcSet ? ` srcset="${escape(srcSet)}" sizes="100vw"` : ''}>`;
}

function link(url, label, className = '') {
  const destination = safeUrl(url);
  return destination ? `<a class="${className}" href="${escape(destination)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>` : '';
}

function navLinks() {
  return `${isBath ? '<a href="#programs">Программы</a>' : '<a href="#formats">Форматы</a>'}
    ${isClub ? '<a href="#events">Афиша</a>' : ''}
    ${data.gallery.length ? '<a href="#gallery">Галерея</a>' : ''}
    <a href="#booking">Календарь</a><a href="#contacts">Контакты</a>`;
}

function heroSection() {
  const primary = isBath ? 'Записаться' : isClub ? 'Аренда' : 'Выбрать дату';
  const secondary = isClub ? ['#events', 'Афиша'] : isBath ? ['#programs', 'Программы'] : ['#gallery', 'Галерея'];
  const alt = data.heroAlt || `Интерьер ${data.title}`;
  const credit = data.heroCaption && data.hero ? '<span class="hero-photo-credit">Иллюстрация</span>' : '';
  return `<section id="top" class="hero">
    <div class="hero-copy">
      <p class="micro">${escape(labels[slug].name)} · ${escape(labels[slug].city)}</p>
      <h1>${escape(data.title)}</h1>
      ${data.tagline ? `<p class="hero-tagline">${escape(data.tagline)}</p>` : ''}
      <div class="hero-actions">
        <a class="button primary" href="#booking">${primary}</a>
        <a class="button secondary" href="${secondary[0]}">${secondary[1]}</a>
      </div>
    </div>
    <div class="hero-art">${photo(data.hero, alt, 'hero-image', data.heroVariants)}</div>${credit}
  </section>`;
}

function modePanel(mode) {
  return `${mode.image ? `<div id="mode-image">${photo(mode.image, mode.alt || mode.name)}</div>` : ''}
    ${data.illustrative && mode.image ? '<small class="mode-photo-credit">Иллюстрация</small>' : ''}
    <p id="mode-text">${escape(mode.text)}</p>
    ${mode.features?.length ? `<ul class="mode-features">${mode.features.map(feature => `<li>${escape(feature)}</li>`).join('')}</ul>` : ''}
    <a id="mode-request" class="text-link" data-occasion="${escape(mode.name)}" href="#booking">Выбрать дату</a>`;
}

function formatSection() {
  if (!data.modes.length || isBath) return '';
  return `<section id="formats" class="section formats reveal">
    <div class="section-heading"><h2>${labels[slug].formats}</h2></div>
    <div class="mode-layout">
      <div class="mode-list" role="tablist" aria-label="Форматы">${data.modes.map((mode, index) =>
        `<button class="mode ${index ? '' : 'active'}" type="button" role="tab" id="mode-tab-${index}" aria-controls="mode-panel" tabindex="${index ? -1 : 0}" aria-selected="${!index}" data-mode="${index}"><span>${escape(mode.name)}</span><i aria-hidden="true">${index ? '+' : '−'}</i></button>`).join('')}</div>
      <div class="mode-display" id="mode-panel" role="tabpanel" aria-labelledby="mode-tab-0" tabindex="0">${modePanel(data.modes[0])}</div>
    </div>
  </section>`;
}

function gallerySection() {
  if (!data.gallery.length) return '';
  return `<section id="gallery" class="section gallery-section reveal">
    <div class="section-heading"><h2>${data.illustrative ? 'Атмосфера' : labels[slug].gallery}</h2></div>
    ${renderGallery(data.gallery, { className: 'room-gallery', label: data.illustrative ? 'Иллюстрации' : 'Фотографии пространства' })}
  </section>`;
}

function programsSection() {
  if (!data.programs.length) return '';
  return `<section id="programs" class="section programs-section reveal">
    <div class="section-heading"><h2>Банные программы</h2></div>
    <div class="programs">${data.programs.map(program => `<article>
      <h3>${escape(program.name)}</h3>
      ${program.description ? `<p>${escape(program.description)}</p>` : ''}
      <a class="text-link" data-occasion="${escape(program.name)}" href="#booking">Выбрать дату</a>
    </article>`).join('')}</div>
  </section>`;
}

function eventCard(event) {
  const date = dateLabel.format(new Date(event.date + 'T12:00:00+03:00'));
  return `<article>${event.image ? photo(event.image, `Афиша: ${event.title}`) : ''}
    <div><p class="micro">${escape(date)}${event.time ? ' · ' + escape(event.time) : ''}</p>
      <h3>${escape(event.title)}</h3>
      ${event.description ? `<p>${escape(event.description)}</p>` : ''}
      ${link(event.link, event.linkLabel || 'Как попасть', 'button secondary')}
    </div></article>`;
}

function eventsSection() {
  const time = event => Date.parse(`${event.date}T${event.time || '23:59'}:00+03:00`);
  const future = data.events.filter(event => event.status === 'published' && safeUrl(event.link) && time(event) >= Date.now())
    .sort((a, b) => time(a) - time(b));
  if (isBath && !future.length) return '';
  return `<section id="events" class="section events-section reveal">
    <div class="section-heading"><h2>${isBath ? 'Групповые встречи' : 'Афиша'}</h2></div>
    ${future.length ? `<div class="event-grid">${future.map(eventCard).join('')}</div>` :
      `<div class="empty-events"><p>Новых событий пока нет.</p>${link(data.channel, 'Афиша в Telegram', 'button secondary')}</div>`}
  </section>`;
}

function practical(text) {
  return text && !/демо|уточн|карточк|по запросу|подтвержда|согласу|в каталогах/i.test(text);
}

function detailsSection() {
  const details = data.details.map(detail => typeof detail === 'string' ? detail : detail.name).filter(practical);
  const equipment = data.equipment.filter(entry => entry?.status === 'confirmed' && practical(entry.name));
  const tariffs = data.tariffs.filter(entry => entry?.status === 'confirmed' && entry.name && entry.price);
  const faq = data.faq.filter(entry => practical(entry.q) && practical(entry.a));
  const intro = [data.conditionsIntro, data.intro].find(practical);
  if (!intro && !details.length && !equipment.length && !tariffs.length && !faq.length) return '';
  return `<section id="details" class="section details reveal">
    <div class="section-heading"><h2>${labels[slug].details}</h2></div>
    ${intro || details.length ? `<div class="details-grid">
      ${intro ? `<div class="details-lead"><p>${escape(intro)}</p></div>` : ''}
      ${details.length ? `<div class="detail-rows">${details.map(item => `<div>${escape(item)}</div>`).join('')}</div>` : ''}
    </div>` : ''}
    ${equipment.length ? `<div class="detail-rows equipment-rows"><h3>Оснащение</h3>${equipment.map(entry =>
      `<div><strong>${escape(entry.name)}</strong>${practical(entry.text) ? ' ' + escape(entry.text) : ''}</div>`).join('')}</div>` : ''}
    ${tariffs.length ? `<div class="detail-rows equipment-rows"><h3>Тарифы</h3>${tariffs.map(entry =>
      `<div><strong>${escape(entry.name)}</strong> · ${escape(entry.price)}</div>`).join('')}</div>` : ''}
    ${faq.length ? `<div class="faq-list">${faq.map(entry => `<details><summary>${escape(entry.q)}</summary><p>${escape(entry.a)}</p></details>`).join('')}</div>` : ''}
  </section>`;
}

function contactsSection() {
  return `<footer id="contacts">
    <div><strong>${escape(data.title)}</strong><p>${escape(data.address)}</p></div>
    <div>
      ${link(data.map, 'Построить маршрут', 'text-link')}
      ${link(data.channel, 'Telegram-канал', 'text-link')}
      ${link(data.contact, 'Связаться', 'text-link')}
      ${data.phone ? link('tel:' + data.phone.replace(/[^+\d]/g, ''), data.phone, 'text-link') : ''}
      ${data.email ? link('mailto:' + data.email, data.email, 'text-link') : ''}
      ${data.whatsapp ? link(data.whatsapp, 'WhatsApp', 'text-link') : ''}
    </div>
  </footer>`;
}

function bindNavigation() {
  const nav = $('.nav');
  const menu = $('.menu-toggle');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', open);
    menu.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  }
  menu.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  $$('a', nav).forEach(anchor => anchor.addEventListener('click', () => setMenu(false)));
  nav.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      setMenu(false);
      menu.focus();
    }
  });
}

function bindModes() {
  const tabs = $$('.mode');
  if (!tabs.length) return;
  function choose(index, focus = false) {
    tabs.forEach((tab, i) => {
      tab.classList.toggle('active', i === index);
      tab.setAttribute('aria-selected', i === index);
      tab.tabIndex = i === index ? 0 : -1;
      $('i', tab).textContent = i === index ? '−' : '+';
    });
    if (focus) tabs[index].focus();
    const panel = $('#mode-panel');
    panel.setAttribute('aria-labelledby', `mode-tab-${index}`);
    panel.innerHTML = modePanel(data.modes[index]);
    document.body.dataset.mode = index;
    if (!reduced.matches) panel.animate([{ opacity: .46 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => choose(index));
    tab.addEventListener('keydown', event => {
      const actions = { ArrowLeft: index - 1, ArrowUp: index - 1, ArrowRight: index + 1, ArrowDown: index + 1, Home: 0, End: tabs.length - 1 };
      if (!(event.key in actions)) return;
      event.preventDefault();
      choose((actions[event.key] + tabs.length) % tabs.length, true);
    });
  });
}

function bindReveal() {
  if (reduced.matches || !('IntersectionObserver' in window)) {
    $$('.reveal').forEach(item => item.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    observer.unobserve(entry.target);
  }), { threshold: .05 });
  $$('.reveal').forEach(item => observer.observe(item));
}

function render() {
  document.body.className = `site ${slug}`;
  document.title = `${data.title} — ${labels[slug].name}`;
  $('meta[name="description"]').content = data.intro;
  const app = $('#app');
  app.innerHTML = `<a class="skip-link" href="#content">К содержанию</a>
    <header class="nav">
      <a class="brand" href="#top">${escape(data.title)}</a>
      <nav id="site-navigation" aria-label="Основная навигация">${navLinks()}</nav>
      <a class="nav-cta" href="#booking">${isBath ? 'Записаться' : 'Выбрать дату'}</a>
      <button class="menu-toggle" type="button" aria-label="Открыть меню" aria-controls="site-navigation" aria-expanded="false">Меню</button>
    </header>
    <main id="content">${heroSection()}${isClub ? eventsSection() : ''}${isBath ? programsSection() : formatSection()}
      ${gallerySection()}${isBath ? eventsSection() : ''}${bookingSection()}${detailsSection()}
    </main>${contactsSection()}`;
  bindNavigation();
  bindModes();
  bindGalleries(app);
  booking = bindBooking($('#booking'), slug);
  app.addEventListener('click', event => {
    const anchor = event.target.closest('a[href="#booking"]');
    if (anchor) booking.chooseOccasion(anchor.dataset.occasion);
  });
  bindReveal();
  const deepLink = location.hash && document.getElementById(location.hash.slice(1));
  if (deepLink) deepLink.scrollIntoView({ behavior: 'instant' });
}

async function load() {
  const app = $('#app');
  try {
    if (!labels[slug]) throw Error('Площадка не найдена.');
    const response = await fetch(new URL(`./${slug}-content.json`, import.meta.url));
    if (!response.ok) throw Error('Не удалось загрузить площадку.');
    data = {
      gallery: [], modes: [], programs: [], events: [], details: [], faq: [], equipment: [], tariffs: [],
      ...await response.json()
    };
    render();
  } catch (error) {
    app.innerHTML = `<div class="loading"><p>${escape(error.message)}</p><button type="button">Повторить</button></div>`;
    $('button', app).addEventListener('click', load);
  }
}

load();
