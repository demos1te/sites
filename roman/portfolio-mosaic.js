import { createGlass } from './portfolio-gallery-glass.js';
import { archive } from './portfolio-archive.js?v=glass-mosaic-102';

const stage = document.querySelector('.mosaic-stage');
const viewer = document.querySelector('.mosaic-viewer');
const viewerImage = viewer.querySelector('img');
const formats = ['left', 'festival', 'violet', 'crowd', 'hockey', 'right'];
const optics = new WeakMap();
const reducedTransparency = matchMedia('(prefers-reduced-transparency: reduce)');

function makeCard(photo, format) {
  const card = document.createElement('a');
  card.className = `mosaic-card mosaic-card--${format}`;
  card.href = photo.src;
  const image = document.createElement('img');
  image.src = photo.src;
  image.alt = photo.alt;
  image.width = photo.width;
  image.height = photo.height;
  image.loading = 'lazy';
  image.decoding = 'async';
  card.append(image);
  return card;
}

const archiveGrids = document.createDocumentFragment();
for (let index = 0; index < archive.length; index += formats.length) {
  const grid = document.createElement('div');
  grid.className = 'mosaic-grid';
  archive.slice(index, index + formats.length).forEach((photo, slot) => {
    grid.append(makeCard(photo, formats[slot]));
  });
  archiveGrids.append(grid);
}
stage.append(archiveGrids);
const grids = [...stage.querySelectorAll('.mosaic-grid')];
for (const card of stage.querySelectorAll('.mosaic-card')) card.setAttribute('aria-haspopup', 'dialog');

stage.addEventListener('wheel', event => {
  if (!event.cancelable || event.ctrlKey || event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

  const end = stage.scrollWidth - stage.clientWidth;
  const goingRight = event.deltaY > 0;
  if (goingRight ? stage.scrollLeft >= end - 1 : stage.scrollLeft <= 1) return;

  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? stage.clientWidth : 1;
  event.preventDefault();
  stage.scrollLeft += event.deltaY * unit;
}, { passive: false });

stage.addEventListener('click', event => {
  const card = event.target.closest('.mosaic-card');
  if (!card || event.defaultPrevented || event.button || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

  event.preventDefault();
  const thumbnail = card.querySelector('img');
  viewerImage.alt = thumbnail.alt;
  viewerImage.src = card.href;
  viewer.showModal();
});

viewer.addEventListener('click', event => {
  if (event.target === viewer) viewer.close();
});

function addRims(grid) {
  if (reducedTransparency.matches || optics.has(grid)) return;

  const rims = [...grid.querySelectorAll('.mosaic-card')].map(card => {
    const rim = document.createElement('span');
    rim.className = 'mosaic-rim';
    rim.setAttribute('aria-hidden', 'true');
    rim.style.setProperty('--rim-image', `url("${card.href}")`);
    card.prepend(rim);

    const glass = createGlass(rim, {
      fit: true,
      radius: parseFloat(getComputedStyle(card).borderTopLeftRadius),
      refraction: 6,
      bezel: .18,
      chroma: 0,
      specular: .58,
      mapScale: 1,
    });
    return { rim, glass };
  });
  optics.set(grid, rims);
}

function removeRims(grid) {
  for (const { rim, glass } of optics.get(grid) ?? []) {
    glass.destroy();
    rim.remove();
  }
  optics.delete(grid);
}

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      target.toggleAttribute('data-in-view', isIntersecting);
      if (isIntersecting) addRims(target);
      else removeRims(target);
    }
  }, { rootMargin: '100px 0px' });
  grids.forEach(grid => observer.observe(grid));
}

reducedTransparency.addEventListener('change', () => {
  for (const grid of grids) {
    if (reducedTransparency.matches) removeRims(grid);
    else if (grid.hasAttribute('data-in-view')) addRims(grid);
  }
});
