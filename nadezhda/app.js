const collections = {
  bento: {
    title: 'Бенто',
    description: 'Три идеи оформления небольшого торта.',
    products: ['bento-berries', 'bento-xl', 'bento-honey'],
    custom: 'custom-bento',
    withFilling: true
  },
  cakes: {
    title: 'Торты',
    description: 'Примеры оформления и место для вашей идеи.',
    products: ['cake-lambeth', 'cake-ruby'],
    custom: 'custom-cake',
    withFilling: true
  },
  honey: {
    title: 'Медовики',
    description: 'Два варианта оформления медового торта.',
    products: ['honey-berries', 'honey-fire'],
    custom: 'custom-honey',
    withFilling: true
  },
  gingerbread: {
    title: 'Пряники',
    description: 'Примеры фигурных и объёмных пряников.',
    products: ['gingerbread-house', 'gingerbread-cats'],
    custom: 'custom-gingerbread'
  },
  zephyr: {
    title: 'Зефир',
    description: 'Зефир в подарочной упаковке и в виде цветов.',
    products: ['zephyr-bouquet', 'zephyr-box'],
    custom: 'custom-zephyr'
  },
  cupcakes: {
    title: 'Капкейки',
    description: 'Порционные десерты для торжества.',
    products: ['cupcakes-wedding', 'cupcakes-party'],
    custom: 'custom-cupcakes'
  }
};

const descriptions = {
  'bento-berries': 'Малина, черника и свечи в форме цифр.',
  'bento-xl': 'Цветная роспись и фигурки для детского праздника.',
  'bento-honey': 'Круг из малины и надпись в центре.',
  'cake-lambeth': 'Розовые кремовые воланы и зелёные детали.',
  'cake-ruby': 'Зелёное оформление и яркие ягодные слои.',
  'honey-berries': 'Золотистая обсыпка и свежие ягоды на фото.',
  'honey-fire': 'Фигурка пожарной машины и декор в цветах огня.',
  'gingerbread-house': 'Объёмный домик с подсолнухами.',
  'gingerbread-cats': 'Медово-имбирные пряники с фигурной росписью.',
  'zephyr-bouquet': 'Зефир, собранный в букет.',
  'zephyr-box': 'Подарочный набор в коробке.',
  'cupcakes-wedding': 'Капкейки с декором для свадьбы.',
  'cupcakes-party': 'Набор с ярким тематическим декором.'
};

const fillings = {
  strawberry: 'Клубничная',
  chocolate: 'Шоколадная',
  lingonberry: 'Брусника с маком',
  cranberry: 'Клюква и инжир',
  custom: 'Своя начинка',
  discuss: 'Обсудим в чате'
};

const dialog = document.querySelector('.order-dialog');
const title = document.querySelector('#order-title');
const dateStep = document.querySelector('#date-step');
const categoryStep = document.querySelector('#category-step');
const productStep = document.querySelector('#product-step');
const orderCategories = document.querySelector('#order-categories');
const orderProducts = document.querySelector('#order-products');
const form = document.querySelector('#order-form');
const fillingField = form.querySelector('.fillings');
const fillingDetails = document.querySelector('#custom-filling');
const fillingInput = form.elements.customFilling;
const fillingError = document.querySelector('#filling-error');
const successStep = document.querySelector('#success-step');
const selectedProduct = document.querySelector('#selected-product');
const continueButton = document.querySelector('[data-continue]');
const dateGrid = document.querySelector('#dates');
const monthTitle = document.querySelector('#month-title');
const monthButtons = [...document.querySelectorAll('[data-month]')];
const selectedDates = [...document.querySelectorAll('[data-selected-date]')];
const receipt = document.querySelector('#receipt');
const contactInput = form.elements.contact;
const contactError = document.querySelector('#contact-error');
const commentInput = form.elements.comment;
const commentLabel = document.querySelector('.comment-label');
const commentOptional = document.querySelector('.comment-optional');
const commentError = document.querySelector('#comment-error');
const orderError = document.querySelector('#order-error');
const categoryLinks = [...document.querySelectorAll('[data-category]')];
const collectionTitle = document.querySelector('#collection-title');
const collectionDescription = document.querySelector('#collection-description');
const productList = document.querySelector('#product-list');
const dateLabel = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const monthLabel = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const calendarHorizon = 5;

