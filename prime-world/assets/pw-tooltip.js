(function(){
  'use strict';
  var DATA=window.PW_TOOLTIP_ITEMS=Object.create(null);
  var shards=new Map();
  var scriptUrl=document.currentScript.src;
  function loadRecord(key){
    if(DATA[key])return Promise.resolve(DATA[key]);
    var match=/^(heroes|talents|kits)\/(\d+)-/.exec(key);
    if(!match)return Promise.resolve(undefined);
    var shard=match[1]+'-'+Math.floor(Number(match[2])/50);
    if(!shards.has(shard)){
      var request=new Promise(function(resolve,reject){
        var script=document.createElement('script');
        script.src=new URL('tooltip/'+shard+'.js',scriptUrl).href;
        script.onload=resolve;
        script.onerror=function(){script.remove();reject(new Error('Tooltip data unavailable'));};
        document.head.appendChild(script);
      });
      shards.set(shard,request);
    }
    return shards.get(shard).then(function(){return DATA[key];},function(){shards.delete(shard);return undefined;});
  }
  var ROOT=(document.body&&document.body.getAttribute('data-root'))||'';
  var tip=document.createElement('div');
  tip.className='pw-tooltip';tip.hidden=true;tip.setAttribute('role','tooltip');tip.setAttribute('aria-live','polite');
  document.body.appendChild(tip);
  var active=null,described=null,pending=null,skipFocus=null;
  var openTimer=null,closeTimer=null,touchTimer=null,touchTarget=null,touchStart=null,longPressed=false,suppressClickKey=null;
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function clearTimers(){if(openTimer)clearTimeout(openTimer);if(closeTimer)clearTimeout(closeTimer);openTimer=closeTimer=null;}
  function normalizeKey(value){var s=String(value||'').replace(/\\/g,'/');while(s.indexOf('../')===0)s=s.slice(3);while(s.indexOf('./')===0)s=s.slice(2);return s.replace(/^\/+/, '');}
  function triggerFrom(node){
    if(!node||!node.closest)return null;
    var img=node.closest('button.hero-sim-slot[data-pw-tooltip]')||node.closest('img[data-pw-tooltip],img.skill-icon,img.pw-hero-poster');
    if(!img)return null;
    var key=img.getAttribute('data-pw-tooltip');
    if(!key){var owner=img.closest('[data-pw-tooltip]');if(owner)key=owner.getAttribute('data-pw-tooltip');}
    if(!key){var link=img.closest('a[href]');if(link)key=link.getAttribute('href');}
    key=normalizeKey(key);
    if(!/^(heroes|talents|kits)\/\d+-/.test(key))return null;
    img.setAttribute('data-pw-tooltip',key);
    return img;
  }
  function triggerFromFocus(node){
    var t=triggerFrom(node);if(t)return t;
    if(node&&node.matches('a,button.hero-sim-slot')){
      var img=node.querySelector('img.skill-icon,img.pw-hero-poster,img[data-pw-tooltip]');
      if(img)return triggerFrom(img);
    }
    return null;
  }
  function addTag(parent,tag){var isString=typeof tag==='string';var n=el('span','pw-tooltip-tag '+(isString?'special':(tag.group||'')),isString?tag:(tag.label||tag.zh||''));if(!isString&&tag.key)n.dataset.effectKey=tag.key;parent.appendChild(n);}
  var effectTerms=new Map();
  var effectGroups={
    magic:'魔法伤害 法术伤害 能量伤害',
    physical:'物理伤害',
    pure:'纯粹伤害 真实伤害',
    damage:'持续伤害 额外伤害 暴击率 暴击伤害 暴击 穿透 伤害',
    control:'眩晕 沉默 击退 击飞 定身 缴械 减速 嘲讽 恐惧 睡眠 致盲 禁锢 禁止移动',
    defence:'免疫控制 免疫伤害 伤害减免 受到的伤害降低 吸收伤害 免疫 无敌 护盾 格挡',
    recovery:'治疗效果 治疗量 治疗 生命恢复 能量恢复 恢复生命 恢复能量 复活 净化 驱散',
    utility:'冷却时间 冷却缩减 冷却 传送 位移 隐身 召唤',
    stat:'最大生命值 最大生命 最大能量值 最大能量 基础移动速度 移动速度 攻速 生命偷取 力量 智力 灵巧 坚韧 意志'
  };
  Object.entries(effectGroups).forEach(function(pair){
    pair[1].split(' ').forEach(function(term){effectTerms.set(term,pair[0]);});
  });
  var namedTerms=Array.from(effectTerms.keys()).sort(function(a,b){return b.length-a.length;});
  var referencedSkills=new Set(["一切为了前线","一步不退","不倦猎手","不公平决斗","不可阻挡的野兽","不屈存在","不屈意志","不羁狂怒","义人奖赏","乌鸦邪眼","亡兽饥渴","仁慈之举","以太幽灵","以太形态","以太护盾","以太领主","以眼还眼","仪式打击","仪式灭绝","优势","传承护符","传送门","伤口愈合","似曾相识","信仰跃步","停滞","催眠挑衅","先祖之力","先祖之怒","先祖庇护","免疫削弱","共振","兽化体质","内在支柱","冥界寒意","冲击波","冲锋尖端","决心冲动","冷静算计","冻伤","凛冽寒霜","凶猛擒拿","击溃","切割飞盘","创伤灾厄","利刃浪潮","刽子手判决","刽子手的不屈","刽子手的无情","前线战友","剧毒之握","剧毒冲刺","剧毒孢子","力量平衡","势不可挡","勇猛冲击","厄运","压倒性存在","压制猛攻","原始狂怒","双手投掷","变形术","召唤恶魔","可靠护甲","合一","同一信仰","同一身躯","同血之盟","同袍战友","吞噬","命运呐喊","喂养黑豹","噩梦时刻","团队协作","地震打击","坚守秘法","坚定凯旋","坚定步伐","坚硬岩躯","处决","复仇","复仇再战","复仇渴望","夜行猛兽","大地震颤","大胆无畏","天然能量","天穹之怒","天穹裁决","头狼","奥术之网","女巫披风","奶昔","宁静","守护者誓言","安全着陆","安宁","密集射击","寒冰碎片","寒冰锁链","寒冷之力","寒颤","尖锐骨刺","尸毒","山崩","岩块形态","巨人步伐","平衡偏移","并发症","并肩作战","幻象庇护","幽灵拥抱","弩箭射击","弱者之殇","弹射","彩虹庇护","彩虹跃迁","彩虹飞行","心智游戏","心脏骤停","忍痛","快速翻滚","怒意","怒意散发","思维扭曲","怪物饥渴","恐怖印象","恐怖死亡","恐惧尾迹","恐惧诅咒","恶根","恶魔之力","恶魔形态","恶魔烈焰","惊喜盒中的猫","惊骇嚎叫","惩戒打击","惩戒者之路","愤怒之拳","战争碎片","战备","战意","战斗号令","战斗恍惚","战斗热忱","战斗热血","战斗狂怒","战斗狂热","战斗问候","战斗阵型","战斗陶醉","战术机动","打破宁静","执念","抗命","折服","抵抗无用","挑战","挑衅灾厄","振翼","捕猎者","捕食天性","捕食者","摄魂乐章","放肆无忌","放血","新弹簧","无尽储备","无尽噩梦","无尽好奇","无形之躯","无形追猎者","无情","无情之毒","无情射击","无瑕之盾","无畏旅者","无阻冲锋","昏厥","易位","星界扩张","星门","暗夜护甲","暗黑邪眼","暴走","暴雪风暴","暴风雪","最后一滴","最后堡垒","最终凯旋","有力论据","有恃无恐","机会边缘","机关剑刃","束缚之源","束缚气场","果决突袭","果断突刺","枯竭","树木滋养","森林象征","武器大师","死灵秘术","殉道者奖赏","毁灭威能","毒性束缚","毒性释放","毒素补充","毒蘑菇","永不满足的渴望","永冻","永恒冻土","永恒服役","沉默誓言","沙皇炸弹","沸腾之血","洞穿凝视","活力十足","活埋","活性护皮","活石","浓缩以太","深切伤口","深呼吸","清算时刻","游击射程路线","火焰波浪","火箭打击","火舌","灵魂一体","灵魂图腾","灵魂陷阱","灼烧","灾厄聚集","炼狱","烈焰守卫","烈焰打击","燃烧","爆心","爆炸幻象","爆烈混合物","爆破狂热","特制配方","狂乱","狂怒投矛","狂暴","狂暴旋风","狂热","狂野之火","狼之呼唤","狼兄弟","狼群守护","猎手警觉","猛烈喷涌","猛烈火力","猫捉老鼠","环形防御","瓦尔普吉斯之夜","生命之环","生命之路","生命光辉","电击","电能释放","疫风","疯狂火花","疾风连击","痉挛","痛苦试炼","瘟疫脓包","瘴气","白骨陷阱","盛大狩猎","目光接触","眩晕投球","瞄准射击","瞬间感知","瞬间起飞","碎骨声","碎骨爆裂","神圣复仇","神圣战旗","穿刺冰片","穿甲弹","突破","突袭","窒息","第二口气","粉碎重击","粒子加速","精巧心智","精疲力竭","纯洁之盾","统领重击","缠绕闪现","缴械技巧","群体催眠","群狼之力","翻腾","耀目之言","聚焦烈焰","聚能弹","肾上腺爆发","胜利之星","能量共振","能量团","能量屏障","能量释放","脆弱诅咒","致命冲刺","致命山崩","致命撕咬","致命毒药","致命触碰","良机","茧","蔓生","蔽身黑雾","蛇之坚忍","蛇之柔韧","蛇毒","血色玫瑰","血迹","袖中王牌","解放者","誓约","诅咒恐惧","诡异呼唤","诡诈打击","诡诈火焰","谦卑","贯穿之矛","贯穿长矛","贴身护卫","超新星","超机动性","超空间","越界","轰炸","输血","边境守卫","迅猛连击","过剩能量","过载","进攻姿态","连续重拳","连锁闪电","迷醉之歌","迷魅","追猎","速度马蹄铁","速效毒药","遁移","遏制打击","遗忘棒","邪树","酸液喷发","重复发射","重弩","野兽召唤师","野兽嗅觉","野兽扑击","野兽皮毛","野兽诅咒","金字塔之谜","金字塔谜题","钢铁之拳","钢铁之握","钢铁皮毛","钢铁纪律","钢铁统御","钻地突袭","铁腿","锋利矛尖","锯齿弩矢","长寿秘诀","长矛诅咒","闪电反应","闪电速度","防御伪装","防御甲片","防护力场","防护长袍","附魔战甲","隐秘魔法","难耐酷热","雷霆一击","震慑打击","震耳轰鸣","霜寒触碰","静电充能","预兆","预言之焰","风暴狂怒","飞吻送别","飞掷重物","飞行狂喜","飞身重击","饥渴之钢","饥饿诅咒","饥饿鼠群","骚乱","魅惑丰饶","魅惑旋律","魔宠","魔法加速","魔法陷阱","魔笛之力","魔笛之召","魔笛大师","鲜奶油","鲜血仪式","鲜血斩痕","鸦群","鹰眼","鹰隼目光","黑色旋风","鼓舞颂歌","鼠疫","鼠群侵袭"]);
  var effectTokens=new RegExp(/〔[^〕]+〕|激活\s*\d+\s*[项件]|《[^》]+》|“[^”]+”|[+−-]?\d+(?:\.\d+)?(?:\s*(?:个百分点|秒|%|％|Prime|个|份|次|层))?/.source+'|'+namedTerms.join('|'),'g');
  function appendHighlightedText(result,text){
    var end=0;
    for(var match of text.matchAll(effectTokens)){
      result.append(text.slice(end,match.index));
      var value=match[0];
      var quotedName=/^[“《]/.test(value)?value.slice(1,-1):'';
      if(referencedSkills.has(quotedName)){
        result.append(el('span','pw-tooltip-skill-ref','【'+quotedName+'】'));
        end=match.index+value.length;
        continue;
      }
      var kind=(value.startsWith('〔')||value.startsWith('激活'))?'condition':/^[+−-]?\d/.test(value)?'value':effectTerms.get(value);
      result.append(kind?el('span','pw-tooltip-'+kind,value):value);
      end=match.index+value.length;
    }
    result.append(text.slice(end));
  }
  function effectText(text){
    var result=el('p','pw-tooltip-effect');
    appendHighlightedText(result,text);
    return result;
  }
  document.querySelectorAll('.skill-effect').forEach(function(effect){
    effect.querySelectorAll('.parameter-ref').forEach(function(link){
      link.classList.add(link.classList.contains('dynamic-parameter')?'pw-tooltip-condition':'pw-tooltip-value');
    });
    var walker=document.createTreeWalker(effect,NodeFilter.SHOW_TEXT,{
      acceptNode:function(node){
        return node.parentElement.closest('a,code')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(function(node){
      if(!node.data.match(effectTokens))return;
      var highlighted=document.createDocumentFragment();
      appendHighlightedText(highlighted,node.data);
      node.replaceWith(highlighted);
    });
  });
  function build(record,key){
    tip.replaceChildren();
    var head=el('div','pw-tooltip-head');
    if(record.icon){var img=el('img',record.kind==='hero'?'pw-tooltip-icon pw-tooltip-avatar':'pw-tooltip-icon');img.alt='';img.loading='lazy';img.src=ROOT+record.icon;img.onerror=function(){img.remove();};head.appendChild(img);}else{head.appendChild(el('div','pw-tooltip-icon is-empty','✦'));}
    var title=el('div','pw-tooltip-title');title.appendChild(el('strong','',record.name||'未命名资源'));
    var sub=[];if(record.en)sub.push(record.en);if(record.role)sub.push(record.role);if(record.type)sub.push(record.type);
    if(sub.length)title.appendChild(el('div','pw-tooltip-subtitle',sub.join(' · ')));
    if(record.id){title.appendChild(el('div','pw-tooltip-id',(record.idLabel==='persistentId'?'原版资源 ID / persistentId':(record.idLabel||'原版 ID'))+': '+record.id));}
    else if(record.resourceType==='TALKIT'){title.appendChild(el('div','pw-tooltip-id','TALKIT · 原版类型未定义 persistentId'));}
    var localNo=String(key||'').match(/^(?:heroes|talents|kits)\/(\d+)-/);
    if(localNo||record.resourceType){var meta=[];if(localNo)meta.push('本站目录号：'+localNo[1]);if(record.resourceType)meta.push('XDB 类型：'+record.resourceType);title.appendChild(el('div','pw-tooltip-catalog',meta.join(' · ')));}
    head.appendChild(title);tip.appendChild(head);
    var body=el('div','pw-tooltip-body');
    if(record.effect||record.summary){var sec=el('div','pw-tooltip-section');sec.appendChild(el('span','pw-tooltip-label',record.kind==='hero'?'英雄机制':'技能效果'));sec.appendChild(effectText(record.effect||record.summary));body.appendChild(sec);}
    if(record.tags&&record.tags.length){var tags=el('div','pw-tooltip-tags');record.tags.slice(0,8).forEach(function(t){addTag(tags,t);});body.appendChild(tags);}
    if(record.metrics&&record.metrics.length){var grid=el('div','pw-tooltip-metrics');record.metrics.slice(0,6).forEach(function(m){var box=el('div','pw-tooltip-metric');var parts=m.match(/^(.+?)\s+((?:\d|\u89c1|\u65e0|\u2014)[\s\S]*)$/);box.appendChild(el('span','',parts?parts[1]:'参数'));box.appendChild(el('b','',parts?parts[2]:m));grid.appendChild(box);});body.appendChild(grid);}
    if(record.components&&record.components.length){var sec2=el('div','pw-tooltip-section');sec2.appendChild(el('span','pw-tooltip-label','套装部件'));var list=el('ul','pw-tooltip-components');record.components.slice(0,6).forEach(function(c){list.appendChild(el('li','',c));});sec2.appendChild(list);body.appendChild(sec2);}
    if(record.owner){body.appendChild(el('div','pw-tooltip-subtitle','所属英雄：'+record.owner));}
    var actions=el('div','pw-tooltip-actions');
    if(record.href){var detail=el('a','',record.kind==='hero'?'打开英雄图鉴 →':record.kind==='kit'?'打开套装详情 →':'打开完整技能详情 →');detail.href=ROOT+record.href;actions.appendChild(detail);}
    if(record.source){var source=el('a','pw-tooltip-source','原版 XDB ↗');source.href=record.source;source.target='_blank';source.rel='noopener noreferrer';actions.appendChild(source);}
    if(actions.childNodes.length)body.appendChild(actions);
    tip.appendChild(body);
  }
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function place(x,y,anchor){
    tip.hidden=false;
    var w=tip.offsetWidth||360,h=tip.offsetHeight||220,vw=window.innerWidth,vh=window.innerHeight,g=10,left,top;
    if(anchor){
      var r=anchor.getBoundingClientRect();
      if(vw>680){
        left=r.right+g;top=r.top-2;
        if(left+w>vw-10){var leftSide=r.left-w-g;if(leftSide>=10)left=leftSide;else{left=clamp(r.left,10,vw-w-10);top=r.bottom+g;if(top+h>vh-10)top=r.top-h-g;}}
      }else{
        left=clamp(r.left,10,vw-w-10);top=r.bottom+g;
        if(top+h>vh-10)top=r.top-h-g;
      }
    }else{left=x+12;top=y+14;if(left+w>vw-10)left=x-w-12;if(top+h>vh-10)top=y-h-12;}
    left=clamp(left,10,Math.max(10,vw-w-10));top=clamp(top,10,Math.max(10,vh-h-10));
    tip.style.left=Math.round(left)+'px';tip.style.top=Math.round(top)+'px';
  }
  function clearDescription(){
    if(!described)return;
    var ids=(described.getAttribute('aria-describedby')||'').split(/\s+/).filter(function(id){return id&&id!==tip.id;});
    if(ids.length)described.setAttribute('aria-describedby',ids.join(' '));else described.removeAttribute('aria-describedby');
    described=null;
  }
  function open(target,delay,focus){
    if(active&&active!==target)hide();
    clearTimers();
    var request={target:target,focused:!!focus};
    pending=request;
    var record=loadRecord(target.getAttribute('data-pw-tooltip'));
    openTimer=setTimeout(async function(){
      var data=await record;
      if(pending!==request)return;
      pending=null;
      if(!data||!target.isConnected)return;
      clearDescription();
      active=target;
      var key=target.getAttribute('data-pw-tooltip');
      build(data,key);
      place(0,0,target);
      described=focus||target.closest('a,button,[tabindex]')||target;
      tip.id='pw-tooltip-active';
      var previous=described.getAttribute('aria-describedby');
      described.setAttribute('aria-describedby',previous?previous+' '+tip.id:tip.id);
    },delay);
  }
  function cancelPending(target){
    if(!pending||(target&&pending.target!==target))return;
    clearTimeout(openTimer);
    pending=null;
  }
  function scheduleClose(){if(closeTimer)clearTimeout(closeTimer);closeTimer=setTimeout(hide,260);}
  function hide(){
    cancelPending();clearTimers();clearDescription();
    tip.hidden=true;active=null;
  }
  document.addEventListener('pointerover',function(e){
    if(e.pointerType==='touch')return;
    var target=triggerFrom(e.target);
    if(!target||pending?.focused||described?.matches(':focus-visible'))return;
    if(active===target){clearTimeout(closeTimer);return;}
    open(target,160);
  });
  document.addEventListener('pointermove',function(e){
    if(touchStart&&e.pointerId===touchStart.id&&Math.hypot(e.clientX-touchStart.x,e.clientY-touchStart.y)>12){
      clearTimeout(touchTimer);cancelPending(touchTarget);touchTimer=null;touchTarget=null;touchStart=null;
    }
  });
  document.addEventListener('pointerout',function(e){
    if(e.pointerType==='touch')return;
    var target=triggerFrom(e.target);
    if(!target||target.contains(e.relatedTarget))return;
    if(!pending||!pending.focused)cancelPending(target);
    if(active===target&&!described?.matches(':focus-visible'))scheduleClose();
  });
  tip.addEventListener('pointerenter',function(){clearTimeout(closeTimer);});
  tip.addEventListener('pointerleave',function(){if(!tip.contains(document.activeElement))scheduleClose();});
  document.addEventListener('focusin',function(e){
    if(tip.contains(e.target)){clearTimeout(closeTimer);return;}
    var target=triggerFromFocus(e.target);
    if(target&&e.target!==skipFocus)open(target,0,e.target);
  });
  document.addEventListener('focusout',function(e){
    if(tip.contains(e.relatedTarget))return;
    if(tip.contains(e.target)){scheduleClose();return;}
    var target=triggerFromFocus(e.target);
    if(target){cancelPending(target);if(active===target)scheduleClose();}
  });
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape'||(!active&&!pending&&!touchTimer))return;
    var restore=tip.contains(document.activeElement)?described:null;
    clearTimeout(touchTimer);touchTimer=null;touchTarget=null;touchStart=null;
    hide();
    if(restore){skipFocus=restore;restore.focus({preventScroll:true});skipFocus=null;}
  });
  document.addEventListener('pointerdown',function(e){
    suppressClickKey=null;
    if(e.pointerType!=='touch')return;if(tip.contains(e.target))return;
    var t=triggerFrom(e.target);if(!t){hide();return;}
    clearTimeout(touchTimer);touchTarget=t;touchStart={x:e.clientX,y:e.clientY,id:e.pointerId};longPressed=false;
    loadRecord(t.getAttribute('data-pw-tooltip'));
    touchTimer=setTimeout(function(){if(touchTarget===t){longPressed=true;open(t,0);}},470);
  },{passive:true});
  document.addEventListener('pointerup',function(e){if(e.pointerType!=='touch')return;if(touchTimer)clearTimeout(touchTimer);touchTimer=null;if(longPressed&&touchTarget)suppressClickKey=touchTarget.getAttribute('data-pw-tooltip');touchStart=null;touchTarget=null;setTimeout(function(){longPressed=false;},0);},{passive:true});
  document.addEventListener('pointercancel',function(){if(touchTimer)clearTimeout(touchTimer);if(touchTarget)cancelPending(touchTarget);touchTimer=null;touchStart=null;touchTarget=null;longPressed=false;},{passive:true});
  document.addEventListener('click',function(e){var t=triggerFrom(e.target);if(suppressClickKey&&t&&normalizeKey(t.getAttribute('data-pw-tooltip'))===normalizeKey(suppressClickKey)){e.preventDefault();e.stopPropagation();suppressClickKey=null;return;}if(suppressClickKey)suppressClickKey=null;if(!tip.contains(e.target)&&!t)hide();},true);
  document.addEventListener('contextmenu',function(e){if(longPressed)e.preventDefault();});
  window.addEventListener('resize',function(){if(active)place(0,0,active);});
  window.addEventListener('scroll',function(){if(active)place(0,0,active);},{passive:true});
})();
