(()=>{
'use strict';
const filters=document.querySelectorAll('.a5-filter'), cards=document.querySelectorAll('.a5-mode-card'),search=document.querySelector('#a5-mode-search');
if(filters.length&&cards.length){let active='全部';function run(){let term=(search?.value||'').trim().toLowerCase();let matched=0;cards.forEach(el=>{let ok=(active==='全部'||el.dataset.type===active)&&(!term||(el.dataset.name||'').toLowerCase().includes(term));el.hidden=!ok;if(ok)matched++});let stat=document.querySelector('#a5-visible-count');if(stat)stat.textContent=matched+ ' 个模式'}
filters.forEach(b=>b.addEventListener('click',()=>{filters.forEach(a=>a.classList.toggle('active',a===b));active=b.dataset.filter;run()}));search?.addEventListener('input',run);run()}
})();
