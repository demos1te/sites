import { readCatalog, writeCatalog, resetCatalog, heroBlocks, heroFonts } from './store.js?v=glass-only';

const editable = '[data-edit-path][data-edit-type]';
const actions = '[data-edit-toggle], [data-edit-reset], [data-edit-collection], [data-edit-remove]';
const formats = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];
const photoAccept = formats.concat('.heic', '.heif').join(',');
const defaultColor = '#e8d7c1';
const scopes = new Set(['text', 'price', 'media', 'background']);

const dialog = document.createElement('dialog');
dialog.className = 'catalog-editor-dialog';
dialog.setAttribute('aria-labelledby', 'catalog-editor-heading');
dialog.innerHTML = `
  <div class="catalog-editor-panel">
    <header>
      <h2 id="catalog-editor-heading"></h2>
      <button type="button" data-editor-close aria-label="Закрыть">×</button>
    </header>
    <form>
      <div data-editor-fields></div>
      <p class="catalog-editor-error" role="alert" hidden></p>
      <footer>
        <button class="catalog-editor-submit" type="submit">Сохранить</button>
        <button type="button" data-editor-close>Отмена</button>
      </footer>
    </form>
  </div>`;
document.body.append(dialog);

const status = document.createElement('p');
status.className = 'catalog-editor-status';
status.setAttribute('role', 'status');
document.body.append(status);
const backgroundPicker = document.createElement('input');
backgroundPicker.type = 'file';
backgroundPicker.accept = photoAccept;
backgroundPicker.hidden = true;
backgroundPicker.dataset.backgroundPicker = '';
document.body.append(backgroundPicker);
const backgroundButton = document.querySelector('.background-button');

backgroundPicker.addEventListener('change', async () => {
  const file = backgroundPicker.files[0];
  if (!file) return;
  backgroundButton.disabled = true;
  try {
    updateValue('heroBackground', { color: '', image: await encodePhoto(file) });
    announce('Фон установлен в этом браузере.');
  } catch (failure) {
    announce(failure?.name === 'QuotaExceededError'
      ? 'Не хватило места для фона. Выберите фото меньшего размера.'
      : failure?.message || 'Не удалось установить фон.');
  } finally {
    backgroundButton.disabled = false;
    backgroundPicker.value = '';
    if (document.body.hasAttribute('data-editing')) backgroundButton.focus({ preventScroll: true });
  }
});

const form = dialog.querySelector('form');
const fields = dialog.querySelector('[data-editor-fields]');
const heading = dialog.querySelector('h2');
const submit = dialog.querySelector('[type="submit"]');
const error = dialog.querySelector('[role="alert"]');
let saveChange;
let origin;
let statusTimer;
let disposeFields;

function setError(text = '') {
  error.textContent = text;
  error.hidden = !text;
}

function announce(text) {
  clearTimeout(statusTimer);
  status.textContent = text;
  statusTimer = setTimeout(() => { status.textContent = ''; }, 3800);
}

function segments(path) {
  if (!/^(?:[a-z][a-z\d]*|\d+)(?:\.(?:[a-z][a-z\d]*|\d+))*$/i.test(path ?? '')) {
    throw new Error('Не удалось найти это поле.');
  }
  return path.split('.');
}

function readValue(site, path) {
  return segments(path).reduce((parent, key) => {
    if (parent && Object.hasOwn(parent, key)) return parent[key];
    throw new Error('Это поле уже изменилось. Откройте редактор ещё раз.');
  }, site);
}

function updateValue(path, value) {
  const site = structuredClone(readCatalog());
  const keys = segments(path);
  const name = keys.pop();
  const parent = keys.length ? readValue(site, keys.join('.')) : site;
  if (!Object.hasOwn(parent, name)) throw new Error('Это поле уже изменилось.');
  parent[name] = value;
  writeCatalog(site, path === 'heroBackground');
}

function updateList(path, modify) {
  const site = structuredClone(readCatalog());
  const list = readValue(site, path);
  if (!Array.isArray(list)) throw new Error('Не удалось открыть список.');
  modify(list);
  writeCatalog(site);
}

function action(label, run) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', run);
  return button;
}

function field(label, type, value, options = {}) {
  const wrapper = document.createElement('label');
  wrapper.className = 'catalog-editor-field';
  const control = document.createElement(type === 'textarea' ? 'textarea' : 'input');
  if (type !== 'textarea') control.type = type;
  if (type !== 'file') control.value = value ?? '';
  Object.assign(control, options);
  wrapper.append(document.createTextNode(label), control);
  return { wrapper, control };
}

