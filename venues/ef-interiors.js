import {bindGalleries} from './ef-carousel.js';
bindGalleries();
const active = location.pathname.match(/\/(evento|forma)(?:-[a-z]+)?\.html$/);
if (active) {
  const site = active[1];
  const home = new URL('./'+site+'.html',location.href).pathname;
  const key = 'venue-home-position-'+site;
  document.addEventListener('click',event=>{
    const anchor = event.target.closest('a[href]');
    if (!anchor || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin) return;
    const target = url.pathname.match(/\/(evento|forma)(?:-[a-z]+)?\.html$/);
    if (!target || target[1] !== site) return;
    try {
      if (location.pathname === home && url.pathname !== home) {
        sessionStorage.setItem(key,JSON.stringify({url:location.pathname+location.search+location.hash,y:scrollY}));
      } else if (location.pathname !== home && url.pathname === home && !url.hash) {
        const saved = JSON.parse(sessionStorage.getItem(key)||'null');
        if (saved) {
          sessionStorage.setItem(key+'-restore','1');
          anchor.href = saved.url;
        }
      }
    } catch {}
  });
  if (location.pathname === home) {
    try {
      if (sessionStorage.getItem(key+'-restore')) {
        sessionStorage.removeItem(key+'-restore');
        const saved = JSON.parse(sessionStorage.getItem(key));
        if (saved) addEventListener('load',()=>scrollTo({top:saved.y,behavior:'instant'}),{once:true});
      }
    } catch {}
  }
}