let products = {};
let choice = null;
let today;
let shownMonth;
let trigger;
let openFromKeyboard = false;
let currentStep;
let dateReturnStep;

const steps = { date: dateStep, category: categoryStep, product: productStep, form, success: successStep };
const stepTitles = {
  date: 'Выберите дату',
  category: 'Что закажем?',
  form: 'Детали заказа',
  success: 'Демо-заявка сохранена'
};

function node(tag, className, content) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (content) result.textContent = content;
  return result;
}

function productIds(collection) {
  return [...collection.products, collection.custom].filter(id => Object.hasOwn(products, id));
}

function categoryOf(id) {
  return Object.keys(collections).find(key => {
    const collection = collections[key];
    return collection.custom === id || collection.products.includes(id);
  });
}

function productCard(id, collection) {
  const product = products[id];
  const custom = id === collection.custom;
  const article = node('article', 'product-card');
  const photo = node('img');
  photo.src = product.small;
  photo.alt = product.alt;
  photo.width = product.width;
  photo.height = product.height;
  photo.loading = 'lazy';
  const picture = node('div', 'product-picture');
  picture.append(photo);
  if (product.source) {
    const source = node('a', 'source', '↗');
    source.href = product.source;
    source.setAttribute('aria-label', 'Источник фотографии: ' + product.title);
    picture.append(source);
  }
  if (custom) picture.append(node('span', 'example-note', 'Фото для примера'));
  const cta = node('button', 'outline', custom ? 'Описать свой вариант' : 'Хочу похожий');
  cta.type = 'button';
  cta.dataset.order = id;
  if (!custom) cta.setAttribute('aria-label', 'Хочу похожий: ' + product.title);
  const detail = custom ? 'Опишите, каким вы представляете своё изделие.' : descriptions[id];
  article.append(picture, node('h4', '', product.title), node('p', '', detail), cta);
  return article;
}

function orderOption(label, product, onSelect, note = '') {
  const button = node('button', 'order-option');
  button.type = 'button';
  if (product) {
    const image = node('img');
    image.src = product.small;
    image.alt = '';
    image.width = product.width;
    image.height = product.height;
    image.loading = 'lazy';
    button.append(image);
  }
  const caption = node('span', '', label);
  if (note) caption.append(node('small', '', note));
  button.append(caption);
  button.addEventListener('click', onSelect);
  return button;
}

function paintOrderCategories() {
  orderCategories.replaceChildren(...Object.entries(collections).map(([id, collection]) =>
    orderOption(collection.title, products[collection.products[0]], () => {
      choice.category = id;
      paintOrderProducts();
      showStep('product');
    })
  ));
}

function paintOrderProducts() {
  const collection = collections[choice.category];
  const items = productIds(collection);
  if (!items.length) {
    orderProducts.replaceChildren(node('p', 'hint', 'Не удалось открыть изделия. Закройте форму и обновите страницу.'));
    return;
  }
  orderProducts.replaceChildren(...items.map(id => {
    const custom = id === collection.custom;
    return orderOption(custom ? 'Описать свой вариант' : products[id].title, products[id], () => {
      selectProduct(id);
      showStep('form');
    }, custom ? 'Фото для примера' : '');
  }));
}

function openOrderCategories() {
  paintOrderCategories();
  showStep('category');
}

function activeCategory() {
  return Object.hasOwn(collections, location.hash.slice(1)) ? location.hash.slice(1) : 'bento';
}