function fontField(value) {
  const wrapper = document.createElement('label');
  wrapper.className = 'catalog-editor-field';
  const title = document.createElement('span');
  title.id = 'hero-setting-font';
  title.textContent = 'Шрифт';
  const control = document.createElement('select');
  control.setAttribute('aria-labelledby', title.id);
  for (const [key, font] of Object.entries(heroFonts)) control.add(new Option(font.label, key));
  control.value = value;
  wrapper.append(title, control);
  return { wrapper, control };
}

function editorSheet(title, trigger, controls, save, label = 'Сохранить', dispose) {
  disposeFields?.();
  disposeFields = dispose;
  heading.textContent = title;
  fields.replaceChildren(...controls);
  origin = trigger;
  saveChange = save;
  submit.textContent = label;
  submit.disabled = false;
  setError();
  if (!dialog.open) dialog.showModal();
  const startingPoint = fields.querySelector('input:not([type="file"]):not([type="color"]), textarea') ?? submit;
  startingPoint.focus({ preventScroll: true });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!saveChange || submit.disabled) return;
  setError();
  submit.disabled = true;
  try {
    await saveChange();
    dialog.close();
    announce('Изменения сохранены в этом браузере.');
  } catch (failure) {
    showFailure(failure);
  } finally {
    submit.disabled = false;
  }
});

function showFailure(failure) {
  setError(failure?.name === 'QuotaExceededError'
    ? 'В браузере закончилось место. Удалите несколько фотографий или выберите файл меньшего размера.'
    : (failure?.message || 'Не удалось сохранить изменения.'));
}

dialog.querySelectorAll('[data-editor-close]').forEach(button => {
  button.addEventListener('click', () => { if (!submit.disabled) dialog.close(); });
});

dialog.addEventListener('cancel', event => { if (submit.disabled) event.preventDefault(); });

dialog.addEventListener('close', () => {
  saveChange = undefined;
  disposeFields?.();
  disposeFields = undefined;
  if (origin?.isConnected) origin.focus({ preventScroll: true });
  else document.querySelector('[data-edit-toggle]')?.focus({ preventScroll: true });
  origin = undefined;
});

function mediaFields(current) {
  const palette = /^#[0-9a-f]{6}$/i.test(current?.color ?? '') ? current.color : defaultColor;
  const color = field('Цвет заглушки', 'color', palette);
  const upload = field('Загрузить фото', 'file', '', {
    accept: photoAccept
  });
  const preview = document.createElement('div');
  preview.className = 'catalog-editor-preview';
  preview.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img');
  image.alt = '';
  preview.append(image);
  const row = document.createElement('div');
  row.className = 'catalog-editor-media-actions';

  const selected = { color: current?.color || '', image: current?.image || '' };
  let file;
  let temporaryUrl = '';

  function releasePreview() {
    if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
    temporaryUrl = '';
  }

  function paint() {
    preview.style.backgroundColor = selected.color || palette;
    const source = temporaryUrl || selected.image;
    image.hidden = !source;
    if (source) image.src = source;
    else image.removeAttribute('src');
  }

  function removePhoto() {
    releasePreview();
    selected.image = '';
    selected.color ||= color.control.value;
    file = undefined;
    upload.control.value = '';
    paint();
  }

  color.control.addEventListener('input', () => {
    selected.color = color.control.value;
    removePhoto();
  });

  upload.control.addEventListener('change', () => {
    setError();
    releasePreview();
    file = upload.control.files[0];
    if (file) temporaryUrl = URL.createObjectURL(file);
    paint();
  });

  row.append(action('Оставить только цвет', removePhoto));

  paint();
  return {
    nodes: [preview, color.wrapper, upload.wrapper, row],
    dispose: releasePreview,
    async value() {
      return { color: selected.color, image: file ? await encodePhoto(file) : selected.image };
    }
  };
}

