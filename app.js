const models = [
  { id:'nice-royal-3', name:'Ницца Royal', composition:'Композиция 3', layout:'Прямая', price:79536, length:'3000 мм', height:'2500 мм', depth:'600 мм', body:'ЛДСП, цвет Вотан', front:'МДФ с эмалью Renner, Blanco / Galant', lead:'от 10 рабочих дней', image:'img/nice-royal.jpg' },
  { id:'nice-2', name:'Ницца', composition:'Композиция 2', layout:'Прямая', price:61671, length:'3000 мм', height:'2350 мм', depth:'600 мм', body:'ЛДСП, белый', front:'МДФ с усиленным ПВХ покрытием, дуб серый', lead:'от 3 рабочих дней', image:'img/nice-2.jpg' },
  { id:'nice-3', name:'Ницца', composition:'Композиция 3', layout:'Прямая', price:36839, length:'2200 мм', height:'2350 мм', depth:'600 мм', body:'ЛДСП, венге', front:'МДФ с усиленным ПВХ покрытием, дуб оливковый', lead:'от 3 рабочих дней', image:'img/nice-3.jpg' },
  { id:'nice-4', name:'Ницца', composition:'Композиция 4', layout:'Прямая', price:57818, length:'3000 мм', height:'2150 мм', depth:'600 мм', body:'ЛДСП, белый', front:'МДФ с усиленным ПВХ покрытием, дуб синий', lead:'от 3 рабочих дней', image:'img/nice-4.jpg' },
  { id:'glacier-2', name:'Глетчер', composition:'Композиция 2', layout:'Прямая', price:59072, length:'3000 мм', height:'2150 мм', depth:'600 мм', body:'ЛДСП, венге', front:'МДФ с матовым покрытием Soft-touch, маренго', lead:'от 3 рабочих дней', image:'img/glacier.jpg' },
  { id:'valeria-2', name:'Валерия-М', composition:'Композиция 2', layout:'Угловая', price:53934, length:'2400 × 1400 мм', height:'2334 мм', depth:'600 мм', body:'ЛДСП, белый', front:'МДФ с глянцевым ПВХ покрытием, бежевый глянец', lead:'от 3 рабочих дней', image:'img/valeria.jpg' }
];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = n => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s).toLowerCase().replace(/ё/g, 'е');
const PHONE = '79255170973';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- каталог: поиск и фильтры ---------- */
const state = { q:'', sort:'name' };
const hay = m => norm(`${m.name} ${m.composition} ${m.layout} ${m.layout === 'Угловая' ? 'угловая углом' : 'прямая линейная'} ${m.length} ${m.height} ${m.body} ${m.front} ${m.price} ${money(m.price)}`);
function filtered() {
  const words = norm(state.q).split(/\s+/).filter(Boolean);
  const list = models.filter(m => words.every(w => hay(m).includes(w)));
  return list.sort((a, b) => state.sort === 'price-desc' ? b.price - a.price : state.sort === 'price-asc' ? a.price - b.price
    : a.name.localeCompare(b.name, 'ru') || a.composition.localeCompare(b.composition, 'ru', { numeric:true }));
}
const plural = n => n % 10 === 1 && n % 100 !== 11 ? 'кухня' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'кухни' : 'кухонь');
function renderProducts() {
  const list = filtered();
  const dirty = !!state.q;
  $('#count').textContent = dirty ? `Найдено: ${list.length} ${plural(list.length)}` : `Все кухни: ${list.length}`;
  $('#resetFilters').hidden = !dirty;
  $('#clearSearch').hidden = !state.q;
  $('#products').innerHTML = list.length ? list.map((m, i) => `<article class="product" role="button" tabindex="0" data-id="${m.id}" style="--i:${i}" aria-label="Оформить заявку на кухню ${esc(m.name)}, ${esc(m.composition)}"><div class="product-top"><img src="${m.image}" alt="Кухня серии ${esc(m.name)}, иллюстрация производителя" loading="lazy" onerror="this.remove()"><small>${m.layout.toUpperCase()}</small></div><div class="product-body"><h3>${esc(m.name)}</h3><p>${esc(m.composition)} · ${esc(m.length)}<br>${esc(m.front)}</p><div class="product-bottom"><div class="product-price">${money(m.price)}<small>цена из карточки · уточняйте</small></div><span class="product-cta">Оформить <i aria-hidden="true">→</i></span></div></div></article>`).join('')
    : '<div class="empty"><b>Ничего не нашли</b><p>Попробуйте другое слово — например, «Ницца», «эмаль» или «венге».</p><button type="button" class="button dark" id="emptyReset">Показать все кухни</button></div>';
}
function resetFilters() { state.q = ''; $('#search').value = ''; renderProducts(); }
$('#search').addEventListener('input', e => { state.q = e.target.value; renderProducts(); });
$('#clearSearch').addEventListener('click', () => { $('#search').value = ''; state.q = ''; renderProducts(); $('#search').focus(); });
$('#sortFilter').addEventListener('change', e => { state.sort = e.target.value; renderProducts(); });
$('#resetFilters').addEventListener('click', resetFilters);
$('#products').addEventListener('click', e => {
  if (e.target.closest('#emptyReset')) return resetFilters();
  const c = e.target.closest('.product'); if (c) openProduct(c.dataset.id);
});
$('#products').addEventListener('keydown', e => {
  const c = e.target.closest('.product');
  if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openProduct(c.dataset.id); }
});

