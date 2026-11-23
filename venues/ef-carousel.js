const initialized = new WeakSet();
const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? {matches:true};
const escapeAttribute = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[character]);

function localAsset(value) {
  return typeof value === 'string' && /^\/(?:assets|media)\/[A-Za-z0-9_./-]+$/.test(value) ? value : '';
}

function imageMarkup(image, eager) {
  const variants = Object.entries(image.variants || {}).filter(([width, url]) =>
    /^\d{2,4}$/.test(width) && localAsset(url));
  const srcset = variants.length
    ? ' srcset="' + variants.map(([width, url]) => url + ' ' + width + 'w').join(', ') + '"'
      + ' sizes="(max-width: 720px) 95vw, (max-width: 1080px) 70vw, 960px"'
    : '';
  return `<img class="venue-carousel-image" src="${localAsset(image.src)}"${srcset}
    alt="${escapeAttribute(image.alt || '')}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" draggable="false"
    data-caption="${escapeAttribute(image.caption || '')}">`;
}

/** Возвращает самостоятельную разметку галереи для безопасных локальных изображений. */
export function renderGallery(images = [], options = {}) {
  const pictures = Array.isArray(images) ? images.filter(image => localAsset(image?.src)) : [];
  return carouselMarkup(pictures.map((image, index) => ({
    html:imageMarkup(image, index < 2 || index === pictures.length - 1), caption:image.caption,
  })), options);
}

export function renderCards(cards = [], options = {}) {
  return carouselMarkup(cards.map(html => ({html, caption:''})), {...options, className:'card-carousel ' + (options.className || '')});
}

function carouselMarkup(slides, {id, className = '', label = 'Фотографии пространства'} = {}) {
  if (!slides.length) return '';
  const multiple = slides.length > 1;
  const cardCarousel = className.includes('card-carousel');
  const itemName = cardCarousel ? 'Карточка' : 'Кадр';
  return `<figure class="venue-carousel ${escapeAttribute(className)}" data-venue-carousel
    ${id ? 'id="' + escapeAttribute(id) + '"' : ''} aria-label="${escapeAttribute(label)}">
    <div class="venue-carousel-viewport" ${multiple ? 'tabindex="0" role="group" aria-label="Листайте свайпом, перетаскиванием или клавишами со стрелками"' : ''}>
      ${slides.map((slide,index) => `<div class="venue-carousel-slide" data-caption="${escapeAttribute(slide.caption || '')}"${index ? ' hidden' : ''}>${slide.html}</div>`).join('')}
    </div>
    ${multiple ? `<div class="venue-carousel-dots" role="group" aria-label="Кадры">
      <span class="venue-carousel-traveler" aria-hidden="true"><span></span></span>
      ${slides.map((_, index) => `<button type="button" aria-label="${itemName} ${index + 1}"${index ? '' : ' aria-current="true"'}></button>`).join('')}
    </div>` : ''}
    <figcaption class="venue-carousel-caption"${slides[0].caption ? '' : ' hidden'}>${escapeAttribute(slides[0].caption || '')}</figcaption>
    <span data-gallery-announcement class="venue-carousel-announce" role="status"></span>
  </figure>`;
}

