(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const root=document.body.dataset.root||'';const STORE='pw-original-atlas';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(STORE+k))??d}catch(e){return d}},save=(k,v)=>{try{localStorage.setItem(STORE+k,JSON.stringify(v))}catch(e){}};
const theme=$('.theme-select');if(theme){theme.value=load('-theme','dark');theme.addEventListener('change',()=>{save('-theme',theme.value);document.documentElement.dataset.theme=theme.value==='system'?(matchMedia('(prefers-color-scheme:light)').matches?'light':'dark'):theme.value})}
const media=matchMedia('(prefers-color-scheme:light)');media.addEventListener?.('change',e=>{if(load('-theme','dark')==='system')document.documentElement.dataset.theme=e.matches?'light':'dark'});
const gsearch=$('#global-search'),gout=$('#global-results');
if(gsearch&&gout){gsearch.addEventListener('input',()=>{const q=gsearch.value.trim().toLowerCase();if(!q){gout.classList.remove('open');gout.innerHTML='';return}const hits=(window.PW_SEARCH||[]).filter(x=>(x.name+' '+x.words).toLowerCase().includes(q)).slice(0,14);gout.innerHTML=hits.length?hits.map(x=>`<a href="${root+esc(x.url)}"><span>${esc(x.name)}</span><small>${esc(x.kind)} · ${esc((x.words||'').slice(0,85))}</small></a>`).join(''):'<p style="padding:12px 16px">没有匹配结果。试试英雄名、招式名或中文关键词。</p>';gout.classList.add('open')});gsearch.addEventListener('focus',()=>{if(gsearch.value)gout.classList.add('open')});document.addEventListener('click',e=>{if(!e.target.closest('.global-search'))gout.classList.remove('open')});document.addEventListener('keydown',e=>{if(e.key==='Escape'){gout.classList.remove('open');gsearch.blur()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();gsearch.focus()}})}
const heroFilter=$('#hero-filter');if(heroFilter){let role='全部';const search=$('#hero-search'),secondary=$('#include-secondary');function update(){const q=(search?.value||'').trim().toLowerCase();let n=0;$$('.hero-card').forEach(c=>{const matchRole=role==='全部'||c.dataset.role===role||(secondary?.checked&&(c.dataset.secondary||'').split(',').includes(role));const ok=matchRole&&(!q||(c.dataset.search||'').toLowerCase().includes(q));c.hidden=!ok;if(ok)n++});$$('.role-section').forEach(s=>{const count=$$('.hero-card:not([hidden])',s).length;s.hidden=!count;const v=$('.visible-count',s);if(v)v.textContent=count});$('#hero-count').textContent=n;$('#hero-empty').hidden=n!==0}$$('[data-role]',heroFilter).forEach(b=>b.addEventListener('click',()=>{role=b.dataset.role;$$('[data-role]',heroFilter).forEach(x=>x.classList.toggle('active',x===b));update()}));search?.addEventListener('input',update);secondary?.addEventListener('change',update);update()}
const talentCatalog=$('#talent-catalog');
if(talentCatalog){
  const catalogUrl=new URL('talent-catalog-data.js',document.currentScript.src).href;
  const perPage=48;
  const query=$('#talent-search'),level=$('#talent-level'),rarity=$('#talent-rarity');
  const kind=$('#talent-kind'),registered=$('#only-registered');
  const results=$('#talent-results'),status=$('#catalog-status');
  const previous=$('#talent-prev'),next=$('#talent-next');
  let page=0,pages=Number(talentCatalog.dataset.pages),revision=0,catalogRequest;

  function loadCatalog(){
    if(!catalogRequest){
      catalogRequest=new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src=catalogUrl;
        script.onload=()=>resolve(window.PW_TALENTS);
        script.onerror=()=>{
          script.remove();
          catalogRequest=undefined;
          reject(new Error('Talent catalog unavailable'));
        };
        document.head.appendChild(script);
      });
    }
    return catalogRequest;
  }

  function updateButtons(){
    previous.disabled=page===0;
    next.disabled=page>=pages-1;
  }

  async function render(offset){
    const current=++revision;
    if(!window.PW_TALENTS){
      status.textContent='正在加载完整天赋目录…';
      previous.disabled=next.disabled=true;
    }
    let records;
    try{
      records=await loadCatalog();
    }catch(error){
      if(current===revision){
        status.textContent='天赋目录加载失败，请重新筛选或翻页以重试。';
        updateButtons();
      }
      return;
    }
    if(current!==revision)return;
    const key=query.value.trim().toLowerCase();
    const list=records.filter(x=>
      (!key||(x.name+' '+x.words+' '+x.code).toLowerCase().includes(key))&&
      (!level.value||String(x.row)===level.value)&&
      (!rarity.value||x.rarity===rarity.value)&&
      (!kind.value||x.kind===kind.value)&&(!registered.checked||x.registered)
    );
    pages=Math.max(1,Math.ceil(list.length/perPage));
    page=offset===0?0:Math.max(0,Math.min(page+offset,pages-1));
    results.innerHTML=list.length
      ? list.slice(page*perPage,(page+1)*perPage).map(x=>`<a class="talent-result" href="${esc(x.url)}">${x.icon?`<img src="${esc(x.icon)}" alt="" loading="lazy" data-pw-tooltip="${esc(x.url)}">`:'<span class="icon-placeholder">✦</span>'}<div class="talent-result-copy"><b class="rarity-${esc(x.rarity)}">${esc(x.name)}</b><small>${esc(x.type_zh)} · 第 ${x.row} 层 · ${esc(x.rarity_zh)}${x.registered?'':' · 未登记'}</small></div></a>`).join('')
      : '<div class="empty-state">没有符合条件的天赋，请调整筛选条件。</div>';
    status.textContent='找到 '+list.length+' 条 · 第 '+(page+1)+' / '+pages+' 页';
    updateButtons();
    if(offset)talentCatalog.scrollIntoView({block:'start'});
  }

  query.addEventListener('input',()=>render(0));
  [level,rarity,kind,registered].forEach(field=>field.addEventListener('change',()=>render(0)));
  previous.addEventListener('click',()=>render(-1));
  next.addEventListener('click',()=>render(1));
  if(query.value||level.value||rarity.value||kind.value||registered.checked)render(0);
}
$$('table').forEach(t=>{const cols=Math.max(0,...Array.from(t.rows).map(r=>r.cells.length));if(cols>=5)t.classList.add('wide-table');$$('td',t).forEach(c=>{if(/^[+−-]?[\d.,]+\s*(%|％|秒|次|层|格)?$/.test(c.textContent.trim()))c.classList.add('numeric-cell')});if(t.parentElement.classList.contains('table-wrap'))return;const w=document.createElement('div');w.className='table-wrap';t.before(w);w.appendChild(t);const h=document.createElement('div');h.className='table-hint';h.textContent='表格可左右滑动查看完整内容';w.after(h)});
const artSwitches=$$('[data-art-switch]');
artSwitches.forEach(button=>button.addEventListener('click',()=>{
  const portrait=$('#hero-main-art');
  if(!portrait)return;
  portrait.src=button.dataset.artSwitch;
  portrait.classList.toggle('pw-model-shot',button.dataset.artKind==='model');
  portrait.classList.toggle('pw-legacy-art',button.dataset.artKind==='legacy');
  artSwitches.forEach(option=>option.classList.toggle('active',option===button));
}));
function revealHash(){if(!location.hash)return;let id;try{id=decodeURIComponent(location.hash.slice(1))}catch(e){return}const el=document.getElementById(id);if(!el)return;let p=el.parentElement;while(p){if(p.tagName==='DETAILS')p.open=true;p=p.parentElement}requestAnimationFrame(()=>el.scrollIntoView({behavior:'auto',block:'start'}))}window.addEventListener('hashchange',revealHash);revealHash();
const kitActivation = document.getElementById('kit-activation');
if (kitActivation) {
  document.querySelectorAll('a[href="#kit-activation"]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (location.hash !== '#kit-activation') return;
      event.preventDefault();
      kitActivation.scrollIntoView({behavior:'instant',block:'start'});
    });
  });
}
const toc=$('#toc-list');if(toc){const headings=$$('.article-body>h2,.article-body>section>h2,.article-body>h3').filter(x=>x.id);toc.innerHTML=headings.slice(0,45).map(x=>`<a href="#${encodeURIComponent(x.id)}" class="${x.tagName==='H3'?'sub':''}">${esc(x.textContent)}</a>`).join('')}
const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(!e.isIntersecting||!e.target.id)return;$$('.toc a,.anchor-tabs a').forEach(a=>{try{a.classList.toggle('current',decodeURIComponent(a.hash.slice(1))===e.target.id)}catch(err){}})})},{rootMargin:'-150px 0px -65% 0px',threshold:0});$$('.article-body h2[id],.article-body>section[id]').forEach(x=>observer.observe(x));
const read=$('.read-toggle');if(read){const key=document.body.dataset.page;let done=load('-read',{});function sync(){read.classList.toggle('is-read',!!done[key]);read.textContent=done[key]?'已标记读完 ✓':'标记本页已读';read.setAttribute('aria-pressed',String(!!done[key]))}read.addEventListener('click',()=>{done=load('-read',{});if(done[key])delete done[key];else done[key]=Date.now();save('-read',done);sync()});sync()}
const progress=$('.scroll-progress');const setProgress=()=>{if(!progress)return;const max=document.documentElement.scrollHeight-innerHeight;progress.style.width=(max?Math.min(100,scrollY/max*100):0)+'%'};addEventListener('scroll',setProgress,{passive:true});setProgress();$('.back-top')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'auto'}));
function number(c,n){const value=$(`[name="${n}"]`,c)?.value;return value===undefined||String(value).trim()===''?NaN:Number(value)}
const f=n=>Number.isFinite(n)?Number(n.toFixed(4)).toLocaleString('zh-CN',{maximumFractionDigits:4}):'无法求得有限数值';
const ra=x=>x>=0?Math.floor(x+.5):Math.ceil(x-.5);
$$('[data-calc]').forEach(c=>{
 function calc(){
  let out='',steps='';const type=c.dataset.calc;
  const fields={scale:['x','a','b'],refine:['a','d','star'],defence:['sta','will','pen','damage','red','shield'],attack:['as','dex','str']}[type]||[];
  const valid=fields.every(name=>Number.isFinite(number(c,name)));
  if(!valid){out='请填写完整的有效数字';steps='输入留空时暂不计算，不会将空白自动当作0。'}
  else if(type==='scale'){
   const x=number(c,'x'),a=number(c,'a'),b=number(c,'b'),mode=$('[name="mode"]',c).value;
   const anchors={damage:[50,258],ability:[50,182],damageLife:[600,6000],abilityLife:[600,4212],damageEnergy:[600,5100],abilityEnergy:[600,3625]}[mode];
   if(!anchors){out='请选择有效标尺';steps='';}
   else{
    const [l,r]=anchors,raw=Math.max(a+(x-l)*(b-a)/(r-l),a);
    out=`默认取整参数：${f(ra(raw))}`;
    steps=`max(${a}＋(${x}−${l})×(${b}−${a})÷(${r}−${l})，${a})＝${f(raw)}。原引擎 Round 将半整数向远离0的一侧取整；若具体技能显式关闭取整，则直接使用未取整值。输出只设下限，不在右锚点封顶；生命、能量须按技能实际要求输入当前值或最大值。尚未计算防御、护盾和其他状态。`;
   }
  }
  else if(type==='refine'){
   const a=number(c,'a'),d=number(c,'d'),star=number(c,'star');
   if(!Number.isInteger(star)||star<1){out='强化等级须为不小于1的整数';steps='1星使用基础值A，此后每升1星增加d。'}
   else{out=`当前强化值：${f(a+d*(star-1))}`;steps=`${a}＋${d}×(${star}−1)。第二个参数是每升一级的增量；本函数不自动取整。具体天赋可另作取整或状态判断，可达到的最高星级还取决于品质与强化规则。`;}
  }
  else if(type==='defence'){
   const sta=number(c,'sta'),will=number(c,'will'),pen=number(c,'pen'),damage=number(c,'damage'),shield=number(c,'shield'),redPercent=number(c,'red');
   if(damage<0||shield<0||redPercent<0||redPercent>100){out='请使用普通结算范围内的输入';steps='本示例要求原始伤害与护盾余额不小于0，类型减免为0%至100%；特殊负向修正须按相应状态另算。';}
   else{
    const mode=$('[name="mode"]',c).value,auto=$('[name="auto"]',c).checked;
    const def=.00536*(mode==='magic'?will+.3*sta:sta+.3*will)-.2,delta=def-pen;
    const v=Math.max(-.75,Math.min(.75,delta)),factor=1-(delta>0||auto?1:.75)*v;
    const before=damage*(1-redPercent/100)*factor,absorbed=Math.min(before,shield),after=Math.max(0,before-shield);
    out=`标准护盾后待扣伤害：${f(after)}`;
    steps=`防御比例${f(def)}；减去穿透后的差值${f(delta)}；防御通道倍率${f(factor)}。先得${f(before)}点盾前伤害，护盾实际吸收${f(absorbed)}，剩余护盾${f(shield-absorbed)}。最终生命损失还须以目标当前生命为上限。本示例假定技能防御与额外技能穿透变量为0、无无视防御标记、无免疫、转移或其他事件修正；原始伤害已包含需要的暴击与攻击方修正。`;
   }
  }
  else if(type==='attack'){
   const as=number(c,'as'),dex=number(c,'dex'),str=number(c,'str'),de=dex-Math.max(0,dex-500)*.25;
   if(str<0||de+128===0){out='这组输入不适用于普通攻击演算';steps='普攻原始伤害不能为负，暴击公式的分母不能为0。';}
   else{
    const crit=Math.max(0,Math.min(100,90.9*de/(de+128)-28)),aps=Math.max(Math.min(as*.00365+.49,2),.01);
    out=`攻频${f(aps)}次/秒 · 暴击率${f(crit)}%`;
    steps=`假定无显式攻频覆盖、额外暴击百分点为0，普攻允许暴击且暴击倍率为2。若平均原始伤害为${str}，持续命中时的期望原始输出为${f(str*aps*(1+crit/100))}/秒；这是长期平均，不是每次伤害。尚未计入防御、穿透、护盾、移动与未命中；特殊固定射速或不暴击普攻须另算。`;
   }
  }
  $('.calc-output',c).textContent=out;$('.calc-steps',c).textContent=steps;
 }
 c.addEventListener('input',calc);c.addEventListener('change',calc);calc();
});
})();
