const sheet = document.querySelector('#inline-dialog');
const sheetTitle = document.querySelector('#edit-title');
const content = document.querySelector('[data-editor-body]');
const status = document.querySelector('[data-edit-status]');
const colorNames = {
  blush: 'Пудровый', peach: 'Персиковый', linen: 'Льняной', sage: 'Светло-зелёный',
  mint: 'Мятный', fog: 'Серо-голубой', butter: 'Сливочный', sand: 'Песочный',
  cream: 'Молочный', lilac: 'Сиреневый', rose: 'Розовый', sky: 'Небесный'
};
const priceModes = { exact: 'Точная цена', from: 'Цена от', on_request: 'По запросу' };
const browserStore = document.body.dataset.annaHosted ? await import('./browser-store.js?v=1') : null;
let state;
let busy = false;

function element(tag, attrs = {}, text = '') {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  if (text) node.textContent = text;
  return node;
}

function button(text, action) {
  const node = element('button', { type: 'button' }, text);
  node.addEventListener('click', action);
  return node;
}

function field(label, input) {
  const holder = element('label', { class: 'edit-field' });
  holder.append(element('span', {}, label), input);
  return holder;
}

function textField(label, value, max, multiline = false) {
  const input = element(multiline ? 'textarea' : 'input', { maxlength: max });
  input.value = value || '';
  return { node: field(label, input), input };
}

async function load() {
  if (!state) {
    if (browserStore) {
      state = await browserStore.getState();
      return;
    }
    const response = await fetch('/api/admin/state', { cache: 'no-store' });
    if (!response.ok) throw Error('Не удалось открыть редактор.');
    state = await response.json();
  }
}

async function api(action, payload, file = false) {
  if (browserStore) return browserStore.perform(action, payload);
  const response = await fetch('/api/admin/' + action, {
    method: 'POST',
    headers: { 'X-Demo-Token': state.token, 'Content-Type': file ? 'application/octet-stream' : 'application/json' },
    body: file ? payload : JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.message || 'Не удалось сохранить изменения.');
  return data;
}

function reloadPage(message) {
  sessionStorage.setItem('anna-scroll', String(scrollY));
  sessionStorage.setItem('anna-edit-status', message);
  const slides = Object.fromEntries([...document.querySelectorAll('[data-work-card][data-slide-index]')]
    .map(card => [card.dataset.id, card.dataset.slideIndex]));
  sessionStorage.setItem('anna-editor-slides', JSON.stringify(slides));
  location.reload();
}

async function saveDraft(change) {
  const draft = structuredClone(state.draft);
  change(draft);
  await api('save', { revision: state.revision, draft });
  reloadPage('Черновик сохранён');
}

function openSheet(title, inputs, save, extraButtons = []) {
  sheetTitle.textContent = title;
  const form = element('form');
  const error = element('p', { class: 'edit-error', role: 'alert' });
  const actions = element('div', { class: 'edit-actions' });
  const saveButton = element('button', { type: 'submit', class: 'solid' }, 'Сохранить');
  actions.append(saveButton, button('Отмена', () => sheet.close()), ...extraButtons);
  form.append(...inputs, error, actions);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    saveButton.disabled = true;
    error.textContent = '';
    try {
      await save();
    } catch (problem) {
      error.textContent = problem.message || 'Не удалось сохранить. Попробуйте ещё раз.';
    } finally {
      busy = false;
      saveButton.disabled = false;
    }
  });
  content.replaceChildren(form);
  sheet.showModal();
  form.querySelector('input, textarea, select')?.focus();
}

function editSettings(target) {
  const { key, label } = target.dataset;
  const text = textField(label, state.draft.settings[key], key === 'intro' ? 500 : 120, key === 'intro');
  if (['heading', 'city', 'brand'].includes(key)) text.input.required = true;
  openSheet(label, [text.node], () => saveDraft(draft => { draft.settings[key] = text.input.value; }));
}

