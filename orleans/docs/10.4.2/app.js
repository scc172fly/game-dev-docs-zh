'use strict';
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nf = new Intl.NumberFormat('zh-CN');
  const state = {catalog:null,pages:[],byPath:new Map(),byId:new Map(),groups:new Map(),mode:'zh',route:'/',page:null,loadId:0,searchResults:[],searchSelected:0,searchIndex:null,searchLoading:false,observer:null,indexPage:0};
  const appBaseUrl = new URL('.', document.currentScript?.src || document.baseURI);
  function loadData(key) {
    if (!window.OrleansData?.load) return Promise.reject(new Error('数据加载器未找到。请完整解压文档包，并保持 index.html、data-loader.js、data 和 assets 的相对位置。'));
    return window.OrleansData.load(key);
  }
  const storage = {get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
  state.mode = ['zh','compare','en'].includes(storage.get('orleans-mode')) ? storage.get('orleans-mode') : 'zh';
  const navStorageKey = 'orleans-nav-groups-v1';
  const navExpansion = (()=>{
    try{
      const saved=JSON.parse(storage.get(navStorageKey));
      if(saved?.version===1&&saved.groups&&typeof saved.groups==='object'&&!Array.isArray(saved.groups))return new Map(Object.entries(saved.groups).filter(([,open])=>typeof open==='boolean'));
    }catch{}
    return new Map();
  })();
  let navHasNavigated=false;
  const canonical = raw => {
    let p = String(raw || '/').replace(/^https?:\/\/dotnet\.github\.io/, '').replace(/^\/orleans(?=\/|$)/, '').replace(/\.md$/, '/').split('?')[0];
    if (!p.startsWith('/')) p = '/' + p;
    if (!p.endsWith('/')) p += '/';
    return p.replace(/\/{2,}/g, '/');
  };
  const link = (p,anchor='') => '#' + canonical(p) + (anchor ? '::' + encodeURIComponent(anchor) : '');
  const currentTitle = p => state.mode === 'en' ? (p.title || p.titleZh || p.path) : (p.titleZh || p.title || p.path);
  const isApi = p => /\/api\/csharp\//.test(p.path) || /api|member|type|package/.test(p.kind || '');
  const isPackage = p => /api-package|^package$/.test(p.kind || '') || (/^\/docs\/api\/csharp\//.test(p.path) && p.path.split('/').filter(Boolean).length <= 4);
  const groupNames = {'docs':'文档总览','get-started':'开始使用','getting-started':'开始使用','grains':'Grain 开发','host':'托管与配置','configuration-guide':'配置指南','monitoring':'可观测性','deployment':'部署与运维','streaming':'流处理','security':'安全','implementation':'运行时架构','tutorials-and-samples':'教程与示例','how-to':'操作指南','diagnostics':'分析器诊断','resources':'参考资料','api':'C# API 参考','api-packages':'API 包','samples':'示例','contributing':'参与贡献','overview':'概览','migration':'迁移指南'};
  function groupOf(p) { return p.group || (isApi(p) ? 'api-packages' : (p.path.split('/').filter(Boolean)[1] || 'docs')); }
  function groupLabel(id) {const v=state.groups.get(id); return (typeof v==='string'?v:(v?.label || v?.titleZh || v?.title)) || groupNames[id] || id;}
  function sourceDate() { const d=state.catalog?.meta?.snapshot || state.catalog?.meta?.snapshotDate || '';return String(d).replace(/(?<=\d)T(?=\d)/,' ').replace(/\.\d+Z$/,' UTC'); }
  function documentationVersion(){
    const m=state.catalog?.meta||{},v=m.documentationVersion||state.catalog?.documentationVersion||{};
    const sourceBranch=String(v.sourceBranch||''),sourceCommit=String(v.sourceCommit||m.sourceCommit||'');
    const reference=[sourceBranch,sourceCommit.slice(0,7)].filter(Boolean).join('@');
    const date=sourceDate().match(/^\d{4}-\d{2}-\d{2}/)?.[0]||'';
    return {...v,label:v.label||'官方文档快照',summary:v.summary||'本译站依据官方文档快照制作。具体版本以各页面和来源记录为准。',sourceBranch,sourceCommit,reference:[reference,date].filter(Boolean).join(' · ')};
  }
  function updateVersionHeader(){
    const v=documentationVersion(),label=$('#documentation-version-label'),reference=$('#documentation-version-ref'),entry=$('#documentation-version');
    if(label)label.textContent=v.label;
    if(reference)reference.textContent=v.reference||'查看版本与快照说明';
    if(entry){entry.title=v.summary;entry.setAttribute('aria-label',`${v.label}，${v.reference}，查看版本与快照说明`);}
    const release=$('#repository-release'),latest=v.latestRepositoryRelease;
    if(release){
      const valid=latest&&/^https:\/\/github\.com\/dotnet\/orleans\/releases\/tag\//.test(latest.sourceUrl||'');
      release.hidden=!valid;
      if(valid){release.href=latest.sourceUrl;release.textContent=`最新 ${latest.tag||latest.version}`;release.title=`官方仓库最新 Release；发布于 ${latest.publishedDate||'未提供'}，核验于 ${latest.checkedDate||'未提供'}。文档依据仍为 ${v.label}。`;release.setAttribute('aria-label',release.textContent+'，打开官方仓库 Release');}
    }
  }
  function versionSummary(home=false){
    const v=documentationVersion();
    if(!home)return `<details class="version-summary version-summary-compact" aria-label="文档版本说明"><summary><span class="version-summary-label">${esc(v.label)}</span>${v.reference?` <code>${esc(v.reference)}</code>`:''}<span class="version-summary-toggle">版本说明</span></summary><p>${esc(v.summary)}</p></details>`;
    return `<section class="version-summary${home?' version-summary-home':''}" aria-label="文档版本说明"><div class="version-summary-heading"><a href="#/__audit/::audit-source">${esc(v.label)}</a>${v.reference?`<code>${esc(v.reference)}</code>`:''}</div><p>${esc(v.summary)}</p></section>`;
  }
  function versionAuditRows(){
    const v=documentationVersion(),rows=[['文档依据',v.label,v.scope],['适用版本说明',v.summary],['源码分支',v.sourceBranch||'未提供'],['源码提交',v.sourceCommit||'未提供'],['快照时间',sourceDate()||'未提供']];
    const latest=v.latestRepositoryRelease;
    if(latest){rows.push(['官方仓库最新 Release',latest.tag||latest.version,`发布于 ${latest.publishedDate||'未提供'}；这是仓库 Release 信息，文档依据仍为 ${v.label}。`,latest.sourceUrl]);rows.push(['最新 Release 核验日期',latest.checkedDate||'未提供']);}
    const packageKey=v.exampleProjectPackageVersion?'exampleProjectPackageVersion':v.quickstartPackageVersion?'quickstartPackageVersion':'baselinePackageVersion';
    if(v[packageKey])rows.push([packageKey==='exampleProjectPackageVersion'?'文档示例包版本':'快速入门示例包版本',v[packageKey],v[packageKey+'Scope']]);
    for(const [key,label] of [['sourceVersionPrefix','源码默认版本前缀'],['apiVersions','API 页面标注版本'],['additionalMentionedVersions','迁移文档涉及版本']]){
      if(v[key])rows.push([label,Array.isArray(v[key])?v[key].join('、'):v[key],v[key+'Scope']]);
    }
    return rows.map(([label,value,note,url])=>`<tr><td>${esc(label)}</td><td>${url&&/^https:\/\/github\.com\/dotnet\/orleans\/releases\/tag\//.test(url)?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(value)}</a>`:label==='源码提交'&&/^[a-f\d]{7,40}$/i.test(value)?`<a class="source-hash" href="https://github.com/dotnet/orleans/commit/${esc(value)}" target="_blank" rel="noopener noreferrer">${esc(value)}</a>`:esc(value)}${note?`<small class="version-scope">${esc(note)}</small>`:''}</td></tr>`).join('');
  }
  function statusInfo(page) {
    const s = String(page.status || '').toLowerCase();
    if (s === 'machine-draft') return {label:'中文初稿 · 待复审',className:'pending'};
    if (s === 'reviewed' || s === 'human-reviewed' || s === 'semantic-reviewed') return {label:'译文已复审',className:'reviewed'};
    if (['translated','machine','machine-translated','draft','translated-unreviewed','translation-reviewed'].includes(s)) return {label:s==='translation-reviewed'?'译文已复查':'已翻译',className:'translated'};
    if (s === 'verified') return {label:'结构已校验',className:'translated'};
    if (s === 'partial' || s === 'partially-translated') return {label:'部分翻译',className:'pending'};
    if (s === 'original' || s === 'pending' || s === 'untranslated' || s === 'source-only') return {label:'待翻译',className:'pending'};
    if (page.titleZh && /[\u3400-\u9fff]/.test(page.titleZh)) return {label:'已翻译',className:'translated'};
    return {label:'原文收录',className:''};
  }
  function badge(page) {const s=statusInfo(page);return `<span class="badge ${s.className}">${s.label}</span>`;}
  function setToc(items, note='') {
    $('#toc').innerHTML = items.map(x=>`<a href="${esc(x.href)}" class="${x.level>2?'toc-deep':''}">${esc(x.label)}</a>`).join('');
    $('#toc-note').innerHTML = note;
  }
  function snapshotFooter() {return `原文：<a href="https://dotnet.github.io/orleans/" target="_blank" rel="noopener noreferrer">dotnet.github.io/orleans</a><br>基于原文快照制作的非官方中文对照版本。<br>源文档遵循 <a href="https://github.com/dotnet/orleans/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT 许可证</a>，版权所有 © .NET Foundation。`;}
  function saveNavExpansion(){
    const groups=$$('.nav-group', $('#navigation')).map(group=>[group.dataset.group,group.open]);
    for(const [id,open] of groups)navExpansion.set(id,open);
    storage.set(navStorageKey,JSON.stringify({version:1,groups:Object.fromEntries(groups)}));
  }
  function navGroupForPath(path){
    if(path==='/'||path==='/original-home/')return null;
    const page=state.byPath.get(path)||state.byId.get(path.slice(1,-1));
    return page?groupOf(page):null;
  }
  function renderNav() {
    const navPages = state.pages.filter(p=>p.path!=='/original-home/'&&(!isApi(p)||isPackage(p)));
    const grouped=new Map();
    navPages.forEach(p=>{const g=groupOf(p);if(!grouped.has(g))grouped.set(g,[]);grouped.get(g).push(p);});
    let html='<a href="#/__overview/" class="nav-home" data-path="/__overview/">中文文档导航</a>';
    const groupOrder=[...state.groups.keys()];
    const orderedGroups=[...grouped].sort(([a],[b])=>(groupOrder.includes(a)?groupOrder.indexOf(a):999)-(groupOrder.includes(b)?groupOrder.indexOf(b):999));
    for(const [gid,pages] of orderedGroups){
      const open=navExpansion.has(gid)?navExpansion.get(gid):true;
      html+=`<details class="nav-group" data-group="${esc(gid)}"${open?' open':''}><summary>${esc(groupLabel(gid))}<span class="nav-count">${pages.length}</span></summary><div class="nav-links">`;
      html+=pages.map(p=>`<a class="nav-link${p.path.split('/').length>6?' is-deep':''}" href="${esc(link(p.path))}" data-path="${esc(p.path)}" title="${esc(p.title||'')}">${esc(p.titleZh||p.title||p.path)}</a>`).join('');
      html+='</div></details>';
    }
    if(!navPages.some(p=>isApi(p))) html+='<a class="nav-home" href="#/__all/">C# API 参考</a>';
    $('#navigation').innerHTML=html;
    $$('.nav-group', $('#navigation')).forEach(group=>{
      group.addEventListener('toggle',saveNavExpansion);
      $('summary',group).addEventListener('click',event=>{
        event.preventDefault();
        group.open=!group.open;
        saveNavExpansion();
      });
    });
    $('#collapse-nav').disabled=false;
    $('#sidebar-snapshot').textContent=sourceDate()?`原文快照 ${sourceDate()}`:'原文快照信息见审校记录';
    updateNavActive();
  }
  function updateNavActive(revealGroup=false){
    const activePath=state.route==='/original-home/'?'/':state.route;
    $$('[data-path]', $('#navigation')).forEach(el=>{const on=el.dataset.path===activePath;el.classList.toggle('active',on);if(on)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    if(revealGroup){
      const groupId=navGroupForPath(state.route),group=$$('.nav-group', $('#navigation')).find(item=>item.dataset.group===groupId);
      if(group&&!group.open){group.open=true;saveNavExpansion();}
    }
  }
  function closeMenu(){document.body.classList.remove('nav-open');$('#mobile-overlay').hidden=true;$('#menu-toggle').setAttribute('aria-expanded','false');}
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),2400);}
  const isHomepagePath=path=>path==='/'||path==='/original-home/';
  function officialIcon(name,className=''){
    const svg=window.OrleansOfficialIcons?.[name];
    return svg?`<span class="official-icon ${className}" data-source-icon="${esc(name)}" data-source-ui="true" aria-hidden="true">${svg}</span>`:'';
  }
  function homepageBlock(block,index,className='',asHeading=false,iconName=''){
    const id=String(block.id||`homepage-${index}`),en=block.en||'',zh=block.zh||'';
    const shared=block.type==='code'&&en===zh,compare=state.mode==='compare'&&!shared;
    const fragment=(language,value)=>{
      const source=`<div class="source-fragment" data-source-language="${language}"${shared?' data-source-shared="en zh"':''} lang="${language==='zh'?'zh-CN':'en'}">${value}</div>`;
      return iconName?`<div class="official-card-title-row" data-card-title-language="${language}">${officialIcon(iconName,'card-icon')}${source}</div>`:source;
    };
    let content;
    if(compare){
      content=`<div class="official-language"><span class="official-language-label" data-source-ui="true">English</span>${fragment('en',en)}</div><div class="official-language"><span class="official-language-label" data-source-ui="true">中文</span>${fragment('zh',zh||en)}</div>`;
    }else{
      const language=state.mode==='en'||shared&&state.mode==='compare'?'en':'zh';
      content=(shared&&state.mode==='compare'?'<div class="shared-caption" data-source-ui="true">代码相同 · 两种语言共用</div>':'')+fragment(language,language==='en'?en:(zh||en));
    }
    return `<div class="official-block ${className}${compare?' is-bilingual':''}${shared?' is-shared':''}" id="${esc(id)}" data-source-block="${esc(id)}" data-source-type="${esc(block.type||'other')}" data-block="${index}"${asHeading?' role="heading" aria-level="3"':''}>${content}</div>`;
  }
  function preserveHomepageAnchors(blocks){
    const sourceById=new Map(blocks.map(block=>[String(block.id),block]));
    const containers=$$('.official-block');
    const usedIds=new Set($$('[id]').filter(el=>!el.closest('.source-fragment')).map(el=>el.id));
    for(const container of containers){
      const block=sourceById.get(container.dataset.sourceBlock),anchors=new Set(block?.anchor?[block.anchor]:[]);
      $$('[id]',container).forEach(el=>{anchors.add(el.id);el.dataset.sourceAnchor=el.id;el.removeAttribute('id');});
      for(const anchor of anchors){
        if(usedIds.has(anchor))continue;
        const marker=document.createElement('span');marker.id=anchor;marker.className='official-anchor';marker.setAttribute('aria-hidden','true');container.prepend(marker);usedIds.add(anchor);
      }
    }
  }
  function renderHome(page){
    state.page=page;
    const blocks=page.blocks||[],used=new Set();
    const block=(index,className='',asHeading=false,iconName='')=>{if(!blocks[index])return'';used.add(index);return homepageBlock(blocks[index],index,className,asHeading,iconName);};
    const featureIcons=['virtual-actors','durable-state','streams','scheduling','transactions','event-sourcing','scaling','fault-tolerance'];
    const scenarioIcons=['ai-agents','fraud-risk','iot','monitoring','games','commerce'];
    const cards=(start,icons)=>icons.map((name,index)=>`<section class="official-card"><div class="official-card-heading">${block(start+index*2,'official-card-title',true,name)}</div>${block(start+index*2+1,'official-card-description')}</section>`).join('');
    const hero=`<section class="official-hero"><div class="official-hero-copy">${block(0,'official-title')}${block(1,'official-tagline')}${block(2,'official-introduction')}${block(3,'official-cta')}</div><div class="official-logo-wrap"><img class="official-logo" src="assets/brand/orleans-logo.svg" width="400" height="400" alt="Microsoft Orleans"></div></section>`;
    const features=`<section class="official-section official-features">${block(4,'official-section-heading')}${block(5,'official-section-introduction')}<div class="official-feature-grid">${cards(6,featureIcons)}</div></section>`;
    const scenarios=`<section class="official-section official-scenarios">${block(22,'official-section-heading')}${block(23,'official-section-introduction')}<div class="official-scenario-grid">${cards(24,scenarioIcons)}</div></section>`;
    const programming=`<section class="official-section official-programming">${block(36,'official-section-heading')}${block(37,'official-section-introduction')}<div class="official-program-grid"><section class="official-code-card">${block(38,'official-card-title',true)}${block(39,'official-code-filename')}${block(40,'official-code')}</section><section class="official-code-card">${block(41,'official-card-title',true)}${block(42,'official-code-filename')}${block(43,'official-code')}</section></div></section>`;
    const start=`<section class="official-section official-start">${block(44,'official-section-heading')}<div class="official-start-grid">${[45,46,47,48].map(index=>block(index,'official-start-card')).join('')}</div></section>`;
    const remaining=blocks.map((item,index)=>used.has(index)?'':homepageBlock(item,index)).join('');
    const source=page.sourceUrl||'https://dotnet.github.io/orleans/';
    $('#content').innerHTML=`<div class="official-toolbar"><nav class="official-page-links" aria-label="首页导航"><a href="#/" aria-current="page">官网首页</a><a href="#/__overview/" class="official-overview-link">中文文档导航</a></nav><div class="mode-control" role="group" aria-label="首页阅读语言"><button type="button" data-mode="zh" class="${state.mode==='zh'?'active':''}" aria-pressed="${state.mode==='zh'}">中文</button><button type="button" data-mode="compare" class="${state.mode==='compare'?'active':''}" aria-pressed="${state.mode==='compare'}">中英对照</button><button type="button" data-mode="en" class="${state.mode==='en'?'active':''}" aria-pressed="${state.mode==='en'}">English</button></div></div><article class="official-home doc-body" data-mode="${state.mode}" data-source-page="${esc(page.id)}" aria-label="原官网首页中文对照">${hero}${features}${scenarios}${programming}${start}${remaining?`<section class="official-section">${remaining}</section>`:''}</article><footer class="official-footer">${versionSummary(true)}<div class="official-provenance">${badge(page)}<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">查看英文官网首页</a><a href="#/__overview/">中文文档导航</a><a href="#/__audit/">来源与审校记录</a></div>${page.sourceHash?`<p class="source-hash">原文 SHA-256：${esc(page.sourceHash)}</p>`:''}<p>${snapshotFooter()}</p></footer>`;
    preserveHomepageAnchors(blocks);
    $$('.official-toolbar [data-mode]').forEach(button=>button.onclick=()=>{state.mode=button.dataset.mode;storage.set('orleans-mode',state.mode);const y=window.scrollY;renderHome(page);window.scrollTo(0,y);});
    enhanceContent();setToc([]);document.title='Microsoft Orleans · 官网首页中文对照';
  }
  function renderOverview(){
    const m=state.catalog.meta||{}, total=m.totalPages??state.pages.length, translated=m.translatedPages??0, reviewed=m.reviewedPages??0;
    const docs=state.pages.filter(p=>!isApi(p));
    const intro=docs.find(p=>/getting-started|quickstart|quick-start/.test(p.path))||state.byPath.get('/docs/')||docs[0];
    const choices=[];
    const patterns=[/\/overview\/$|\/docs\/$/,/\/grains\/$/,/grain-persistence\/$/,/transactions\/$/,/configuration-guide\/$/,/\/streaming\/$/,/\/deployment\/$/,/\/tutorials-and-samples\/$/];
    for(const re of patterns){const p=state.pages.find(p=>!isApi(p)&&re.test(p.path));if(p&&!choices.includes(p))choices.push(p);}
    for(const p of docs){if(choices.length>=8)break;if(!choices.includes(p))choices.push(p);}
    $('#content').innerHTML=`<section class="home-hero"><div class="home-eyebrow">MICROSOFT ORLEANS · 中文对照文档</div><h1 class="home-title">中文文档导航</h1><p class="home-lead">从 Grain 编程模型到运行时机制，从应用开发到 API 参考。保留英文原文、代码和来源，在中文阅读与中英对照之间随时切换。</p>${versionSummary(true)}<div class="home-actions">${intro?`<a class="button-primary" href="${esc(link(intro.path))}">开始阅读</a>`:''}<a class="button-secondary" href="#/__all/">浏览全部文档</a><a class="button-secondary" href="#/__audit/">查看审校记录</a></div></section>
    <section class="home-stats" aria-label="文档覆盖统计"><div class="home-stat"><strong>${nf.format(total)}</strong><span>原站页面</span></div><div class="home-stat"><strong>${nf.format(translated)}</strong><span>已提供中文译文</span></div><div class="home-stat"><strong>${nf.format(reviewed)}</strong><span>已记录语义复审</span></div></section>
    ${m.notice?`<div class="page-notice information">${esc(m.notice)}</div>`:''}
    <section id="home-topics"><h2 class="section-title">从这里开始探索</h2><p class="section-description">沿用原站的知识结构。示例注释提供中文译文，代码语句与 API 标识符保留原样；正文按段落对应。</p><div class="topic-list">${choices.map(p=>`<a class="topic-link" href="${esc(link(p.path))}"><strong>${esc(p.titleZh||p.title)}</strong><small>${esc(p.titleZh&&p.title!==p.titleZh?p.title:groupLabel(groupOf(p)))}</small></a>`).join('')}</div></section>
    <section id="home-reading"><h2 class="section-title">按你的习惯阅读</h2><div class="reading-guide"><div><h3>中文阅读</h3><p>使用统一的专业术语；Grain、Silo、类型名称及方法签名保留英文标识。</p></div><div><h3>中英逐段对照</h3><p>在同一位置查看原文与译文。宽屏并排显示，手机按原文、译文顺序排列。</p></div><div><h3>来源与校验可追溯</h3><p>每篇文档保留英文来源和内容快照信息，翻译覆盖与复审情况单独记录。</p></div></div></section>
    <div class="home-source">${sourceDate()?`原文快照：${esc(sourceDate())}<br>`:''}${snapshotFooter()}</div>`;
    setToc([{label:'中文文档导航',href:'#/__overview/'},{label:'开始探索',href:'#/__overview/::home-topics'},{label:'阅读方式',href:'#/__overview/::home-reading'},{label:'术语表',href:'#/__glossary/'},{label:'审校记录',href:'#/__audit/'}], '中文翻译以对应英文原文为依据。<br>版本、覆盖范围和复审状态见审校记录。');
    document.title='中文文档导航 · Orleans 中文对照文档';
  }
  const builtInGlossary=[
    ['Grain','Grain（虚拟 Actor）','保留 Grain 名称；不能把 Grain 的逻辑身份与某个激活实例混为一谈。'],
    ['Silo','Silo（Orleans 服务器）','承载 Grain 激活实例的服务器进程。'],
    ['activation','激活实例 / 激活','根据上下文区分运行中的实例与激活过程。'],
    ['virtual actor','虚拟 Actor','Actor 的逻辑身份与内存中的生命周期解耦。'],
    ['reentrancy','重入','讨论请求交错调度；不要直接等同于多线程并行执行。'],
    ['interleaving','交错执行','多个请求在执行与等待之间交错推进。'],
    ['persistence','持久化','将状态写入持久存储。'],
    ['provider','提供程序','Orleans 的存储、成员管理、流等可替换实现。'],
    ['transaction','事务','保留原文所限定的参与者、状态类型和一致性边界。'],
    ['serializable isolation','可串行化隔离','数据库与分布式事务中的隔离级别。'],
    ['stream','流','流处理中的事件序列；不是操作系统字节流。'],
    ['reminder','提醒器','与计时器（timer）区分。'],
    ['event sourcing','事件溯源','通过事件序列描述和重建状态。'],
    ['placement','放置','选择承载 Grain 激活实例的 Silo。'],
    ['membership','集群成员管理','集群节点身份、存活状态及成员变更。'],
    ['grain directory','Grain 目录','记录 Grain 激活位置的目录机制。'],
    ['serialization','序列化','区分数据序列化与事务可串行化。'],
    ['durability','持久性','已提交数据在故障后的保留保证。']
  ];
  function renderGlossary(){
    const list=state.catalog.meta?.glossary||builtInGlossary.map(([en,zh,note])=>({en,zh,note}));
    const rows=Array.isArray(list)?list:Object.entries(list).map(([en,v])=>typeof v==='string'?{en,zh:v}:{en,...v});
    $('#content').innerHTML=`<div class="breadcrumbs"><a href="#/">文档首页</a><span class="sep">/</span><span>中英术语表</span></div><h1 class="page-title">中英术语表</h1><p class="english-title">Terminology glossary</p><p class="section-description" style="margin-top:23px">专业术语优先保持语义准确。类名、接口名、方法名、包名与代码标识符不翻译；上下文不同的同一英文词可能使用不同中文表达。</p><table class="audit-table glossary-table"><thead><tr><th>英文</th><th>统一中文表达</th><th>使用说明</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.en||x.term||'')}</td><td>${esc(x.zh||x.translation||'')}</td><td>${esc(x.note||x.notes||'')}</td></tr>`).join('')}</tbody></table><div class="document-footer">术语表用于保证译文前后一致。具体技术行为仍以对应页面的完整上下文为准。<br>${snapshotFooter()}</div>`;
    setToc([{label:'中英术语表',href:'#/__glossary/'},{label:'来源与审校记录',href:'#/__audit/'}]);document.title='中英术语表 · Orleans 中文文档';
  }
  function renderAudit(){
    const m=state.catalog.meta||{};
    let audit=m.audit||[];
    if(!Array.isArray(audit))audit=Object.entries(audit).map(([label,v])=>typeof v==='object'&&v!==null?{label,...v}:{label,value:v});
    const counts=[{label:'原站收录页面',value:nf.format(m.totalPages??state.pages.length),detail:'依据已保存的原文页面清单。'},{label:'已提供中文译文的页面',value:nf.format(m.translatedPages??0),detail:'译文覆盖统计；与语义复审数量分别计算。'},{label:'记录语义复审的页面',value:nf.format(m.reviewedPages??0),detail:'只有明确记录复审结果的页面计入。'}];
    $('#content').innerHTML=`<div class="breadcrumbs"><a href="#/">文档首页</a><span class="sep">/</span><span>来源与审校记录</span></div><h1 class="page-title">来源与审校记录</h1><p class="english-title">Source, coverage & review</p><div class="audit-summary"><p>${esc(m.reviewSummary||'翻译覆盖、代码与结构校验、语义复审分别记录。结构检查能够发现缺段、代码变化和链接问题，但不能替代逐句理解与技术语义复审。')}</p></div><h2 id="audit-source" class="section-title">文档版本与原文来源</h2><table class="audit-table"><tbody><tr><td>原文站点</td><td><a href="https://dotnet.github.io/orleans/" target="_blank" rel="noopener noreferrer">dotnet.github.io/orleans</a></td></tr>${versionAuditRows()}${m.sourceHash?`<tr><td>原文摘要</td><td class="source-hash">${esc(m.sourceHash)}</td></tr>`:''}<tr><td>原文许可证</td><td><a href="https://github.com/dotnet/orleans/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT · © .NET Foundation</a></td></tr></tbody></table><h2 id="audit-coverage" class="section-title">覆盖与校验结果</h2><table class="audit-table"><thead><tr><th>检查项</th><th>结果</th><th>说明</th></tr></thead><tbody>${[...counts,...audit].map(x=>`<tr><td>${esc(x.label||x.name||'')}</td><td>${esc(typeof x.value==='object'?JSON.stringify(x.value):(x.value??x.result??x.status??''))}</td><td>${esc(x.detail||x.description||x.note||'')}</td></tr>`).join('')}</tbody></table><p class="audit-downloads"><a href="documentation-version.json" download>下载文档版本依据</a> · <a href="audit-report.json" download>下载覆盖报告</a> · <a href="static-compatibility.json" download>下载静态版兼容性校验</a> · <a href="publication-verification.json" download>下载全站结构校验</a> · <a href="code-verification.json" download>下载代码校验</a> · <a href="code-comments-review.json" download>下载代码注释译审</a> · <a href="code-comments-cross-review.json" download>下载注释交叉复核</a> · <a href="review-register.json" download>下载逐页复审记录</a> · <a href="unit-review-register.json" download>下载逐单元复审记录</a> · <a href="contextual-reviews.json" download>下载页面语境复审</a> · <a href="cross-review-report.json" download>下载交叉复核记录</a> · <a href="source-issues.json" download>下载原文问题记录</a> · <a href="snapshot-metadata.json" download>下载来源快照信息</a></p><h2 id="audit-status" class="section-title">如何理解页面状态</h2><div class="doc-body"><ul><li><strong>中文初稿 · 待复审：</strong>已有机器辅助生成的中文初稿，尚未完成逐句语义复审。</li><li><strong>已翻译：</strong>页面已有对应译文；是否完成语义复审另行记录。</li><li><strong>译文已复审：</strong>该页全部正文单元已有 AI 语义译审、精确审定译文复用或标识符核对记录。</li><li><strong>结构已校验：</strong>表示代码、段落或链接等结构检查通过，不代表所有句子均完成语义复审。</li><li><strong>部分翻译 / 待翻译：</strong>尚未完成的内容保留英文，并在正文提示。</li></ul></div>${m.limitations?`<h2 id="audit-limits" class="section-title">已知限制</h2><div class="doc-body">${Array.isArray(m.limitations)?`<ul>${m.limitations.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:`<p>${esc(m.limitations)}</p>`}</div>`:''}<div class="document-footer">${snapshotFooter()}</div>`;
    setToc([{label:'文档版本与来源',href:'#/__audit/::audit-source'},{label:'覆盖与校验结果',href:'#/__audit/::audit-coverage'},{label:'页面状态',href:'#/__audit/::audit-status'},...(m.limitations?[{label:'已知限制',href:'#/__audit/::audit-limits'}]:[])]);document.title='来源与审校记录 · Orleans 中文文档';
  }
  function renderIndex(){
    state.indexPage=0;
    $('#content').innerHTML=`<div class="breadcrumbs"><a href="#/">文档首页</a><span class="sep">/</span><span>全站页面索引</span></div><h1 class="page-title">全站页面索引</h1><p class="english-title">Documentation & C# API reference</p><div class="index-toolbar"><input class="index-input" id="index-query" type="search" placeholder="按标题、类名或路径筛选" aria-label="筛选全部页面"><select class="index-filter" id="index-filter" aria-label="页面类型"><option value="all">全部内容</option><option value="docs">文档与教程</option><option value="api">C# API</option><option value="packages">API 包</option></select></div><p class="index-summary" id="index-summary"></p><div id="index-list"></div><div class="pagination"><button id="index-prev" type="button">上一页</button><span id="index-position"></span><button id="index-next" type="button">下一页</button></div>`;
    $('#index-query').addEventListener('input',()=>{state.indexPage=0;updateIndex()});$('#index-filter').addEventListener('change',()=>{state.indexPage=0;updateIndex()});$('#index-prev').onclick=()=>{state.indexPage--;updateIndex();$('#index-list').scrollIntoView({block:'start'})};$('#index-next').onclick=()=>{state.indexPage++;updateIndex();$('#index-list').scrollIntoView({block:'start'})};
    updateIndex();setToc([{label:'全站页面索引',href:'#/__all/'},{label:'术语表',href:'#/__glossary/'}]);document.title='全站页面索引 · Orleans 中文文档';
  }
  function updateIndex(){
    const q=$('#index-query').value.toLowerCase().trim(),kind=$('#index-filter').value;
    const pages=state.pages.filter(p=>(kind==='all'||(kind==='docs'&&!isApi(p))||(kind==='api'&&isApi(p))||(kind==='packages'&&isPackage(p)))&&(!q||p.searchText.includes(q)));
    const size=60,total=Math.max(1,Math.ceil(pages.length/size));state.indexPage=Math.max(0,Math.min(state.indexPage,total-1));
    $('#index-summary').textContent=`共 ${nf.format(pages.length)} 个页面，每页 ${size} 个。`;
    $('#index-list').innerHTML=pages.slice(state.indexPage*size,(state.indexPage+1)*size).map(p=>`<div class="index-row"><a href="${esc(link(p.path))}">${esc(p.titleZh||p.title)}<small>${esc(p.titleZh&&p.titleZh!==p.title?p.title+' · ':'')}${esc(p.path)}</small></a>${badge(p)}</div>`).join('')||'<p class="search-empty">没有找到匹配页面。请尝试更短的中文词或英文标识符。</p>';
    $('#index-prev').disabled=state.indexPage===0;$('#index-next').disabled=state.indexPage>=total-1;$('#index-position').textContent=`${state.indexPage+1} / ${total}`;
  }
  function parseHash(){const raw=location.hash.slice(1)||'/';const i=raw.indexOf('::');let a=i>=0?raw.slice(i+2):'';try{a=decodeURIComponent(a)}catch{}return{path:canonical(i>=0?raw.slice(0,i):raw),anchor:a};}
  async function getPageData(page){
    if(page.blocks)return page;
    const chunk=page.chunk??page.id;
    let key=String(chunk);if(!/\.json$/.test(key))key+='.json';if(!key.startsWith('content/'))key='content/'+key;
    const data=await loadData(key);
    let out=data[page.id]||data[page.path]||data.pages?.[page.id];
    if(!out&&Array.isArray(data))out=data.find(x=>x.id===page.id||canonical(x.path)===page.path);
    if(!out&&data.blocks)out=data;
    if(!out)throw new Error('对应数据文件中没有找到本页内容。请完整解压文档包，并保持文件位置。');return {...page,...out};
  }
  function safeId(id,i){return String(id||'section-'+i);}
  function renderDocument(page){
    state.page=page;const title=currentTitle(page),type=isApi(page)?'C# API':'文档',src=page.sourceUrl||('https://dotnet.github.io/orleans'+page.path);
    const blocks=page.blocks||[];let missing=0;
    const rows=blocks.map((b,i)=>{
      if(b.level===1)return '';
      const en=b.en||'',zh=b.zh||'',isShared=b.type==='code'&&en===zh;if(!zh&&!isShared&&en)missing++;
      const id=safeId(b.anchor||b.id,i);
      if(isShared)return `<section class="doc-block shared-block" id="${esc(id)}" data-block="${i}">${state.mode==='compare'?'<div class="shared-caption">代码相同 · 两种语言共用</div>':''}<div class="block-content">${en||zh}</div></section>`;
      if(state.mode==='compare')return `<section class="doc-block" id="${esc(id)}" data-block="${i}"><div class="block-content block-en" lang="en">${en}</div><div class="block-content block-zh" lang="zh-CN">${zh||'<span class="pending-text">本段待翻译，以下保留英文原文。</span>'+en}</div></section>`;
      return `<section class="doc-block" id="${esc(id)}" data-block="${i}"><div class="block-content" lang="${state.mode==='en'?'en':'zh-CN'}">${state.mode==='en'?en:(zh||'<span class="pending-text">本段待翻译，以下保留英文原文。</span>'+en)}</div></section>`;
    }).join('');
    const notice=page.notice||page.reviewNote||(page.status==='machine-draft'?'本页为中文初稿，尚未完成逐句语义复审。可切换中英对照查看对应原文。':'');
    $('#content').innerHTML=`<div class="breadcrumbs"><a href="#/">文档首页</a><span class="sep">/</span><span>${esc(groupLabel(groupOf(page)))}</span><span class="sep">/</span><span>${type}</span></div><h1 class="page-title" id="_top">${esc(title)}</h1>${page.title&&page.title!==title?`<p class="english-title" lang="en">${esc(page.title)}</p>`:''}<div class="document-meta">${badge(page)}<span>${esc(sourceDate()?'快照 '+sourceDate():'原文快照')}</span><a href="${esc(src)}" target="_blank" rel="noopener noreferrer">查看英文原页<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m0-6-9 9M10 5H5v14h14v-5"/></svg></a></div>${versionSummary()}<div class="reading-toolbar"><div class="mode-control" role="group" aria-label="阅读语言"><button type="button" data-mode="zh" class="${state.mode==='zh'?'active':''}" aria-pressed="${state.mode==='zh'}">中文</button><button type="button" data-mode="compare" class="${state.mode==='compare'?'active':''}" aria-pressed="${state.mode==='compare'}">中英对照</button><button type="button" data-mode="en" class="${state.mode==='en'?'active':''}" aria-pressed="${state.mode==='en'}">English</button></div><span class="toolbar-note">注释已译为中文；代码语句与 API 标识符保留原文</span></div>${notice?`<div class="page-notice information">${esc(notice)}</div>`:''}${page.sourceIssues?.length?`<details class="source-review-note"><summary>原文问题与译注（${page.sourceIssues.length}）</summary><ul>${page.sourceIssues.map(note=>`<li>${esc(note)}</li>`).join('')}</ul><a href="source-issues.json" download>下载原文问题记录</a></details>`:''}${missing&&state.mode!=='en'?`<div class="page-notice">本页有 ${missing} 段暂未提供中文，已保留英文并逐段标记。</div>`:''}${state.mode==='compare'?'<div class="comparison-head"><span>ENGLISH · 原文</span><span>简体中文 · 对照译文</span></div>':''}<article class="doc-body" data-mode="${state.mode}" data-source-page="${esc(page.id)}" aria-label="文档正文">${rows||'<p class="muted">当前页没有正文内容。</p>'}</article><div class="document-footer"><a href="${esc(src)}" target="_blank" rel="noopener noreferrer">英文来源</a> · <a href="#/__glossary/">术语表</a> · <a href="#/__audit/">审校记录</a>${page.sourceHash?`<br><span class="source-hash">原文 SHA-256：${esc(page.sourceHash)}</span>`:''}<br>© .NET Foundation · 原文遵循 MIT 许可证。</div>${prevNext(page)}`;
    $$('.mode-control button').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;storage.set('orleans-mode',state.mode);const y=window.scrollY;renderDocument(page);window.scrollTo(0,y);});
    enhanceContent();
    const toc=[];$$('.doc-block').forEach(el=>{const h=$('h1,h2,h3',state.mode==='compare'?$('.block-zh',el)||el:el);if(h)toc.push({label:h.textContent,href:link(page.path,el.id),level:Number(h.tagName[1])});});
    setToc(toc,`<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">查看英文原文</a><br><a href="#/__audit/">翻译与复审状态</a>`);observeSections();document.title=title+' · Orleans 中文文档';
  }
  function prevNext(page){
    let list=state.pages.filter(p=>groupOf(p)===groupOf(page));if(!isApi(page))list=list.filter(p=>!isApi(p));
    const i=list.findIndex(p=>p.id===page.id),prev=list[i-1],next=list[i+1];if(!prev&&!next)return'';
    return `<nav class="prev-next" aria-label="相邻文档">${prev?`<a href="${esc(link(prev.path))}"><small>上一篇</small><strong>${esc(currentTitle(prev))}</strong></a>`:'<span></span>'}${next?`<a href="${esc(link(next.path))}"><small>下一篇</small><strong>${esc(currentTitle(next))}</strong></a>`:''}</nav>`;
  }
  async function copyText(text){
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}}catch{}
    const active=document.activeElement,selection=window.getSelection(),ranges=[];
    if(selection)for(let i=0;i<selection.rangeCount;i++)ranges.push(selection.getRangeAt(i).cloneRange());
    const ta=document.createElement('textarea');ta.value=text;ta.readOnly=true;ta.tabIndex=-1;ta.setAttribute('aria-hidden','true');ta.style.cssText='position:fixed;left:-9999px;top:0;opacity:0;font-size:16px';
    try{document.body.append(ta);ta.focus({preventScroll:true});ta.select();ta.setSelectionRange(0,text.length);return document.execCommand('copy')===true;}catch{return false;}finally{ta.remove();try{if(active?.isConnected)active.focus({preventScroll:true});if(selection){selection.removeAllRanges();ranges.forEach(range=>selection.addRange(range));}}catch{}}
  }
  function enhanceSourceComponents(){
    // 图标与原文分离；原文、译文和代码片段不加入任何辅助文字。
    $$('.doc-body input[type="checkbox"]').forEach(input=>{
      input.disabled=true;
      const item=input.closest('li');if(item){item.classList.add('task-list-item');const list=item.parentElement;if(list?.matches('ul,ol'))list.classList.add('contains-task-list');}
    });
    $$('.doc-body .starlight-aside').forEach(aside=>{
      const kind=['note','tip','caution','danger'].find(value=>aside.classList.contains('starlight-aside--'+value));
      const title=$('.starlight-aside__title',aside);
      if(!kind||!title||$('.official-icon',title))return;
      const icon=officialIcon('aside-'+kind,'aside-icon');
      if(!icon)return;
      const empty=$('svg.starlight-aside__icon',title);
      if(empty)empty.outerHTML=icon;else title.insertAdjacentHTML('afterbegin',icon);
    });
    $$('.doc-body .source-link-card').forEach(card=>{
      if(card.closest('.source-link-shell'))return;
      const shell=document.createElement('div');shell.className='source-link-shell';
      const fragment=card.closest('.source-fragment'),host=fragment&&fragment.childElementCount===1&&fragment.firstElementChild===card?fragment:card;
      host.before(shell);shell.append(host);shell.insertAdjacentHTML('beforeend',officialIcon('arrow-right','link-card-icon'));
    });
    $$('.doc-body h2,.doc-body h3,.doc-body h4,.doc-body h5,.doc-body h6').forEach(heading=>{
      if(heading.closest('a,.source-heading,.source-link-card,.starlight-aside,.official-card-title'))return;
      const anchor=heading.dataset.sourceAnchor||heading.id||heading.closest('.doc-block')?.id;
      if(!anchor)return;
      const fragment=heading.closest('.source-fragment'),host=fragment&&fragment.childElementCount===1&&fragment.firstElementChild===heading?fragment:heading;
      const shell=document.createElement('div');shell.className='source-heading level-'+heading.tagName.toLowerCase();
      const jump=document.createElement('a');jump.className='source-anchor-link';jump.href=link(state.route,anchor);jump.dataset.sourceUi='true';jump.setAttribute('aria-label',(state.mode==='en'?'Link to section: ':'链接到此节：')+heading.textContent.trim());jump.innerHTML=officialIcon('heading-anchor');
      host.before(shell);shell.append(host,jump);
    });
  }
  // 六条图片辅助文本仅在精确匹配的中文列中显示，英文列保留源文。
  const reviewedImageAlts=Object.freeze([
  {
    "pageId": "9144e01529752bdc",
    "src": "assets/original/_astro/generate-serializer-code-fix.BrBLQAWQ_Z1ilxaJ.webp",
    "originalAlt": "An animated image of the available code fix being suggested and applied on the GenerateSerializerAttribute when the containing type doesn't contain IdAttribute's on its members.",
    "zh": "已标注 GenerateSerializerAttribute 的类型未在其成员上标注 IdAttribute 时，编辑器建议并应用可用代码修复的动图。"
  },
  {
    "pageId": "1d3e2f583aa4b05f",
    "src": "assets/original/_astro/heterogeneous.C0meRUB5_V6RbB.webp",
    "originalAlt": "A cluster whose silos support different grain type sets.",
    "zh": "一个集群，其中各个 Silo 支持的 Grain 类型集合不同。"
  },
  {
    "pageId": "382b25bad3cd2b5e",
    "src": "assets/original/_astro/grain-formulation.CtOzAqNu_Z1FvyYE.svg",
    "originalAlt": "A grain is composed of a stable identity, behavior, and state.",
    "zh": "Grain 由稳定的标识、行为和状态组成。"
  },
  {
    "pageId": "382b25bad3cd2b5e",
    "src": "assets/original/_astro/cluster-silo-grain-relationship.BADVHeJX_OrNGc.svg",
    "originalAlt": "A cluster has one or more silos, and each silo hosts grain activations.",
    "zh": "集群包含一个或多个 Silo，每个 Silo 托管 Grain 激活实例。"
  },
  {
    "pageId": "a48e234bd6ae9dd9",
    "src": "assets/original/_astro/web-application.mdTGpSsm_Z1r4fB0.webp",
    "originalAlt": "Screenshot of the running URL shortener web application.",
    "zh": "正在运行的 URL 缩短 Web 应用程序的屏幕截图。"
  },
  {
    "pageId": "a48e234bd6ae9dd9",
    "src": "assets/original/_astro/storage-table-entities.DAOG8iOS_1vuzP0.webp",
    "originalAlt": "A screenshot showing Orleans data in Azure Table Storage.",
    "zh": "显示 Azure 表存储中 Orleans 数据的屏幕截图。"
  }
]);
  function applyReviewedImageAlt(img){
    const language=img.closest('.block-content[lang]')?.getAttribute('lang')||'';
    if(!/^zh(?:-|$)/i.test(language))return;
    const match=reviewedImageAlts.find(item=>item.pageId===state.page?.id&&item.src===img.getAttribute('src')&&item.originalAlt===img.getAttribute('alt'));
    if(match)img.setAttribute('alt',match.zh);
  }
  // 只恢复冻结原站明确标有 image-lightbox 的三张图。
  const sourceLightboxImages=new Map([
    ['9144e01529752bdc',new Set(['generate-serializer-code-fix.BrBLQAWQ_Z1ilxaJ.webp'])],
    ['382b25bad3cd2b5e',new Set(['grain-formulation.CtOzAqNu_Z1FvyYE.svg','cluster-silo-grain-relationship.BADVHeJX_OrNGc.svg'])]
  ]);
  function hasSourceLightbox(img){return sourceLightboxImages.get(state.page?.id)?.has((img.getAttribute('src')||'').split(/[?#]/)[0].split('/').pop())||false;}
  let imageDialog;
  function showSourceImage(img){
    if(!imageDialog){
      imageDialog=document.createElement('dialog');imageDialog.className='source-image-dialog';imageDialog.setAttribute('aria-label','查看原尺寸图片');
      const close=document.createElement('button');close.type='button';close.className='source-image-close';close.textContent='关闭';close.onclick=()=>imageDialog.close();
      const preview=document.createElement('img');preview.className='source-image-preview';
      imageDialog.append(close,preview);document.body.append(imageDialog);
      imageDialog.addEventListener('click',event=>{if(event.target===imageDialog)imageDialog.close();});
      imageDialog.addEventListener('close',()=>{preview.removeAttribute('src');preview.alt='';});
    }
    const preview=$('img',imageDialog);preview.src=img.currentSrc||img.src;preview.alt=img.alt;$('.source-image-close',imageDialog).textContent=state.mode==='en'?'Close':'关闭';
    imageDialog.setAttribute('aria-label',state.mode==='en'?'View full-size image':'查看原尺寸图片');
    imageDialog.showModal();
  }
  function enhanceContent(){
    $$('.doc-block [id]').forEach(el=>{el.dataset.sourceAnchor=el.id;el.removeAttribute('id');});
    enhanceSourceComponents();
    $$('.doc-body table').forEach(table=>{if(table.parentElement.classList.contains('table-wrap'))return;const wrap=document.createElement('div');wrap.className='table-wrap';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','可横向滚动的表格');table.before(wrap);wrap.append(table);});
    $$('.doc-body pre').forEach(pre=>{if(pre.closest('.code-shell'))return;const shell=document.createElement('div');shell.className='code-shell';const fragment=pre.closest('.source-fragment'),host=fragment&&fragment.childElementCount===1&&fragment.firstElementChild===pre?fragment:pre;host.before(shell);shell.append(host);const lang=$('code',pre)?.className?.match(/language-([\w-]+)/)?.[1]||pre.dataset.language||'CODE';const label=document.createElement('span');label.className='code-label';label.textContent=lang.toUpperCase();shell.prepend(label);const b=document.createElement('button');b.type='button';b.className='copy-code';b.textContent='复制';b.setAttribute('aria-label','复制代码');b.onclick=async()=>{const t=$('code',pre)?.textContent||pre.textContent;if(await copyText(t)){b.textContent='已复制';setTimeout(()=>b.textContent='复制',1600)}else toast('自动复制未成功，请选中代码后复制。');};shell.append(b);});
    $$('.doc-body img').forEach(img=>{applyReviewedImageAlt(img);img.loading=img.classList.contains('official-logo')?'eager':'lazy';img.decoding='async';img.addEventListener('error',()=>{img.alt='图片未能加载：'+(img.alt||img.src);},{once:true});if(hasSourceLightbox(img)&&!img.closest('a')&&!img.classList.contains('source-image-zoom')){img.classList.add('source-image-zoom');img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',(state.mode==='en'?'View image: ':'查看原尺寸图片：')+(img.alt||''));img.onclick=()=>showSourceImage(img);img.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();showSourceImage(img);}};}});
    $$('.doc-body a[href]').forEach(a=>{
      const h=a.getAttribute('href');
      if(h.startsWith('#')&&!h.startsWith('#/'))a.href=link(state.route,h.slice(1));
      else if(/^https?:\/\/dotnet\.github\.io\/orleans\//.test(h)) {try{const u=new URL(h),p=canonical(u.pathname);if(state.byPath.has(p))a.href=link(p,u.hash.slice(1));}catch{}}
      if(/^https?:/.test(a.getAttribute('href'))){a.target='_blank';a.rel='noopener noreferrer';}
    });
    if(state.route==='/samples/')enhanceSamples();
    renderDiagrams();
  }
  function enhanceSamples(){
    const article=$('.doc-body');article.classList.add('samples-gallery');
    const lists=$$('.doc-block ul',article).filter(list=>$('li > a > img',list));
    const inputs=$$('input[type="search"]',article);
    const primary=lists[0]?[...lists[0].children]:[];
    const pairs=primary.map((_,i)=>lists.map(list=>list.children[i]).filter(Boolean));
    pairs.forEach(cards=>cards.forEach(card=>{
      const anchor=$('a',card),img=$('img',card);if(!anchor||!img)return;
      anchor.classList.add('sample-card');
      if(!$('.sample-card-body',anchor)){
        const body=document.createElement('div');body.className='sample-card-body';
        while(img.nextSibling)body.append(img.nextSibling);
        anchor.append(body);
      }
      restoreSampleCardTail($('.sample-card-body',anchor),anchor.getAttribute('href'));
      if(/(?:^|\/)favicon\.svg(?:[?#]|$)/.test(img.getAttribute('src')||'')){
        if(!img.parentElement.classList.contains('sample-card-placeholder')){
          const placeholder=document.createElement('div');placeholder.className='sample-card-placeholder';placeholder.setAttribute('aria-hidden','true');img.before(placeholder);placeholder.append(img);
        }
        img.alt='';
      }else{
        img.classList.add('sample-card-image');if(!img.alt)img.alt=$('h2',card)?.textContent||'示例预览';
      }
    }));
    inputs.forEach((input,i)=>{
      input.id='samples-filter-'+i;input.setAttribute('aria-label',state.mode==='en'?'Search samples':'搜索示例');
      const form=input.closest('form'),label=$('label',form);if(label)label.htmlFor=input.id;
      form.addEventListener('submit',event=>event.preventDefault());
      const count=document.createElement('span');count.className='sample-count';count.setAttribute('aria-live','polite');form.append(count);
      input.addEventListener('input',()=>filter(input.value));
    });
    function filter(value){
      const q=value.trim().toLowerCase();let visible=0;
      pairs.forEach(cards=>{const show=!q||cards.some(card=>card.textContent.toLowerCase().includes(q));cards.forEach(card=>card.hidden=!show);if(show)visible++;});
      inputs.forEach(input=>{if(input.value!==value)input.value=value;$('.sample-count',input.closest('form')).textContent=state.mode==='en'?`${visible} / ${pairs.length} samples`:`${visible} / ${pairs.length} 个示例`;});
    }
    filter('');
  }
  function restoreSampleCardTail(body,href){
    if(!body||body.dataset.sourceTailRestored)return;
    const definition=window.OrleansSampleCardStructure?.find(card=>card.href===href);
    const description=$(':scope > p:last-of-type',body);if(!definition||!description)return;
    const nodes=[];for(let node=description.nextSibling;node;node=node.nextSibling)nodes.push(node);
    const isPlainTail=node=>node.nodeType===3||(node.nodeType===1&&node.tagName==='SPAN'&&[...node.childNodes].every(child=>child.nodeType===3));
    if(!nodes.length||nodes.some(node=>!isPlainTail(node)))return;
    const original=nodes.map(node=>node.textContent).join(''),text=original.trim();
    const variant=definition.variants.find(value=>value.tail===text&&[...value.chips,value.linkText].join(value.separator)===text);
    if(!variant)return;
    const fragment=document.createDocumentFragment(),chips=document.createElement('div');chips.className='sample-card-chips';
    const separator=()=>{const span=document.createElement('span');span.className='sample-chip-separator';span.setAttribute('aria-hidden','true');span.textContent=variant.separator;return span;};
    fragment.append(document.createTextNode(original.slice(0,original.indexOf(text))));
    variant.chips.forEach((label,index)=>{if(index&&variant.separator)chips.append(separator());const chip=document.createElement('span');chip.className='sample-card-chip';chip.textContent=label;chips.append(chip);});
    fragment.append(chips);if(variant.separator)fragment.append(separator());
    const action=document.createElement('span');action.className='sample-card-source';action.textContent=variant.linkText;fragment.append(action,document.createTextNode(original.slice(original.indexOf(text)+text.length)));
    if(fragment.textContent!==original)return;
    nodes.forEach(node=>node.remove());body.append(fragment);body.dataset.sourceTailRestored='true';
  }
  let mermaidPromise,diagramQueue=Promise.resolve(),diagramNumber=0;
  function loadMermaid(){
    if(typeof window.OrleansMermaid?.initialize==='function'&&typeof window.OrleansMermaid?.render==='function')return Promise.resolve(window.OrleansMermaid);
    if(mermaidPromise)return mermaidPromise;
    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');let timer,settled=false;
      const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);script.onload=null;script.onerror=null;script.remove();if(error)reject(error);else resolve(window.OrleansMermaid);};
      const failure=()=>new Error('图表脚本无法载入。请完整解压文档包，并保持 assets/mermaid.bundle.js 的相对位置。');
      script.async=true;script.src=new URL('assets/mermaid.bundle.js',appBaseUrl).href;
      script.onload=()=>finish(typeof window.OrleansMermaid?.initialize==='function'&&typeof window.OrleansMermaid?.render==='function'?null:failure());
      script.onerror=()=>finish(failure());timer=setTimeout(()=>finish(failure()),30000);
      try{document.head.append(script);}catch{finish(failure());}
    });
    mermaidPromise=promise.catch(error=>{mermaidPromise=null;throw error;});return mermaidPromise;
  }
  function renderDiagrams(){
    const figures=$$('.doc-diagram');if(!figures.length)return;
    diagramQueue=diagramQueue.then(async()=>{
      const [data,mermaid]=await Promise.all([loadData('diagrams.json'),loadMermaid()]);
      const dark=document.documentElement.dataset.theme==='dark';
      mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:dark?'dark':'default',fontFamily:'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif',flowchart:{htmlLabels:false,useMaxWidth:true},sequence:{useMaxWidth:true,wrap:true}});
      for(const figure of figures){
        if(!figure.isConnected)continue;
        const record=data[figure.dataset.diagramKey],language=figure.dataset.diagramLanguage,canvas=$('.diagram-canvas',figure);if(!record||!canvas)continue;
        try{
          const result=await mermaid.render('orleans-zh-diagram-'+(++diagramNumber),language==='zh'?record.zh:record.source);
          if(!figure.isConnected)continue;
          canvas.innerHTML=result.svg;canvas.dataset.status='rendered';canvas.setAttribute('aria-label',language==='zh'?'已译审的中文图表':'原文图表');
          if(!$('figcaption',figure)){
            const caption=document.createElement('figcaption');const note=document.createElement('span');note.textContent=language==='zh'?'中文标签 · 结构与原图对应':'Original diagram';
            const button=document.createElement('button');button.type='button';button.className='diagram-expand';button.textContent=language==='zh'?'放大查看':'Expand';
            button.onclick=()=>openDiagram(canvas,language==='zh'?'中文图表':'Original diagram');caption.append(note,button);canvas.after(caption);
          }
        }catch(error){canvas.textContent=language==='zh'?'图表暂时无法绘制，请展开下方原始代码查看。':'Unable to render this diagram. Original source is available below.';canvas.dataset.status='error';console.error(error);}
      }
    }).catch(error=>{for(const f of figures){const c=$('.diagram-canvas',f);if(c){c.textContent='图表资源暂时无法载入。请完整解压文档包，并保持 data 和 assets 的相对位置；也可查看下方原始代码。';c.dataset.status='error';}}console.error(error);});
  }
  function openDiagram(canvas,title){
    const svg=$('svg',canvas);if(!svg)return;
    const previousStyle=svg.getAttribute('style');
    const naturalWidth=svg.viewBox?.baseVal?.width||svg.getBoundingClientRect().width;
    svg.style.width=`${Math.max(240,naturalWidth*1.25)}px`;
    const dialog=document.createElement('dialog');dialog.className='diagram-dialog';dialog.setAttribute('aria-label',title);
    const header=document.createElement('div');header.className='diagram-dialog-header';const strong=document.createElement('strong');strong.textContent=title;
    const close=document.createElement('button');close.type='button';close.textContent='关闭';close.onclick=()=>dialog.close();header.append(strong,close);
    const viewport=document.createElement('div');viewport.className='diagram-viewport';viewport.append(svg);dialog.append(header,viewport);document.body.append(dialog);
    dialog.addEventListener('close',()=>{if(previousStyle===null)svg.removeAttribute('style');else svg.setAttribute('style',previousStyle);canvas.append(svg);dialog.remove();},{once:true});dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});dialog.showModal();
  }
  function observeSections(){
    if(state.observer)state.observer.disconnect();if(!('IntersectionObserver'in window))return;
    state.observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){const target=link(state.route,e.target.id);$$('#toc a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===target));break;}}},{rootMargin:'-90px 0px -65% 0px',threshold:0});
    $$('.doc-block').filter(el=>$('h1,h2,h3',el)).forEach(el=>state.observer.observe(el));
  }
  function scrollAnchor(anchor){if(!anchor){window.scrollTo({top:0,behavior:'instant'});return}requestAnimationFrame(()=>{let el=document.getElementById(anchor);if(!el)el=$$('[id]').find(x=>x.id.toLowerCase()===anchor.toLowerCase());if(!el)el=$$('[data-source-anchor]').find(x=>x.dataset.sourceAnchor===anchor);el?.scrollIntoView({block:'start'});});}
  async function navigate(){
    if(!state.catalog)return;const {path,anchor}=parseHash();closeMenu();
    if(path===state.route&&state.rendered){scrollAnchor(anchor);return;}
    const revealNavGroup=navHasNavigated&&navGroupForPath(path)!==navGroupForPath(state.route);
    navHasNavigated=true;
    state.route=path;state.rendered=false;state.page=null;document.body.classList.toggle('landing-page',isHomepagePath(path));updateNavActive(revealNavGroup);const id=++state.loadId;
    if(state.observer)state.observer.disconnect();
    if(path==='/__overview/')renderOverview();else if(path==='/__glossary/')renderGlossary();else if(path==='/__audit/')renderAudit();else if(path==='/__all/')renderIndex();else{
      const p=isHomepagePath(path)?(state.byPath.get('/original-home/')||state.byId.get('bfa8f21cc2984261')):(state.byPath.get(path)||state.byId.get(path.slice(1,-1)));
      if(!p){$('#content').innerHTML=`<div class="error-state"><div class="home-eyebrow">页面未收录</div><h1>没有找到这篇文档</h1><p>当前快照中没有路径 <code>${esc(path)}</code>。可通过搜索或全站索引定位对应页面。</p><a class="button-primary" href="#/__all/">浏览全站页面索引</a></div>`;setToc([]);}
      else{ $('#content').innerHTML='<div class="initial-loading"><span class="loading-spinner"></span><p>正在载入文档…</p></div>';setToc([]);try{const data=await getPageData(p);if(id!==state.loadId)return;if(isHomepagePath(path))renderHome(data);else renderDocument(data);}catch(e){if(id!==state.loadId)return;$('#content').innerHTML=`<div class="error-state"><h1>这篇文档暂时无法载入</h1><p>${esc(e.message)}</p><p>请确认文档包已完整解压，并保持 index.html、data 和 assets 的相对位置后重试。</p><button class="button-secondary" id="reload-page" type="button">重试</button> <a class="button-secondary" href="${esc(p.sourceUrl||(p.path==='/original-home/'?'https://dotnet.github.io/orleans/':'https://dotnet.github.io/orleans'+p.path))}" target="_blank" rel="noopener noreferrer">英文原文</a></div>`;$('#reload-page').onclick=()=>{state.rendered=false;navigate()};}}
    }
    state.rendered=true;scrollAnchor(anchor);
  }
  function openSearch(){const d=$('#search-dialog');if(!d.open)d.showModal();$('#search-input').focus();runSearch($('#search-input').value);}
  function highlight(text,query){if(!query)return esc(text);const i=String(text).toLowerCase().indexOf(query.toLowerCase());return i<0?esc(text):esc(text.slice(0,i))+'<mark>'+esc(text.slice(i,i+query.length))+'</mark>'+esc(text.slice(i+query.length));}
  async function maybeSearchIndex(){
    if(state.searchIndex||state.searchLoading||!state.catalog?.meta?.searchIndex)return;
    state.searchLoading=true;try{state.searchIndex=await loadData(state.catalog.meta.searchIndex);if($('#search-input').value)runSearch($('#search-input').value);}catch{$('#search-meta').textContent+=' · 正文索引未载入，当前搜索标题与路径。请完整解压文档包并保持 data 目录的位置。';}finally{state.searchLoading=false;}
  }
  function runSearch(raw){
    if(!state.catalog)return;const q=raw.trim().toLowerCase();let hits=[];
    if(!q){hits=state.pages.filter(p=>!isApi(p)).slice(0,8).map(p=>({page:p,score:0}));$('#search-meta').textContent='常用文档 · 输入中文、英文或 API 标识符搜索';}
    else{
      const terms=q.split(/\s+/).filter(Boolean);
      for(const p of state.pages){if(!terms.every(t=>p.searchText.includes(t)))continue;const zh=(p.titleZh||'').toLowerCase(),en=(p.title||'').toLowerCase();const score=(zh===q||en===q?100:0)+(zh.startsWith(q)||en.startsWith(q)?50:0)+(zh.includes(q)?25:0)+(en.includes(q)?20:0)+(!isApi(p)?5:0);hits.push({page:p,score});}
      if(state.searchIndex&&hits.length<50){const used=new Set(hits.map(x=>x.page.id));const entries=Array.isArray(state.searchIndex)?state.searchIndex:Object.entries(state.searchIndex).map(([id,text])=>({id,text}));for(const s of entries){if(used.has(s.id))continue;const text=String(s.text||s.content||s.zh||'').toLowerCase();if(terms.every(t=>text.includes(t))){const page=state.byId.get(s.id);if(page)hits.push({page,score:1});}}}
      hits.sort((a,b)=>b.score-a.score);$('#search-meta').textContent=`找到 ${nf.format(hits.length)} 个匹配结果${hits.length>70?' · 显示前 70 个，请添加关键词缩小范围':''}`;maybeSearchIndex();
    }
    state.searchResults=hits.slice(0,70).map(x=>x.page);state.searchSelected=0;
    $('#search-results').innerHTML=state.searchResults.map((p,i)=>`<a class="search-result${i===0?' selected':''}" href="${esc(link(p.path))}" role="option" aria-selected="${i===0}" data-result="${i}"><span class="result-kind">${isApi(p)?'API':'DOC'}</span><span class="result-main"><strong>${highlight(p.titleZh||p.title||p.path,q)}</strong><small>${highlight(p.titleZh&&p.titleZh!==p.title?p.title:p.path,q)}</small></span></a>`).join('')||'<div class="search-empty">没有找到匹配内容。可以尝试英文类名、方法名，或简短的中文概念。</div>';
    $$('.search-result').forEach(a=>a.onclick=()=>$('#search-dialog').close());
  }
  function selectResult(delta){const n=state.searchResults.length;if(!n)return;state.searchSelected=(state.searchSelected+delta+n)%n;$$('.search-result').forEach((a,i)=>{const on=i===state.searchSelected;a.classList.toggle('selected',on);a.setAttribute('aria-selected',String(on));if(on)a.scrollIntoView({block:'nearest'});});}
  function bindThemePicker(){
    const root=document.documentElement,pickers=$$('select[data-theme-picker]');
    const normalize=value=>['auto','dark','light'].includes(value)?value:'auto';
    let preference=normalize(storage.get('orleans-theme')),media;
    try{media=window.matchMedia('(prefers-color-scheme: dark)');}catch{media={matches:false};}
    const apply=(value,persist=false)=>{
      preference=normalize(value);
      const effective=preference==='auto'?(media.matches?'dark':'light'):preference;
      const changed=root.dataset.theme!==effective;
      root.dataset.themePreference=preference;root.dataset.theme=effective;root.style.colorScheme=effective;
      pickers.forEach(picker=>picker.value=preference);
      if(persist)storage.set('orleans-theme',preference);
      if(changed)renderDiagrams();
    };
    apply(preference);
    pickers.forEach(picker=>picker.addEventListener('change',event=>apply(event.currentTarget.value,true)));
    const systemChanged=()=>{if(preference==='auto')apply('auto');};
    if(media.addEventListener)media.addEventListener('change',systemChanged);else if(media.addListener)media.addListener(systemChanged);
    window.addEventListener('storage',event=>{
      if(event.key!=='orleans-theme'&&event.key!==null)return;
      if(event.storageArea){try{if(event.storageArea!==window.localStorage)return;}catch{return;}}
      apply(event.key===null?'auto':event.newValue);
    });
  }
  function bindUi(){
    $('.skip-link').onclick=e=>{e.preventDefault();$('#main').focus();$('#main').scrollIntoView({block:'start'});};
    bindThemePicker();
    $('#search-open').onclick=openSearch;$('#search-input').addEventListener('input',e=>{clearTimeout(runSearch.timer);runSearch.timer=setTimeout(()=>runSearch(e.target.value),100);});
    $('#search-input').addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();selectResult(1)}else if(e.key==='ArrowUp'){e.preventDefault();selectResult(-1)}else if(e.key==='Enter'){e.preventDefault();const p=state.searchResults[state.searchSelected];if(p){$('#search-dialog').close();location.hash=link(p.path).slice(1);}}});
    $('#search-dialog').addEventListener('click',e=>{if(e.target===$('#search-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch()}if(e.key==='Escape')closeMenu();});
    $('#menu-toggle').onclick=()=>{const on=!document.body.classList.contains('nav-open');document.body.classList.toggle('nav-open',on);$('#mobile-overlay').hidden=!on;$('#menu-toggle').setAttribute('aria-expanded',String(on));};$('#mobile-overlay').onclick=closeMenu;
    $('#collapse-nav').onclick=()=>{$$('.nav-group', $('#navigation')).forEach(group=>group.open=false);saveNavExpansion();};
    $('#back-top').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});window.addEventListener('scroll',()=>{$('#back-top').hidden=window.scrollY<650;},{passive:true});window.addEventListener('hashchange',navigate);
  }
  async function init(){
    bindUi();document.body.classList.toggle('landing-page',isHomepagePath(parseHash().path));try{state.catalog=await loadData('catalog.json');updateVersionHeader();state.pages=(state.catalog.pages||[]).map(p=>({...p,id:String(p.id??p.path),path:canonical(p.path||p.id),searchText:[p.title,p.titleZh,p.path,p.keywords,canonical(p.path||p.id)==='/original-home/'?'官网首页 原官网首页 首页 homepage landing':''].filter(Boolean).join(' ').toLowerCase()}));
      for(const p of state.pages){state.byPath.set(p.path,p);state.byId.set(p.id,p);}const groups=state.catalog.groups||[];if(Array.isArray(groups))groups.forEach(g=>state.groups.set(g.id,g));else Object.entries(groups).forEach(([k,v])=>state.groups.set(k,v));renderNav();await navigate();
    }catch(e){$('#content').innerHTML=`<div class="error-state"><div class="home-eyebrow">ORLEANS 中文文档</div><h1>文档内容暂时无法载入</h1><p>${esc(e.message)}</p><p>请完整解压文档包，并保持 index.html、data-loader.js、data 和 assets 的相对位置，然后重新打开 index.html。</p><button class="button-primary" type="button" id="reload-app">重新载入</button></div>`;$('#reload-app').onclick=()=>location.reload();$('#navigation').innerHTML='<p class="muted loading-label">目录尚未载入。</p>';}
  }
  init();
})();
