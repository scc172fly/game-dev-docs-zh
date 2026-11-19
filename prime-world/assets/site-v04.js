(()=>{
'use strict';
// V0.5.1: site-wide themed dropdown. It is intentionally outside hash/TOC navigation.
const key = 'pw-theme-v04';
const docroot = document.documentElement;
const options = [
  {value:'system', label:'跟随系统', desc:'自动匹配系统外观', icon:'monitor'},
  {value:'dark', label:'深色模式', desc:'沉浸式暗色界面', icon:'moon'},
  {value:'light', label:'浅色模式', desc:'明亮阅读界面', icon:'sun'}
];
const glyphs = {
  monitor:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  moon:'<path d="M20.7 13.3A9 9 0 0 1 10.7 3.3 9 9 0 1 0 20.7 13.3Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'
};
const svg=(name)=>'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+glyphs[name]+'</svg>';
const shell=document.querySelector('.pw-theme-wrap');
const native=shell?.querySelector('.pw-theme-select');
let trigger=null, menu=null, iconArea=null, selectedLabel=null;
let entries=[];
function stored(){try{const t=localStorage.getItem(key);return ['system','dark','light'].includes(t)?t:'system'}catch(e){return 'system'}}
function effective(value){return value==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):value}
function currentOption(value){return options.find(o=>o.value===value)||options[0]}
function closeMenu(){if(!shell||!menu)return;shell.classList.remove('is-open');menu.hidden=true;trigger?.setAttribute('aria-expanded','false')}
function updateLabels(value){
  const selected=currentOption(value);
  if(selectedLabel)selectedLabel.textContent=selected.label;
  if(iconArea)iconArea.innerHTML=svg(selected.icon);
  if(native)native.value=value;
  entries.forEach(([button,entry])=>{const on=entry.value===value;button.setAttribute('aria-checked',String(on));button.classList.toggle('is-selected',on)});
}
// Preserve the reader's absolute scroll position. In particular, do NOT scroll to location.hash.
function changeTheme(value,preserveScroll){
  if(!options.some(o=>o.value===value))value='system';
  const x=window.scrollX,y=window.scrollY;
  if(preserveScroll)docroot.classList.add('pw-theme-changing');
  docroot.dataset.theme=effective(value);
  docroot.dataset.themePref=value;
  updateLabels(value);
  if(preserveScroll){
    const restore=()=>window.scrollTo({left:x,top:y,behavior:'instant'});
    restore();
    requestAnimationFrame(()=>{restore();requestAnimationFrame(()=>{restore();docroot.classList.remove('pw-theme-changing')})});
  }
}
function choose(value){
  closeMenu();
  try{localStorage.setItem(key,value)}catch(e){}
  changeTheme(value,true);
  trigger?.focus({preventScroll:true});
}
if(shell&&native){
  // Keep a hidden select as a non-JavaScript fallback, but never show OS-styled options.
  shell.classList.add('pw-theme-picker');
  native.hidden=true;native.tabIndex=-1;native.setAttribute('aria-hidden','true');
  shell.querySelector('.a5-theme-icon')?.remove();
  shell.querySelector('.pw-caret')?.remove();
  trigger=document.createElement('button');trigger.type='button';trigger.className='pw-theme-trigger';
  trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','切换显示主题');
  iconArea=document.createElement('span');iconArea.className='pw-theme-trigger-icon';
  selectedLabel=document.createElement('span');selectedLabel.className='pw-theme-trigger-label';
  const arrow=document.createElement('span');arrow.className='pw-theme-trigger-arrow';arrow.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  trigger.append(iconArea,selectedLabel,arrow);
  menu=document.createElement('div');menu.className='pw-theme-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','外观主题');menu.hidden=true;
  for(const opt of options){
    const item=document.createElement('button');item.type='button';item.className='pw-theme-option';item.dataset.value=opt.value;
    item.setAttribute('role','menuitemradio');item.setAttribute('aria-checked','false');
    item.innerHTML='<span class="pw-theme-option-icon">'+svg(opt.icon)+'</span><span class="pw-theme-option-content"><span class="pw-theme-option-title"></span><span class="pw-theme-option-desc"></span></span><span class="pw-theme-option-check" aria-hidden="true">✓</span>';
    item.querySelector('.pw-theme-option-title').textContent=opt.label;
    item.querySelector('.pw-theme-option-desc').textContent=opt.desc;
    item.addEventListener('click',(e)=>{e.preventDefault();choose(opt.value)});
    item.addEventListener('keydown',(e)=>{
      const i=entries.findIndex(([b])=>b===item);
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();const delta=e.key==='ArrowDown'?1:-1;entries[(i+delta+entries.length)%entries.length][0].focus({preventScroll:true});
      }else if(e.key==='Escape'){e.preventDefault();closeMenu();trigger.focus({preventScroll:true})}
      else if(e.key==='Home'||e.key==='End'){e.preventDefault();entries[e.key==='Home'?0:entries.length-1][0].focus({preventScroll:true})}
      else if(e.key==='Tab'){closeMenu()}
    });
    menu.append(item);entries.push([item,opt]);
  }
  shell.append(trigger,menu);
  trigger.addEventListener('click',(e)=>{
    e.preventDefault();
    const willOpen=menu.hidden;
    menu.hidden=!willOpen;shell.classList.toggle('is-open',willOpen);trigger.setAttribute('aria-expanded',String(willOpen));
  });
  trigger.addEventListener('keydown',(e)=>{
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();menu.hidden=false;shell.classList.add('is-open');trigger.setAttribute('aria-expanded','true');
      const i=e.key==='ArrowDown'?0:entries.length-1;entries[i][0].focus({preventScroll:true});
    }else if(e.key==='Escape'){closeMenu()}
  });
  document.addEventListener('pointerdown',(e)=>{if(!shell.contains(e.target))closeMenu()});
  document.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&!menu.hidden){e.preventDefault();closeMenu();trigger.focus({preventScroll:true})}});
  native.addEventListener('change',()=>choose(native.value));
}
changeTheme(stored(),false);
const media=matchMedia('(prefers-color-scheme: light)');
media.addEventListener?.('change',()=>{if(stored()==='system')changeTheme('system',true)});
// Existing site navigation and search remain unchanged.
const mobile=document.querySelector('.pw-mobile-toggle'),nav=document.getElementById('pw-primary-nav');
if(mobile&&nav){mobile.addEventListener('click',()=>{const open=nav.classList.toggle('is-open');mobile.setAttribute('aria-expanded',String(open))});document.addEventListener('click',e=>{if(!e.target.closest('.pw-site-header')){nav.classList.remove('is-open');mobile.setAttribute('aria-expanded','false')}})}
const search=document.getElementById('pw-search-input'),out=document.getElementById('pw-search-results');
function esc(t){return String(t??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]))}
if(search&&out){
  const indexUrl = new URL('search-index.js', document.currentScript.src).href;
  let indexRequest;
  let revision = 0;
  function loadIndex() {
    if (window.PW_SEARCH) return Promise.resolve();
    if (!indexRequest) {
      indexRequest = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = indexUrl;
        script.onload = resolve;
        script.onerror = () => {
          script.remove();
          indexRequest = undefined;
          reject(new Error('Search index unavailable'));
        };
        document.head.appendChild(script);
      });
    }
    return indexRequest;
  }
  function dismiss() {
    revision++;
    out.classList.remove('is-open');
  }
  async function update(){const q=search.value.trim().toLowerCase();if(!q){dismiss();out.innerHTML='';return}const current = ++revision;
    if (!window.PW_SEARCH) {
      out.textContent = '正在加载搜索索引…';
      out.classList.add('is-open');
      try {
        await loadIndex();
      } catch (error) {
        if (current === revision) out.textContent = '搜索索引加载失败，请重新输入以重试。';
        return;
      }
    }
    if (current !== revision) return;
    const matches=(window.PW_SEARCH||[]).filter(x=>((x.name||'')+' '+(x.words||'')).toLowerCase().includes(q)).slice(0,13);out.innerHTML=matches.length?matches.map(x=>`<a href="${esc(window.PW_V04_ROOT||'')+esc(x.url)}"><strong>${esc(x.name)}</strong><small>${esc(x.kind)} · ${esc((x.words||'').slice(0,66))}</small></a>`).join(''):'<div style="padding:16px;color:var(--soft);font-size:12px">没有匹配结果，可尝试英雄名、技能名或英文术语。</div>';out.classList.add('is-open')}
  search.addEventListener('input',update);search.addEventListener('focus',update);
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.pw-search-wrap'))dismiss()});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.focus();search.select()}if(e.key==='Escape'&&search===document.activeElement){dismiss();search.blur()}});
}
})();