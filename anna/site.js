const motion = matchMedia('(prefers-reduced-motion: reduce)');
const dialog = document.querySelector('#work-dialog');
const workCards = [...document.querySelectorAll('[data-work-card]')];
let expanded;

function displaySlide(card, index, direction = 1) {
  const slides = [...card.querySelectorAll('[data-slide]')];
  if (!slides.length) return;
  const active = (index + slides.length) % slides.length;
  card.dataset.slideIndex = active;
  slides.forEach((slide, i) => { slide.hidden = i !== active; });
  markDot(card.querySelector('[data-gallery-dots]'), active, direction);
  if (direction && !motion.matches) animateFrame(slides[active], direction);
}

function markDot(dots, index, direction) {
  if (!dots) return;
  dots.querySelectorAll('[data-dot]').forEach(dot => {
    if (Number(dot.dataset.dot) === index) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  });
  dots.style.setProperty('--active-dot', index);
  if (!direction || motion.matches) return;
  const oval = dots.querySelector('.dot-traveler > span');
  oval.getAnimations().forEach(animation => animation.cancel());
  oval.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(1.45)', offset: .36 }, { transform: 'scaleX(1)' }],
    { duration: 340, easing: 'cubic-bezier(.24,.68,.28,1)' });
}

function animateFrame(node, direction) {
  node.getAnimations().forEach(animation => animation.cancel());
  node.animate([
    { opacity: .36, transform: 'translateX(' + direction * 12 + 'px)' },
    { opacity: 1, transform: 'none' }
  ], { duration: 260, easing: 'cubic-bezier(.22,.61,.36,1)' });
}

function step(card, direction) {
  selectFrame(card, Number(card.dataset.slideIndex || 0) + direction, direction);
}

function selectFrame(card, index, direction = Math.sign(index - Number(card.dataset.slideIndex || 0))) {
  if (!direction) return;
  displaySlide(card, index, direction);
  if (expanded?.card === card && dialog.open) renderExpanded(direction);
}

function swipe(element, onStep) {
  let touchStart;
  let mouseStart;
  let lastSwipe = 0;
  element.addEventListener('touchstart', event => {
    if (!event.target.closest('[data-gallery-dots]') && event.touches.length === 1) touchStart = event.touches[0];
  }, { passive: true });
  element.addEventListener('touchend', event => {
    if (!touchStart) return;
    swipeTo(touchStart, event.changedTouches[0]);
    touchStart = undefined;
  }, { passive: true });
  element.addEventListener('touchcancel', () => { touchStart = undefined; }, { passive: true });
  element.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button === 0 && !event.target.closest('[data-gallery-dots]')) mouseStart = event;
  });
  document.addEventListener('pointerup', event => {
    if (mouseStart?.pointerId === event.pointerId) swipeTo(mouseStart, event);
    mouseStart = undefined;
  });
  element.addEventListener('dragstart', event => event.preventDefault());
  function swipeTo(start, end) {
    const x = end.clientX - start.clientX;
    const y = end.clientY - start.clientY;
    if (Math.abs(x) < 40 || Math.abs(x) <= Math.abs(y) * 1.3) return;
    lastSwipe = Date.now();
    onStep(x < 0 ? 1 : -1);
  }
  element.addEventListener('click', event => {
    if (Date.now() - lastSwipe < 380 && !event.target.closest('[data-gallery-dots]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      lastSwipe = 0;
    }
  }, { capture: true });
}

function arrowKeys(element, onStep) {
  element.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    onStep(event.key === 'ArrowLeft' ? -1 : 1);
  });
}

function renderExpanded(direction = 0) {
  const card = expanded.card;
  const slides = [...card.querySelectorAll('[data-slide]')];
  const index = Number(card.dataset.slideIndex || 0);
  const media = slides[index].firstElementChild.cloneNode(true);
  if (media.tagName === 'IMG') {
    media.sizes = '(max-width: 720px) 100vw, 830px';
    media.loading = 'eager';
  }
  dialog.querySelector('[data-expanded-image]').replaceChildren(media);
  if (direction && !motion.matches) animateFrame(media, direction);
  markDot(dialog.querySelector('[data-gallery-dots]'), index, direction);
}

function openCard(card, trigger) {
  expanded = { card, trigger };
  const title = dialog.querySelector('#expanded-title');
  const price = dialog.querySelector('[data-expanded-price]');
  const copy = dialog.querySelector('[data-expanded-copy]');
  title.textContent = card.querySelector('[data-card-title]').textContent;
  price.textContent = card.querySelector('[data-card-price]').textContent;
  copy.replaceChildren(card.querySelector('[data-card-copy]').content.cloneNode(true));
  const track = card.querySelector('[data-gallery-dots]');
  dialog.querySelector('[data-expanded-dots]').replaceChildren(...(track ? [track.cloneNode(true)] : []));
  if (document.body.classList.contains('editing')) {
    if (!copy.querySelector('[data-item-description]')) {
      const empty = document.createElement('p');
      empty.dataset.itemDescription = '';
      empty.textContent = 'Добавить описание';
      copy.prepend(empty);
    }
    makeExpandedEditable(title, 'item', 'title', 'Изменить название');
    makeExpandedEditable(price, 'item', 'priceValue', 'Изменить цену');
    makeExpandedEditable(copy.querySelector('[data-item-description]'), 'item', 'text', 'Описание карточки');
    makeExpandedEditable(copy.querySelector('.card-note'), 'item', 'priceValue', 'Подпись под ценой');
    makeExpandedEditable(dialog.querySelector('[data-expanded-image]'), 'photo', '', 'Изменить кадр');
  }
  renderExpanded();
  dialog.showModal();
  dialog.scrollTop = 0;
}