function bindGallery(gallery) {
  if (initialized.has(gallery)) return;
  initialized.add(gallery);
  const viewport = gallery.querySelector('.venue-carousel-viewport');
  const images = [...viewport.children];
  if (images.length < 2) return;
  const dots = gallery.querySelector('.venue-carousel-dots');
  const buttons = [...dots.querySelectorAll('button')];
  const traveler = dots.querySelector('.venue-carousel-traveler span');
  const caption = gallery.querySelector('figcaption');
  const announcement = gallery.querySelector('[data-gallery-announcement]');
  dots.style.setProperty('--dot-count', images.length);
  let index = 0;
  let gesture;
  let animation;
  let outgoing;
  let pulse;
  let suppressClick = 0;

  const normalize = position => (position + images.length) % images.length;
  const clearFrames = () => {
    animation?.cancel();
    outgoing?.cancel();
    animation = undefined;
    outgoing = undefined;
    images.forEach((image, number) => {
      image.hidden = number !== index;
      image.style.removeProperty('transform');
      image.style.removeProperty('z-index');
      image.removeAttribute('aria-hidden');
      image.inert = number !== index;
    });
  };

  function select(position, direction, distance = 0) {
    const next = normalize(position);
    if (next === index) {
      clearFrames();
      return;
    }
    const previous = images[index];
    const target = images[next];
    index = next;
    clearFrames();
    dots.style.setProperty('--active-dot', String(index));
    buttons.forEach((button, number) => {
      if (number === index) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    caption.textContent = target.dataset.caption;
    caption.hidden = !caption.textContent;
    announcement.textContent = `${gallery.classList.contains('card-carousel')?'Карточка':'Фото'} ${index + 1} из ${images.length}`;
    if (motion.matches) return;

    pulse?.cancel();
    pulse = traveler.animate([{scale:'1 1'}, {scale:'1.55 .87', offset:.42}, {scale:'1 1'}],
      {duration:325, easing:'cubic-bezier(.24,.68,.28,1)'});
    const width = viewport.clientWidth;
    previous.hidden = false;
    previous.inert = true;
    previous.setAttribute('aria-hidden', 'true');
    const settings = {duration:290, easing:'cubic-bezier(.22,.7,.26,1)'};
    outgoing = previous.animate([
      {transform:`translateX(${distance}px)`},
      {transform:`translateX(${-direction * width}px)`},
    ], settings);
    target.style.zIndex = '1';
    animation = target.animate([
      {transform:`translateX(${direction * width + distance}px)`},
      {transform:'translateX(0)'},
    ], settings);
    animation.onfinish = clearFrames;
  }

  function onKey(event) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const onDot = event.currentTarget === dots;
    const direction = event.key === 'ArrowLeft' || event.key === 'Home' ? -1 : 1;
    const position = event.key === 'Home' ? 0 : event.key === 'End' ? images.length - 1 : index + direction;
    select(position, direction);
    if (onDot) buttons[index].focus();
    else if (event.target !== viewport) viewport.focus({preventScroll:true});
  }

  viewport.addEventListener('keydown', onKey);
  viewport.addEventListener('click', event => {
    if (Date.now() >= suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  dots.addEventListener('keydown', onKey);
  buttons.forEach((button, number) =>
    button.addEventListener('click', () => select(number, number < index ? -1 : 1)));

  viewport.addEventListener('pointerdown', event => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    clearFrames();
    gesture = {id:event.pointerId, x:event.clientX, y:event.clientY, horizontal:false, distance:0};
  });
  viewport.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const x = event.clientX - gesture.x;
    const y = event.clientY - gesture.y;
    if (!gesture.horizontal) {
      if (Math.abs(y) > 12 && Math.abs(y) > Math.abs(x)) {
        gesture = undefined;
        return;
      }
      if (Math.abs(x) < 12) return;
      gesture.horizontal = true;
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('is-dragging');
    }
    const width = viewport.clientWidth;
    const direction = x > 0 ? -1 : 1;
    const offset = Math.min(width, Math.max(-width, x));
    const neighbor = normalize(index + direction);
    gesture.distance = Math.abs(x);
    images.forEach((image, number) => {
      image.hidden = number !== index && (number !== neighbor || motion.matches);
      image.inert = number !== index;
      if (number === neighbor) image.setAttribute('aria-hidden', 'true');
      else image.removeAttribute('aria-hidden');
    });
    if (!motion.matches) {
      images[index].style.transform = `translateX(${offset}px)`;
      images[neighbor].style.transform = `translateX(${direction * width + offset}px)`;
    }
  });
  viewport.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const {horizontal, distance} = gesture;
    const offset = event.clientX - gesture.x;
    gesture = undefined;
    viewport.classList.remove('is-dragging');
    if (horizontal) suppressClick = Date.now() + 350;
    if (horizontal && Math.abs(offset) >= Math.min(76, viewport.clientWidth * .19)) {
      const direction = offset > 0 ? -1 : 1;
      select(index + direction, direction, Math.max(-viewport.clientWidth, Math.min(viewport.clientWidth, offset)));
    } else {
      clearFrames();
      if (horizontal && distance && !motion.matches) {
        images[index].animate([{transform:`translateX(${offset}px)`}, {transform:'translateX(0)'}],
          {duration:175, easing:'ease-out'});
      }
    }
  });

  function cancelGesture() {
    if (!gesture) return;
    gesture = undefined;
    viewport.classList.remove('is-dragging');
    clearFrames();
  }
  viewport.addEventListener('pointercancel', cancelGesture);
  viewport.addEventListener('lostpointercapture', event => {
    // На телефоне исходная дочерняя карточка отдаёт свой неявный захват области свайпа.
    if (event.target === viewport) cancelGesture();
  });
  viewport.addEventListener('pointerleave', () => {
    if (!gesture?.horizontal) cancelGesture();
  });
  viewport.addEventListener('dragstart', event => event.preventDefault());
}

export function bindGalleries(root = document) {
  if (root.matches?.('[data-venue-carousel]')) bindGallery(root);
  root.querySelectorAll('[data-venue-carousel]').forEach(bindGallery);
}