function paintCollection(category) {
  const collection = collections[category];
  categoryLinks.forEach(link => {
    if (link.dataset.category === category) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
  collectionTitle.textContent = collection.title;
  collectionDescription.textContent = collection.description;
  productList.replaceChildren(...productIds(collection).map(id => productCard(id, collection)));
}

categoryLinks.forEach(link => link.addEventListener('click', event => {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (activeCategory() === link.dataset.category) return;
  history.pushState(null, '', link.hash);
  paintCollection(link.dataset.category);
}));
window.addEventListener('popstate', () => paintCollection(activeCategory()));

function ymd(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function dateAt(offset, day = 1) {
  return new Date(today.getFullYear(), today.getMonth() + offset, day);
}

function sameDate(first, second) {
  return second && ymd(first) === ymd(second);
}

function dayState(date) {
  if (date < today) return 'past';
  const sinceToday = Math.round((date.getTime() - today.getTime()) / 86400000);
  return [2, 5].includes(sinceToday % 7) ? 'occupied' : 'available';
}

function paintDates() {
  const first = dateAt(shownMonth);
  const offset = (first.getDay() + 6) % 7;
  const end = dateAt(shownMonth + 1, 0).getDate();
  monthTitle.textContent = monthLabel.format(first);
  monthButtons[0].disabled = shownMonth === 0;
  monthButtons[1].disabled = shownMonth === calendarHorizon;
  const controls = Array.from({ length: offset }, () => node('span', 'date-blank'));
  for (let number = 1; number <= end; number++) {
    const day = dateAt(shownMonth, number);
    const state = dayState(day);
    const description = { past: 'дата прошла', occupied: 'занято в демо', available: 'доступно в демо' }[state];
    const button = node('button', 'day', String(number));
    button.type = 'button';
    button.dataset.date = ymd(day);
    button.dataset.state = state;
    button.disabled = state !== 'available';
    button.setAttribute('aria-label', dateLabel.format(day) + ', ' + description);
    button.setAttribute('aria-pressed', String(Boolean(sameDate(day, choice?.date))));
    button.addEventListener('click', () => {
      choice.date = day;
      dateGrid.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-pressed', 'true');
      continueButton.disabled = false;
    });
    controls.push(button);
  }
  dateGrid.replaceChildren(...controls);
  continueButton.disabled = !choice?.date;
}

function showStep(step) {
  currentStep = step;
  for (const [name, element] of Object.entries(steps)) element.hidden = name !== step;
  title.textContent = step === 'product' ? collections[choice.category].title : stepTitles[step];
  selectedProduct.hidden = !choice.product || step === 'category' || step === 'product' || step === 'success';
  dialog.scrollTop = 0;
  title.focus({ preventScroll: true });
}

function selectProduct(id) {
  const category = collections[categoryOf(id)];
  if (choice.productId !== id && form.elements.filling) {
    for (const radio of form.elements.filling) radio.checked = false;
    fillingInput.value = '';
  }
  choice.productId = id;
  choice.product = products[id];
  choice.custom = id === category.custom;
  choice.needsFilling = Boolean(category.withFilling);
  selectedProduct.textContent = choice.product.title;
  fillingField.hidden = !choice.needsFilling;
  fillingField.disabled = !choice.needsFilling;
  commentLabel.textContent = choice.custom ? 'Опишите свой вариант' : 'Комментарий';
  commentOptional.hidden = choice.custom;
  commentInput.required = choice.custom;
  clearErrors();
  syncCustomFilling();
}

function openOrder(button, keyboard) {
  trigger = button;
  openFromKeyboard = keyboard;
  const now = new Date();
  today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  shownMonth = 0;
  const id = button.dataset.order;
  choice = { category: categoryOf(id), productId: '', product: null, date: null };
  form.reset();
  if (products[id]) selectProduct(id);
  dateReturnStep = choice.product ? 'form' : 'category';
  dialog.classList.toggle('instant', keyboard);
  dialog.showModal();
  paintDates();
  showStep('date');
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-order]');
  if (button && !dialog.open) openOrder(button, event.detail === 0);
});
dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('close', () => trigger?.focus({ preventScroll: true }));
dialog.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !openFromKeyboard) dialog.classList.add('instant');
});
monthButtons.forEach(button => button.addEventListener('click', () => {
  shownMonth += Number(button.dataset.month);
  paintDates();
  if (button.disabled) monthButtons.find(control => !control.disabled)?.focus();
}));
continueButton.addEventListener('click', () => {
  if (!choice?.date) return;
  const selection = dateLabel.format(choice.date);
  for (const label of selectedDates) label.textContent = selection;
  if (dateReturnStep === 'category') openOrderCategories();
  else showStep(dateReturnStep);
});
dialog.querySelectorAll('[data-change-date]').forEach(button => button.addEventListener('click', () => {
  dateReturnStep = currentStep;
  showStep('date');
}));
dialog.querySelectorAll('[data-change-category]').forEach(button => button.addEventListener('click', openOrderCategories));