function editPrice(item) {
  const mode = element('select');
  Object.entries(priceModes).forEach(([key, label]) => mode.append(element('option', { value: key }, label)));
  mode.value = item.priceMode;
  const amount = element('input', { type: 'number', min: 0, max: 10000000, step: 1, inputmode: 'numeric' });
  amount.value = item.priceValue ?? '';
  const amountField = field('Цена, ₽', amount);
  const setRequired = () => { amountField.hidden = mode.value === 'on_request'; amount.required = !amountField.hidden; };
  mode.addEventListener('change', setRequired);
  setRequired();
  const note = textField('Подпись под ценой', item.priceNote, 160);
  openSheet('Изменить цену', [field('Режим цены', mode), amountField, note.node], () => saveDraft(draft => {
    const row = draft.items.find(i => i.id === item.id);
    row.priceMode = mode.value;
    row.priceValue = amountField.hidden ? null : Number(amount.value);
    row.priceNote = note.input.value;
  }));
}

function editItem(target, item) {
  const { key, label } = target.dataset;
  if (key === 'priceValue') return editPrice(item);
  const text = textField(label, item[key], key === 'title' ? 80 : 1200, key === 'text');
  if (key === 'title') text.input.required = true;
  openSheet(label, [text.node], () => saveDraft(draft => {
    draft.items.find(row => row.id === item.id)[key] = text.input.value;
  }));
}

function previewPhoto(container, key, file) {
  container.replaceChildren();
  if (key.startsWith('color-') && !file) {
    container.append(element('span', { class: 'color-placeholder', 'data-swatch': key.slice(6) }));
  } else if (file || key) {
    if (browserStore && !file) {
      const image = element('img', { alt: '' });
      container.append(image);
      browserStore.getPhoto(key).then(photo => {
        if (container.firstChild === image && photo) image.src = photo.src;
      }).catch(() => {});
      return;
    }
    const src = file ? URL.createObjectURL(file) : key.startsWith('demo-')
      ? '/static/flowers/' + key.slice(5) + '-480.webp' : '/editor-media/' + key + '-480.webp';
    const image = element('img', { src, alt: '' });
    if (file) image.addEventListener('load', () => URL.revokeObjectURL(src), { once: true });
    container.append(image);
  }
}

function photoPicker(original, { label = 'Загрузить фото', includeAlt = true } = {}) {
  let key = original?.key || '';
  const preview = element('div', { class: 'edit-color-preview' });
  const upload = element('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' });
  const selection = element('div', { class: 'edit-select-swatch' });
  const alt = textField('Описание изображения', original?.alt, 200);
  const redraw = () => {
    previewPhoto(preview, key, upload.files[0]);
    selection.querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.swatch === key.slice(6) && !upload.files.length)));
  };
  Object.entries(colorNames).forEach(([color, label]) => {
    const option = button('', () => {
      key = 'color-' + color;
      upload.value = '';
      alt.input.value = label;
      redraw();
    });
    option.className = 'color-placeholder';
    option.dataset.swatch = color;
    option.setAttribute('aria-label', label);
    selection.append(option);
  });
  upload.addEventListener('change', redraw);
  redraw();
  return {
    fields: [field(label, upload), preview, selection, ...(includeAlt ? [alt.node] : [])],
    async resolve() {
      const file = upload.files[0];
      if (file) {
        if (file.size > 12 * 1024 * 1024) throw Error('Файл больше 12 МБ.');
        key = (await api('photo', file, true)).key;
      }
      if (!key) throw Error('Выберите оттенок или загрузите фото.');
      return { key, alt: alt.input.value, caption: original?.caption || '' };
    }
  };
}

function editPhoto(target, item) {
  const isHero = !item;
  const card = item ? document.querySelector('[data-id="' + CSS.escape(item.id) + '"]') : null;
  const index = isHero ? 0 : target.hasAttribute('data-add-photo') ? item.photos.length
    : Number(card?.dataset.slideIndex || 0);
  const original = isHero ? { key: state.draft.settings.hero } : item.photos[index];
  if (index >= 20) throw Error('В карточке уже 20 кадров.');
  const picker = photoPicker(original, { includeAlt: !isHero });
  const remove = original && !isHero ? button('Удалить кадр', async () => {
    if (!confirm('Удалить этот кадр из черновика?')) return;
    await saveDraft(draft => { draft.items.find(row => row.id === item.id).photos.splice(index, 1); });
  }) : null;
  openSheet(isHero ? 'Фото первого экрана' : original ? 'Изменить кадр' : 'Добавить кадр',
    picker.fields, async () => {
      const photo = await picker.resolve();
      await saveDraft(draft => {
        if (isHero) draft.settings.hero = photo.key;
        else draft.items.find(i => i.id === item.id).photos[index] = photo;
      });
    }, remove ? [remove] : []);
}

