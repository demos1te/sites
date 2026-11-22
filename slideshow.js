/* Слайд-шоу «Что мы собирали»: квадратные карточки, автопрокрутка, точки, стрелки по кругу */
(() => {
  const root = document.querySelector('[data-works-carousel]');
  if (!root) return;
  const track = root.querySelector('.gallery');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let items = [], dots = [], idx = 0, pages = 1, step = 1, timer = null, holdUntil = 0, visible = false, raf = 0;

  const dotsBox = document.createElement('div');
  dotsBox.className = 'works-dots';
  dotsBox.setAttribute('aria-label', 'Выбор фото');
  root.after(dotsBox);

  const measure = () => {
    if (items.length < 2) { step = 1; pages = 1; return; }
    step = items[1].offsetLeft - items[0].offsetLeft;
    const perView = Math.max(1, Math.round((track.clientWidth + (step - items[0].offsetWidth)) / step - 0.01));
    pages = Math.max(1, items.length - perView + 1);
  };
  const mark = (i) => {
    items.forEach((el, k) => el.classList.toggle('is-active', k === i));
    dots.forEach((d, k) => { d.classList.toggle('is-on', k === i); d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
  };
  const go = (i, smooth = true) => {
    if (items.length < 2) return;
    idx = (i + pages) % pages;
    track.scrollTo({ left: idx * step, behavior: smooth && !reduce ? 'smooth' : 'auto' });
    mark(idx);
  };
  const hold = (ms = 7000) => { holdUntil = Date.now() + ms; };

  const buildDots = () => {
    dotsBox.innerHTML = '';
    dots = Array.from({ length: pages }, (_, k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', 'Фото ' + (k + 1));
      b.addEventListener('click', () => { hold(); go(k); });
      dotsBox.appendChild(b); return b;
    });
    dotsBox.hidden = pages < 2;
  };
  const build = () => {
    items = [...track.querySelectorAll('.gallery__item')];
    measure(); buildDots();
    root.classList.toggle('is-ready', items.length > 1);
    if (items.length > 1) { idx = Math.min(idx, pages - 1); go(idx, false); }
  };

  /* карточки рисует app.js чуть позже — ждём их появления */
  new MutationObserver(build).observe(track, { childList: true });
  if (track.children.length) build();

  track.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; if (items.length < 2) return;
      idx = Math.min(pages - 1, Math.max(0, Math.round(track.scrollLeft / step)));
      mark(idx);
    });
  }, { passive: true });

  /* стрелки идут по кругу и ставят автопрокрутку на паузу */
  const arrow = (sel, d) => root.querySelector(sel)?.addEventListener('click', (e) => {
    e.stopImmediatePropagation(); hold(); go(idx + d);
  }, true);
  arrow('[data-gallery-prev]', -1); arrow('[data-gallery-next]', 1);

  ['pointerdown', 'touchstart', 'wheel', 'keydown', 'focusin'].forEach((ev) => track.addEventListener(ev, () => hold(9000), { passive: true }));
  root.addEventListener('mouseenter', () => hold(3000));

  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: .35 }).observe(root);
  else visible = true;

  if (!reduce) timer = setInterval(() => {
    if (!visible || document.hidden || items.length < 2 || Date.now() < holdUntil) return;
    if (document.querySelector('dialog[open]')) return;
    go(idx + 1);
  }, 3600);
  addEventListener('resize', () => { measure(); buildDots(); go(Math.min(idx, pages - 1), false); });
})();

/* фото главного экрана дублируется размытым фоном (CSS-переменная --hero) и подхватывает смену фото из админки */
(() => {
  const g = document.querySelector('.garden'), img = g && g.querySelector('.garden__img');
  if (!img) return;
  const sync = () => { const s = img.getAttribute('src'); if (s) g.style.setProperty('--hero', 'url("' + s + '")'); };
  sync(); new MutationObserver(sync).observe(img, { attributes: true, attributeFilter: ['src'] });
})();