async function encodePhoto(file) {
  if ((!formats.includes(file.type) && !/\.(?:jpe?g|png|webp|avif|heic|heif)$/i.test(file.name)) || file.size > 16 * 1024 * 1024) {
    throw new Error('Выберите фото в формате JPG, PNG, WebP, AVIF или HEIC до 16 МБ.');
  }
  let bitmap;
  let source;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    source = URL.createObjectURL(file);
    const image = new Image();
    image.src = source;
    try {
      await image.decode();
      bitmap = image;
    } catch {
      URL.revokeObjectURL(source);
      throw new Error('Фотография не открывается. Попробуйте выбрать JPG или PNG.');
    }
  }
  try {
    const maxSide = 1100;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .72));
    if (!blob) throw new Error('Не удалось подготовить фотографию.');
    if (blob.size > 900 * 1024) throw new Error('Фотография слишком большая. Попробуйте выбрать другую.');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result), { once: true });
      reader.addEventListener('error', () => reject(new Error('Не удалось сохранить фотографию.')), { once: true });
      reader.readAsDataURL(blob);
    });
  } finally {
    bitmap.close?.();
    if (source) URL.revokeObjectURL(source);
  }
}

function removeAction(path, trigger) {
  const keys = segments(path);
  const index = Number(keys.pop());
  const listPath = keys.join('.');
  if (!Number.isInteger(index) || !/(?:^|\.)(?:works|photos)$/.test(listPath)) return;
  const isPhoto = listPath.endsWith('photos');
  const lastPhoto = isPhoto && readValue(readCatalog(), listPath).length === 1;
  const question = document.createElement('p');
  question.textContent = lastPhoto ? 'Последний кадр будет заменён однотонной заглушкой.'
    : isPhoto ? 'Удалить эту фотографию?' : 'Удалить эту работу из каталога?';
  editorSheet(isPhoto ? 'Удалить фотографию' : 'Удалить работу', trigger, [question], () => {
    updateList(listPath, list => {
      if (!list[index]) throw new Error('Эта запись уже удалена.');
      if (isPhoto && list.length === 1) list[index] = { color: defaultColor, image: '' };
      else list.splice(index, 1);
    });
  }, 'Удалить');
}

function orderControls(path, kind) {
  const keys = segments(path);
  const index = Number(keys.pop());
  const listPath = keys.join('.');
  const list = readValue(readCatalog(), listPath);
  if (list.length < 2) return null;
  const controls = document.createElement('div');
  controls.className = 'catalog-editor-media-actions';
  for (const step of [-1, 1]) {
    const destination = index + step;
    if (destination < 0 || destination >= list.length) continue;
    const order = step < 0 ? 'раньше' : 'позже';
    controls.append(action(`Переместить ${kind} ${order}`, () => {
      if (submit.disabled) return;
      try {
        updateList(listPath, current => {
          if (!current[index] || destination >= current.length) throw new Error('Список уже изменился.');
          const [item] = current.splice(index, 1);
          current.splice(destination, 0, item);
        });
        dialog.close();
        announce('Порядок сохранён в этом браузере.');
      } catch (failure) {
        showFailure(failure);
      }
    }));
  }
  return controls;
}

function editMedia(trigger, path) {
  const current = readValue(readCatalog(), path);
  const media = mediaFields(current);
  if (/\.photos\.\d+$/.test(path)) {
    const order = orderControls(path, 'кадр');
    if (order) media.nodes.push(order);
    media.nodes.push(action('Удалить этот кадр', () => removeAction(path, trigger)));
  }
  editorSheet('Изменить фотографию', trigger, media.nodes, async () => {
    updateValue(path, await media.value());
  }, 'Сохранить', media.dispose);
}

function textEditor(trigger, path, isPrice) {
  const site = readCatalog();
  const value = readValue(site, path);
  const name = segments(path).at(-1);
  const long = name === 'description' || name === 'intro';
  const label = isPrice ? 'Цена от, ₽' : long ? 'Описание' : 'Текст';
  const control = field(label, isPrice ? 'number' : long ? 'textarea' : 'text', value, {
    required: !long,
    ...(isPrice ? { min: 0, max: 99999999, step: 1 } : { maxLength: long ? 1000 : 100 })
  });
  const controls = [control.wrapper];
  const font = heroBlocks.includes(path) && trigger.closest('.home-hero-copy')
    ? fontField(site.heroLayout.typography[path].font)
    : null;
  if (font) controls.push(font.wrapper);
  if (/\.works\.\d+\.title$/.test(path)) {
    const order = orderControls(path.replace(/\.title$/, ''), 'работу');
    if (order) controls.push(order);
  }
  editorSheet(isPrice ? 'Изменить цену' : 'Изменить текст', trigger, controls, () => {
    const next = isPrice ? control.control.valueAsNumber : control.control.value.trim();
    if (!isPrice && !long && !next) throw new Error('Введите текст.');
    if (!font) {
      updateValue(path, next);
      return;
    }
    const updated = readCatalog();
    updated.heroLayout.typography[path].font = font.control.value;
    updated[path] = next;
    writeCatalog(updated);
  });
}