function addCard() {
  const title = textField('Название', '', 80);
  title.input.required = true;
  const description = textField('Описание', '', 1200, true);
  const amount = element('input', { type: 'number', min: 0, max: 10000000, inputmode: 'numeric' });
  const photo = photoPicker({ key: 'color-linen', alt: 'Льняной' }, { label: 'Первое фото', includeAlt: false });
  openSheet('Добавить карточку', [...photo.fields, title.node, field('Цена, ₽', amount), description.node], async () => {
    const firstPhoto = await photo.resolve();
    if (!firstPhoto.key.startsWith('color-')) firstPhoto.alt = title.input.value;
    await saveDraft(draft => {
      draft.items.push({
        id: crypto.randomUUID(), visible: true, title: title.input.value, text: description.input.value,
        priceMode: amount.value ? 'exact' : 'on_request', priceValue: amount.value ? Number(amount.value) : null,
        includes: [], photos: [firstPhoto]
      });
    });
  });
}

function cardOptions(item) {
  const visible = element('input', { type: 'checkbox' });
  visible.checked = item.visible;
  const order = element('input', { type: 'number', min: 1, max: state.draft.items.length, required: '' });
  order.value = state.draft.items.indexOf(item) + 1;
  const visibility = field('Показывать после публикации', visible);
  visibility.className = 'edit-checkbox';
  const remove = button('Удалить карточку', async () => {
    if (!confirm('Убрать карточку из каталога?')) return;
    await saveDraft(draft => {
      const index = draft.items.findIndex(row => row.id === item.id);
      const [cell] = draft.items.splice(index, 1);
      draft.trash.push({ section: 'items', cell, removed: new Date().toISOString() });
    });
  });
  openSheet(item.title || 'Настройки карточки', [visibility, field('Позиция в каталоге', order)], () => saveDraft(draft => {
    const index = draft.items.findIndex(row => row.id === item.id);
    const [row] = draft.items.splice(index, 1);
    row.visible = visible.checked;
    draft.items.splice(Number(order.value) - 1, 0, row);
  }), [remove]);
}

async function withStatus(action) {
  try {
    await load();
    await action();
  } catch (error) {
    status.textContent = error.message;
  }
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-edit], [data-add-card]');
  if (!target) return;
  withStatus(() => {
    if (sheet.open) return;
    const item = state.draft.items.find(row => row.id === target.dataset.editItem);
    if (target.hasAttribute('data-add-card')) return addCard();
    if (target.dataset.edit === 'settings') return editSettings(target);
    if (target.dataset.edit === 'hero') return editPhoto(target);
    if (!item) return;
    if (target.dataset.edit === 'photo') return editPhoto(target, item);
    if (target.dataset.edit === 'item-options') return cardOptions(item);
    return editItem(target, item);
  });
});
document.addEventListener('keydown', event => {
  const target = event.target.closest('[data-edit][role="button"]');
  if (target && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    target.click();
  }
});
document.querySelector('[data-close-editor]').addEventListener('click', () => sheet.close());
const publish = document.querySelector('[data-publish]');
publish.addEventListener('click', () => withStatus(async () => {
  if (busy) return;
  busy = true;
  publish.disabled = true;
  try {
    await api('publish', { revision: state.revision, draft: state.draft });
    reloadPage(browserStore ? 'Правки применены в этом браузере' : 'Опубликовано');
  } finally { busy = false; publish.disabled = false; }
}));
document.querySelector('[data-discard]').addEventListener('click', () => withStatus(async () => {
  if (busy || !confirm('Сбросить правки и вернуться к опубликованной версии?')) return;
  await api('discard', { revision: state.revision });
  reloadPage('Черновик сброшен');
}));

const previousMessage = sessionStorage.getItem('anna-edit-status');
if (previousMessage) {
  status.textContent = previousMessage;
  sessionStorage.removeItem('anna-edit-status');
}
