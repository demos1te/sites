const menu=document.querySelector('.menu-toggle');
if(menu){
  const nav=document.getElementById('site-nav');
  function menuOpen(open){
    menu.setAttribute('aria-expanded',String(open));
    nav.classList.toggle('is-open',open);
  }
  menu.addEventListener('click',()=>menuOpen(menu.getAttribute('aria-expanded')!=='true'));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){menuOpen(false);menu.focus();}
  });
}