/* ---------- заявка: общая форма ---------- */
function formHTML(withSelect) {
  return `<form class="lead" novalidate><h3>Оформить заявку</h3><p class="form-lead">Оставьте телефон — мы свяжемся с вами и всё уточним.</p>
  <div class="form-row"><label>Ваше имя <em class="opt">необязательно</em><input name="name" autocomplete="name" maxlength="60" placeholder="Как к вам обращаться"></label><label>Телефон<input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+7 (___) ___-__-__"></label></div>
  ${withSelect ? '<label>Интересующая модель<select name="model"><option value="">Нужна помощь с выбором</option></select></label>' : ''}
  <label>Пожелания <em class="opt">необязательно</em><textarea name="comment" maxlength="600" rows="2" placeholder="Размеры, цвет, сроки — всё, что важно"></textarea></label>
  <p class="form-error" role="alert" aria-live="polite"></p>
  <button class="button submit" type="submit">Оформить заявку</button></form>
  <div class="success" hidden role="status"><svg class="check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="m15 27 8 8 15-17"/></svg><h3>Заявка оформлена!</h3><p class="succ-id"></p><button class="button dark" type="button" data-again>Оставить ещё одну</button></div>`;
}
function maskPhone(el, e) {
  if (e && e.inputType && e.inputType.startsWith('delete')) { el.value = el.value.replace(/[^\d]+$/, ''); if (el.value.replace(/\D/g, '').length <= 1) el.value = ''; return; }
  let d = el.value.replace(/\D/g, ''); if (!d) { el.value = ''; return; }
  if (d[0] === '8') d = '7' + d.slice(1); if (d[0] !== '7') d = '7' + d; d = d.slice(0, 11);
  const p = d.slice(1); let o = '+7';
  if (p.length) o += ' (' + p.slice(0, 3); if (p.length >= 3) o += ') ' + p.slice(3, 6);
  if (p.length >= 6) o += '-' + p.slice(6, 8); if (p.length >= 8) o += '-' + p.slice(8, 10);
  el.value = o;
}
/* Сюда позже подключится отправка в салон (почта, CRM, Telegram-бот и т.д.).
   Пока заявка сохраняется только в браузере. */
async function submitLead(app) {
  const saved = JSON.parse(localStorage.getItem('mm-demo-applications') || '[]');
  saved.push(app); localStorage.setItem('mm-demo-applications', JSON.stringify(saved.slice(-30)));
}
function wireForm(root, getModel, onAgain) {
  const f = $('form', root), ok = $('.success', root), err = $('.form-error', f);
  $('[name=phone]', f).addEventListener('input', e => maskPhone(e.target, e));
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const name = f.elements.name.value.trim(), phone = f.elements.phone.value.trim(), digits = phone.replace(/\D/g, '');
    err.textContent = '';
    const bad = (m, el) => { err.textContent = m; el.focus(); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); };
    if (digits.length < 11) return bad('Проверьте номер телефона', f.elements.phone);
    const model = getModel(f), id = 'ММ-' + Date.now().toString(36).toUpperCase();
    const btn = $('.submit', f); btn.disabled = true;
    try { await submitLead({ id, name, phone, model: model ? `${model.name}, ${model.composition}` : '', comment: f.elements.comment.value.trim(), createdAt: new Date().toISOString() }); }
    catch { btn.disabled = false; return bad('Не получилось оформить заявку. Попробуйте ещё раз.', f.elements.name); }
    btn.disabled = false;
    $('.succ-id', ok).innerHTML = `${name ? esc(name) + ', спасибо!' : 'Спасибо!'} Номер заявки <b>${id}</b>.<br>Мы свяжемся с вами по номеру ${esc(phone)}.`;
    f.hidden = true; ok.hidden = false; root.scrollTop = 0;
  });
  $('[data-again]', ok).addEventListener('click', () => { f.reset(); f.hidden = false; ok.hidden = true; onAgain && onAgain(); });
}

/* форма внизу страницы */
const main = $('#mainForm');
main.innerHTML = formHTML(true);
models.forEach(m => $('[name=model]', main).insertAdjacentHTML('beforeend', `<option value="${m.id}">${esc(m.name)} — ${esc(m.composition)} · ${money(m.price)}</option>`));
wireForm(main, f => models.find(m => m.id === f.elements.model.value));

