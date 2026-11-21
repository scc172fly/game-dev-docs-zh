/* Prime World V0.6 - presentation enhancement; no existing game data is modified. */
(function(){
'use strict';
function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn()}
ready(function(){
  const body=document.body;
  body.classList.add('v6-site');
  const shortEnglishTerm = /^[A-Za-z][A-Za-z0-9_.-]*(?:[ /-]+[A-Za-z0-9_.-]+){0,4}$/;
  const numberOrCost = /^[+−-]?\d+(?:[,，]\d{3})*(?:\.\d+)?(?:\s*(?:Prime|%))?$/i;
  const protectedText = /[+−-]?\d+(?:[,，]\d{3})*(?:\.\d+)?[  　]*Prime|(?:[A-Za-z][\w]*[_.][\w.]+|[a-z]+[A-Z][A-Za-z0-9]*)/gi;
  document.querySelectorAll('table').forEach(table => {
    let needsRoom = false;
    for (const cell of table.querySelectorAll('th, td')) {
      const value = cell.textContent.trim();
      if (!cell.matches(".formula-cell") && value.length <= 36 && (shortEnglishTerm.test(value) || numberOrCost.test(value))) {
        cell.classList.add('pw-table-unbroken');
        needsRoom = true;
        continue;
      }
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.parentElement.closest('script,style,pre,table table')
            ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        },
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const matches = [...node.data.matchAll(protectedText)];
        if (!matches.length) continue;
        const fragment = document.createDocumentFragment();
        let end = 0;
        for (const match of matches) {
          fragment.append(node.data.slice(end, match.index));
          const token = document.createElement('span');
          token.className = 'pw-table-unbroken';
          token.textContent = match[0];
          fragment.append(token);
          end = match.index + match[0].length;
        }
        fragment.append(node.data.slice(end));
        node.replaceWith(fragment);
        needsRoom = true;
      }
    }
    if (!needsRoom || table.parentElement.matches('.table-wrap,.table-scroll,.a5-table-wrap,.pw-table-scroll')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'pw-table-scroll';
    table.before(wrapper);
    wrapper.append(table);
  });
  // Hero role deep-links from the home portal use the existing filter controls.
  try{
    const role=new URLSearchParams(location.search).get('role');
    if(role && document.querySelector('#hero-filter')) {
      const btn=[...document.querySelectorAll('#hero-filter [data-role]')].find(x=>x.dataset.role===role);
      if(btn){btn.click();document.querySelector('#hero-filter')?.scrollIntoView({block:'start',behavior:'auto'});}
    }
  }catch(_e){}
  // An editorial stats ribbon and unobtrusive category icons on each existing hero page.
  const statGrid=document.querySelector('.article-body .stat-grid');
  if(statGrid && !document.querySelector('.v6-stat-ribbon')){
    const ribbon=document.createElement('div');ribbon.className='v6-stat-ribbon';
    ribbon.innerHTML='<span>HERO PARAMETERS</span><strong>原版基础数据</strong><em>基础参数与实际对战最终属性不同</em>';
    statGrid.parentNode.insertBefore(ribbon,statGrid);
    const statIcons={'生命':'♥','能量':'✦','力量':'⚔','智力':'✧','灵巧':'➶','攻速':'⚡','坚韧':'⛨','意志':'◆'};
    statGrid.querySelectorAll('.stat-box').forEach(cell=>{
      const k=cell.querySelector('small')?.textContent.trim();
      if(k && !cell.querySelector('.v6-stat-icon')){
        const ic=document.createElement('span');ic.className='v6-stat-icon';ic.textContent=statIcons[k]||'◈';ic.setAttribute('aria-hidden','true');cell.appendChild(ic);
      }
    });
  }
  // Native inputs and existing scripts handle states; only improve accessibility labels.
  document.querySelectorAll('.sim-tile').forEach(el=>{
    const type=(el.className.match(/kind-(\w+)/)||[])[1]||'common';
    if(!el.getAttribute('aria-label')) el.setAttribute('aria-label',(el.title||'天赋')+' - '+type);
  });
  const board=document.getElementById('sim-board');
  if(board && window.MutationObserver){new MutationObserver(()=>{
    board.querySelectorAll('.sim-tile').forEach(el=>{
      el.setAttribute('aria-pressed',el.classList.contains('is-learned')?'true':'false');
    });
  }).observe(board,{childList:true,subtree:false});}
  // UI polish: synchronize current navigation selection on all existing pages.
  const nav=document.querySelectorAll('.pw-primary-nav .pw-nav-link');
  if(nav.length && !document.querySelector('.pw-primary-nav .is-active')){
    const pathname=decodeURIComponent(location.pathname).split('/').pop();
    const section=pathname==='talent-catalog.html'?'天赋':pathname==='talent-sets.html'?'套装':pathname==='maps-and-modes.html'?'地图':pathname==='balance.html'?'数值':pathname==='economy-and-progression.html'?'经济':'';
    if(section){const x=[...nav].find(a=>a.textContent.includes(section)); if(x)x.classList.add('is-active')}
  }
});
})();

