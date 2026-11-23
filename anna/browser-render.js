import { initial } from './browser-seed.js?v=1';
import { getPhoto, getState } from './browser-store.js?v=1';

const digits = new Intl.NumberFormat('ru-RU');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function price(item) {
  if (!Number.isInteger(item.priceValue) || item.priceMode === 'on_request') return 'Стоимость по запросу';
  const cost = digits.format(item.priceValue) + '\u00a0₽';
  return item.priceMode === 'from' ? 'от ' + cost : cost;
}

function dots(count) {
  if (count < 2) return null;
  const density = count > 12 ? 'tight' : count > 5 ? 'compact' : 'regular';
  const group = element('div', 'gallery-dots ' + density);
  group.dataset.galleryDots = '';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Кадры галереи');
  const traveler = element('span', 'dot-traveler');
  traveler.setAttribute('aria-hidden', 'true');
  traveler.append(element('span'));
  group.append(traveler);
  for (let index = 0; index < count; index++) {
    const button = element('button');
    button.type = 'button';
    button.dataset.dot = index;
    button.setAttribute('aria-label', 'Кадр ' + (index + 1));
    if (!index) button.setAttribute('aria-current', 'true');
    group.append(button);
  }
  return group;
}

async function media(photo, eager = false) {
  const key = photo?.key || '';
  if (key.startsWith('color-')) {
    const block = element('span', 'color-placeholder');
    block.dataset.swatch = key.slice(6);
    block.setAttribute('role', 'img');
    block.setAttribute('aria-label', photo.alt || 'Цветной фон');
    return block;
  }
  const link = await getPhoto(key);
  if (!link) {
    const placeholder = element('div', 'placeholder');
    placeholder.setAttribute('role', 'img');
    placeholder.setAttribute('aria-label', 'Место для фотографии');
    return placeholder;
  }
  const img = element('img');
  img.src = link.src;
  if (link.srcset) img.srcset = link.srcset;
  img.alt = photo.alt || '';
  img.loading = eager ? 'eager' : 'lazy';
  img.sizes = '(max-width: 720px) 91vw, 44vw';
  img.decoding = 'async';
  return img;
}

async function setCardMedia(card, item) {
  const gallery = card.querySelector('[data-card-gallery]');
  const image = gallery.querySelector('.card-image');
  const photos = item.photos.length ? item.photos : [{}];
  const frames = await Promise.all(photos.map(async (photo, index) => {
    const slide = element('span', 'card-slide');
    slide.dataset.slide = index;
    slide.hidden = Boolean(index);
    slide.append(await media(photo));
    return slide;
  }));
  image.replaceChildren(...frames);
  if (image.tagName === 'A') image.setAttribute('aria-label', 'Открыть карточку ' + item.title);
  gallery.querySelector('[data-gallery-dots]')?.remove();
  const controls = dots(item.photos.length);
  if (controls) gallery.append(controls);
}

function cardCopy(item) {
  const nodes = [];
  if (item.text) {
    const description = element('p', 'body-copy', item.text);
    description.dataset.itemDescription = '';
    nodes.push(description);
  }
  if (item.includes?.length) {
    const list = element('ul', 'card-points');
    item.includes.filter(Boolean).forEach(point => list.append(element('li', '', point)));
    nodes.push(list);
  }
  if (item.priceNote) nodes.push(element('p', 'card-note', item.priceNote));
  return nodes;
}

async function updateCard(card, item) {
  card.querySelector('[data-card-title]').textContent = item.title || 'Без названия';
  card.querySelector('[data-card-price]').textContent = price(item);
  card.querySelector('[data-card-copy]').content.replaceChildren(...cardCopy(item));
  await setCardMedia(card, item);
}

async function updateHome(snapshot, editing) {
  const settings = snapshot.settings;
  document.querySelector('.wordmark').textContent = settings.brand;
  document.querySelector('.location').textContent = settings.city;
  const heading = document.querySelector('.hero h1');
  if (settings.heading !== initial.settings.heading) heading.textContent = settings.heading;
  const heroCopy = document.querySelector('.hero-copy');
  let intro = heroCopy.querySelector('.hero-intro');
  if (!intro && settings.intro) {
    intro = element('p', 'hero-intro');
    heading.after(intro);
  }
  if (intro) intro.textContent = settings.intro || (editing ? 'Добавить вступление' : '');
  heroCopy.querySelector('.solid').textContent = settings.workButton || 'Смотреть оформление';
  document.querySelector('.footer-name').textContent = settings.brand;
  document.querySelector('.footer-inner p > span').textContent = settings.footer || settings.city;
  const topButton = document.querySelector('[data-back-top], .footer-label');
  if (topButton.firstChild) topButton.firstChild.textContent = settings.topButton || 'Наверх';
  const hero = document.querySelector('.hero-edit-image') || document.querySelector('.hero-image');
  if (settings.hero !== initial.settings.hero) hero.replaceChildren(await media({ key: settings.hero, alt: settings.heading }, true));

  const grid = document.querySelector('.works-grid');
  const template = document.querySelector('[data-browser-card]');
  const original = new Map(initial.items.map(item => [item.id, item]));
  const cards = await Promise.all(snapshot.items.filter(item => editing || item.visible).map(async item => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.id = item.id;
    card.querySelectorAll('[data-edit-item]').forEach(node => { node.dataset.editItem = item.id; });
    const link = card.querySelector('a[data-open-card]');
    if (link) link.href = original.get(item.id)?.url || '#works';
    await updateCard(card, item);
    return card;
  }));
  grid.replaceChildren(...cards);
  const empty = document.querySelector('.catalog-empty');
  if (empty) empty.hidden = cards.length > 0;
}

export async function hydrateSite() {
  const state = await getState();
  const mode = document.body.dataset.annaHosted;
  if (!state.revision) return;
  if (mode === 'detail') {
    const card = document.querySelector('[data-work-card]');
    const item = state.published.items.find(work => work.visible && work.id === document.body.dataset.hostedItem);
    if (!item) return;
    await updateCard(card, item);
    const details = card.querySelector('.work-expanded-copy');
    details.replaceChildren(details.querySelector('h1'), details.querySelector('[data-card-price]'), ...cardCopy(item));
  } else {
    await updateHome(mode === 'edit' ? state.draft : state.published, mode === 'edit');
  }
}