/* заявка в карточке кухни */
const dlg = $('#productDialog');
function openProduct(id) {
  const m = models.find(x => x.id === id); if (!m) return;
  $('#dialogContent').innerHTML = `<div class="sheet"><div class="sheet-photo"><img src="${m.image}" alt="Кухня серии ${esc(m.name)}, фото производителя" onerror="this.remove()"><small>${m.layout.toUpperCase()}</small></div><div class="sheet-body"><p class="eyebrow">${m.layout.toUpperCase()} КУХНЯ</p><h2 id="dialogTitle">${esc(m.name)}<br><em>${esc(m.composition)}</em></h2><div class="sheet-price">${money(m.price)}<small>цена из карточки салона · уточняйте</small></div><details class="specs"><summary>Размеры и материалы</summary><div class="details-grid"><div><span>ДЛИНА</span><b>${esc(m.length)}</b></div><div><span>ВЫСОТА / ГЛУБИНА</span><b>${esc(m.height)} / ${esc(m.depth)}</b></div><div><span>КОРПУС</span><b>${esc(m.body)}</b></div><div><span>ФАСАДЫ</span><b>${esc(m.front)}</b></div><div><span>СРОК</span><b>${esc(m.lead)}</b></div></div><p class="photo-note">Фото для примера: цвет и комплектацию уточняйте в салоне.</p></details><div class="sheet-form">${formHTML(false)}</div></div></div>`;
  wireForm($('.sheet-form'), () => m, () => {});
  dlg.showModal(); dlg.scrollTop = 0;
  if (!matchMedia('(pointer:coarse)').matches) $('[name=name]', dlg).focus();
}
$('#closeDialog').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('close', () => { $('#dialogContent').innerHTML = ''; });

/* ---------- меню, шапка, анимации ---------- */
const menu = $('#menu');
menu.addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); menu.setAttribute('aria-expanded', String(o)); });
$$('#nav a').forEach(a => a.addEventListener('click', () => { $('#nav').classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }));

const header = $('.header'), prog = $('#progress'), mbar = $('#mbar'), hero = $('.hero');
let reqVisible = false;
const onScroll = () => {
  const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
  header.classList.toggle('stuck', y > 40);
  prog.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  mbar.classList.toggle('show', y > hero.offsetHeight * .6 && !reqVisible);
};
addEventListener('scroll', onScroll, { passive:true }); onScroll();

$$('.section-heading,.quickfacts>div,.service-list article,.photo-grid figure,.review-grid article,.contact-list>div,.request-copy,.form-card,.contacts>div:first-child,.services>div:first-child,.text-link').forEach((el, i) => { el.classList.add('rv'); el.style.setProperty('--d', (i % 4) * 90 + 'ms'); });
if ('IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver(en => en.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold:.12, rootMargin:'0px 0px -40px 0px' });
  $$('.rv').forEach(el => io.observe(el));
  new IntersectionObserver(en => { reqVisible = en[0].isIntersecting; onScroll(); }).observe($('#request'));
} else $$('.rv').forEach(el => el.classList.add('in'));

renderProducts();

/* Слайд-шоу «Наши работы». Положите фото в img/works/work-01.jpg … work-10.jpg — они встанут на место «Фото N» сами. */
(() => {
  const track = document.querySelector('[data-wtrack]'); if (!track) return;
  const dotsBox = document.querySelector('[data-wdots]'), N = 10;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  track.innerHTML = Array.from({ length: N }, (_, i) => `<figure class="wslide"><span class="wslide__label">Фото ${i + 1}</span><img src="img/works/work-${String(i + 1).padStart(2, '0')}.jpg" alt="Наша работа ${i + 1}" loading="lazy" onerror="this.remove()"></figure>`).join('');
  const items = [...track.children]; let idx = 0, pages = 1, step = 1, hold = 0, visible = false, dots = [];
  const measure = () => { step = items[1].offsetLeft - items[0].offsetLeft; const per = Math.max(1, Math.round((track.clientWidth + 20) / step)); pages = Math.max(1, N - per + 1);
    dotsBox.innerHTML = ''; dots = Array.from({ length: pages }, (_, k) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Фото ' + (k + 1)); b.onclick = () => { hold = Date.now() + 8000; go(k); }; dotsBox.appendChild(b); return b; }); mark(); };
  const mark = () => dots.forEach((d, k) => d.classList.toggle('is-on', k === idx));
  const go = (i) => { idx = (i + pages) % pages; track.scrollTo({ left: idx * step, behavior: reduce ? 'auto' : 'smooth' }); mark(); };
  track.addEventListener('scroll', () => { idx = Math.min(pages - 1, Math.max(0, Math.round(track.scrollLeft / step))); mark(); }, { passive: true });
  document.querySelector('[data-wprev]').onclick = () => { hold = Date.now() + 8000; go(idx - 1); };
  document.querySelector('[data-wnext]').onclick = () => { hold = Date.now() + 8000; go(idx + 1); };
  ['pointerdown', 'touchstart', 'wheel'].forEach((e) => track.addEventListener(e, () => { hold = Date.now() + 9000; }, { passive: true }));
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: .3 }).observe(track); else visible = true;
  if (!reduce) setInterval(() => { if (visible && !document.hidden && Date.now() > hold) go(idx + 1); }, 3600);
  addEventListener('resize', measure); measure();
})();
