import { createGlass } from './liquid-glass.js';

const root = document.documentElement;
const body = document.body;
const catalog = document.querySelector('#catalog-view');
const surfaceSelector = '.browse-catalogue, .theme-switch, .catalogue-head, .collection-hero, .occasion-card, .work-card, .work-dialog[open] .detail-copy, .work-dialog[open] .dialog-close';
const solidSurface = matchMedia('(prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)');
const surfaces = new Set();
const lenses = new Map();
const moving = new Map();
const failed = new WeakSet();
let alignFrame = 0;
let scanFrame = 0;

const isGlass = () => body.dataset.theme === 'glass' && !solidSurface.matches;

function alignLayers() {
  alignFrame = 0;
  const now = performance.now();
  for (const [node, end] of moving) {
    if (!node.isConnected || end <= now) moving.delete(node);
  }
  const width = root.clientWidth;
  const height = window.innerHeight;
  const bleed = parseFloat(getComputedStyle(body).getPropertyValue('--anna-backdrop-bleed')) || 0;
  const positions = Array.from(lenses.values(), lens => [lens, lens.pixels.getBoundingClientRect()]);
  for (const [lens, rect] of positions) {
    lens.replica.style.width = width + 2 * bleed + 'px';
    lens.replica.style.height = height + 2 * bleed + 'px';
    lens.replica.style.transform = `translate3d(${-rect.left - bleed}px, ${-rect.top - bleed}px, 0)`;
    lens.veil.style.width = width + 'px';
    lens.veil.style.height = height + 'px';
    lens.veil.style.transform = `translate3d(${-rect.left}px, ${-rect.top}px, 0)`;
    const stable = !Array.from(moving.keys()).some(node => node.contains(lens.target));
    lens.optic.style.visibility = stable ? '' : 'hidden';
    lens.target.toggleAttribute('data-glass-active', stable);
  }
  if (moving.size) alignOnFrame();
}

function alignOnFrame() {
  if (lenses.size && !alignFrame) alignFrame = requestAnimationFrame(alignLayers);
}

function geometryMoves(event) {
  const slidesIn = /^(view-arrival|card-scroll-arrival)$/.test(event.animationName);
  const morphs = event.propertyName === 'transform' && event.target.matches('.work-dialog, .browse-catalogue');
  return slidesIn || morphs;
}

function followMotion(event) {
  if (!isGlass() || !geometryMoves(event)) return;
  const target = event.target;
  moving.set(target, performance.now() + 360);
  // The compositor can advance a transform after main-thread measurements. Keep the
  // translucent sheet until the lens can register with the stationary page again.
  for (const lens of lenses.values()) {
    if (!target.contains(lens.target)) continue;
    lens.optic.style.visibility = 'hidden';
    lens.target.removeAttribute('data-glass-active');
  }
  alignOnFrame();
}

function finishMotion(event) {
  if (geometryMoves(event)) moving.delete(event.target);
  alignOnFrame();
}

function showGlass(target) {
  if (!isGlass() || !surfaces.has(target) || lenses.has(target) || failed.has(target)) return;
  const optic = document.createElement('span');
  const pixels = document.createElement('span');
  const replica = document.createElement('span');
  const veil = document.createElement('span');
  veil.className = 'glass-scene-wash';
  optic.className = 'glass-optic';
  pixels.className = 'glass-pixels';
  replica.className = 'glass-replica';
  optic.setAttribute('aria-hidden', 'true');
  optic.style.visibility = 'hidden';
  pixels.append(replica, veil);
  optic.append(pixels);
  target.prepend(optic);

  const control = target.matches('.browse-catalogue, .theme-switch, .dialog-close');
  const radius = Math.min(+(parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0), target.offsetHeight / 2, target.offsetWidth / 2);
  try {
    // The SVG filter applies to the clipped backdrop pixels, never to the labels.
    const glass = createGlass(pixels, {
      fit: true, radius,
      refraction: control ? 19 : 25,
      bezel: control ? 0.76 : 0.34,
      curvature: control ? 2.5 : 4,
      chroma: 0.14, blur: 1.1, specular: 0.7, specularWidth: 1.8, mapScale: 0.85,
    });
    lenses.set(target, { target, optic, pixels, replica, veil, glass });
    alignOnFrame();
  } catch {
    failed.add(target);
    optic.remove();
  }
}

function hideGlass(target) {
  const lens = lenses.get(target);
  if (!lens) return;
  lens.glass.destroy();
  lens.optic.remove();
  delete target.dataset.glassActive;
  lenses.delete(target);
}

const visibility = new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) {
    if (isIntersecting) showGlass(target);
    else hideGlass(target);
  }
}, { rootMargin: '80px 0px' });

const resize = new ResizeObserver(alignOnFrame);
resize.observe(root);
if (catalog) resize.observe(catalog);

function trackSurfaces() {
  scanFrame = 0;
  const enabled = isGlass();
  if (!enabled) moving.clear();
  const next = new Set(enabled ? document.querySelectorAll(surfaceSelector) : []);
  for (const target of surfaces) {
    if (next.has(target)) continue;
    visibility.unobserve(target);
    resize.unobserve(target);
    hideGlass(target);
    surfaces.delete(target);
  }
  for (const target of next) {
    if (surfaces.has(target)) continue;
    surfaces.add(target);
    visibility.observe(target);
    resize.observe(target);
  }
  alignOnFrame();
}

function scheduleScan() {
  if (!scanFrame) scanFrame = requestAnimationFrame(trackSurfaces);
}

const changes = new MutationObserver(scheduleScan);
changes.observe(body, { attributes: true, attributeFilter: ['data-theme'] });
if (catalog) changes.observe(catalog, { childList: true, subtree: true });
const dialog = document.querySelector('.work-dialog');
if (dialog) {
  changes.observe(dialog, { attributes: true, attributeFilter: ['open'], childList: true, subtree: true });
  dialog.addEventListener('scroll', alignOnFrame, { passive: true });
  dialog.addEventListener('transitionrun', followMotion);
  dialog.addEventListener('transitionend', finishMotion);
  dialog.addEventListener('transitioncancel', finishMotion);
}
window.addEventListener('scroll', alignOnFrame, { passive: true });
window.addEventListener('resize', alignOnFrame);
window.addEventListener('pageshow', scheduleScan);
catalog?.addEventListener('animationend', finishMotion);
catalog?.addEventListener('animationcancel', finishMotion);
catalog?.addEventListener('animationstart', followMotion);
catalog?.addEventListener('transitionrun', followMotion);
catalog?.addEventListener('transitionend', finishMotion);
catalog?.addEventListener('transitioncancel', finishMotion);
solidSurface.addEventListener('change', scheduleScan);
scheduleScan();