function makeExpandedEditable(target, kind, key, label) {
  if (!target) return;
  Object.assign(target.dataset, { edit: kind, key, label, editItem: expanded.card.dataset.id, editExpanded: '' });
  target.setAttribute('role', 'button');
  target.setAttribute('aria-label', label);
  target.tabIndex = 0;
}

for (const card of workCards) {
  const media = card.querySelector('[data-card-gallery]');
  const change = direction => step(card, direction);
  media.addEventListener('click', event => {
    const dot = event.target.closest('[data-dot]');
    if (dot) selectFrame(card, Number(dot.dataset.dot));
  });
  swipe(media, change);
  arrowKeys(media, change);
  card.querySelectorAll('[data-open-card], [data-preview-card]').forEach(trigger => {
    trigger.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      openCard(card, trigger);
    });
  });
}
try {
  const stored = JSON.parse(sessionStorage.getItem('anna-editor-slides') || '{}');
  sessionStorage.removeItem('anna-editor-slides');
  workCards.forEach(card => {
    const index = Number(stored[card.dataset.id]);
    if (Number.isInteger(index)) displaySlide(card, Math.min(index, card.querySelectorAll('[data-slide]').length - 1), 0);
  });
} catch { /* Без сохранённого положения открывается первый кадр. */ }

if (dialog) {
  dialog.querySelector('[data-close-card]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    expanded?.trigger.focus({ preventScroll: true });
    expanded = undefined;
  });
  dialog.querySelector('[data-expanded-dots]').addEventListener('click', event => {
    const dot = event.target.closest('[data-dot]');
    if (dot && expanded) selectFrame(expanded.card, Number(dot.dataset.dot));
  });
  swipe(dialog.querySelector('[data-expanded-gallery]'), direction => step(expanded.card, direction));
  arrowKeys(dialog, direction => step(expanded.card, direction));
}

const animatedCards = [...document.querySelectorAll('.work-card')].map((card, index) => ({
  card, inner: card.querySelector('.work-card-inner'), direction: index % 2 ? 1 : -1
}));
let frameId = 0;
const clamp = value => Math.min(1, Math.max(0, value));
const ease = value => value * value * (3 - 2 * value);

function updateCards() {
  frameId = 0;
  for (const { card, inner, direction } of animatedCards) {
    if (motion.matches || document.body.classList.contains('editing') || card.contains(document.activeElement) && card.matches(':focus-within') && document.activeElement.matches(':focus-visible')) {
      inner.style.opacity = '';
      inner.style.transform = '';
      continue;
    }
    const { top, bottom, height } = card.getBoundingClientRect();
    const entryDistance = Math.min(height * .55, 180, innerHeight * .31);
    const entry = ease(clamp((innerHeight + 15 - top) / entryDistance));
    const exitDistance = Math.min(height * .4, 170);
    const exit = ease(clamp((exitDistance - bottom) / exitDistance));
    inner.style.opacity = String(entry * (1 - exit));
    inner.style.transform = 'translate3d(' + (direction * exit * 70) + 'px,' + ((1 - entry) * 54 - exit * 15) + 'px,0)';
  }
}

function scheduleCards() {
  if (!frameId) frameId = requestAnimationFrame(updateCards);
}
if (animatedCards.length) {
  addEventListener('scroll', scheduleCards, { passive: true });
  addEventListener('resize', scheduleCards);
  document.addEventListener('focusin', scheduleCards);
  document.addEventListener('focusout', scheduleCards);
  motion.addEventListener('change', scheduleCards);
  scheduleCards();
}

document.querySelector('[data-back-top]')?.addEventListener('click', event => {
  event.preventDefault();
  if (motion.matches) return window.scrollTo({ top: 0, behavior: 'instant' });
  const from = scrollY;
  if (!from) return;
  const started = performance.now();
  function move(now) {
    const progress = clamp((now - started) / 460);
    window.scrollTo({ top: from * (1 - ease(progress)), behavior: 'instant' });
    if (progress < 1 && !motion.matches) requestAnimationFrame(move);
  }
  requestAnimationFrame(move);
});

for (const link of document.querySelectorAll('[data-enter-edit], [data-exit-edit]')) {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    sessionStorage.setItem('anna-scroll', String(scrollY));
  });
}
const previousScroll = sessionStorage.getItem('anna-scroll');
if (previousScroll !== null) {
  sessionStorage.removeItem('anna-scroll');
  requestAnimationFrame(() => window.scrollTo({ top: Number(previousScroll), behavior: 'instant' }));
}
