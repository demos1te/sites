/* Поведение сайта: карусель, фильтры каталога, конструктор букета, отправка заказа.
   Все данные — из window.SHOP (собирается build.py из shop.config.json). */
(async () => {
  const SHOP = window.SHOP;
  const STAFF = SHOP.orders?.staff || 'флорист';
  const QUOTE_ONLY = !!SHOP.builder?.quoteOnly;  // кто отвечает покупателю: флорист или администратор
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const rub = (n) => Math.round(n).toLocaleString('ru-RU').replace(/\s/g, ' ') + ' ₽';
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Сайт с админкой: свежие данные из data/live.json поверх собранных ---------- */
  if (SHOP.live) {
    // 404 — сотрудник ещё ничего не сохранял; любая другая ошибка — данные не дошли, сохранять из админки нельзя (затрёт правки)
    const live = await fetch('data/live.json?' + Date.now(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : r.status === 404 ? {} : null)).catch(() => null);
    const base = JSON.parse(JSON.stringify(SHOP));
    SHOP.__liveOk = !!live; SHOP.__rev = (live && live.rev) || '';
    if (live) Object.assign(SHOP, live);
    // Новые пункты из обновлений сайта (новая упаковка, раздел и т. п.) добавляем к сохранённым спискам сотрудника,
    // кроме тех, что сотрудник удалил сам (они записаны в removed)
    for (const k of ['wrapping', 'ribbons', 'extras', 'shapes', 'greens', 'flowers', 'custom', 'balloons', 'toys', 'refCats', 'floristOcc', 'floristTone']) {
      if (!live || !Array.isArray(live[k]) || !Array.isArray(base[k])) continue;
      const have = new Set(live[k].map((x) => String(x.id))), gone = new Set(((Array.isArray(live.removed) ? null : live.removed)?.[k] || []).map(String));
      base[k].forEach((x, i) => { if (!have.has(String(x.id)) && !gone.has(String(x.id))) SHOP[k].splice(Math.min(i, SHOP[k].length), 0, x); });
    }
    SHOP.flowers.forEach((f) => { f.shades = f.shades || []; });
    const fresh = SHOP.staticClone ? [] : await fetch('api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"reviews"}' })
      .then((r) => (r.ok ? r.json() : [])).catch(() => []);
    if (Array.isArray(fresh)) {
      const have = new Set([...(SHOP.reviews || []).map((r) => r.id), ...(SHOP.reviewsHidden || [])]);
      SHOP.reviews = [...fresh.filter((r) => !have.has(r.id)), ...(SHOP.reviews || [])];
    }
  }

  /* ---------- Каждый заход и обновление начинаются сверху, чтобы была видна анимация первого экрана ---------- */
  if ($('.garden')) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    window.scrollTo(0, 0);
  }

  /* ---------- Первый экран: слова растягиваются ровно на ширину экрана ---------- */
  const fitWords = () => $$('[data-fit]').forEach((w) => {
    const box = w.parentElement, cs = getComputedStyle(box);
    const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    w.style.transition = 'none';  // при «уменьшить анимацию» размер менялся бы с задержкой, и замер ломался
    w.style.fontSize = '100px';
    const size = Math.min(100 * avail * 0.97 / w.offsetWidth, window.innerWidth >= 1000 ? 300 : 999);
    w.style.fontSize = size.toFixed(1) + 'px';
  });
  fitWords();
  (document.fonts?.ready || Promise.resolve()).then(fitWords);
  window.addEventListener('resize', fitWords);

  /* ---------- Бесконечные ленты фото: вторую половину дописываем здесь, а не в HTML ---------- */
  $$('[data-dup]').forEach((r) => { r.innerHTML += r.innerHTML; });

  /* ---------- Цветы поштучно: «В букет» добавляет стебель в конструктор ---------- */
  $$('[data-stem]').forEach((b) => b.addEventListener('click', () => {
    $(`[data-flower="${b.dataset.stem}"] .pick__photo`)?.click();
    $('#builder')?.scrollIntoView({ behavior: 'smooth' });
  }));

  /* ---------- Круглосуточный: часы по Москве ---------- */
  const clock = $('[data-clock]');
  if (clock) {
    const tick = () => {
      const t = new Date(Date.now() + (new Date().getTimezoneOffset() + 180) * 60000);
      const p2 = (n) => String(n).padStart(2, '0');
      clock.innerHTML = p2(t.getHours()) + '<span>:</span>' + p2(t.getMinutes());
    };
    if (!document.documentElement.dataset.capture) { tick(); setInterval(tick, 10000); }
  }

  /* ---------- Сторис: фото сменяются сами, нажатие листает ---------- */
  const st = $('[data-stories]');
  if (st) {
    const pics = $$('.stories__img', st), bars = $$('.stories__bars span', st);
    let cur = 0, timer;
    const show = (i) => {
      cur = (i + pics.length) % pics.length;
      pics.forEach((p, k) => p.classList.toggle('is-on', k === cur));
      bars.forEach((b, k) => { b.classList.toggle('is-done', k < cur); b.classList.remove('is-run'); });
      void bars[cur].offsetWidth; bars[cur].classList.add('is-run');
      clearTimeout(timer); timer = setTimeout(() => show(cur + 1), 5000);
    };
    $('[data-story-next]', st).addEventListener('click', () => show(cur + 1));
    $('[data-story-prev]', st).addEventListener('click', () => show(cur - 1));
    show(0);
  }

  /* ---------- Рассказ: фото меняется вместе с фразой в центре экрана ---------- */
  const story = $('[data-story]');
  if (story) {
    const steps = $$('.story__step', story), pics = $$('.story__img', story);
    const onStory = () => {
      const mid = window.innerHeight * 0.55;
      let best = 0, dist = Infinity;
      steps.forEach((s, i) => { const r = s.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - mid); if (d < dist) { dist = d; best = i; } });
      steps.forEach((s, i) => s.classList.toggle('is-active', i === best));
      pics.forEach((p, i) => p.classList.toggle('is-on', i === best));
    };
    window.addEventListener('scroll', onStory, { passive: true });
    onStory();
  }

  /* ---------- Каталог: фильтр по поводу, полки по цене ---------- */
  $$('[data-filter-occasion]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-filter-occasion]').forEach((x) => x.classList.toggle('is-active', x === b));
    const occ = b.dataset.filterOccasion;
    let total = 0;
    $$('[data-shelf]').forEach((shelf) => {
      let shown = 0;
      $$('.product', shelf).forEach((p) => {
        const ok = !occ || p.dataset.occasions.split(' ').includes(occ);
        p.hidden = !ok;
        if (ok) shown++;
      });
      shelf.hidden = !shown;
      $('[data-track]', shelf).scrollLeft = 0;
      total += shown;
    });
    const empty = $('[data-catalog-empty]');
    if (empty) empty.hidden = total > 0;
  }));

  /* ---------- Галерея ---------- */
  const lb = $('[data-lightbox-dialog]');
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lightbox]');
    if (!b || e.target.closest('.ed') || SHOP.__edit) return;
    const im = $('[data-lightbox-img]');
    im.src = b.dataset.lightbox; im.alt = b.dataset.alt || '';
    lb.showModal();
  });
  lb?.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });

  /* ---------- Тост ---------- */
  const toast = (msg) => {
    const t = $('[data-toast]');
    const host = document.querySelector('dialog[open]') || document.body;  // окно заказа лежит поверх всего — показываем внутри него
    if (t.parentElement !== host) host.append(t);
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200);
  };

  /* ---------- Сайт с админкой: всё ниже рисуется из SHOP и перерисовывается после правок ---------- */
  // в режиме правки (SHOP.__edit) видно и скрытое, чтобы его можно было вернуть
  const shown = (x) => SHOP.__edit || x.on !== false;
  // букет из удалённой вкладки показываем в первой, чтобы он не пропал с сайта
  const catOf = (x) => (SHOP.refCats.some((c) => c.id === x.cat) ? x.cat : SHOP.refCats[0]?.id);
  const off = (x) => (x.on === false ? ' is-off' : '');

  // наборы шрифтов для выбора в админке (файлы лежат на сайте, assets/fonts)
  const FONTS = {
    garden: ['Cormorant Garamond', 'Jost'], playfair: ['Playfair Display', 'Manrope'], script: ['Marck Script', 'Jost'],
    bold: ['Unbounded', 'Manrope'], soft: ['Comfortaa', 'Nunito'], lora: ['Lora', 'Nunito'],
  };
  window.SITE_FONTS = FONTS;
  window.SITE_FONT_OF = (n) => fontOf(n);
  const LOGO_FONTS = { vibes: 'Great Vibes', marck: 'Marck Script', bad: 'Bad Script', heading: '' };
  window.SITE_LOGO_FONTS = LOGO_FONTS;
  function applyFont() {
    const lf = SHOP.settings?.logoFont;
    if (lf && lf in LOGO_FONTS) document.documentElement.style.setProperty('--font-logo', LOGO_FONTS[lf] ? `"${LOGO_FONTS[lf]}", cursive` : 'var(--font-heading)');
    const f = FONTS[SHOP.settings?.font];
    if (!f) return;
    document.documentElement.style.setProperty('--font-heading', `"${f[0]}", Georgia, serif`);
    document.documentElement.style.setProperty('--font-body', `"${f[1]}", system-ui, sans-serif`);
  }

  // Любой текст страницы можно поменять в режиме правки. У текстов без своего ключа (data-t) ключ — их исходный текст:
  // так правка не «переедет» на другой текст, если шаблон потом поменяется. Запоминаем исходники до первой отрисовки.
  const SKIP = '[data-ed], [data-sum], [data-preview-hint], [data-toast], [data-qty], [data-badge], [data-lines], script, style, svg, select, textarea, output, .ed, .ed-add';
  const isLeaf = (el) => [...el.children].every((c) => c.tagName === 'BR') && el.textContent.trim().length > 1;
  $$('main h1, main h2, main h3, main h4, main p, main dt, main dd, main span, main a, main button, main small, main b, main label > span, header a, header span, .quicknav a, footer p, footer a, dialog h2, dialog p, dialog label > span, dialog button, .catview h2, .catview h3, .topnote, .callbar a, .buildbar button, .summary dt')
    .forEach((el) => { if (!el.dataset.t && !el.closest(SKIP) && isLeaf(el)) el.dataset.ta = el.textContent.trim(); });
  const fontOf = (name) => (name ? `"${name}", ${/Script|Vibes/.test(name) ? 'cursive' : 'serif'}` : '');
  function setText(el, v) {
    if (v == null) return;
    // у главного заголовка буквы анимируются по одной — пересобираем их
    const h = el.matches('[data-name-title]') ? el : null;
    if (h) { $('.garden__w', h).innerHTML = [...v].map((c, i) => `<span style="animation-delay:${(.25 + .06 * i).toFixed(2)}s">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join(''); h.setAttribute('aria-label', v); return; }
    el.textContent = v;
  }

  function renderTexts() {
    applyFont();
    const T = SHOP.texts || {}, F = SHOP.textFonts || {};
    $$('[data-t]').forEach((el) => { if (T[el.dataset.t] != null) setText(el, T[el.dataset.t]); el.style.fontFamily = fontOf(F[el.dataset.t]); });
    $$('[data-ta]').forEach((el) => { const k = 'a:' + el.dataset.ta; if (T[k] != null) el.textContent = T[k]; el.style.fontFamily = fontOf(F[k]); });
    const nm = $('[data-name-title]');
    if (nm) { if (T['shop.name'] != null) setText(nm, T['shop.name']); nm.style.fontFamily = fontOf(F['shop.name']); }
    // Фото от админа: старое (из сборки) держим скрытым, пока новое не скачается, — иначе браузер
    // показывает старое, пока грузит новое
    const swapPhoto = (im, p) => {
      if (!p || im.getAttribute('src') === p) return;
      im.style.opacity = '0';
      const n = new Image();
      n.onload = () => {
        im.removeAttribute('srcset'); im.src = p;
        // показываем, только когда новое фото уже отрисовано, иначе на кадр проступает старое
        (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { im.style.opacity = ''; });
      };
      n.onerror = () => { im.style.opacity = ''; };
      n.src = p;
    };
    $$('[data-loc]').forEach((im) => swapPhoto(im, SHOP.locPhotos?.[+im.dataset.loc]));
    $$('[data-hero]').forEach((im) => swapPhoto(im, SHOP.heroPhotos?.[+im.dataset.hero]));
  }

  /* ---------- Витрина и «Соберём для вас» ---------- */
  const COLL = { ref: 'refs', show: 'showcase', ball: 'balloons', toy: 'toys' };
  const card = (x, kind) => `
    <li class="product${off(x)}" data-ed="${COLL[kind]}:${esc(x.id)}">
      <div class="product__photo"><img src="${esc(x.photo)}" alt="${esc(x.name || 'Букет')}" loading="lazy" width="400" height="500">${kind === 'show' && x.video ? `<video class="product__video" data-src="${esc(x.video)}" muted playsinline loop preload="none" aria-hidden="true"></video>` : ''}</div>
      ${kind !== 'show' && x.name ? `<h4 class="product__name">${esc(x.name)}</h4>` : ''}
      <div class="product__foot">
        <span class="product__price">${x.price == null ? 'цену подскажем' : (kind === 'ref' && x.from ? 'от ' : '') + rub(x.price)}</span>
        ${kind === 'ball' || kind === 'toy' ? `<button class="btn btn--small" data-addon="${COLL[kind]}:${esc(x.id)}">В букет</button>` : ''}
        <button class="btn btn--small" data-order-item="${kind}:${esc(x.id)}">${kind === 'ref' ? 'Хочу такой' : kind === 'show' ? 'Заказать' : 'Отдельно'}</button>
      </div>
    </li>`;
  const thous = (n) => (n / 1000).toLocaleString('ru-RU');
  const budgetName = ([a, b]) => (b ? (a ? `${thous(a)}–${thous(b)} тыс.` : `до ${thous(b)} тыс.`) : `от ${thous(a)} тыс.`);
  const budgetText = ([a, b]) => (b ? (a ? `${rub(a)}–${rub(b)}` : `до ${rub(b)}`) : `от ${rub(a)}`);
  const chip = (attr, v, n, on, ed) => `<button class="chip${on ? ' is-active' : ''}" ${attr}="${esc(v)}"${ed ? ` data-ed="${ed}"` : ''}>${esc(n)}</button>`;
  const rf = { cat: null, budget: '', ball: '' };
  const fl = { budget: null, occ: '', tone: '' };

  let showcaseObserver;
  function initShowcaseVideos(sc) {
    showcaseObserver?.disconnect();
    const videos = [...sc.querySelectorAll('.product__video')];
    if (!videos.length) return;
    showcaseObserver = new IntersectionObserver(entries => entries.forEach(({target, isIntersecting}) => {
      if (isIntersecting) {
        if (!target.src) target.src = target.dataset.src;
        target.play().then(() => target.classList.add('is-playing')).catch(() => {});
      } else { target.pause(); target.classList.remove('is-playing'); }
    }), {rootMargin:'100px 0px',threshold:.1});
    videos.forEach(v => showcaseObserver.observe(v));
  }

  function renderShop() {
    const sc = $('[data-showcase]');
    if (sc) {
      const items = SHOP.showcase.filter(shown);
      sc.innerHTML = items.map((x) => card(x, 'show')).join('');
      initShowcaseVideos(sc);
      $('[data-showcase-empty]').hidden = items.length > 0;
    }
    if ($('[data-ref-list]')) {
      // пустые вкладки посетителям не показываем, в админке видны все
      const cats = SHOP.__edit ? SHOP.refCats : SHOP.refCats.filter((c) => SHOP.refs.some((x) => shown(x) && catOf(x) === c.id));
      if (!cats.some((c) => c.id === rf.cat)) rf.cat = cats[0]?.id;
      $('[data-ref-cats]').innerHTML = cats.map((c) => chip('data-cat', c.id, c.name, c.id === rf.cat, `refCats:${c.id}`)).join('');
      $('[data-ref-budget]').innerHTML = chip('data-budget', '', 'Любой бюджет', rf.budget === '')
        + SHOP.budgets.map((b, i) => chip('data-budget', i, budgetName(b), String(i) === rf.budget)).join('');
      if ($('[data-florist-budget]')) {  // блок «На вкус флориста» можно отключить (noFlorist)
      $('[data-florist-budget]').innerHTML = SHOP.budgets.map((b, i) => chip('data-fb', i, budgetName(b), i === fl.budget)).join('');
      // повод и гамма: необязательные кнопки, список правится в админке
      for (const [key, box, any] of [['occ', 'floristOcc', 'Любой повод'], ['tone', 'floristTone', 'Любая гамма']]) {
        const list = (SHOP[box] || []).filter(shown);
        if (!list.some((x) => x.name === fl[key])) fl[key] = '';
        $(`[data-florist-${key}]`).innerHTML = (list.length ? chip(`data-${key}`, '', any, !fl[key]) : '')
          + list.map((x) => chip(`data-${key}`, x.name, x.name, x.name === fl[key], `${box}:${x.id}`).replace('class="chip', `class="chip${off(x)}`)).join('');
      }
      }
      drawRefs();
    }
    // шары и игрушки: пункты меню (пустой каталог не показываем) и отдельный экран
    const anyAddon = ['balloons', 'toys'].some((id) => (SHOP[id] || []).some(shown));
    $$('[data-nav="addons"]').forEach((a) => (a.hidden = !anyAddon && !SHOP.__edit));
    if (cat.open) drawCat();
    const rv = $('[data-reviews]');
    if (rv) rv.innerHTML = (SHOP.reviews || []).filter(shown).sort((a, b) => !!(b.photos || []).length - !!(a.photos || []).length).map((r) => `
      <li class="quote${off(r)}" data-ed="reviews:${esc(r.id)}">
        <blockquote class="${r.text.length > 260 ? 'is-long' : ''}">${esc(r.text)}</blockquote>
        ${(r.photos || []).length ? `<div class="quote__photos">${r.photos.map((u) => `<button data-lightbox="${esc(u.replace('{size}', 'XXXL'))}" aria-label="Фото к отзыву"><img src="${esc(u.replace('{size}', 'L'))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
        <p class="quote__by"><strong>${esc(r.author)}</strong>${r.date ? new Date(r.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</p>
      </li>`).join('');
    const cs = $('[data-custom]');
    if (cs) {
      const LINK = { 'Конструктор': '#builder', 'В наличии': '#showcase', 'Соберём для вас': '#refs', 'Доставка': '#delivery', 'Контакты': '#contacts', 'Отзывы': '#reviews' };
      const href = (x) => (x.link === 'WhatsApp' ? `https://wa.me/${SHOP.contacts.whatsapp}` : x.link === 'Позвонить' ? `tel:${SHOP.contacts.phoneRaw}` : LINK[x.link] || '');
      const list = (SHOP.custom || []).filter(shown);
      cs.innerHTML = list.map((x) => `
        <section class="custom${off(x)}${x.photo ? ' has-photo' : ''}" id="s-${esc(x.id)}" data-ed="custom:${esc(x.id)}">
          <div class="wrap custom__grid">
            ${x.photo ? `<img class="custom__img" src="${esc(x.photo)}" alt="" loading="lazy">` : ''}
            <div>
              <h2 class="h2" data-f="custom:${esc(x.id)}:name" style="font-family:${fontOf(x.fonts?.name)}">${esc(x.name || '')}</h2>
              ${x.text || SHOP.__edit ? `<p class="lead custom__text" data-f="custom:${esc(x.id)}:text" style="font-family:${fontOf(x.fonts?.text)}">${esc(x.text || (SHOP.__edit ? 'Нажмите, чтобы добавить текст' : ''))}</p>` : ''}
              ${x.btn ? (x.link === 'Шары и игрушки' ? `<button class="btn btn--green" data-open-cat data-f="custom:${esc(x.id)}:btn">${esc(x.btn)}</button>`
                : `<a class="btn btn--green" href="${esc(href(x) || '#')}"${/^https?:/.test(href(x)) ? ' target="_blank" rel="noopener"' : ''} data-f="custom:${esc(x.id)}:btn">${esc(x.btn)}</a>`) : ''}
            </div>
          </div>
        </section>`).join('');
      $$('[data-custom-nav]').forEach((a) => a.remove());
      const qn = $('[data-quicknav] .quicknav__track'), before = qn && $('a[href="#builder"], a[href="#reviews"]', qn);  // пункт — рядом с разделом, перед конструктором
      list.filter((x) => x.on !== false && x.name).forEach((x) => {
        const a = Object.assign(document.createElement('a'), { href: `#s-${x.id}`, textContent: x.name });
        a.dataset.customNav = '';
        if (qn) qn.insertBefore(a, before || null);
      });
    }
    const wk = $('[data-works]');
    if (wk) {
      wk.innerHTML = SHOP.works.filter(shown).map((w) => `
      <li class="gallery__item${off(w)}" data-ed="works:${esc(w.id)}"><button class="gallery__btn" data-lightbox="${esc(w.photo)}" aria-label="Открыть фото">
        <img src="${esc(w.photo)}" alt="Работа флористов" loading="lazy" decoding="async"></button></li>`).join('');
      const carousel = $('[data-works-carousel]');
      $('[data-gallery-prev]', carousel)?.addEventListener('click', () => wk.scrollBy({left: -wk.clientWidth * .82, behavior: 'smooth'}));
      $('[data-gallery-next]', carousel)?.addEventListener('click', () => wk.scrollBy({left: wk.clientWidth * .82, behavior: 'smooth'}));
    }
  }

  // экран «Шары и игрушки»: сначала все шары, под ними все игрушки
  const cat = { open: false };
  function drawCat() {
    const v = $('[data-catview]');
    const balls = (SHOP.balloons || []).filter(shown);
    const kinds = [...new Set(balls.map((x) => x.kind).filter(Boolean))];
    if (!kinds.includes(rf.ball)) rf.ball = '';
    $('[data-balloon-kinds]').innerHTML = kinds.length > 1 ? chip('data-kind', '', 'Все', !rf.ball) + kinds.map((k) => chip('data-kind', k, k, k === rf.ball)).join('') : '';
    $('[data-cat-list="balloons"]', v).innerHTML = balls.filter((x) => !rf.ball || x.kind === rf.ball).map((x) => card(x, 'ball')).join('');
    $('[data-cat-list="toys"]', v).innerHTML = (SHOP.toys || []).filter(shown).map((x) => card(x, 'toy')).join('');
    $('[data-cat-group="balloons"]', v).hidden = !balls.length && !SHOP.__edit;
    $('[data-cat-group="toys"]', v).hidden = !(SHOP.toys || []).some(shown) && !SHOP.__edit;
  }
  function openCat() {
    cat.open = true; rf.ball = '';
    $('[data-catview]').hidden = false; document.body.style.overflow = 'hidden';
    drawCat(); $('[data-catview]').scrollTop = 0;
    window.SITE?.after?.();
  }
  function closeCat() { cat.open = false; $('[data-catview]').hidden = true; document.body.style.overflow = ''; window.SITE?.after?.(); }

  function drawRefs() {
    if (rf.budget !== '' && !SHOP.budgets[rf.budget]) rf.budget = '';  // диапазон могли убрать в админке
    const [lo, hi] = rf.budget === '' ? [0, 0] : SHOP.budgets[rf.budget];
    const items = SHOP.refs.filter((x) => shown(x) && catOf(x) === rf.cat && (rf.budget === '' || (x.price != null && x.price >= lo && (!hi || x.price < hi))));
    $('[data-ref-list]').innerHTML = items.map((x) => card(x, 'ref')).join('');
    $('[data-ref-empty]').hidden = items.length > 0;
  }

  if (SHOP.live) {
    const pick = (box, fn) => $(box).addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b || e.target.closest('.ed')) return;
      $$('.chip', e.currentTarget).forEach((x) => x.classList.toggle('is-active', x === b));
      fn(b);
    });
    pick('[data-ref-cats]', (b) => { rf.cat = b.dataset.cat; drawRefs(); });
    pick('[data-ref-budget]', (b) => { rf.budget = b.dataset.budget; drawRefs(); });
    pick('[data-balloon-kinds]', (b) => { rf.ball = b.dataset.kind; drawCat(); window.SITE?.after?.(); });
    document.addEventListener('click', (e) => {
      const o = e.target.closest('[data-open-cat]');
      if (o) { e.preventDefault(); openCat(); }
      if (e.target.closest('[data-cat-close]')) closeCat();
      const a = e.target.closest('[data-addon]');
      if (a) {
        state.addons.set(a.dataset.addon, (state.addons.get(a.dataset.addon) || 0) + 1);
        update(); if (cat.open) toast('Добавлено в букет');
      }
      const r = e.target.closest('[data-addon-del]');
      if (r) { const k = r.dataset.addonDel, q = (state.addons.get(k) || 1) - 1; q ? state.addons.set(k, q) : state.addons.delete(k); update(); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cat.open) closeCat(); });
    // На вкус флориста: бюджет обязателен, гамма по желанию
    if ($('[data-florist-order]')) {
    pick('[data-florist-budget]', (b) => { fl.budget = +b.dataset.fb; $('[data-florist-order]').disabled = false; });
    pick('[data-florist-occ]', (b) => { fl.occ = b.dataset.occ; });
    pick('[data-florist-tone]', (b) => { fl.tone = b.dataset.tone; });
    $('[data-florist-order]').addEventListener('click', () => openOrder([
      `Букет на вкус флориста, бюджет ${budgetText(SHOP.budgets[fl.budget])}`,
      ...(fl.occ ? [`Повод: ${fl.occ}`] : []),
      ...(fl.tone ? [`Гамма: ${fl.tone}`] : []),
    ]));
    }
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-order-item]'); if (!b) return;
      const [kind, id] = b.dataset.orderItem.split(':');
      const x = SHOP[COLL[kind]].find((i) => String(i.id) === id);
      orderPhoto = x.photo;
      orderLink = x.source ? `Публикация: ${x.source}` : kind === 'ref' || kind === 'show' ? `Фото: ${new URL(x.photo, location.href).href}` : '';
      openOrder(kind === 'ref' ? [`Хочу букет как на примере: «${x.name || 'без названия'}» — ${x.from ? 'от ' : ''}${rub(x.price)}`]
        : kind === 'show' ? [`Букет из витрины: «${x.name}» — ${rub(x.price)} (цена из публикации, уточните наличие)`]
        : [`${kind === 'ball' ? 'Шар' : 'Игрушка'}: «${x.name || 'без названия'}»${x.price == null ? '' : ` — ${rub(x.price)}`}`], false, true);
    });
  }

  /* ---------- Вход для сотрудников: 5 нажатий в правом нижнем углу страницы ----------
     Здесь только окно пароля. Код админки сервер отдаёт лишь после верного пароля. */
  let taps = [];
  $('[data-corner]')?.addEventListener('click', () => {
    taps = [...taps.filter((t) => Date.now() - t < 3000), Date.now()];
    if (taps.length < 5) return;
    taps = [];
    if (window.openAdmin) return window.openAdmin();
    const box = document.createElement('div');
    box.className = 'gate';
    box.innerHTML = `<form class="gate__card"><button type="button" class="gate__x" aria-label="Закрыть">×</button>
      <input type="password" placeholder="Пароль" autocomplete="current-password" required><p class="gate__err"></p><button class="btn btn--green">Войти</button></form>`;
    document.body.append(box);
    const f = $('form', box), inp = $('input', box);
    $('.gate__x', box).onclick = () => box.remove();
    box.onclick = (e) => { if (e.target === box) box.remove(); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const r = await fetch('api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pass: inp.value, action: 'login' }) })
        .then((x) => x.json()).catch(() => ({ error: 'Нет связи с сервером' }));
      if (!r.code) { $('.gate__err', box).textContent = r.error || 'Неверный пароль'; inp.select(); return; }
      box.remove();
      new Function(r.code)();
      window.openAdmin(inp.value);
    };
    inp.focus();
  });

  /* =========================================================
     Конструктор букета
     ========================================================= */
  const B = SHOP.builder;
  const state = {
    stems: new Map(),       // "flowerId|shadeIdx" -> qty
    shade: {},              // flowerId -> выбранный индекс оттенка
    greens: new Map(),      // greenId -> qty
    wrap: B.defaultWrapping,
    ribbon: B.defaultRibbon,
    shape: SHOP.shapes?.[0]?.id,
    extras: new Set(),
    addons: new Map(),      // "balloons:id" / "toys:id" -> qty
    cardText: '',
  };
  const addonStrip = () => {
    const pool = ['balloons', 'toys'].flatMap((c) => (SHOP[c] || []).filter(shown).map((x) => [c, x]));
    if (!pool.length) return '';
    return `<div class="addons__strip">${pool.slice(0, 12).map(([c, x]) => `<button type="button" class="addons__card${state.addons.has(`${c}:${x.id}`) ? ' is-on' : ''}" data-addon="${c}:${esc(x.id)}">
        <img src="${esc(x.photo || '')}" alt="" loading="lazy"><span>${esc(x.name || '')}</span><b>${x.price == null ? 'цену подскажем' : rub(x.price)}</b></button>`).join('')}</div>
      <button type="button" class="addons__open" data-open-cat>Весь ассортимент шаров и игрушек</button>`;
  };
  const addonOf = (k) => { const [c, id] = k.split(':'); return (SHOP[c] || []).find((x) => String(x.id) === id); };
  let flowerById, greenById, wrapById, ribbonById, extraById, shapeById;
  const avail = (x) => SHOP.__edit || (x.on !== false && (x.stock == null || x.stock > 0));
  const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

  const flowerList = $('[data-flower-list]');
  let cardText = null;
  if (flowerList) initBuilder();

  function initBuilder() {
    flowerList.addEventListener('click', (e) => {
      const row = e.target.closest('[data-flower]');
      if (!row || e.target.closest('.ed')) return;
      const id = row.dataset.flower;
      const sh = e.target.closest('[data-shade]');
      if (sh) {
        state.shade[id] = +sh.dataset.shade;
        $$('[data-shade]', row).forEach((b) => {
          const on = b === sh;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-checked', on);
        });
        renderRow(row);
        return;
      }
      if (e.target.closest('[data-inc]')) changeStem(id, +1);
      if (e.target.closest('[data-dec]')) changeStem(id, -1);
    });
    $('[data-green-list]').addEventListener('click', (e) => {
      const row = e.target.closest('[data-green]');
      if (!row || e.target.closest('.ed')) return;
      const id = row.dataset.green;
      const cur = state.greens.get(id) || 0;
      const next = Math.max(0, Math.min(greenById[id].stock ?? 30, cur + (e.target.closest('[data-inc]') ? 1 : e.target.closest('[data-dec]') ? -1 : 0)));
      next ? state.greens.set(id, next) : state.greens.delete(id);
      $('[data-qty]', row).textContent = next;
      $('[data-dec]', row).disabled = !next;
      update();
    });
    $('[data-wrap-list]').addEventListener('change', (e) => { state.wrap = e.target.value; update(); });
    $('[data-shape-list]')?.addEventListener('change', (e) => { state.shape = e.target.value; update(); });
    $('[data-ribbon-list]').addEventListener('change', (e) => { state.ribbon = e.target.value; update(); });
    const extraList = $('[data-extra-list]');
    cardText = document.createElement('textarea');
    Object.assign(cardText, { rows: 2, maxLength: 300, placeholder: 'Текст открытки', className: 'card-text', hidden: true });
    cardText.setAttribute('aria-label', 'Текст открытки');
    extraList.after(cardText);
    cardText.addEventListener('input', () => (state.cardText = cardText.value));
    extraList.addEventListener('change', (e) => {
      if (e.target.type !== 'checkbox') return;
      e.target.checked ? state.extras.add(e.target.value) : state.extras.delete(e.target.value);
      if (extraById[e.target.value].hasText) {
        cardText.hidden = !e.target.checked;
        if (e.target.checked) cardText.focus();
      }
      update();
    });
    renderBuilder();
  }

  function renderBuilder() {
    if (!flowerList) return;
    flowerById = byId(SHOP.flowers); greenById = byId(SHOP.greens); wrapById = byId(SHOP.wrapping);
    ribbonById = byId(SHOP.ribbons); extraById = byId(SHOP.extras); shapeById = byId(SHOP.shapes || []);
    // убираем из букета то, чего больше нет
    [...state.stems.keys()].forEach((k) => { if (!avail(flowerById[k.split('|')[0]] || { on: false })) state.stems.delete(k); });
    [...state.greens.keys()].forEach((k) => { if (!avail(greenById[k] || { on: false })) state.greens.delete(k); });
    [...state.extras].forEach((k) => { if (!avail(extraById[k] || { on: false })) state.extras.delete(k); });
    const firstOk = (list, cur) => (list.some((x) => x.id === cur && avail(x)) ? cur : list.find(avail)?.id);
    state.wrap = firstOk(SHOP.wrapping, state.wrap);
    state.ribbon = firstOk(SHOP.ribbons, state.ribbon);
    state.shape = firstOk(SHOP.shapes || [], state.shape);

    // Цветы: карточка с фото. Нажатие на фото добавляет один стебель выбранного оттенка.
    flowerList.innerHTML = SHOP.flowers.filter(avail).map((f) => `
      <li class="pick${off(f)}" data-flower="${f.id}" data-ed="flowers:${esc(f.id)}">
        <button type="button" class="pick__photo" data-inc aria-label="Добавить: ${esc(f.name)}">
          <img src="${esc(f.photo)}" alt="" loading="lazy" width="320" height="400">
          <span class="pick__badge" data-badge>0</span>
        </button>
        <div>
          <div class="pick__name">${esc(f.name)}</div>
        <div class="pick__price">${rub(f.price)} за шт${f.seasonal ? ', сезонный' : ''}</div>
        </div>
        ${(f.shades || []).length ? `<div class="pick__shades" role="radiogroup" aria-label="Оттенок: ${esc(f.name)}">
          ${f.shades.map((s, i) => `<button type="button" class="shade${i === (state.shade[f.id] || 0) ? ' is-active' : ''}" role="radio" aria-checked="${i === (state.shade[f.id] || 0)}" data-shade="${i}" style="background:${esc(s.hex)}" title="${esc(s.name)}" aria-label="${esc(s.name)}"></button>`).join('')}
        </div>` : ''}
        <div class="qty">
          <button type="button" data-dec aria-label="Убрать: ${esc(f.name)}">−</button>
          <output data-qty>0</output>
          <button type="button" data-inc aria-label="Добавить: ${esc(f.name)}">+</button>
        </div>
        <div class="pick__lines" data-lines></div>
      </li>`).join('');

    $('[data-green-list]').innerHTML = SHOP.greens.filter(avail).map((g) => `
      <li class="green${off(g)}" data-green="${g.id}" data-ed="greens:${esc(g.id)}">
        ${g.photo ? `<img class="green__photo" src="${esc(g.photo)}" alt="" loading="lazy" width="56" height="70">` : ''}
        <span class="green__name">${esc(g.name)} <span class="green__price">${rub(g.price)}</span>${g.note ? `<small class="green__note">${esc(g.note)}</small>` : ''}</span>
        <span class="qty">
          <button type="button" data-dec aria-label="Убрать: ${esc(g.name)}" ${state.greens.get(g.id) ? '' : 'disabled'}>−</button>
          <output data-qty>${state.greens.get(g.id) || 0}</output>
          <button type="button" data-inc aria-label="Добавить: ${esc(g.name)}">+</button>
        </span>
      </li>`).join('');

    const option = (name, x, cur, coll) => `
      <label class="option${off(x)}" data-ed="${coll}:${esc(x.id)}">
        <input type="radio" name="${name}" value="${esc(x.id)}" ${x.id === cur ? 'checked' : ''}>
        <span class="option__body">
          ${coll === 'shapes' ? '' : `<span class="option__thumb" style="background:${esc(x.color2 || '#f1ebe7')}">${x.photo ? `<img src="${esc(x.photo)}" alt="">` : wrapThumb(x)}</span>`}
          <span class="option__name">${esc(x.name)}</span>
          <span class="option__price">${priceLabel(x, x.price)}</span>
        </span>
      </label>`;
    $('[data-wrap-list]').innerHTML = SHOP.wrapping.filter(avail).map((w) => option('wrap', w, state.wrap, 'wrapping')).join('');
    const shapeList = $('[data-shape-list]');
    if (shapeList) shapeList.innerHTML = (SHOP.shapes || []).filter(avail).map((x) => option('shape', x, state.shape, 'shapes')).join('');
    // у магазина нет форм букета — шаг и строку в итоге не показываем (в админке видно, чтобы можно было добавить)
    const noShapes = !(SHOP.shapes || []).filter(avail).length;
    if (shapeList?.closest('.step')) shapeList.closest('.step').style.display = noShapes && !SHOP.__edit ? 'none' : '';
    const shapeSum = $('[data-sum="shape"]')?.parentElement; if (shapeSum) shapeSum.style.display = noShapes ? 'none' : '';

    $('[data-ribbon-list]').innerHTML = SHOP.ribbons.filter(avail).map((r) => `
      <label class="swatch${off(r)}" data-ed="ribbons:${esc(r.id)}">
        <input type="radio" name="ribbon" value="${esc(r.id)}" ${r.id === state.ribbon ? 'checked' : ''}>
        <span><i class="${r.color ? '' : 'none'}" style="--c:${esc(r.color || 'transparent')}"></i>${esc(r.name)}${!QUOTE_ONLY && r.price ? ` <small>+${rub(r.price)}</small>` : ''}</span>
      </label>`).join('');

    $('[data-extra-list]').innerHTML = SHOP.extras.filter(avail).map((x) => `
      <label class="extra${off(x)}" data-ed="extras:${esc(x.id)}">
        <input type="checkbox" value="${esc(x.id)}" ${state.extras.has(x.id) ? 'checked' : ''}>
        <span>${esc(x.name)}</span>
        <span class="extra__price">${x.price ? '+' + rub(x.price) : 'бесплатно'}</span>
      </label>`).join('');
    if (cardText) cardText.hidden = ![...state.extras].some((id) => extraById[id]?.hasText);

    $$('[data-flower]').forEach(renderRow);
    update();
  }

  window.SITE = {
    SHOP,
    render() { renderTexts(); renderShop(); renderBuilder(); },
  };
  if (SHOP.live) { renderTexts(); renderShop(); document.documentElement.classList.add('live-ready'); }

  function countOf(id) {
    let n = 0;
    state.stems.forEach((q, k) => { if (k.split('|')[0] === id) n += q; });
    return n;
  }

  function changeStem(id, delta) {
    const f = flowerById[id];
    const key = `${id}|${f.shades.length ? (state.shade[id] || 0) : 0}`;
    let q = state.stems.get(key) || 0;
    if (delta < 0 && !q) {
      // минус убирает из последнего добавленного оттенка этого цветка
      const other = [...state.stems.keys()].reverse().find((k) => k.startsWith(id + '|'));
      if (!other) return;
      const oq = state.stems.get(other) - 1;
      oq ? state.stems.set(other, oq) : state.stems.delete(other);
    } else {
      if (delta > 0 && f.stock != null && countOf(id) >= f.stock) return toast(`${f.name}: сейчас в наличии ${f.stock} шт`);
      if (delta > 0 && countOf(id) >= B.maxStemsPerFlower) return toast(`Не больше ${B.maxStemsPerFlower} шт одного цветка — для большего заказа напишите нам`);
      q += delta;
      if (delta > 0 && !builderStarted) { builderStarted = true; track('bs'); }  // первый цветок в букете
      q > 0 ? state.stems.set(key, q) : state.stems.delete(key);
    }
    renderRow($(`[data-flower="${id}"]`));
    update();
  }

  function renderRow(row) {
    const id = row.dataset.flower;
    const f = flowerById[id];
    const total = countOf(id);
    const sIdx = state.shade[id] || 0;
    $('[data-qty]', row).textContent = f.shades.length ? (state.stems.get(`${id}|${sIdx}`) || 0) : total;
    $('[data-dec]', row).disabled = total === 0;
    row.classList.toggle('is-picked', total > 0);
    $('[data-badge]', row).textContent = total;
    const lines = f.shades.length
      ? [...state.stems].filter(([k]) => k.startsWith(id + '|')).map(([k, q]) => `${f.shades[+k.split('|')[1]].name.toLowerCase()} ${q}`)
      : [];
    $('[data-lines]', row).textContent = lines.length > 1 || (lines.length === 1 && !state.stems.has(`${id}|${sIdx}`)) ? lines.join(', ') : '';
  }

  // цена не указана — значит её называет флорист (коробки, корзины: зависят от размера)
  function priceLabel(x, p) { if (QUOTE_ONLY) return 'цену уточнит флорист'; return x?.price == null ? 'по запросу' : p ? '+' + rub(p) : 'бесплатно'; }

  // упаковка может дорожать, когда цветы и зелень дороже порога (settings.wrapThreshold)
  function wrapPrice(w, flowers) {
    const lim = SHOP.settings?.wrapThreshold;
    return w ? (w.priceOver && lim && flowers > lim ? w.priceOver : w.price) : 0;
  }

  function totals() {
    let flowers = 0, stems = 0;
    state.stems.forEach((q, k) => { flowers += flowerById[k.split('|')[0]].price * q; stems += q; });
    state.greens.forEach((q, id) => { flowers += greenById[id].price * q; });
    const wrap = wrapPrice(wrapById[state.wrap], flowers);
    const shape = shapeById?.[state.shape]?.price || 0;
    const ribbon = ribbonById[state.ribbon]?.price || 0;
    let extras = 0;
    state.extras.forEach((id) => (extras += extraById[id].price));
    state.addons.forEach((q, k) => (extras += (addonOf(k)?.price || 0) * q));
    const fee = stems ? (B.assemblyFee || 0) : 0;
    return { flowers: flowers + fee, wrap: stems ? wrap : 0, ribbon: stems ? ribbon : 0, shape: stems ? shape : 0, extras, stems,
      total: (stems ? flowers + fee + wrap + ribbon + shape : 0) + extras };
  }

  function update() {
    const t = totals();
    $$('[data-sum="flowers"]').forEach((el) => (el.textContent = rub(t.flowers)));
    $$('[data-sum="wrap"]').forEach((el) => (el.textContent = QUOTE_ONLY ? 'уточним' : rub(t.wrap)));
    $$('[data-sum="shape"]').forEach((el) => (el.textContent = QUOTE_ONLY ? 'уточним' : rub(t.shape)));
    const ad = $('[data-addons]');
    if (ad) {
      [...state.addons.keys()].forEach((k) => { if (!addonOf(k)) state.addons.delete(k); });
      ad.innerHTML = [...state.addons].map(([k, q]) => { const x = addonOf(k); return `<div class="addons__item"><img src="${esc(x.photo)}" alt="">
        <span>${esc(x.name || '')}${q > 1 ? ` × ${q}` : ''}<br><small>${x.price == null ? 'цену подскажем' : rub(x.price * q)}</small></span><button type="button" data-addon-del="${esc(k)}" aria-label="Убрать">×</button></div>`; }).join('')
        + addonStrip();
    }
    $$('[data-sum="ribbon"]').forEach((el) => (el.textContent = QUOTE_ONLY ? 'уточним' : rub(t.ribbon)));
    $$('[data-sum="extras"]').forEach((el) => (el.textContent = QUOTE_ONLY ? 'уточним' : rub(t.extras)));
    $$('[data-sum="total"]').forEach((el) => (el.textContent = (QUOTE_ONLY ? '≈ ' : '') + rub(t.total)));
    $$('[data-wrap-list] input').forEach((i) => {
      const p = wrapPrice(wrapById[i.value], t.flowers);
      i.parentElement.querySelector('.option__price').textContent = priceLabel(wrapById[i.value], p);
    });
    $$('[data-sum="count"]').forEach((el) => (el.textContent = `${t.stems} ${plural(t.stems, 'цветок', 'цветка', 'цветов')}`));
    $$('[data-checkout]').forEach((b) => (b.disabled = t.stems < (B.minStems || 1)));
    $('[data-preview-hint]').textContent = t.stems && t.stems < B.minStems
      ? `Добавьте ещё ${B.minStems - t.stems} — минимум ${B.minStems} ${plural(B.minStems, 'цветок', 'цветка', 'цветов')}`
      : 'Добавьте цветы — букет появится здесь';
    $('[data-preview-hint]').classList.toggle('is-hidden', t.stems >= B.minStems);
    drawPreview();
    window.__syncBars?.();
  }

  /* ---------- Превью букета (SVG) ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const SHAPES = {
    rose: 'rose', peony: 'peony', 'peony-rose': 'peony', 'spray-rose': 'spray', chrysanthemum: 'daisy', tanacetum: 'tiny',
    chamomile: 'daisy', eustoma: 'ruffle', carnation: 'ruffle', hydrangea: 'cloud', alstroemeria: 'star', tulip: 'cup',
  };
  const SIZE = { rose: 17, peony: 21, spray: 15, daisy: 14, tiny: 12, ruffle: 15, cloud: 27, star: 15, cup: 14 };

  // Детерминированный «случайный» генератор, чтобы букет не прыгал при каждом клике
  const rnd = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v + amt * (amt > 0 ? 255 - v : v)))));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function isLight(hex) {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) > 200;
  }

  function bloomSVG(kind, color, r, rand) {
    const dark = shade(color, -0.18), deep = shade(color, -0.35), light = shade(color, 0.25);
    const rot = Math.round(rand() * 360);
    let s = '';
    switch (kind) {
      case 'rose':
        s = `<circle r="${r}" fill="${dark}"/><circle r="${r * .78}" fill="${color}"/>
             <path d="M${-r * .5} 0a${r * .5} ${r * .5} 0 1 1 ${r * .5} ${r * .5}" fill="none" stroke="${deep}" stroke-width="1.4"/>
             <path d="M${-r * .25} 0a${r * .25} ${r * .25} 0 1 0 ${r * .25} ${-r * .25}" fill="none" stroke="${deep}" stroke-width="1.2"/>`;
        break;
      case 'peony':
        for (let i = 0; i < 7; i++) s += `<ellipse rx="${r * .62}" ry="${r * .42}" cx="${r * .38}" fill="${i % 2 ? color : dark}" transform="rotate(${i * 51})"/>`;
        s += `<circle r="${r * .5}" fill="${light}"/><circle r="${r * .3}" fill="${color}"/><path d="M${-r * .2} 0q${r * .2} ${-r * .3} ${r * .35} 0" stroke="${deep}" fill="none" stroke-width="1.1"/>`;
        break;
      case 'spray':
        [[-r * .55, r * .2, .55], [r * .5, r * .35, .5], [0, -r * .45, .6]].forEach(([x, y, k]) => {
          s += `<g transform="translate(${x} ${y})"><circle r="${r * k}" fill="${dark}"/><circle r="${r * k * .7}" fill="${color}"/><circle r="${r * k * .28}" fill="${deep}"/></g>`;
        });
        break;
      case 'daisy':
        for (let i = 0; i < 14; i++) s += `<ellipse rx="${r * .5}" ry="${r * .16}" cx="${r * .55}" fill="${color}" stroke="${dark}" stroke-width=".4" transform="rotate(${i * 25.7})"/>`;
        s += `<circle r="${r * .3}" fill="${isLight(color) ? '#e2b93f' : deep}"/>`;
        break;
      case 'tiny':
        [[-r * .6, 0], [r * .55, -r * .2], [0, r * .6], [r * .1, -r * .7]].forEach(([x, y]) => {
          let p = '';
          for (let i = 0; i < 10; i++) p += `<ellipse rx="${r * .26}" ry="${r * .09}" cx="${r * .28}" fill="${color}" stroke="#d8d2bd" stroke-width=".3" transform="rotate(${i * 36})"/>`;
          s += `<g transform="translate(${x} ${y})">${p}<circle r="${r * .14}" fill="#e8c34a"/></g>`;
        });
        break;
      case 'ruffle': {
        let d = '';
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * Math.PI * 2, rr = r * (i % 2 ? .86 : 1);
          d += `${i ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`;
        }
        s = `<path d="${d}Z" fill="${dark}"/><circle r="${r * .7}" fill="${color}"/><circle r="${r * .42}" fill="${light}" opacity=".7"/><circle r="${r * .18}" fill="${deep}" opacity=".6"/>`;
        break;
      }
      case 'cloud':
        for (let i = 0; i < 22; i++) {
          const a = i * 2.4, d = Math.sqrt(i / 22) * r * .8;
          s += `<circle cx="${(Math.cos(a) * d).toFixed(1)}" cy="${(Math.sin(a) * d).toFixed(1)}" r="${r * .28}" fill="${i % 3 ? color : dark}" stroke="${light}" stroke-width=".6"/>`;
        }
        break;
      case 'star':
        for (let i = 0; i < 6; i++) s += `<ellipse rx="${r * .6}" ry="${r * .3}" cx="${r * .45}" fill="${i % 2 ? color : dark}" transform="rotate(${i * 60})"/>`;
        s += `<circle r="${r * .22}" fill="#e6c25a"/><path d="M-3 -2l3 3M2 -4l-1 4M-1 3l2 -3" stroke="${deep}" stroke-width=".8"/>`;
        break;
      case 'cup':
        s = `<path d="M${-r * .8} ${-r * .3}Q${-r * .8} ${r} 0 ${r}Q${r * .8} ${r} ${r * .8} ${-r * .3}L${r * .4} ${-r * .05}L0 ${-r * .55}L${-r * .4} ${-r * .05}Z" fill="${color}" stroke="${dark}" stroke-width="1"/>
             <path d="M0 ${-r * .5}V${r * .8}" stroke="${dark}" stroke-width=".8"/>`;
        return `<g>${s}</g>`;
    }
    return `<g transform="rotate(${rot})">${s}</g>`;
  }

  function leafSVG(g, rand) {
    const c = g.color, d = shade(c, -0.25);
    const kind = g.id;
    if (kind === 'eucalyptus') {
      let s = `<path d="M0 0V-46" stroke="${d}" stroke-width="1.2"/>`;
      for (let i = 0; i < 5; i++) s += `<circle cx="${i % 2 ? 7 : -7}" cy="${-8 - i * 9}" r="6.5" fill="${c}" stroke="${d}" stroke-width=".6"/>`;
      return s;
    }
    if (kind === 'lagurus' || kind === 'stipa') {
      return kind === 'lagurus'
        ? `<path d="M0 0V-40" stroke="#b9ad8c" stroke-width="1"/><ellipse cy="-46" rx="5" ry="10" fill="${c}"/>`
        : `<path d="M0 0Q${rand() * 20 - 10} -30 ${rand() * 30 - 15} -60" stroke="${c}" stroke-width="1.4" fill="none"/><path d="M0 0Q${rand() * 16 - 8} -28 ${rand() * 24 - 12} -54" stroke="${d}" stroke-width=".9" fill="none"/>`;
    }
    if (kind === 'amaranth') {
      // свисающие кисти: стебель вверх и вбок, бусины свисают вниз
      let s = `<path d="M0 0Q4 -30 14 -40" stroke="${d}" stroke-width="1.2" fill="none"/>`;
      for (let i = 0; i < 9; i++) s += `<circle cx="${14 + i * 1.6 + Math.sin(i) * 1.5}" cy="${-40 + i * 6}" r="${3.4 - i * .2}" fill="${c}"/>`;
      return s;
    }
    if (kind === 'fern') {
      let s = `<path d="M0 0V-52" stroke="${d}" stroke-width="1.2"/>`;
      for (let i = 1; i < 9; i++) s += `<path d="M0 ${-i * 6}l${9 - i * .6} -4M0 ${-i * 6}l${-(9 - i * .6)} -4" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`;
      return s;
    }
    // рускус и прочая зелень — вытянутые листья
    let s = `<path d="M0 0V-44" stroke="${d}" stroke-width="1"/>`;
    for (let i = 0; i < 4; i++) s += `<ellipse cx="${i % 2 ? 6 : -6}" cy="${-12 - i * 9}" rx="4" ry="8" fill="${c}" transform="rotate(${i % 2 ? 25 : -25} ${i % 2 ? 6 : -6} ${-12 - i * 9})"/>`;
    return s;
  }

  function vesselSVG(w, ribbon, layer) {
    const c = w.color, c2 = w.color2, d = shade(c, -0.15);
    const rib = ribbon?.color;
    const ribD = rib ? shade(rib, -0.2) : null;
    if (w.kind === 'none') {
      // без упаковки — букет, собранный в руке: стебли сходятся к перевязке и чуть расходятся ниже
      if (layer === 'back') return '';
      const tie = rib || '#c9b28f', tieD = shade(tie, -0.25);
      let stems = '';
      for (let i = 0; i < 11; i++) {
        const t = i / 10 - .5;
        const top = 160 + t * 96, low = 160 + t * 34;
        const g = ['#6f9160', '#7d9a6b', '#5f8452'][i % 3];
        stems += `<path d="M${top.toFixed(1)} ${206 + Math.abs(t) * 30} Q${(160 + t * 30).toFixed(1)} 262 ${(160 + t * 7).toFixed(1)} 292 L${low.toFixed(1)} 368" stroke="${g}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
      }
      const bow = rib
        ? `<g transform="translate(160 290)"><path d="M0 0C-22 -18 -36 -4 -30 6C-24 14 -10 6 0 0ZM0 0C22 -18 36 -4 30 6C24 14 10 6 0 0Z" fill="${rib}" stroke="${ribD}" stroke-width=".7"/>
          <path d="M-2 2L-14 38M2 2L12 40" stroke="${rib}" stroke-width="5" stroke-linecap="round"/><circle r="5" fill="${ribD}"/></g>`
        : '';
      return `${stems}<rect x="143" y="283" width="34" height="13" rx="6" fill="${tie}" stroke="${tieD}" stroke-width=".8"/>
        <path d="M145 287H175M145 292H175" stroke="${tieD}" stroke-width=".7" opacity=".6"/>${bow}`;
    }
    if (w.kind === 'wrap') {
      if (layer === 'back') return `<path d="M160 300 L52 92 Q100 64 160 70 Q220 64 268 92 Z" fill="${c2}" stroke="${d}" stroke-width=".8"/>
        <path d="M160 300 L74 110 Q120 128 160 124" fill="${c}" opacity=".55"/>`;
      return `<path d="M160 330 L92 176 Q126 196 160 192 Q194 196 228 176 Z" fill="${c}" stroke="${d}" stroke-width=".8"/>
        <path d="M160 330 L120 186 Q140 196 160 192Z" fill="${shade(c, .18)}" opacity=".8"/>
        <path d="M150 330 L152 366 M160 330 L160 370 M170 330 L168 364" stroke="#7d9a6b" stroke-width="3" stroke-linecap="round"/>
        ${rib ? `<g transform="translate(160 292)"><path d="M0 0C-22 -18 -36 -4 -30 6C-24 14 -10 6 0 0ZM0 0C22 -18 36 -4 30 6C24 14 10 6 0 0Z" fill="${rib}" stroke="${ribD}" stroke-width=".7"/>
          <path d="M-2 2L-16 40M2 2L14 42" stroke="${rib}" stroke-width="5" stroke-linecap="round"/><circle r="5" fill="${ribD}"/></g>` : ''}`;
    }
    if (w.kind === 'bag') {
      if (layer === 'back') return `<path d="M108 210 Q112 150 132 150 M212 210 Q208 150 188 150" stroke="${d}" stroke-width="5" fill="none"/>`;
      return `<path d="M88 200 H232 L222 352 H98 Z" fill="${c}" stroke="${d}" stroke-width=".8"/><path d="M88 200 H232 L228 222 H92Z" fill="${c2}"/>
        ${rib ? `<g transform="translate(160 236)"><path d="M0 0C-18 -14 -30 -3 -25 5C-20 12 -8 5 0 0ZM0 0C18 -14 30 -3 25 5C20 12 8 5 0 0Z" fill="${rib}" stroke="${ribD}" stroke-width=".7"/><circle r="4" fill="${ribD}"/></g>` : ''}`;
    }
    if (w.kind === 'box') {
      if (layer === 'back') return `<ellipse cx="160" cy="214" rx="86" ry="20" fill="${shade(c, -0.25)}"/>`;
      return `<path d="M74 214 V330 A86 20 0 0 0 246 330 V214 A86 20 0 0 1 74 214Z" fill="${c}" stroke="${d}" stroke-width=".8"/>
        <path d="M74 214 A86 20 0 0 0 246 214" fill="none" stroke="${shade(c, .2)}" stroke-width="2"/>
        ${rib ? `<path d="M74 286 A86 20 0 0 0 246 286 V300 A86 20 0 0 1 74 300Z" fill="${rib}" stroke="${ribD}" stroke-width=".5"/>` : ''}`;
    }
    // basket
    if (layer === 'back') return `<path d="M76 220 Q160 40 244 220" fill="none" stroke="${d}" stroke-width="7"/><ellipse cx="160" cy="220" rx="88" ry="18" fill="${shade(c, -0.35)}"/>`;
    let weave = '';
    for (let y = 236; y < 330; y += 14) weave += `<path d="M${78 + (y - 220) * .2} ${y} H${242 - (y - 220) * .2}" stroke="${d}" stroke-width="1.2" stroke-dasharray="10 4"/>`;
    return `<path d="M72 220 H248 L226 338 H94 Z" fill="${c}" stroke="${d}" stroke-width=".8"/>${weave}
      ${rib ? `<g transform="translate(92 214)"><path d="M0 0C-18 -14 -30 -3 -25 5C-20 12 -8 5 0 0ZM0 0C18 -14 30 -3 25 5C20 12 8 5 0 0Z" fill="${rib}" stroke="${ribD}" stroke-width=".7"/><circle r="4" fill="${ribD}"/></g>` : ''}`;
  }

  function drawPreview() {
    const svg = $('[data-preview]');
    if (!svg) return;
    const t = totals();
    const w = wrapById[state.wrap] || SHOP.wrapping[0];
    const ribbon = ribbonById[state.ribbon];
    if (!t.stems) {
      svg.innerHTML = `<g opacity=".5">${vesselSVG(w, ribbon, 'back')}${vesselSVG(w, ribbon, 'front')}</g>`;
      const mini = $('[data-preview-mini]');
      if (mini) mini.innerHTML = svg.innerHTML;
      return;
    }
    // Раскладываем все стебли в один список и перемешиваем
    const rand = rnd(7);
    const blooms = [];
    state.stems.forEach((q, k) => {
      const [id, si] = k.split('|');
      const f = flowerById[id];
      const color = f.shades.length ? f.shades[+si].hex : (f.color || '#f5f1e8');
      const kind = SHAPES[id] || 'ruffle';
      for (let i = 0; i < q; i++) blooms.push({ kind, color, key: k + i, sort: rand() });
    });
    blooms.sort((a, b) => a.sort - b.sort);
    const shown = blooms.slice(0, 90);

    // Купол: площадь цветов определяет радиус, при большом букете — уменьшаем масштаб
    const area = shown.reduce((s, b) => s + Math.PI * SIZE[b.kind] ** 2, 0);
    const R = Math.sqrt(area / Math.PI) * 1.08;
    const isOpen = w.kind === 'wrap' || w.kind === 'bag' || w.kind === 'none';
    const cy = w.kind === 'wrap' ? 138 : w.kind === 'none' ? 150 : 192;
    const maxR = w.kind === 'wrap' || w.kind === 'none' ? 96 : 88;
    // маленький букет показываем крупнее, большой — уменьшаем, чтобы влез
    const k = Math.max(0.5, Math.min(1.7, (maxR * (0.55 + Math.min(shown.length, 25) / 55)) / R));

    let placed = shown.map((b, i) => {
      const a = i * 2.39996, d = Math.sqrt((i + .5) / shown.length) * R;
      return { ...b, x: 160 + Math.cos(a) * d * k, y: cy + Math.sin(a) * d * k * .72 - (R * k - d * k) * .18 };
    });
    placed.sort((a, b) => a.y - b.y);

    // Зелень по краю купола
    let greens = '';
    const gr = rnd(11);
    let gi = 0;
    const gTotal = [...state.greens.values()].reduce((a, b) => a + b, 0);
    state.greens.forEach((q, id) => {
      for (let i = 0; i < Math.min(q, 12); i++, gi++) {
        const ang = -Math.PI + (gi + .5) / Math.max(gTotal, 1) * Math.PI;
        const gx = 160 + Math.cos(ang) * (R * k + 6), gy = cy + Math.sin(ang) * (R * k * .72 + 8);
        const rotDeg = (ang + Math.PI / 2) * 180 / Math.PI * .9;
        greens += `<g transform="translate(${gx.toFixed(1)} ${(gy + 26).toFixed(1)}) rotate(${rotDeg.toFixed(0)}) scale(${(.85 + gr() * .3).toFixed(2)})">${leafSVG(greenById[id], gr)}</g>`;
      }
    });

    const br = rnd(3);
    const bloomsSvg = placed.map((b) =>
      `<g transform="translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) scale(${k.toFixed(2)})"><g class="bloom">${bloomSVG(b.kind, b.color, SIZE[b.kind], br)}</g></g>`).join('');

    svg.innerHTML = `
      <ellipse cx="160" cy="364" rx="${isOpen ? 70 : 96}" ry="8" fill="#000" opacity=".06"/>
      ${vesselSVG(w, ribbon, 'back')}
      ${greens}
      <g>${bloomsSvg}</g>
      ${vesselSVG(w, ribbon, 'front')}
      ${blooms.length > shown.length ? `<text x="160" y="26" text-anchor="middle" font-size="12" fill="#8a8277">+ ещё ${blooms.length - shown.length} в букете</text>` : ''}`;
    const mini = $('[data-preview-mini]');
    if (mini) mini.innerHTML = svg.innerHTML.replace(/class="bloom"/g, '');
  }

  function wrapThumb(w) {
    if (w.kind === 'none' || !w.color) return '<svg viewBox="0 0 40 56" aria-hidden="true"><path d="M17 50L19 14M20 50V12M23 50L21 14" stroke="#7d9a6b" stroke-width="2" stroke-linecap="round"/></svg>';
    const c = w.color, d = shade(c, -0.2);
    const shapes = {
      wrap: `<path d="M20 52 L4 10 Q20 4 36 10Z" fill="${c}" stroke="${d}" stroke-width=".6"/>`,
      bag: `<path d="M6 18H34L31 52H9Z" fill="${c}" stroke="${d}" stroke-width=".6"/><path d="M13 18Q14 8 20 8Q26 8 27 18" stroke="${d}" fill="none" stroke-width="1.6"/>`,
      box: `<path d="M5 16V46A15 5 0 0 0 35 46V16Z" fill="${c}" stroke="${d}" stroke-width=".6"/><ellipse cx="20" cy="16" rx="15" ry="5" fill="${shade(c, .15)}" stroke="${d}" stroke-width=".6"/>`,
      basket: `<path d="M6 28Q20 0 34 28" stroke="${d}" fill="none" stroke-width="2"/><path d="M4 28H36L32 50H8Z" fill="${c}" stroke="${d}" stroke-width=".6"/><path d="M6 36H34M7 43H33" stroke="${d}" stroke-dasharray="4 2" stroke-width=".8"/>`,
    };
    return `<svg viewBox="0 0 40 56" aria-hidden="true">${shapes[w.kind] || shapes.wrap}</svg>`;
  }

  /* =========================================================
     Оформление заказа
     ========================================================= */
  const dialog = $('[data-order-dialog]');
  const form = $('[data-order-form]');
  let orderLines = [];

  function builderLines() {
    const t = totals();
    const lines = ['Букет из конструктора:'];
    state.stems.forEach((q, k) => {
      const [id, si] = k.split('|');
      const f = flowerById[id];
      const shadeName = f.shades.length ? ', ' + f.shades[+si].name.toLowerCase() : '';
      lines.push(QUOTE_ONLY ? `• ${f.name}${shadeName} — ${q} шт` : `• ${f.name}${shadeName} — ${q} шт × ${rub(f.price)} = ${rub(q * f.price)}`);
    });
    state.greens.forEach((q, id) => lines.push(QUOTE_ONLY ? `• ${greenById[id].name} — ${q} шт` : `• ${greenById[id].name} — ${q} шт = ${rub(q * greenById[id].price)}`));
    const w = wrapById[state.wrap];
    const sh = shapeById?.[state.shape];
    if (sh) lines.push(`Форма: ${sh.name}${sh.price ? ` — ${rub(sh.price)}` : ''}`);
    lines.push(w.kind === 'none' ? 'Без упаковки' : QUOTE_ONLY ? `Упаковка: ${w.name}` : `Упаковка: ${w.name} — ${w.price == null ? 'цена по запросу' : rub(t.wrap)}`);
    const r = ribbonById[state.ribbon];
    if (r && r.id !== 'none') lines.push(QUOTE_ONLY ? `Лента: ${r.name}` : `Лента: ${r.name} — ${rub(r.price)}`);
    state.extras.forEach((id) => {
      const x = extraById[id];
      lines.push(`+ ${x.name} — ${rub(x.price)}${x.hasText && state.cardText.trim() ? `\n  Текст: «${state.cardText.trim()}»` : ''}`);
    });
    state.addons.forEach((q, k) => {
      const x = addonOf(k);
      if (x) lines.push(`+ ${k.startsWith('balloons') ? 'Шар' : 'Игрушка'} «${x.name || 'без названия'}»${q > 1 ? ` × ${q}` : ''} — ${x.price == null ? 'цена по запросу' : rub(x.price * q)}`);
    });
    lines.push(QUOTE_ONLY ? 'Стоимость уточнит флорист' : `Итого: ${rub(t.total)}`);
    return lines;
  }

  let orderPhoto = '', orderLink = '';
  function openOrder(lines, withPreview = false, keepPhoto = false) {
    if (!keepPhoto) { orderPhoto = ''; orderLink = ''; }
    const op = $('[data-order-photo]');
    if (op) { op.hidden = !orderPhoto; if (orderPhoto) op.src = orderPhoto; }
    orderLines = lines;
    orderFrom = withPreview ? 'builder' : 'other';  // «Оформить» в конструкторе или заказ из витрины, примеров
    track(withPreview ? 'bo' : 'oo');
    $('[data-order-summary]').textContent = lines.join('\n');
    const sp = $('[data-preview-sheet]');
    if (sp) {
      sp.hidden = !withPreview;
      if (withPreview) sp.innerHTML = $('[data-preview]').innerHTML.replace(/class="bloom"/g, '');
    }
    if (orderBody) { orderBody.hidden = false; orderDone.hidden = true; orderErr.textContent = ''; }
    dialog.showModal();
  }

  $$('[data-checkout]').forEach((b) => b.addEventListener('click', () => openOrder(builderLines(), true)));
  $$('[data-order-product]').forEach((b) => b.addEventListener('click', () => {
    const p = SHOP.catalog.find((x) => x.id === b.dataset.orderProduct);
    openOrder([`Букет из каталога: «${p.name.replace(/[«»]/g, '')}» — ${rub(p.price)}`]);
  }));

  /* ---------- Заявка на сайте (демо): ничего не отправляется, показывается «Заявка оформлена» ---------- */
  const orderBody = $('[data-order-body]'), orderDone = $('[data-order-done]'), orderErr = $('[data-order-error]');
  const delivBox = $('[data-delivery-fields]');
  const maskPhone = (el, ev) => {
    if (ev && ev.inputType && ev.inputType.startsWith('delete')) { el.value = el.value.replace(/[^\d]+$/, ''); if (el.value.replace(/\D/g, '').length <= 1) el.value = ''; return; }
    let d = el.value.replace(/\D/g, ''); if (!d) { el.value = ''; return; }
    if (d[0] === '8') d = '7' + d.slice(1); if (d[0] !== '7') d = '7' + d; d = d.slice(0, 11);
    const p = d.slice(1); let o = '+7';
    if (p.length) o += ' (' + p.slice(0, 3); if (p.length >= 3) o += ') ' + p.slice(3, 6);
    if (p.length >= 6) o += '-' + p.slice(6, 8); if (p.length >= 8) o += '-' + p.slice(8, 10);
    el.value = o;
  };
  $$('input[type="tel"]', form).forEach((el) => el.addEventListener('input', (e) => maskPhone(el, e)));
  const syncReceive = () => {
    const delivery = form?.elements.receive.value === 'delivery';
    const pf = $('[data-pickup-field]'); if (pf) pf.hidden = delivery;
    if (delivBox) delivBox.hidden = !delivery;
  };
  form?.addEventListener('change', (e) => { if (e.target.name === 'receive') syncReceive(); });
  $$('[data-order-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
  dialog?.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog?.addEventListener('close', () => {
    if (!orderDone.hidden) { form.reset(); syncReceive(); }
    orderBody.hidden = false; orderDone.hidden = true; orderErr.textContent = '';
  });
  form?.addEventListener('input', (e) => { e.target.classList?.remove('is-bad'); orderErr.textContent = ''; });
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form), delivery = fd.get('receive') === 'delivery';
    const digits = (v) => String(v || '').replace(/\D/g, '').length;
    const bad = (name, msg) => {
      const el = form.elements[name]; el.classList.add('is-bad'); orderErr.textContent = msg; el.focus();
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); return false;
    };
    $$('.is-bad', form).forEach((x) => x.classList.remove('is-bad'));
    if (String(fd.get('name') || '').trim().length < 2) return bad('name', 'Укажите ваше имя');
    if (digits(fd.get('phone')) < 11) return bad('phone', 'Укажите ваш номер телефона полностью');
    if (delivery && String(fd.get('address') || '').trim().length < 5) return bad('address', 'Укажите адрес доставки');
    if (delivery && digits(fd.get('rphone')) < 11) return bad('rphone', 'Укажите номер телефона получателя полностью');
    try {   // демо: сохраняется только в этом браузере, никуда не уходит
      const key = 'cj-demo-orders', saved = JSON.parse(localStorage.getItem(key) || '[]');
      saved.push({ at: new Date().toISOString(), items: orderLines, name: fd.get('name'), phone: fd.get('phone'), receive: fd.get('receive'),
        address: delivery ? fd.get('address') : '', recipientPhone: delivery ? fd.get('rphone') : '', when: fd.get('when'), comment: fd.get('comment') });
      localStorage.setItem(key, JSON.stringify(saved.slice(-20)));
    } catch { /* приватный режим */ }
    orderBody.hidden = true; orderDone.hidden = false; dialog.scrollTop = 0;
  });

  function message() {
    const fd = new FormData(form);
    const out = [SHOP.orders.greeting, '', ...orderLines, ...(orderLink ? [orderLink] : []), ''];
    const receive = fd.get('receive');
    if (receive === 'delivery') out.push('Доставка: адрес пришлю в чате');
    else if (receive === 'pickup') out.push(fd.get('shop') ? `Заберу сам(а): ${fd.get('shop')}` : 'Заберу сам(а)');
    if (fd.get('when')) out.push(`Когда: ${fd.get('when')}`);
    if (fd.get('comment')) out.push(`Комментарий: ${fd.get('comment')}`);
    return out.join('\n');
  }

  /* ---------- Переход в WhatsApp/Telegram: сначала окно с примечанием, мессенджер открывает кнопка в нём ---------- */
  function jumpHelp(name, go) {
    let d = $('[data-jumphelp]');
    if (!d) {
      d = document.createElement('div');
      d.className = 'demo-pop'; d.dataset.jumphelp = '';
      d.innerHTML = `<div class="demo-pop__card" role="dialog" aria-modal="true" aria-labelledby="jumphelp-title">
        <p class="demo-pop__title" id="jumphelp-title"></p>
        <p class="maxhelp__steps">Заказ скопируется и подставится в сообщение. Имя, телефон и адрес доставки допишите в чате.</p>
        <p class="maxhelp__note">Переходя в мессенджер, вы покидаете сайт. Обработка данных происходит в соответствии с правилами мессенджера.</p>
        <button type="button" class="btn btn--green btn--block" data-jump-go></button>
        <button type="button" class="btn btn--ghost btn--block maxhelp__back" data-jump-close>Назад к заказу</button></div>`;
      d.addEventListener('click', (e) => {
        if (e.target === d || e.target.closest('[data-jump-close]')) d.classList.remove('is-open');
      });
    }
    (document.querySelector('dialog[open]') || document.body).append(d);  // поверх окна заказа
    $('.demo-pop__title', d).textContent = name;
    const goBtn = $('[data-jump-go]', d);
    goBtn.textContent = `Перейти в ${name}`;
    goBtn.onclick = () => { d.classList.remove('is-open'); go(); };
    d.classList.add('is-open');
  }

  $$('[data-send]').forEach((b) => b.addEventListener('click', async () => {
    const text = message();
    const c = SHOP.contacts;
    track(orderFrom === 'builder' ? 'sb' : 'so', { c: b.dataset.send });
    if (SHOP.demo) { demoShow('Так заказ придёт вам в WhatsApp', text); return; }
    if (b.dataset.send === 'sms') {
      copyText(text);
      window.location.href = `sms:${c.phoneRaw}?&body=${encodeURIComponent(text)}`;
    } else if (b.dataset.send === 'max') {
      // есть ссылка на профиль MAX (max.ru/u/...) — окно-инструкция и переход из него
      if (/^https?:/.test(c.max || '')) { maxHelp(c.max); return; }
      copyText(text);
      toast(`Заказ скопирован. Найдите в MAX номер ${c.phone} и вставьте сообщение`);
    } else if (b.dataset.send === 'whatsapp') {
      jumpHelp('WhatsApp', () => { copyText(text); window.open(`https://wa.me/${c.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); });
    } else if (b.dataset.send === 'telegram') {
      // ссылка с ?text= в приложении Telegram сразу подставляет заказ в поле сообщения
      jumpHelp('Telegram', () => { copyText(text); window.open(`https://t.me/${c.telegram}?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); });
    }
  }));

  // копирование в буфер: работает и без https (на http браузер не даёт navigator.clipboard)
  function copyText(text) {
    let ok = false;
    const box = document.querySelector('dialog[open]') || document.body;  // поле внутри открытого окна, иначе его не выделить
    const ta = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    box.append(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
    try { ok = document.execCommand('copy'); } catch { /* старый способ не сработал */ }
    ta.remove();
    if (!ok && navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    return ok;
  }

  /* ---------- Быстрая плавная прокрутка к разделу по нажатию на пункт меню ---------- */
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function glideTo(el) {
    document.documentElement.style.scrollBehavior = 'auto';
    const qn = $('[data-quicknav].is-visible');
    const off = ($('.header')?.getBoundingClientRect().bottom || 0) + (qn ? 0 : 46) + 8;
    const y0 = scrollY, y1 = Math.max(0, el.getBoundingClientRect().top + scrollY - off);
    const dur = Math.min(750, 300 + Math.abs(y1 - y0) / 10), t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / dur); scrollTo(0, y0 + (y1 - y0) * ease(k)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || a.hasAttribute('data-open-cat')) return;
    const h = a.getAttribute('href'), el = h.length > 1 && $(h);
    if (!el) return;
    e.preventDefault(); glideTo(el);
  });

  /* ---------- Счётчик посещений: без личных данных и только после согласия на cookie ---------- */
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } } };
  const trackOn = () => false;  // сотрудников после входа в админку не считаем
  const track = (e, extra = {}) => {
    if (!trackOn()) return;
    try { fetch('api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hit', e, ...extra }), keepalive: true }).catch(() => {}); } catch { /* счётчик не должен ломать сайт */ }
  };
  const visitSource = () => {
    let h = ''; try { h = new URL(document.referrer).hostname; } catch { /* нет перехода */ }
    if (!h || h === location.hostname) return 'direct';
    if (/(^|\.)(ya|yandex)\./.test(h)) return 'yandex';
    if (/google\./.test(h)) return 'google';
    if (/(vk\.|vkontakte|t\.me|telegram|wa\.me|whatsapp|instagram|facebook|ok\.ru|max\.ru)/.test(h)) return 'social';
    return 'other';
  };
  const trackVisit = () => {
    if (!trackOn()) return;
    let seen = null; try { seen = sessionStorage.getItem('nzv'); sessionStorage.setItem('nzv', '1'); } catch { /* приватный режим */ }
    if (seen) return;
    track('v', { s: visitSource() });
    const today = new Date().toISOString().slice(0, 10);
    if (ls.get('nzu') !== today) { ls.set('nzu', today); track('u'); }
  };
  let builderStarted = false, orderFrom = 'other';
  document.addEventListener('click', (e) => { if (e.target.closest('a[href^="tel:"]')) track('call'); });

  /* ---------- Плашка про cookie: показываем, пока посетитель не выбрал ---------- */
  const ck = $('[data-cookies]');
  if (ck) {
    const main = $('.cookies__main', ck), panel = $('.cookies__set', ck), stats = $('[data-cookies-stats]', ck);
    const show = (open) => { ck.hidden = false; main.hidden = open; panel.hidden = !open; stats.checked = ls.get('cookiesOk') === '1'; };
    const decide = (on) => { ck.hidden = true; ls.set('cookiesOk', on ? '1' : '0'); if (on) trackVisit(); };
    ck.hidden = ls.get('cookiesOk') !== null;  // «1» — статистика разрешена, «0» — отказ
    ck.querySelectorAll('[data-cookies-ok]').forEach((b) => b.addEventListener('click', () => decide(true)));
    $('[data-cookies-set]', ck).addEventListener('click', () => show(true));
    $('[data-cookies-save]', ck).addEventListener('click', () => decide(stats.checked));
    document.addEventListener('click', (e) => { if (e.target.closest('[data-cookies-reset]')) { e.preventDefault(); show(true); } });
  }

  trackVisit();

  /* ---------- Карта Яндекса грузится только по нажатию: до этого Яндекс не получает данные посетителя ---------- */
  $('[data-map-gate]')?.addEventListener('click', (e) => {
    const f = e.currentTarget.parentElement.querySelector('iframe[data-src]');
    if (f) f.src = f.dataset.src;
    e.currentTarget.remove();
  });

  /* ---------- MAX: ссылки на чат с текстом у MAX нет — заказ копируем и объясняем в окне, как его вставить.
     Кнопка «Перейти в MAX» — обычная ссылка: по нажатию на неё телефон сам открывает приложение ---------- */
  function maxHelp(url) {
    let d = $('[data-maxhelp]');
    if (!d) {
      d = document.createElement('div');
      d.className = 'demo-pop'; d.dataset.maxhelp = '';
      d.innerHTML = `<div class="demo-pop__card" role="dialog" aria-modal="true" aria-labelledby="maxhelp-title">
        <p class="demo-pop__title" id="maxhelp-title">Заказ скопирован</p>
        <p class="maxhelp__steps">Нажмите «Перейти в MAX», откроется чат с нами. Зажмите на пару секунд поле сообщения, нажмите «Вставить», допишите имя, телефон и адрес доставки — и отправьте.</p>
        <p class="maxhelp__note">Переходя в мессенджер, вы покидаете сайт. Обработка данных происходит в соответствии с правилами мессенджера.</p>
        <a class="btn btn--green btn--block" target="_blank" rel="noopener" data-maxhelp-go>Перейти в MAX</a>
        <button type="button" class="btn btn--ghost btn--block maxhelp__back" data-maxhelp-close>Назад к заказу</button></div>`;
      d.addEventListener('click', (e) => {
        if (e.target === d || e.target.closest('[data-maxhelp-close], [data-maxhelp-go]')) d.classList.remove('is-open');
      });
    }
    (document.querySelector('dialog[open]') || document.body).append(d);  // поверх окна заказа
    $('[data-maxhelp-go]', d).href = url;
    d.classList.add('is-open');
  }

  /* ---------- «Написать»: выбор мессенджера, если их несколько ---------- */
  $$('[data-write]').forEach((b) => b.addEventListener('click', (e) => {
    const m = $('[data-write-menu]'); if (!m) return;
    e.preventDefault(); m.hidden = !m.hidden;
  }));
  $$('[data-max]').forEach((b) => b.addEventListener('click', async () => {
    copyText(SHOP.contacts.phoneRaw);
    toast(`Номер ${SHOP.contacts.phone} скопирован — найдите его в MAX`);
    $('[data-write-menu]').hidden = true;
  }));
  document.addEventListener('click', (e) => {
    const m = $('[data-write-menu]');
    if (m && !m.hidden && !e.target.closest('[data-write-menu], [data-write]')) m.hidden = true;
  });

  /* ---------- Нижние панели на телефоне ---------- */
  const builderSec = $('#builder');
  const buildbar = $('[data-buildbar]');
  const callbar = $('[data-callbar]');
  // На первом экране свои кнопки, а в конструкторе своя панель — там кнопки звонка прячем
  const seen = { hero: true, builder: false };
  // панель букета видна в конструкторе и везде, пока в букете что-то есть — чтобы собранный букет не терялся
  const syncBars = () => {
    const has = typeof totals === 'function' && flowerList && totals().stems > 0;
    const showBuild = seen.builder || (has && !seen.hero);
    buildbar?.classList.toggle('is-visible', showBuild);
    callbar?.classList.toggle('is-hidden', seen.hero || showBuild);
    quicknav?.classList.toggle('is-visible', !seen.hero);
  };
  // Строка быстрого перехода: подсвечиваем раздел, который сейчас на экране
  const quicknav = $('[data-quicknav]');
  if (quicknav && 'IntersectionObserver' in window) {
    const links = $$('a', quicknav);
    const sio = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => {
        const on = a.getAttribute('href') === '#' + e.target.id;
        a.classList.toggle('is-active', on);
        // только вбок внутри строки: scrollIntoView двигал всю страницу, и её дёргало
        if (on) { const t = a.parentElement; t.scrollTo({ left: a.offsetLeft - (t.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' }); }
      });
    }), { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((a) => { const h = a.getAttribute('href'); const s = h.length > 1 && $(h); if (s) sio.observe(s); });
  }
  if ('IntersectionObserver' in window) {
    const hero = $('#top');
    if (hero) {
      const onScroll = () => {
        const past = window.scrollY > hero.offsetTop + hero.offsetHeight * 0.6;
        if (seen.hero === past) { seen.hero = !past; syncBars(); }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    if (builderSec) new IntersectionObserver(([e]) => { seen.builder = e.isIntersecting; syncBars(); }, { rootMargin: '-10% 0px -10% 0px' }).observe(builderSec);
  } else {
    seen.hero = false;
  }
  syncBars();
  window.__syncBars = syncBars;

  // Браузеры с адресной строкой внизу (Яндекс, Chrome) накрывают ею нижние панели — поднимаем их над строкой
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const lift = () => document.documentElement.style.setProperty('--vvb', Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) + 'px');
    vv.addEventListener('resize', lift); vv.addEventListener('scroll', lift); lift();
  }

  /* ---------- Демо: вместо фейкового номера показываем, что получит магазин ---------- */
  function demoShow(title, text) {
    let d = $('[data-demo]');
    if (!d) {
      d = document.createElement('div');
      d.className = 'demo-pop'; d.dataset.demo = '';
      d.innerHTML = '<div class="demo-pop__card" role="dialog" aria-modal="true"><p class="demo-pop__title"></p><pre class="demo-pop__text"></pre><p class="demo-pop__note">Это демо. На вашем сайте кнопка откроет чат с вашим номером, и заказ придёт уже готовым текстом.</p><button type="button" class="btn demo-pop__close">Понятно</button></div>';
      document.body.append(d);
      d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('.demo-pop__close')) d.classList.remove('is-open'); });
    }
    (document.querySelector('dialog[open]') || document.body).append(d);  // открытый <dialog> лежит поверх всего, окно кладём внутрь него
    $('.demo-pop__title', d).textContent = title;
    $('.demo-pop__text', d).textContent = text || '';
    $('.demo-pop__text', d).hidden = !text;
    d.classList.add('is-open');
  }
  if (SHOP.demo) {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="tel:"], a[href*="wa.me/"], a[href*="t.me/"], a[href^="sms:"]');
      if (!a) return;
      e.preventDefault();
      demoShow(a.href.startsWith('tel:') ? 'Здесь будет ваш номер телефона' : 'Здесь откроется ваш WhatsApp', '');
    }, true);
  }
})();
