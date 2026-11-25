import { readCatalog, heroBlocks, heroFonts } from './store.js?v=photo-picker';

const main = document.querySelector('#catalog-view');
const dialog = document.querySelector('.work-dialog');
const brand = document.querySelector('.wordmark');
const prices = new Intl.NumberFormat('ru-RU');
const galleryPositions = new Map();
const pagePositions = new Map();
let activePage;
let activeWork;
let dialogTrigger;
let renderVersion = 0;
let backdropFrame = 0;
let backdropDistance = 0;
let backdropProgress;
let cancelCatalogueScroll;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) {
    if (!isIntersecting) continue;
    target.dataset.reveal = 'visible';
    revealObserver.unobserve(target);
  }
}) : null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function edit(node, path, type = 'text') {
  node.dataset.editPath = path;
  node.dataset.editType = type;
  return node;
}

function link(path, className, text) {
  const anchor = element('a', className, text);
  anchor.href = '#' + path;
  return anchor;
}

function button(className, label) {
  const control = element('button', className, label);
  control.type = 'button';
  return control;
}

function colorBackground(node, color, property = '--media-color') {
  if (typeof color === 'string' && CSS.supports('color', color)) node.style.setProperty(property, color);
  else node.style.removeProperty(property);
}

function darkColor(color) {
  const rgb = typeof color === 'string' && color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!rgb) return false;
  const linear = rgb.slice(1).map(hex => {
    const channel = Number.parseInt(hex, 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  return luminance < .19;
}

function paintBackground(background) {
  const body = document.body;
  colorBackground(body, background?.color, '--custom-paper');
  const image = photoUrl(background?.image);
  if (image) body.style.setProperty('--uploaded-anna-backdrop', 'url("' + image + '")');
  else if (background?.color) body.style.setProperty('--uploaded-anna-backdrop', 'none');
  else body.style.removeProperty('--uploaded-anna-backdrop');
  body.toggleAttribute('data-site-image', Boolean(image));
  body.toggleAttribute('data-site-color', Boolean(background?.color));
  if (darkColor(background?.color)) body.dataset.backgroundTone = 'dark';
  else delete body.dataset.backgroundTone;
}

function homeHero(site) {
  const hero = element('header', 'home-hero');
  const copy = element('div', 'home-hero-copy');
  const actions = element('div', 'home-hero-actions');
  const browse = edit(button('browse-catalogue', site.catalogueAction), 'catalogueAction');
  browse.addEventListener('click', () => scrollToCatalogue(main.querySelector('#catalogue')));
  actions.append(browse);
  const blocks = {
    brand: edit(element('p', 'home-name', site.brand), 'brand'),
    heading: edit(element('h1', 'hero-title', site.heading), 'heading'),
    intro: edit(element('p', 'hero-intro', site.intro), 'intro'),
    catalogueAction: actions,
  };
  for (const key of heroBlocks) {
    const block = blocks[key];
    const typography = site.heroLayout.typography[key];
    const family = heroFonts[typography.font].family;
    if (family) block.style.setProperty('--hero-font-family', family);
    block.dataset.heroBlock = key;
    copy.append(block);
  }
  hero.append(copy);
  return hero;
}

function catalogueArrival(catalogue) {
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  const margin = parseFloat(getComputedStyle(catalogue).scrollMarginTop) || 0;
  const arrival = window.scrollY + catalogue.getBoundingClientRect().top - margin;
  return Math.max(0, Math.min(arrival, maxScroll));
}

function scrollToCatalogue(catalogue) {
  if (!catalogue) return;
  cancelCatalogueScroll?.();
  catalogue.focus({ preventScroll: true });
  const from = window.scrollY;
  const to = catalogueArrival(catalogue);
  if (reducedMotion.matches || Math.abs(to - from) < 1) {
    window.scrollTo({ top: to, behavior: 'instant' });
    scheduleBackdrop();
    return;
  }

  const interrupt = new AbortController();
  const { signal } = interrupt;
  const scrollKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab', 'Escape']);
  const viewportWidth = innerWidth;
  let frame = 0;
  let started;
  const cancel = () => {
    cancelAnimationFrame(frame);
    interrupt.abort();
    cancelCatalogueScroll = undefined;
  };
  cancelCatalogueScroll = cancel;
  for (const event of ['wheel', 'pointerdown', 'touchstart', 'hashchange']) {
    window.addEventListener(event, cancel, { signal, passive: true });
  }
  window.addEventListener('resize', () => {
    if (innerWidth !== viewportWidth) cancel();
  }, { signal, passive: true });
  window.addEventListener('keydown', event => {
    if (scrollKeys.has(event.key)) cancel();
  }, { signal });

  function step(now) {
    started ??= now;
    const elapsed = Math.min(1, (now - started) / 650);
    const eased = elapsed * elapsed * (3 - 2 * elapsed);
    window.scrollTo({ top: from + (to - from) * eased, behavior: 'instant' });
    if (backdropFrame) cancelAnimationFrame(backdropFrame);
    syncBackdrop();
    if (elapsed < 1) frame = requestAnimationFrame(step);
    else cancel();
  }

  frame = requestAnimationFrame(step);
}

function watchCards() {
  revealObserver?.disconnect();
  if (!revealObserver || reducedMotion.matches) return;
  for (const card of main.querySelectorAll('.occasion-card, .work-card')) {
    if (card.getBoundingClientRect().top > innerHeight - 24) {
      card.dataset.reveal = 'pending';
      revealObserver.observe(card);
    }
  }
}

function syncBackdrop() {
  backdropFrame = 0;
  const progress = backdropDistance
    ? Math.max(0, Math.min(1, window.scrollY / backdropDistance))
    : 1;
  const rounded = progress.toFixed(3);
  if (rounded === backdropProgress) return;
  backdropProgress = rounded;
  document.body.style.setProperty('--anna-photo-soften', rounded);
  document.body.style.setProperty('--anna-cover-veil', (1 - progress).toFixed(3));
}

function scheduleBackdrop() {
  if (!backdropFrame) backdropFrame = requestAnimationFrame(syncBackdrop);
}

function measureBackdrop() {
  const catalogue = main.querySelector('#catalogue');
  backdropDistance = catalogue ? Math.max(1, catalogueArrival(catalogue)) : 0;
  scheduleBackdrop();
}

function photoUrl(value) {
  if (typeof value !== 'string') return '';
  const isPhoto = /^(blob:|data:image\/(?:jpeg|png|webp);base64,)/i.test(value);
  return isPhoto && !/["\\\r\n]/.test(value) ? value : '';
}

function media(frame, className, path) {
  const holder = edit(element('span', 'media ' + className), path, 'media');
  colorBackground(holder, frame?.color);
  const src = photoUrl(frame?.image);
  if (src) {
    const image = element('img');
    image.src = src;
    image.alt = '';
    image.draggable = false;
    image.decoding = 'async';
    image.loading = 'lazy';
    holder.append(image);
  }
  return holder;
}

function price(value) {
  return Number.isFinite(value) ? 'от ' + prices.format(value) + '\u00a0₽' : 'Цена по запросу';
}

function back(href, title) {
  const anchor = link(href, 'navigation-back');
  const arrow = element('span', 'navigation-back-icon');
  arrow.setAttribute('aria-hidden', 'true');
  anchor.append(arrow, element('span', 'navigation-back-label', title));
  return anchor;
}

function pageTitle(title, titlePath, intro, introPath) {
  const hero = element('header', 'hero collection-hero');
  const heading = edit(element('h1', 'hero-title', title), titlePath);
  hero.append(heading);
  if (intro) hero.append(edit(element('p', 'hero-intro', intro), introPath));
  else if (introPath) hero.append(edit(button('editor-only editor-add', 'Добавить описание'), introPath));
  return hero;
}

function addControl(label, path, kind) {
  const control = button('editor-only editor-add', label);
  control.dataset.editCollection = path;
  control.dataset.editKind = kind;
  return control;
}

function occasion(item, href, path) {
  const card = link(href, 'occasion-card');
  const caption = element('span', 'occasion-caption');
  const arrow = element('span', 'occasion-arrow', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  caption.append(edit(element('span', 'occasion-title', item.title), path + '.title'), arrow);
  card.append(media(item.cover, 'occasion-media', path + '.cover'), caption,
    element('span', 'editor-only occasion-edit-link', 'Открыть раздел'));
  return card;
}

function gallery(work, workPath, href, key, onSelect) {
  const root = element('div', 'gallery');
  root.dataset.gallery = '';
  const stage = href ? link(href, 'gallery-stage') : element('div', 'gallery-stage');
  stage.setAttribute('aria-label', href ? 'Открыть карточку «' + work.title + '»' : 'Фотографии работы');
  const photos = work.photos.length ? work.photos : [{}];
  const frames = photos.map((photo, index) => media(photo, 'gallery-frame', workPath + '.photos.' + index));
  stage.append(...frames);
  root.append(stage);
  let current = Math.min(galleryPositions.get(key) || 0, frames.length - 1);
  const dots = [];
  let group;
  if (frames.length > 1) {
    group = element('div', 'gallery-dots');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Кадры');
    if (frames.length > 7) group.dataset.dense = '';
    group.append(element('span', 'gallery-marker'));
    if (!href) stage.tabIndex = 0;
    frames.forEach((_, index) => {
      const dot = button('', '');
      dot.setAttribute('aria-label', 'Кадр ' + (index + 1));
      dot.addEventListener('click', () => select(index, index > current ? 'next' : 'previous'));
      dots.push(dot);
      group.append(dot);
    });
    root.append(group);
  }

  function select(index, direction) {
    const next = (index + frames.length) % frames.length;
    if (direction && next === current) return;
    if (direction) root.dataset.direction = direction;
    current = next;
    galleryPositions.set(key, current);
    frames.forEach((frame, offset) => {
      frame.hidden = offset !== current;
      frame.toggleAttribute('data-active', offset === current);
      if (dots[offset]) dots[offset].setAttribute('aria-current', String(offset === current));
    });
    group?.style.setProperty('--dot-index', current);
    if (group && dots[current]) {
      const dot = dots[current];
      if (dot.offsetLeft < group.scrollLeft) group.scrollLeft = dot.offsetLeft;
      else if (dot.offsetLeft + dot.offsetWidth > group.scrollLeft + group.clientWidth) {
        group.scrollLeft = dot.offsetLeft + dot.offsetWidth - group.clientWidth;
      }
    }
    onSelect?.(current, photos[current]);
  }
  select(current);

  if (frames.length > 1) {
    let pointer;
    let lastSwipe = -Infinity;
    stage.addEventListener('pointerdown', event => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      lastSwipe = -Infinity;
      delete root.dataset.lastSwipe;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    stage.addEventListener('pointerup', event => {
      if (pointer?.id !== event.pointerId) return;
      const horizontal = event.clientX - pointer.x;
      const vertical = event.clientY - pointer.y;
      pointer = null;
      if (Math.abs(horizontal) < 28 || Math.abs(horizontal) < Math.abs(vertical) * 1.3) return;
      lastSwipe = performance.now();
      root.dataset.lastSwipe = String(lastSwipe);
      const step = horizontal < 0 ? 1 : -1;
      select(current + step, step > 0 ? 'next' : 'previous');
    });
    stage.addEventListener('pointercancel', () => { pointer = null; });
    root.addEventListener('click', event => {
      if (event.detail && event.target.closest('.gallery-stage') && performance.now() - lastSwipe < 420) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    root.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const moveFocus = event.target.closest('.gallery-dots');
      const step = event.key === 'ArrowRight' ? 1 : -1;
      select(current + step, step > 0 ? 'next' : 'previous');
      if (moveFocus) dots[current].focus();
    });
  }
  return root;
}

function workCard(work, shortRoute, path) {
  const card = element('article', 'work-card');
  const route = shortRoute + '/work/' + work.id;
  card.dataset.workRoute = route;
  card.append(gallery(work, path, route, route));
  const caption = element('div', 'work-caption');
  const heading = element('h2', 'work-title');
  const title = link(route, '', work.title);
  let tap;
  title.addEventListener('touchstart', event => {
    const touch = event.touches.length === 1 ? event.touches[0] : null;
    tap = touch && { id: touch.identifier, x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  title.addEventListener('touchcancel', () => { tap = null; }, { passive: true });
  title.addEventListener('touchend', event => {
    const touch = Array.from(event.changedTouches).find(point => point.identifier === tap?.id);
    const isTap = touch && Math.hypot(touch.clientX - tap.x, touch.clientY - tap.y) < 10;
    tap = null;
    if (!isTap || document.body.hasAttribute('data-editing')) return;
    // Android can suppress the click on the first tap after a gallery swipe.
    // Cancel the compatibility click before opening the dialog under the finger.
    if (event.cancelable) event.preventDefault();
    requestAnimationFrame(() => { if (title.isConnected) openWork(title); });
  }, { passive: false });
  heading.append(edit(title, path + '.title'));
  caption.append(heading, edit(element('p', 'work-price', price(work.price)), path + '.price', 'price'));
  card.append(caption);
  const actions = element('div', 'editor-only editor-actions');
  const remove = button('', 'Удалить работу');
  remove.dataset.editRemove = path;
  actions.append(link(route, '', 'Открыть карточку'), remove);
  card.append(actions);
  return card;
}

function parseRoute(site) {
  const path = location.hash.slice(1).split('/');
  const index = site.categories.findIndex(category => category.id === path[0]);
  if (index < 0) return { key: 'home' };
  const category = site.categories[index];
  const categoryPath = 'categories.' + index;
  const sectionIndex = category.sections.findIndex(section => section.id === path[1]);
  if (category.sections.length && sectionIndex < 0) return { key: category.id, category, categoryPath };
  const section = sectionIndex >= 0 ? category.sections[sectionIndex] : null;
  const collection = section || category;
  const key = section ? category.id + '/' + section.id : category.id;
  const pathToCollection = section ? categoryPath + '.sections.' + sectionIndex : categoryPath;
  const indexKey = section ? 2 : 1;
  const workIndex = path[indexKey] === 'work' ? collection.works.findIndex(item => item.id === path[indexKey + 1]) : -1;
  return {
    key, category, categoryPath, section, collection, pathToCollection,
    work: collection.works[workIndex],
    workPath: pathToCollection + '.works.' + workIndex,
  };
}

function renderPage(site, route) {
  if (!route.category) {
    const cover = element('div', 'view view--home');
    const catalogue = element('section', 'home-catalogue');
    const top = element('header', 'catalogue-head');
    const heading = edit(element('h2', 'catalogue-title', site.catalogueTitle || 'Каталог'), 'catalogueTitle');
    heading.id = 'catalogue-title';
    catalogue.id = 'catalogue';
    catalogue.tabIndex = -1;
    catalogue.setAttribute('aria-labelledby', heading.id);
    top.append(heading);
    const grid = element('div', 'occasion-grid');
    site.categories.forEach((category, index) => grid.append(occasion(category, category.id, 'categories.' + index)));
    catalogue.append(top, grid);
    cover.append(homeHero(site), catalogue);
    return cover;
  }
  const { category, categoryPath, section, collection, pathToCollection, key } = route;
  if (!collection) {
    const view = element('div', 'view view--sections');
    const grid = element('div', 'occasion-grid');
    category.sections.forEach((item, index) => grid.append(occasion(item, key + '/' + item.id, categoryPath + '.sections.' + index)));
    view.append(back('home', 'Все поводы'), pageTitle(category.title, categoryPath + '.title', category.description, categoryPath + '.description'), grid);
    return view;
  }
  const view = element('div', 'view view--works');
  const grid = element('div', 'work-grid');
  collection.works.forEach((work, index) => grid.append(workCard(work, key, pathToCollection + '.works.' + index)));
  view.append(
    section ? back(category.id, category.title) : back('home', 'Все поводы'),
    pageTitle(collection.title, pathToCollection + '.title', collection.description, pathToCollection + '.description'),
  );
  if (collection.works.length) view.append(grid);
  else view.append(element('p', 'section-empty', 'Работы пока не добавлены.'));
  view.append(addControl('Добавить работу', pathToCollection + '.works', 'works'));
  return view;
}

function closeWork() {
  if (history.state?.annaOpenFrom === activePage) history.back();
  else {
    history.replaceState(null, '', '#' + activePage);
    render({ navigation: true });
  }
}

function showWork(route, update) {
  const workRoute = route.work && route.key + '/work/' + route.work.id;
  if (!workRoute) {
    if (dialog.open) dialog.close();
    if (activeWork) {
      const trigger = [...main.querySelectorAll('[data-work-route]')].find(card => card.dataset.workRoute === activeWork);
      (dialogTrigger?.isConnected ? dialogTrigger : trigger?.querySelector('.gallery-stage'))?.focus({ preventScroll: true });
    }
    activeWork = null;
    dialogTrigger = null;
    delete dialog.dataset.workRoute;
    return;
  }
  if (dialog.open && activeWork === workRoute && !update) return;
  if (!dialog.open) dialogTrigger ??= document.activeElement;
  const { work, workPath } = route;
  const top = element('div', 'dialog-top');
  const close = button('dialog-close', '');
  close.setAttribute('aria-label', 'Закрыть');
  close.autofocus = true;
  const cross = element('span', '', '×');
  cross.setAttribute('aria-hidden', 'true');
  close.append(cross);
  const dismiss = () => {
    if (!dialog.open) return;
    dialog.close();
    closeWork();
  };
  close.addEventListener('click', dismiss);
  top.append(close);
  const content = element('div', 'work-dialog-content');
  const copy = element('div', 'detail-copy');
  const title = edit(element('h2', 'detail-title', work.title), workPath + '.title');
  title.id = 'detail-title';
  copy.append(title, edit(element('p', 'work-price', price(work.price)), workPath + '.price', 'price'));
  if (work.description) copy.append(edit(element('p', 'detail-description', work.description), workPath + '.description'));
  else copy.append(edit(button('editor-only editor-add', 'Добавить описание'), workPath + '.description'));
  const photoPath = workPath + '.photos';
  const photoActions = element('div', 'editor-only editor-actions work-photo-actions');
  const primary = button('', 'Сделать фото основным');
  const remove = button('', 'Удалить фото');
  photoActions.append(addControl('Добавить фото', photoPath, 'photos'), primary, remove);
  copy.append(photoActions);
  const photos = gallery(work, workPath, null, workRoute, (index, frame) => {
    const available = Boolean(photoUrl(frame.image));
    primary.dataset.editPrimaryPhoto = photoPath + '.' + index;
    primary.disabled = !available || index === 0;
    primary.textContent = available && index === 0 ? 'Основное фото' : 'Сделать фото основным';
    remove.dataset.editRemove = photoPath + '.' + index;
    remove.hidden = !available;
  });
  content.append(photos, copy);
  dialog.replaceChildren(top, content);
  dialog.dataset.workRoute = workRoute;
  activeWork = workRoute;
  if (!dialog.open) {
    dialog.scrollTop = 0;
    dialog.showModal();
    close.focus({ preventScroll: true });
  }
}

async function render({ navigation = false, update = false } = {}) {
  const revision = ++renderVersion;
  const site = await readCatalog();
  if (revision !== renderVersion) return;
  const route = parseRoute(site);
  const changed = route.key !== activePage;
  brand.textContent = site.brand;
  edit(brand, 'brand');
  paintBackground(site.heroBackground);
  if (changed || update) {
    if (changed && activePage) pagePositions.set(activePage, window.scrollY);
    activePage = route.key;
    main.replaceChildren(renderPage(site, route));
    if (changed && navigation) {
      const heading = main.querySelector('.hero-title');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      window.scrollTo({ top: pagePositions.get(route.key) || 0, behavior: 'instant' });
    }
    watchCards();
    measureBackdrop();
  }
  showWork(route, update);
}

function openWork(anchor) {
  if (anchor.hash === location.hash) return;
  dialogTrigger = anchor;
  history.pushState({ annaOpenFrom: activePage }, '', anchor.hash);
  render({ navigation: true });
}

document.addEventListener('click', event => {
  const anchor = event.target.closest('a[href^="#"]');
  if (!anchor?.hash.includes('/work/') || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openWork(anchor);
});
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeWork();
});
window.addEventListener('catalog:updated', event => {
  if (event.detail?.photoRoute) galleryPositions.delete(event.detail.photoRoute);
  render({ update: !event.detail?.backgroundOnly });
});
window.addEventListener('hashchange', () => render({ navigation: true }));
window.addEventListener('scroll', () => { if (backdropDistance) scheduleBackdrop(); }, { passive: true });
window.addEventListener('resize', measureBackdrop, { passive: true });
document.fonts?.ready.then(measureBackdrop);
history.scrollRestoration = 'manual';
render();