function editCollection(trigger) {
  const { editCollection: path, editKind: kind } = trigger.dataset;
  if (kind !== 'photos' && kind !== 'works') return;
  const media = mediaFields({ color: defaultColor, image: '' });
  if (kind === 'photos') {
    editorSheet('Добавить кадр', trigger, media.nodes, async () => {
      const photo = await media.value();
      updateList(path, list => list.push(photo));
    }, 'Добавить', media.dispose);
    return;
  }

  const title = field('Название', 'text', '', { required: true, maxLength: 100 });
  const price = field('Цена от, ₽', 'number', '', { required: true, min: 0, max: 99999999, step: 1 });
  const description = field('Описание', 'textarea', '', { maxLength: 1000 });
  editorSheet('Добавить работу', trigger, [title.wrapper, price.wrapper, description.wrapper, ...media.nodes], async () => {
    const name = title.control.value.trim();
    if (!name) throw new Error('Укажите название работы.');
    const photo = await media.value();
    updateList(path, list => list.push({
      id: crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)),
        value => value.toString(16).padStart(2, '0')).join(''),
      title: name,
      description: description.control.value.trim(),
      price: price.control.valueAsNumber,
      photos: [photo]
    }));
  }, 'Добавить', media.dispose);
}

function toggleEditing() {
  const editing = document.body.toggleAttribute('data-editing');
  document.querySelectorAll('[data-edit-toggle]').forEach(toggle => {
    toggle.setAttribute('aria-pressed', String(editing));
    (toggle.querySelector('[data-edit-toggle-label]') ?? toggle).textContent = editing ? 'Готово' : 'Редактировать';
  });
  refreshFocus();
  announce(editing ? 'Нажмите на текст или фотографию, чтобы изменить.' : 'Режим редактирования закрыт.');
}

function refreshFocus() {
  if (document.body.hasAttribute('data-editing')) {
    for (const node of document.querySelectorAll(editable)) {
      if (!node.matches('a, button, input, select, textarea') && node.tabIndex < 0) {
        node.dataset.editorFocus = node.getAttribute('tabindex') ?? '';
        node.tabIndex = 0;
      }
    }
  } else {
    for (const node of document.querySelectorAll('[data-editor-focus]')) {
      const previous = node.dataset.editorFocus;
      if (previous) node.setAttribute('tabindex', previous);
      else node.removeAttribute('tabindex');
      delete node.dataset.editorFocus;
    }
  }
}

const observer = new MutationObserver(refreshFocus);
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener('keydown', event => {
  if (!['Enter', ' '].includes(event.key) || !(event.target instanceof Element)) return;
  if (event.target.matches('[data-editor-focus]') && document.body.hasAttribute('data-editing')) {
    event.preventDefault();
    event.target.click();
  }
});

document.addEventListener('click', event => {
  if (!(event.target instanceof Element) || dialog.contains(event.target)) return;
  const target = event.target.closest(actions) || event.target.closest(editable);
  if (!target) return;
  if (target.matches('[data-edit-toggle]')) {
    event.preventDefault();
    toggleEditing();
    return;
  }
  if (!document.body.hasAttribute('data-editing')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const { editPath: path, editType: type } = target.dataset;
  try {
    if (target.matches('[data-edit-reset]')) {
      const question = document.createElement('p');
      question.textContent = 'Вернуть исходные тексты, цены, фотографии и фон?';
      editorSheet('Сбросить изменения', target, [question], resetCatalog, 'Сбросить');
    } else if (target.matches('[data-edit-remove]')) {
      removeAction(target.dataset.editRemove, target);
    } else if (target.matches('[data-edit-collection]')) {
      editCollection(target);
    } else if (scopes.has(type)) {
      if (type === 'background') backgroundPicker.click();
      else if (type === 'media') editMedia(target, path);
      else textEditor(target, path, type === 'price');
    }
  } catch (failure) {
    announce(failure?.message || 'Не удалось открыть редактор.');
  }
}, true);

if (new URLSearchParams(location.search).get('edit') === '1') toggleEditing();