/* V0.7.2 - progressive on-page explanation of every existing formula parameter.
   This does not recompute game logic, alter formulas or alter numeric source data. */
(function(){
'use strict';
function init(){
 const cells=document.querySelectorAll('td.formula-cell');
 if(!cells.length)return;
 const first=cells[0].closest('table');
 if(first && !document.querySelector('.pw-math-guide-note')){
   const note=document.createElement('div'); note.className='pw-math-guide-note';
   const a=document.createElement('a');
   a.href=(window.PW_V04_ROOT||document.body.dataset.root||'')+'formula-library.html';
   a.textContent='全站公式学习中心 ↗';
   note.append('数学式不会看？点击每个公式下方的「中文解读」，查看符号、条件和演算提示。',a);
   first.parentNode.insertBefore(note,first);
 }
 function num(x){return String(Math.round(x*10000)/10000)}
 function extra(formula,label,result){
   const t=formula.replace(/\s+/g,' ').trim();
   const list=[];
   const money=/Prime|费用|学习/.test(label),time=/秒|时间|冷却|持续/.test(label),range=/距离|范围|半径/.test(label);
   const unit=money?' Prime':time?' 秒':range?'（按该字段的距离单位）':'';
   if(/^[-+]?\d+(?:\.\d+)?$/.test(t)){
     list.push('这是固定配置值，不是需要联立求解的公式：'+label+' = '+t+unit+'。');
     list.push('只有当前资源确实引用这一字段时才生效；特殊状态、地图覆盖或其他属性修正可能另外处理。');
   } else if(/^(?:true|false|是|否)$/i.test(t)){
     list.push('这是布尔开关，表示 '+(t==='true'||t==='是'?'启用／条件成立':'禁用／条件不成立')+'；不是伤害数值。');
   } else {
     const linear=t.match(/([+-]?\d+(?:\.\d+)?)\s*[＋+]\s*(\d+(?:\.\d+)?)\s*[×*]\s*[（(]\s*强化等级\s*[−-]\s*1/);
     const anchors=t.match(/([+-]?\d+(?:\.\d+)?)→([+-]?\d+(?:\.\d+)?)[，,]\s*([+-]?\d+(?:\.\d+)?)→([+-]?\d+(?:\.\d+)?)/);
     if(anchors && t.includes('标尺〔')){
       const x1=+anchors[1],y1=+anchors[2],x2=+anchors[3],y2=+anchors[4];
       list.push('「标尺」是属性到效果数值的换算，不表示在两端数值之间随机取值。横向的两个锚点为：输入 '+num(x1)+' → 输出 '+num(y1)+'；输入 '+num(x2)+' → 输出 '+num(y2)+'。');
       list.push('两锚点之间线性插值：输出 = '+num(y1)+' + (属性−'+num(x1)+') × ('+num(y2)+'−'+num(y1)+') / ('+num(x2)+'−'+num(x1)+')。');
       if(x2!==x1){const sample=(x1<=100 && x2>=100)?100:(x1+x2)/2;const value=y1+(sample-x1)*(y2-y1)/(x2-x1);list.push('例如属性取 '+num(sample)+'，直接代入得到约 '+num(value)+'；是否取整、越过端点后怎样处理，要按此技能引用的原版缩放规则确定。');}
     } else if(linear){
       const a=+linear[1],b=+linear[2];
       list.push('这是按天赋强化等级逐级增长的线性式：「基础数值 + 每级增量 × (强化等级−1)」。强化等级从 1 开始，因此 1 级没有额外增量。');
       list.push('代入示例：强化等级 1 → '+num(a)+' + '+num(b)+'×0 = '+num(a)+'；强化等级 3 → '+num(a)+' + '+num(b)+'×2 = '+num(a+2*b)+'。若外层还有额外倍率，应在这一步之后继续计算。');
     } else if(t.includes('若 ')||t.includes('否则')){
       list.push('这是条件分支表达式。先判断「若」后面的条件；满足则使用第一个分支，不满足则使用「否则」的分支。不能把两条分支相加。');
       if(t.includes('已点亮'))list.push('「已点亮」是指该局内已经学习，不是战前仅放进 6×6 候选盘。');
     } else {
       list.push('先按括号由内向外计算，再处理乘除、加减；其中引用的属性、状态或其他天赋等级都必须先读出当前战斗值。');
       if(t.includes('＋')||t.includes('+'))list.push('「＋」是把两个数值相加；是否属于同一个属性加法乘区，还要回到原版对应效果的执行逻辑。');
       if(t.includes('×')||t.includes('*'))list.push('「×」表示乘法或倍率，不应把倍率项直接当成固定点数。');
     }
     if(t.includes('施法者'))list.push('「施法者」指发动这个效果的角色；与受治疗者、目标英雄的属性可能不同。');
     if(t.includes('目标'))list.push('「目标」指这次效果作用到的实体；需要区分目标当前生命和最大生命。');
     if(t.includes('读取天赋强化等级'))list.push('「读取天赋强化等级」可能引用另一条指定天赋的星级，而不是当前天赋；缺少实际配装时不能给出唯一结果。');
     if(t.includes('已点亮')&&!list.some(x=>x.includes('「已点亮」')))list.push('「已点亮」与「已配置」不同：配置进天赋盘不代表本局已学习。');
   }
   if(result){
     if(/需状态|无法|未计算|待核/.test(result))list.push('本表未给出唯一数值：缺少特定战斗状态、对象属性或运行条件；请不要当作结果为零。');
     else list.push('本表既有演算／结果：'+result+'。如列出多个值，应按页面说明的示例输入顺序读取，不代表任意局面的固定值。');
   }
   list.push('说明边界：本提示解释静态数学表达式；技能是否命中、护盾、防御、特殊资源、套装联动等最终效果，仍须遵守原版运行条件。');
   return list;
 }
 cells.forEach(function(cell){
   if(cell.querySelector('.pw-math-detail'))return;
   const row=cell.closest('tr');if(!row)return;
   const label=(row.cells[0]?.childNodes[0]?.textContent||'此参数').trim();
   const values=row.querySelector('td.values-cell');
   const examples=Array.from(values?.querySelectorAll('.formula-example')||[], example=>example.textContent.trim());
   const result=examples.length>1 ? [values.querySelector('small')?.textContent,...examples].filter(Boolean).join(' / ') : (values?.querySelector('.state-facts dd:last-child')||values)?.textContent?.trim()||'';
   const value=cell.textContent.trim();
   if(!value)return;
   const d=document.createElement('details');d.className='pw-math-detail';
   const summary=document.createElement('summary');summary.textContent=/^[-+]?\d+(?:\.\d+)?$/.test(value)?'常量说明':'中文解读';d.append(summary);
   const body=document.createElement('div');body.className='pw-math-detail-body';
   extra(value,label,result).forEach(function(line){const p=document.createElement('p');p.textContent=line;body.append(p)});
   const a=document.createElement('a');a.href=(location.pathname.split('/').length>2?'../':'')+'formula-library.html';a.textContent='公式阅读方法与全部索引 ↗';body.append(a);d.append(body);
   cell.append(d);
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* Keep the shared masthead subtitle independent of release numbers. */
(function () {
  function normalizeSubtitle() {
    document.querySelectorAll('.pw-brand-copy small').forEach(subtitle => {
      subtitle.textContent = subtitle.textContent.replace(/\s*[\u00b7\u2022]\s*v?\d+(?:\.\d+)+\s*$/i, '');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizeSubtitle, { once: true });
  } else {
    normalizeSubtitle();
  }
})();
