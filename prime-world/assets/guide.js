
'use strict';
(function(){
 function themeLabel(s){return s==='light'?'浅色':s==='system'?'跟随系统':'深色'}
 const th=document.getElementById('theme-switch');
 if(th)th.addEventListener('click',()=>{let old='dark';try{old=localStorage.getItem('pw-guide-theme')||'dark'}catch(e){}const next=({dark:'light',light:'system',system:'dark'})[old];try{localStorage.setItem('pw-guide-theme',next)}catch(e){}document.documentElement.dataset.theme=next==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):next;document.documentElement.dataset.themePref=next;th.querySelector('span').textContent=themeLabel(next)});
 if(th){let t=document.documentElement.dataset.themePref||'dark';th.querySelector('span').textContent=themeLabel(t)}
 const mb=document.getElementById('mobile-menu'),nav=document.getElementById('top-nav');
 if(mb&&nav)mb.addEventListener('click',()=>{let open=nav.classList.toggle('is-open');mb.setAttribute('aria-expanded',open?'true':'false')});
 const sideLinks=[...document.querySelectorAll('.side-nav a[href^="#"]')];const heads=sideLinks.map(a=>document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
 if(heads.length && 'IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){for(const a of sideLinks)a.classList.toggle('active',a.getAttribute('href')==='#'+e.target.id)}}},{rootMargin:'-130px 0px -65% 0px',threshold:0});for(const el of heads)observer.observe(el)}
 for(const a of document.querySelectorAll('[data-read]')){const key='pw-guide-read:'+a.dataset.read;try{a.checked=localStorage.getItem(key)==='1'}catch(e){}a.addEventListener('change',()=>{try{localStorage.setItem(key,a.checked?'1':'0')}catch(e){}})}
 // 6x6 board simulator: exact slot names/tiers from the saved atlas; simplified decision model.
 const boardRoot=document.getElementById('talent-simulator');
 if(boardRoot){let boards=[];try{boards=JSON.parse(document.getElementById('healer-board-data').textContent)}catch(e){}
  let current=0,primeInitial=3000,prime=primeInitial,learned=new Set(),dev=0,last='请先选择第一层的天赋，看看它怎样推动本局成长。';
  const board=document.getElementById('sim-board'), msg=document.getElementById('sim-msg'), detail=document.getElementById('sim-detail');
  function reset(){learned=new Set();prime=primeInitial;dev=0;boards[current].forEach((row,ri)=>row.forEach((x,ci)=>{if(x.auto){learned.add(ri+'-'+ci);dev+=x.dev}}));last='已加载原版配置。自动取得的天赋已经计入发展点。';paint()}
  function badge(x){return ({active:'主动',ultimate:'大招',passive:'被动',enhance:'强化',common:'通用'})[x.kind]||'其他'}
  function paint(){const tiers=[0,4,8,12,16,20];document.getElementById('sim-prime').textContent=prime.toLocaleString('zh-CN');document.getElementById('sim-dev').textContent=dev;document.getElementById('sim-tier').textContent=String(Math.min(6,Math.floor(dev/4)+1));
   msg.textContent=last;board.innerHTML='';if(!boards[current])return;
   for(let ri=0;ri<6;ri++){
    const row=document.createElement('div');row.className='sim-row';const lbl=document.createElement('div');lbl.className='sim-row-label';lbl.innerHTML='<b>第 '+(ri+1)+' 层</b><small>门槛 '+tiers[ri]+' 点</small>';row.append(lbl);
    for(let ci=0;ci<6;ci++){const x=boards[current][ri][ci],id=ri+'-'+ci,done=learned.has(id),open=dev>=tiers[ri];const btn=document.createElement('button');btn.type='button';btn.className='sim-tile kind-'+x.kind+(done?' is-learned':'')+(!open?' is-locked':(prime<x.cost&&!done?' is-poor':''));btn.disabled=done||!open||prime<x.cost;btn.title=x.name+' · 第'+(ri+1)+'层 · '+badge(x)+' · '+(x.auto?'开局自动':x.cost+' Prime')+(done?' · 已学':'');
     const pic=document.createElement('img');pic.src=x.icon;pic.alt='';pic.loading='lazy';btn.append(pic);
     const name=document.createElement('span');name.className='name';name.textContent=x.name;btn.append(name);
     const cost=document.createElement('span');cost.className='price';cost.textContent=x.auto?'自动获得':x.cost+' Prime';btn.append(cost);
     const state=document.createElement('span');state.className='tile-status';state.textContent=done?'✓':!open?'锁':'+';btn.append(state);
     btn.addEventListener('click',()=>{learned.add(id);prime-=x.cost;dev+=x.dev;last='已点亮《'+x.name+'》，花费 '+x.cost+' Prime，获得 '+x.dev+' 发展点。现在可开放至第 '+Math.min(6,Math.floor(dev/4)+1)+' 层。';detail.innerHTML='刚刚选择：<strong>'+escapeHtml(x.name)+'</strong>　<span class="tag">'+badge(x)+'</span>　<a href="'+x.href+'">查看这项天赋的完整原版解释 →</a>';paint()});row.append(btn)
    }board.append(row)
   }
  }
  function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  for(const b of document.querySelectorAll('[data-board]'))b.addEventListener('click',()=>{current=Number(b.dataset.board);for(const bb of document.querySelectorAll('[data-board]'))bb.classList.toggle('active',bb===b);reset()});
  const range=document.getElementById('prime-budget');if(range){range.addEventListener('input',()=>document.getElementById('budget-value').textContent=Number(range.value).toLocaleString('zh-CN'));
   range.addEventListener('change',()=>{primeInitial=Number(range.value);reset()})}
  document.getElementById('sim-reset').addEventListener('click',reset);reset();
 }
 const set=document.getElementById('kit-simulator');if(set){let chosen=new Set();const buttons=[...set.querySelectorAll('[data-set-member]')],result=document.getElementById('kit-result'),detail=document.getElementById('kit-price');
 function update(){for(const b of buttons)b.classList.toggle('active',chosen.has(Number(b.dataset.setMember)));const n=chosen.size;
  let desc=n>=3?'当前示例：控制削减总幅度 40%，而不是 20% + 40%。':n>=2?'当前示例：控制削减幅度 20%。':n===1?'已选 1 件；暂未达到这套效果的第一档条件。':'还未选择套装部件。';
  result.innerHTML='<strong>'+n+' / 4 件已选</strong><p>'+desc+'</p>';let sum=buttons.filter(b=>chosen.has(Number(b.dataset.setMember))).reduce((a,b)=>a+Number(b.dataset.cost),0);detail.textContent='选中的部件学习费合计：'+sum+' Prime（只计算费用，不模拟层级条件）';}
  for(const b of buttons)b.addEventListener('click',()=>{const id=Number(b.dataset.setMember);chosen.has(id)?chosen.delete(id):chosen.add(id);update()});update()}
 const input=document.getElementById('glossary-filter');if(input){const rows=[...document.querySelectorAll('[data-glossary-row]')];let group='全部';const count=document.getElementById('glossary-count');function update(){let q=input.value.trim().toLowerCase(),num=0;for(const r of rows){let on=(group==='全部'||r.dataset.group===group)&&r.textContent.toLowerCase().includes(q);r.hidden=!on;if(on)num++}count.textContent='符合条件：'+num+' 项'}input.addEventListener('input',update);for(const b of document.querySelectorAll('[data-group]'))b.addEventListener('click',()=>{group=b.dataset.group;for(const x of document.querySelectorAll('[data-group]'))x.classList.toggle('active',x===b);update()});update()}
})();