function setContactError(message = '') {
  contactError.textContent = message;
  contactError.hidden = !message;
  contactInput.setCustomValidity(message);
  if (message) contactInput.setAttribute('aria-invalid', 'true');
  else contactInput.removeAttribute('aria-invalid');
}

function clearErrors() {
  setContactError();
  setCommentError();
  setFillingError();
  orderError.hidden = true;
}

contactInput.addEventListener('input', () => setContactError());

function setCommentError(message = '') {
  commentError.textContent = message;
  commentError.hidden = !message;
  commentInput.setCustomValidity(message);
  if (message) commentInput.setAttribute('aria-invalid', 'true');
  else commentInput.removeAttribute('aria-invalid');
}

commentInput.addEventListener('input', () => setCommentError());

function setFillingError(message = '') {
  fillingError.textContent = message;
  fillingError.hidden = !message;
  fillingInput.setCustomValidity(message);
  if (message) fillingInput.setAttribute('aria-invalid', 'true');
  else fillingInput.removeAttribute('aria-invalid');
}

function syncCustomFilling() {
  const active = choice.needsFilling && form.elements.filling.value === 'custom';
  fillingDetails.hidden = !active;
  fillingInput.disabled = !active;
  fillingInput.required = Boolean(active);
  setFillingError();
}

fillingField.addEventListener('change', event => {
  if (event.target.name === 'filling') syncCustomFilling();
});
fillingInput.addEventListener('input', () => setFillingError());

function validContact(contact) {
  const telegram = /^(?:(?:https?:\/\/)?(?:www\.)?t\.me\/|@)([a-z0-9_]{4,32})\/?$/i.test(contact);
  const username = /^[a-z][a-z0-9_]{3,31}$/i.test(contact);
  if (telegram || username) return true;
  const digits = contact.replace(/\D/g, '').length;
  return /^\+?[0-9 ()-]+$/.test(contact) && digits >= 7 && digits <= 15;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  clearErrors();
  const data = new FormData(form);
  const name = data.get('name').trim();
  const contact = data.get('contact').trim();
  const filling = data.get('filling') || '';
  const customFilling = (data.get('customFilling') || '').trim();
  const comment = data.get('comment').trim();
  if (!validContact(contact)) {
    setContactError('Введите телефон, имя пользователя или ссылку на профиль Telegram.');
    contactInput.reportValidity();
    return;
  }
  if (choice?.custom && !comment) {
    setCommentError('Опишите, какое изделие вы хотите заказать.');
    commentInput.reportValidity();
    return;
  }
  if (filling === 'custom' && !customFilling) {
    setFillingError('Укажите желаемую начинку.');
    fillingInput.reportValidity();
    return;
  }
  if (!name || !choice?.product || !choice.date || dayState(choice.date) !== 'available' || (choice.needsFilling && !Object.hasOwn(fillings, filling))) {
    orderError.textContent = choice?.needsFilling ? 'Заполните имя, выберите дату и начинку.' : 'Заполните имя и выберите дату.';
    orderError.hidden = false;
    return;
  }
  const request = {
    name, contact, filling, date: ymd(choice.date),
    category: categoryOf(choice.productId),
    productId: choice.productId,
    sample: choice.product.title,
    comment,
    customFilling,
    savedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem('nadezhda-bakery-demo-request-v1', JSON.stringify(request));
  } catch {
    orderError.textContent = 'Браузер не сохранил заявку. Попробуйте ещё раз.';
    orderError.hidden = false;
    return;
  }
  receipt.textContent = [dateLabel.format(choice.date), choice.product.title, fillings[filling]].filter(Boolean).join(' · ');
  showStep('success');
});

try {
  const response = await fetch('assets/sources.json');
  if (!response.ok) throw new Error('Missing source list');
  products = await response.json();
  paintCollection(activeCategory());
  if (dialog.open && currentStep === 'category') paintOrderCategories();
} catch {
  productList.append(node('p', 'hint', 'Не удалось открыть каталог. Обновите страницу.'));
}
