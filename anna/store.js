const catalogKey = 'anna-catalog-preview-v2';
const themeKey = catalogKey + '-theme';
const themes = ['journal', 'album', 'studio', 'glass'];
const swatches = ['#E8D9CA', '#D8C3AF', '#F0E4D6', '#CDB6A0', '#E5D1BC'];

function work(index, amount, offset) {
  return {
    id: 'variant-' + index,
    title: 'Название ' + index,
    description: 'Описание варианта оформления, его состав и детали.',
    price: amount,
    photos: Array.from({ length: index + 1 }, (_, frame) => ({
      color: swatches[(frame + offset) % swatches.length],
      image: '',
    })),
  };
}

function collection(id, title, description, amount, colorIndex) {
  return {
    id, title, description, cover: { color: swatches[colorIndex], image: '' },
    sections: [],
    works: [work(1, amount, colorIndex), work(2, amount + 3500, colorIndex + 2)],
  };
}

const initial = {
  brand: 'Анна Сушкова',
  heading: 'Декор ваших событий',
  intro: 'Оформляю свадьбы и праздники в Самаре. Посмотрите варианты для вашего повода.',
  catalogueTitle: 'Каталог',
  catalogueAction: 'Смотреть каталог',
  background: { color: '', image: '' },
  heroBackground: { color: '', image: '' },
  categories: [
    {
      id: 'wedding',
      title: 'Свадьба',
      description: 'Оформление церемонии, зала и деталей свадебного дня.',
      cover: { color: swatches[0], image: '' },
      sections: [
        collection('presidium', 'Президиум', 'Оформление стола молодожёнов.', 14000, 0),
        collection('photozone', 'Фотозона', 'Фон и детали для свадебных фотографий.', 10000, 1),
        collection('ceremony', 'Выездная регистрация', 'Оформление места церемонии.', 17000, 2),
        collection('guest-tables', 'Декор гостевых столов', 'Композиции и детали сервировки.', 8000, 3),
        collection('seating-plan', 'План рассадки', 'Оформление списка гостей и плана столов.', 4500, 4),
      ],
      works: [],
    },
    collection('anniversary', 'Юбилей', 'Варианты оформления юбилея.', 9000, 1),
    collection('graduation', 'Выпускной', 'Декор для выпускного вечера.', 11000, 2),
    collection('new-year', 'Новый год', 'Оформление новогоднего праздника.', 12500, 4),
  ],
};

export function readCatalog() {
  try {
    const stored = JSON.parse(localStorage.getItem(catalogKey));
    if (stored?.background && Array.isArray(stored.categories)) {
      if (!stored.heroBackground?.color && !stored.heroBackground?.image) {
        stored.heroBackground = stored.background || { color: '', image: '' };
      }
      stored.background = { color: '', image: '' };
      stored.catalogueTitle ??= initial.catalogueTitle;
      stored.catalogueAction ??= initial.catalogueAction;
      return stored;
    }
  } catch {}
  return structuredClone(initial);
}

export function writeCatalog(site) {
  localStorage.setItem(catalogKey, JSON.stringify(site));
  window.dispatchEvent(new Event('catalog:updated'));
}

export function resetCatalog() {
  localStorage.removeItem(catalogKey);
  window.dispatchEvent(new Event('catalog:updated'));
  return structuredClone(initial);
}

export function activeTheme() {
  const linked = new URLSearchParams(location.search).get('theme');
  if (themes.includes(linked)) return linked;
  try {
    const saved = localStorage.getItem(themeKey);
    if (themes.includes(saved)) return saved;
  } catch {}
  return 'journal';
}

export function setTheme(theme) {
  if (!themes.includes(theme)) return;
  try {
    localStorage.setItem(themeKey, theme);
  } catch {}
  const current = new URL(location.href);
  current.searchParams.set('theme', theme);
  history.replaceState(history.state, '', current);
  window.dispatchEvent(new Event('catalog:theme'));
}
