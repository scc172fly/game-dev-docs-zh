/* Prime World Tactical Atlas V0.8 - interactive teaching calculator, no remote requests. */
(()=>{'use strict';
 const get=id=>document.getElementById(id), num=id=>{const el=get(id);if(!el)return 0;const v=Number(el.value);return Number.isFinite(v)?v:0};
 const tick=id=>Boolean(get(id)&&get(id).checked);
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const defenceFromStats=(main, secondary)=>.00536*(main+.3*secondary)-.2;
 const clampDefence=value=>clamp(value,-.75,.75);
 const fixed=(v,k=4)=>Number.isFinite(v)?v.toFixed(k):'—';
 const put=(id,text)=>{let e=get(id);if(e)e.textContent=text};
 const formulaTerms = {
  Pbase:'基准穿透', x:'防御差值', Δ:'差值', APS:'每秒攻击次数', ExplicitAPS:'指定每秒攻击次数',
  AS:'攻速点数', 'AS′':'有效攻速', Dex:'灵巧', 'Dex′':'有效灵巧', Cbase:'基础暴击率',
  P_AS:'攻速穿透', P_Dex:'灵巧穿透', P:'总穿透', Body:'物理防御比例', Spirit:'魔法防御比例',
  Stamina:'坚韧', Will:'意志', Defence:'对应防御', SpellDef:'技能防护', SpellPierce:'技能穿透',
  q:'防御系数', M:'伤害乘数', MissChance:'未命中率', Evasion:'闪避率',
  max:'取较大值', min:'取较小值', clamp:'限制范围', int:'向零取整',
 };
 const formulaTokens = /(?<![A-Za-z\d_])(?:Pbase|Δ|APS|ExplicitAPS|AS′?|Dex′?|Cbase|P_AS|P_Dex|P|Body|Spirit|Stamina|Will|Defence|SpellDef|SpellPierce|x|q|M|MissChance|Evasion|max|min|clamp|int)(?![A-Za-z\d_])/g;
 const steps = (id, lines) => {
  const list = get(id);
  if (!list) return;
  list.replaceChildren();
  for (const line of lines) {
   const item = document.createElement('li');
   item.textContent = line;
   const translated = line.replace(formulaTokens, token => id === 'v08-nova-steps' && token === 'x' ? '系数影响参数' : formulaTerms[token]);
   if (translated !== line && line.includes('=')) {
    const chinese = document.createElement('div');
    chinese.className = 'pw-formula-zh';
    chinese.textContent = '中文公式　'+translated;
    item.appendChild(chinese);
   }
   list.appendChild(item);
  }
 };
 // PFLogicObject::IsDead compares float health with EPS_VALUE.
 const isAlive=hp=>Math.fround(hp)>=2**-23;
 function calculateNova(){
  const base=Math.max(0,num('v08-nova-base')),x=clamp(num('v08-nova-x'),.333,2.7);
  const old=base*(1+.09*(1-x)),now=base*(1+.06*(1-x)),diff=now-old;
  put('v08-nova-old',fixed(old,2));put('v08-nova-new',fixed(now,2));put('v08-nova-delta',(diff>0?'+':'')+fixed(diff,2));
  steps('v08-nova-steps',[
   '输入：Pbase = '+fixed(base,3)+'，x = '+fixed(x,3)+'。',
   '旧值 = '+fixed(base,3)+' × [1 + 0.09 × (1 − '+fixed(x,3)+')] = '+fixed(old,3)+'。',
   '新值 = '+fixed(base,3)+' × [1 + 0.06 × (1 − '+fixed(x,3)+')] = '+fixed(now,3)+'。',
   '变化 Δ = 新值 − 旧值 = '+fixed(now,3)+' − '+fixed(old,3)+' = '+fixed(diff,3)+'。'
  ]);
 }
 function calculateReduction(){
  const attack=Math.max(0,num('v08-reduce-raw'));
  const stamina=Math.max(0,num('v08-reduce-stamina')),will=Math.max(0,num('v08-reduce-will'));
  const hp=Math.max(0,num('v08-reduce-hp'));
  for (const [kind, primary, secondary] of [['body',stamina,will],['spirit',will,stamina]]) {
   const defence=defenceFromStats(primary,secondary);
   const reduction=clampDefence(defence);
   const damage=attack*(1-reduction);
   const loss=isAlive(hp)?Math.min(damage,hp):0;
   const prefix='v08-reduce-'+kind;
   put(prefix+'-loss',fixed(loss,2));
   put(prefix+'-rate',(reduction<0?'伤害放大 '+fixed(-100*reduction,2):'减伤 '+fixed(100*reduction,2))+'%');
   steps(prefix+'-steps',[
    '对应防御 = 0.00536 × ('+primary+' + 0.3 × '+secondary+') − 0.2 = '+fixed(defence,5),
    '减伤比例 = 限制在 −75% 到 75%（'+fixed(defence*100,3)+'%） = '+fixed(reduction*100,3)+'%',
    '减免后伤害 = '+attack+' × (1 − '+fixed(reduction,5)+') ≈ '+fixed(damage,3),
    isAlive(hp)?'实际扣血 = 取较小值（'+fixed(damage,3)+'，'+hp+'）≈ '+fixed(loss,3):'目标当前生命为零或已低于存活阈值，实际扣血 = 0'
   ]);
  }
 }
 function critFromDex(dex){
  const dprime=dex-Math.max(0,dex-500)*.25;
  return { dprime,rawCrit:90.9*dprime/(dprime+128)-28 };
 }
 function calculateCritical(){
  const prefix='v08-demo-crit-';
  const dex=Math.max(0,num(prefix+'dex')),bonus=num(prefix+'bonus');
  const mult=Math.max(0,num(prefix+'mult')),raw=Math.max(0,num(prefix+'raw'));
  const { dprime,rawCrit }=critFromDex(dex);
  const unbounded=rawCrit+bonus,chance=clamp(unbounded,0,100);
  const critical=raw*mult;
  put(prefix+'chance',fixed(chance,2)+'%');
  get(prefix+'meter').value=chance;
  put(prefix+'normal',fixed(raw,2));
  put(prefix+'hit',fixed(critical,2));
  put(prefix+'normal-note',chance===100?'暴击率为 100%，本次不会走未暴击分支':'未暴击概率 '+fixed(100-chance,2)+'%');
  put(prefix+'hit-note',chance===0?'暴击率为 0%，仅显示该分支的理论值':'暴击概率 '+fixed(chance,2)+'%');
  steps(prefix+'steps',[
   '有效灵巧 = '+dex+' − 取较大值（0，'+dex+' − 500）× 0.25 = '+fixed(dprime,4),
   '加成前未限幅的暴击率百分点 = 90.9 × '+fixed(dprime,4)+' ÷（'+fixed(dprime,4)+' + 128）− 28 ≈ '+fixed(rawCrit,4),
   '先加额外暴击率 = '+fixed(rawCrit,4)+' +（'+bonus+'）≈ '+fixed(unbounded,4)+' 个百分点',
   '最终暴击率 = 将 '+fixed(unbounded,4)+'% 限制在 0% 到 100% ≈ '+fixed(chance,4)+'%',
   '未暴击伤害 = '+fixed(raw,4)+'；暴击伤害 = '+raw+' × '+mult+' ≈ '+fixed(critical,4)
  ]);
 }
 function penetrationFromStats(AS,dex){
  const aprime=AS-Math.max(0,AS-500)*.25;
  const speed=clamp(AS*.00365+.49,.702,2);
  const { dprime,rawCrit }=critFromDex(dex);
  const cbase=clamp(rawCrit,0,100);
  // DerivateStats uses base crit without the added crit bonus and ignores Explicit APS.
  const pas=.00536*aprime-.2-(1-.6667/speed);
  const pdex=.00536*dprime-.2-cbase/(100+cbase);
  return { aprime,dprime,speed,rawCrit,cbase,pas,pdex,P:Math.max(pas+pdex,0) };
 }
 function calculatePenetration(){
  const value=name=>Math.max(0,num('v08-pierce-'+name));
  const as=value('as'),dex=value('dex'),stamina=value('stamina'),will=value('will');
  const raw=value('raw'),hp=value('hp');
  const { aprime,dprime,speed,cbase,pas,pdex,P }=penetrationFromStats(as,dex);
  const points=n=>fixed(100*n,2);
  const ratio=n=>fixed(n,5);
  const healthLoss=damage=>isAlive(hp)?Math.min(damage,hp):0;
  put('v08-pierce-total',points(P)+' 个百分点');
  put('v08-pierce-parts','攻速 '+points(pas)+' · 灵巧 '+points(pdex)+' 个百分点，合计最低为 0');
  steps('v08-pierce-steps',[
   '有效攻速 = '+as+' − 取较大值（0，'+as+' − 500）× 0.25 = '+ratio(aprime),
   '有效灵巧 = '+dex+' − 取较大值（0，'+dex+' − 500）× 0.25 = '+ratio(dprime),
   '攻速换算值 = 将（'+as+' × 0.00365 + 0.49）限制在 0.702 到 2 ≈ '+ratio(speed),
   '基础暴击率百分点 = 将〔90.9 × '+ratio(dprime)+' ÷（'+ratio(dprime)+' + 128）− 28〕限制在 0 到 100 ≈ '+ratio(cbase),
   '攻速穿透 = 0.00536 × '+ratio(aprime)+' − 0.2 −（1 − 0.6667 ÷ '+ratio(speed)+'）≈ '+ratio(pas),
   '灵巧穿透 = 0.00536 × '+ratio(dprime)+' − 0.2 − '+ratio(cbase)+' ÷（100 + '+ratio(cbase)+'）≈ '+ratio(pdex),
   '总穿透 = 取较大值（0，'+ratio(pas)+' + '+ratio(pdex)+'）≈ '+ratio(P)
  ]);
  for (const [kind,main,secondary] of [['body',stamina,will],['spirit',will,stamina]]) {
   const defence=defenceFromStats(main,secondary);
   const before=clampDefence(defence),after=clampDefence(defence-P);
   const damage=raw*(1-after),loss=healthLoss(damage);
   const prefix='v08-pierce-'+kind;
   put(prefix+'-loss',fixed(loss,2));
   put(prefix+'-rate','减伤 '+points(before)+'% → '+points(after)+'% · 实际少减 '+points(before-after)+' 个百分点');
   steps(prefix+'-steps',[
    '基础防御 = 0.00536 ×（'+main+' + 0.3 × '+secondary+'）− 0.2 ≈ '+ratio(defence),
    '扣穿透后的防御 = '+ratio(defence)+' − '+ratio(P)+' ≈ '+ratio(defence-P),
    '将防御限制在 −75% 到 75%：无穿透 '+points(before)+'%，有穿透 '+points(after)+'%，相差 '+points(before-after)+' 个百分点。',
    '减免后伤害 = '+raw+' ×（1 − '+ratio(after)+'）≈ '+fixed(damage,3),
    isAlive(hp)?'实际扣血 = 取较小值（'+fixed(damage,3)+'，'+hp+'）≈ '+fixed(loss,3)+'；无穿透时扣 '+fixed(healthLoss(raw*(1-before)),3):'目标已死亡，实际扣血 = 0'
   ]);
  }
 }
 const nonnegative=id=>Math.max(0,num(id));
 const procRate=value=>clamp(Math.trunc(value),0,100)/100;
 const hitChance=(miss,evade)=>(1-miss)*(1-evade);
 const baseAttackRate=as=>Math.min(as*.00365+.49,2);
 const attackRate=(as,explicit)=>Math.max(explicit>0?explicit:baseAttackRate(as),.01);
 const defenceMultiplier=(x,basic)=>{
  const q=x>0||basic?1:.75;
  const bounded=clampDefence(x);
  return {q,bounded,M:1-q*bounded};
 };
 const shieldSpend=(damage,shield,ignore)=>ignore||shield===0?0:Math.min(damage,shield);
 const burnEnergy=(energy,amount)=>Math.min(energy,amount);
 const percent=ratio=>fixed(100*ratio,2)+'%';
 function calculateHitEvasion(){
  const id='v08-hit-evasion-';
  const missInput=num(id+'miss'),evadeInput=num(id+'evasion');
  const miss=procRate(missInput),evade=procRate(evadeInput);
  const evaded=(1-miss)*evade,hit=hitChance(miss,evade);
  put(id+'hit',percent(hit));
  put(id+'miss-result',percent(miss));
  put(id+'evaded',percent(evaded));
  steps(id+'steps',[
   '第一抽 · 未命中阈值 = 将 '+missInput+' 向零取整后限制在 0 到 100 = '+fixed(miss*100,0)+'；第一抽通过的概率 '+percent(1-miss)+'。',
   '第二抽 · 闪避阈值 = 将 '+evadeInput+' 向零取整后限制在 0 到 100 = '+fixed(evade*100,0)+'。',
   '最终被闪避 = '+percent(1-miss)+' × '+percent(evade)+' = '+percent(evaded)+'。',
   '最终命中 = '+percent(1-miss)+' × '+percent(1-evade)+' = '+percent(hit)+'。'
  ]);
 }
 function calculateAttackSpeed(){
  const id='v08-attack-speed-';
  const as=nonnegative(id+'stat'),explicit=nonnegative(id+'explicit');
  const base=baseAttackRate(as),aps=attackRate(as,explicit),period=1/aps;
  put(id+'aps',fixed(aps,3)+' 次/秒');
  put(id+'period',fixed(period,3)+' 秒');
  steps(id+'steps',[
   '常规攻击频率 = 取较小值（'+as+' × 0.00365 + 0.49，2）≈ '+fixed(base,5),
   '采用'+(explicit>0?'显式频率':'常规频率')+'，与 0.01 取较大值 ≈ '+fixed(aps,5),
   '普攻冷却 = 1 ÷ '+fixed(aps,5)+' ≈ '+fixed(period,5)+' 秒'
  ]);
 }
 function calculateShield(){
  const id='v08-shield-absorb-';
  const damage=num(id+'damage'),shield=nonnegative(id+'shield'),hp=nonnegative(id+'hp');
  const ignore=tick(id+'ignore'),alive=isAlive(hp);
  const spent=alive?shieldSpend(damage,shield,ignore):0;
  const remaining=shield-spent,after=Math.max(damage-spent,0);
  const loss=alive?Math.min(after,hp):0;
  put(id+'loss',fixed(loss,2));
  put(id+'spent',fixed(spent,2));
  put(id+'remaining',fixed(remaining,2));
  steps(id+'steps',[
   !alive?'目标已死亡，跳过结算。':ignore?'本次忽略防御，标准护盾跳过。':shield===0?'护盾已经耗尽，直接进入生命结算。':'护盾消耗量 = 取较小值（'+damage+'，'+shield+'）= '+fixed(spent,3),
   '剩余护盾 = '+shield+' −（'+fixed(spent,3)+'）≈ '+fixed(remaining,3),
   alive?'实际扣血 = 取较小值〔取较大值（'+damage+' −（'+fixed(spent,3)+'），0），'+hp+'〕≈ '+fixed(loss,3):'实际扣血 = 0'
  ]);
 }
 function calculateManaBurn(){
  const id='v08-mana-burn-';
  const energy=nonnegative(id+'energy'),damage=nonnegative(id+'damage');
  const burned=burnEnergy(energy,damage);
  put(id+'burned',fixed(burned,2));
  put(id+'remaining',fixed(energy-burned,2));
  put(id+'loss','0.00');
  steps(id+'steps',[
   '实际灼烧量 = 取较小值（'+energy+'，'+damage+'）≈ '+fixed(burned,3),
   '剩余能量 = '+energy+' − '+fixed(burned,3)+' ≈ '+fixed(energy-burned,3),
   '实际扣血 = 0，护盾保持原值。'
  ]);
 }
 function calculateIronKnightAxe(){
  const id='v08-axe-';
  const value=key=>nonnegative(id+key);
  const preview=value('preview'),launch=value('launch'),impact=value('impact');
  const refine=num(id+'refine');
  const stamina=value('stamina'),will=value('will'),penetration=value('pen')/100;
  const reduction=value('reduction')/100,shield=value('shield'),hp=value('hp');
  const scale=strength=>Math.max(73,73+(strength-50)*477/208);
  const raw=Math.round(scale(impact));
  const defence=defenceFromStats(stamina,will),x=defence-penetration;
  const {q,bounded,M}=defenceMultiplier(x,false);
  const alive=isAlive(hp);
  const event=alive?raw*(1-reduction)*M:0;
  const absorbed=shieldSpend(event,shield,false);
  const loss=Math.min(Math.max(event-absorbed,0),hp);
  put(id+'preview-damage',String(Math.round(scale(preview))));
  put(id+'launch-damage','出手时若按 '+launch+' 力量估算：'+Math.round(scale(launch))+'，仅供对照');
  put(id+'raw',alive?String(raw):'—');
  put(id+'event',alive?'进入护盾：'+fixed(event,2):'目标已死亡，跳过伤害应用');
  put(id+'loss',fixed(loss,2));
  put(id+'absorbed',absorbed<0?'护盾容量增加 '+fixed(-absorbed,2):'护盾吸收 '+fixed(absorbed,2));
  steps(id+'steps',[
   '预览按 '+preview+' 力量算出 '+Math.round(scale(preview))+'。出手时 '+launch+' 力量可估算出 '+Math.round(scale(launch))+'，实际伤害应用时读 '+impact+'。',
   '原始伤害 = 取整〔取较大值（73，73 ＋（'+impact+' − 50）× 477 ÷ 208）〕 = 取整（'+fixed(scale(impact),4)+'）= '+raw+'。强化 '+refine+' 级没有直接进入此式。',
   '物理基础防御 = 0.00536 ×（'+stamina+' ＋ 0.3 × '+will+'）− 0.2 ≈ '+fixed(defence,5)+'。扣掉总穿透 '+fixed(penetration,5)+'，剩余防御 ≈ '+fixed(x,5)+'。',
   '伤害乘数 = 1 − '+q+' × '+fixed(bounded,5)+' ≈ '+fixed(M,5)+'。代入的是限幅后的防御。',
   alive?'进入护盾的伤害 = '+raw+' ×（1 − '+percent(reduction)+'）× '+fixed(M,5)+' ≈ '+fixed(event,4)+'。':'目标已死亡，跳过伤害应用。',
   alive?'护盾处理后伤害 ≈ '+fixed(event,4)+' −（'+fixed(absorbed,4)+'）。按非负和当前生命 '+hp+' 截断，实际扣血 ≈ '+fixed(loss,4)+'。':'实际扣血 = 0。'
  ]);
 }
 function calculateNival(){
  const AS=Math.max(0,num('v08-as')),dex=Math.max(0,num('v08-dex'));
  const stamina=Math.max(0,num('v08-stamina')),will=Math.max(0,num('v08-will'));
  const raw=Math.max(0,num('v08-raw')),hp=Math.max(0,num('v08-hp')),shield=Math.max(0,num('v08-shield'));
  const type=get('v08-damage-type').value,attack=get('v08-attack').value;
  const ignore=tick('v08-ignore'),crit=tick('v08-crit'),evadable=tick('v08-evadable');
  const explicit=Math.max(0,num('v08-explicit-aps'));
  // C05: explicit override bypasses the normal 2 attacks/sec upper limit.
  const aps=attackRate(AS,explicit);
  const { aprime,dprime,rawCrit,cbase,pas,pdex,P }=penetrationFromStats(AS,dex);
  const critChance=clamp(rawCrit+num('v08-crit-bonus'),0,100);
  const body=defenceFromStats(stamina,will),spirit=defenceFromStats(will,stamina);
  const defence=type==='energy'?spirit:body;
  const spellDef=attack==='skill'?num('v08-spell-def'):0,spellPierce=attack==='skill'?num('v08-spell-pierce'):0;
  const x=defence+spellDef-(P+spellPierce);
  const { q,bounded,M }=defenceMultiplier(x,attack==='basic');
  const rollHit=attack==='basic'&&evadable&&!tick('v08-friendly');
  const hit=rollHit?hitChance(procRate(num('v08-miss')),procRate(num('v08-evasion'))):1;
  const critmult=Math.max(0,num('v08-crit-mult'));
  const critical=crit&&critChance>0;
  const modifiedRaw=critical?raw*critmult:raw;
  const normal=(type==='physical'||type==='energy');
  const reduction=normal&&!ignore?Math.max(0,type==='energy'?num('v08-energy-red'):num('v08-phys-red')):0;
  const mana=type==='mana';
  const energy=Math.max(0,num('v08-current-energy'));
  const validTarget=isAlive(hp);
  const burned=mana&&validTarget?burnEnergy(energy,modifiedRaw):0;
  const beforeShield=mana||!validTarget?0:normal&&!ignore?Math.max(modifiedRaw,0)*(1-reduction/100)*M:modifiedRaw;
  const absorbed=shieldSpend(beforeShield,shield,ignore);
  const afterShield=Math.max(beforeShield-absorbed,0);
  const hpLoss=Math.min(afterShield,hp);
  put('v08-aps',fixed(aps,3)+' 次/秒');put('v08-period',fixed(1/aps,3)+' 秒/次'+(explicit>0?' · 已按显式频率覆盖':''));
  put('v08-crit-chance',fixed(critChance,2)+'%');put('v08-pen',fixed(P,4));
  put('v08-mult',normal&&!ignore?fixed(M,4):'未应用');
  put('v08-hit',fixed(hit*100,2)+'%');put('v08-pre-shield',!validTarget?'目标已死亡':mana?'未进入护盾流程':fixed(beforeShield,3));
  put('v08-burned',fixed(burned,3));
  put('v08-absorbed',fixed(absorbed,3));put('v08-hp-loss',fixed(hpLoss,3));
  const route=ignore?'本次 ignoreDefences 已启用：普通防御通道与标准吸收盾均跳过。':
      type==='pure'?'Pure：不走普通物理/法术防御函数，标准吸收盾仍可能吸收。':

      type==='energy'?'能量伤害：防御为 Spirit，减免为 EnergyDamageDecrease。':'物理伤害：防御为 Body，减免为 MaterialDamageDecrease。';
  steps('v08-nival-steps',[
   'C05 攻速：APS = max(ExplicitAPS > 0 ? ExplicitAPS : min(AS × .00365 + .49, 2), .01) = '+fixed(aps,4)+'；攻击周期 = '+fixed(1/aps,4)+' 秒。',
   'C06 灵巧压缩：Dex′ = Dex − max(0, Dex − 500) × .25 = '+fixed(dprime,4)+'；暴击率 = clamp(90.9 × Dex′ / (Dex′ + 128) − 28 + 额外百分点, 0, 100) = '+fixed(critChance,3)+'%。',
   '本次暴击分支：'+(critical?'已勾选暴击成功，原始伤害 '+fixed(raw,3)+' × '+fixed(critmult,3)+' = '+fixed(modifiedRaw,3):(crit?'暴击率为 0，无法触发，原始伤害保持 ':'未选择暴击，原始伤害保持 ')+fixed(raw,3))+'。（真实暴击仍需对应 damageMode 的暴击标志。）',
   'C08 属性压缩：AS′ = '+fixed(aprime,4)+'；Dex′ = '+fixed(dprime,4)+'。基础暴击 Cbase = '+fixed(cbase,4)+'，先限制在 0–100，不加额外暴击加成。',
   'C08 穿透分项：P_AS = '+fixed(pas,5)+'；P_Dex = '+fixed(pdex,5)+'；P = max(P_AS + P_Dex, 0) = '+fixed(P,5)+'。',
   'C07 双防：Body = .00536 × (Stamina + .3 × Will) − .2 = '+fixed(body,5)+'；Spirit = .00536 × (Will + .3 × Stamina) − .2 = '+fixed(spirit,5)+'。',
   'C09 本次 '+(attack==='basic'?'普攻':'技能')+'：Defence = '+fixed(defence,5)+'，SpellDef = '+fixed(spellDef,5)+'，SpellPierce = '+fixed(spellPierce,5)+'；x = Defence + SpellDef − (P + SpellPierce) = '+fixed(x,5)+'。',
   'C09 q = '+fixed(q,2)+'；clamp(x, −.75, .75) = '+fixed(bounded,5)+'；M = 1 − q × clamp(x) = '+fixed(M,5)+'。'+(normal&&!ignore?'本次应用该乘数。':'本次伤害通道不应用该乘数。'),
   'C11 可闪避概率：'+(rollHit?'命中率 = (1 − clamp(int(MissChance), 0, 100)/100) × (1 − clamp(int(Evasion), 0, 100)/100) = '+fixed(hit*100,3)+'%。':'本次不满足普通可闪避攻击前提，跳过两次独立闪避检定。')+'后续数值均假设命中。',
   !validTarget?'目标已死亡，伤害施加器跳过结算。':mana?'C10 Mana：DamageApplicator 直接调用 OnBurnEnergy，跳过生命伤害与护盾事件。':'C10 伤害类型：'+route+'  类型减免 = '+fixed(reduction,2)+'%；进入护盾前 = '+fixed(beforeShield,5)+'。',
   !validTarget?'生命、护盾与能量变化均为 0。':mana?'实际灼烧 = min(当前能量 '+fixed(energy,3)+'，暴击判定后的灼烧量 '+fixed(modifiedRaw,3)+') = '+fixed(burned,3)+'；剩余能量 '+fixed(energy-burned,3)+'，护盾和生命均保持原值。':'C12 单盾：护盾消耗（负值为容量增加） = '+fixed(absorbed,5)+'；护盾后剩余伤害 = '+fixed(afterShield,5)+'；本次扣血 min(剩余伤害, 当前生命 '+fixed(hp,3)+') = '+fixed(hpLoss,5)+'。'
  ]);
 }
 function calculateHeal(){
  const amount=num('v08-heal-raw'),hp=Math.max(0,num('v08-heal-hp'));
  const max=Math.max(0,num('v08-heal-max'));
  const scale=num('v08-heal-scale'),bias=num('v08-heal-bias');
  const ignored=tick('v08-heal-ignore'),forbidden=tick('v08-heal-forbid');
  const theoretical=ignored?amount:amount*(1+scale)+bias;
  const missing=max-hp;
  const blocked=forbidden||!isAlive(hp);
  const actual=blocked?0:Math.min(missing,theoretical);
  const overflow=blocked?0:Math.max(theoretical-actual,0);
  put('v08-heal-theory',fixed(theoretical,2));put('v08-heal-actual',fixed(actual,2));put('v08-heal-over',fixed(overflow,2));
  steps('v08-heal-steps',[
   '输入：基础治疗 '+fixed(amount,2)+'，当前生命 '+fixed(hp,2)+'，最大生命 '+fixed(max,2)+'。',
   ignored?'ignoreHealingMods：不读取比例修正与固定修正，理论治疗量 = '+fixed(amount,2)+'。':'理论治疗 = '+fixed(amount,2)+' × (1 + '+fixed(scale,3)+') + '+fixed(bias,2)+' = '+fixed(theoretical,3)+'。',
   '最大生命 − 当前生命 = '+fixed(missing,3)+'。',
   !isAlive(hp)?'目标已死亡，治疗施加器跳过结算。':forbidden?'FORBIDLIFERESTORE：本次实际恢复为 0，治疗流程被禁止。':'生命变化 = min(最大生命 − 当前生命, 理论治疗) = '+fixed(actual,3)+'；溢出 '+fixed(overflow,3)+'。'+(actual<0?'负值表示生命下降。':'')
  ]);
 }
 const sectionCalculators={
  'damage-reduction':calculateReduction,penetration:calculatePenetration,critical:calculateCritical,
  'hit-evasion':calculateHitEvasion,'attack-speed':calculateAttackSpeed,'shield-absorb':calculateShield,
  'mana-burn':calculateManaBurn,'iron-knight-axe':calculateIronKnightAxe,nova:calculateNova,nival:calculateNival,heal:calculateHeal
 };
 const lab=document.querySelector('.v08-lab-page');if(!lab)return;
 function updateSection(event){
  const input=event.target;
  if(!input.matches('input,select'))return;
  if(input.id==='v08-nova-range')get('v08-nova-x').value=input.value;
  if(input.id==='v08-nova-x'){
   const value=clamp(num(input.id),.333,2.7);
   if(event.type==='change')input.value=String(value);
   get('v08-nova-range').value=value;
  }
  sectionCalculators[input.closest('section[id]')?.id]?.();
 }
 lab.addEventListener('input',updateSection);
 lab.addEventListener('change',updateSection);
 Object.values(sectionCalculators).forEach(calculate=>calculate());
})();
