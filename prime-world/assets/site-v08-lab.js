/* Prime World Tactical Atlas V0.8 - interactive teaching calculator, no remote requests. */
(()=>{'use strict';
 const get=id=>document.getElementById(id), num=id=>{const el=get(id);if(!el)return 0;const v=Number(el.value);return Number.isFinite(v)?v:0};
 const tick=id=>Boolean(get(id)&&get(id).checked);
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const fixed=(v,k=4)=>Number.isFinite(v)?v.toFixed(k):'—';
 const put=(id,text)=>{let e=get(id);if(e)e.textContent=text};
 const steps=(id,lines)=>{const el=get(id);if(!el)return;el.replaceChildren();for(const line of lines){const li=document.createElement('li');li.textContent=line;el.appendChild(li)}};
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
 function calculateNival(){
  const AS=Math.max(0,num('v08-as')),dex=Math.max(0,num('v08-dex'));
  const stamina=Math.max(0,num('v08-stamina')),will=Math.max(0,num('v08-will'));
  const raw=Math.max(0,num('v08-raw')),hp=Math.max(0,num('v08-hp')),shield=Math.max(0,num('v08-shield'));
  const type=get('v08-damage-type').value,attack=get('v08-attack').value;
  const ignore=tick('v08-ignore'),crit=tick('v08-crit'),evadable=tick('v08-evadable');
  const explicit=Math.max(0,num('v08-explicit-aps'));
  // C05: explicit override bypasses the normal 2 attacks/sec upper limit.
  const aps=Math.max(explicit>0?explicit:Math.min(AS*.00365+.49,2),.01);
  const aprime=AS-Math.max(0,AS-500)*.25,dprime=dex-Math.max(0,dex-500)*.25;
  const rawCrit=90.9*dprime/(dprime+128)-28;
  const cbase=clamp(rawCrit,0,100);
  const critChance=clamp(rawCrit+num('v08-crit-bonus'),0,100);
  // C08: unmodified Cbase, not added bonus; original AS rather than Explicit APS.
  const pas=.00536*aprime-.2-(1-.6667/clamp(AS*.00365+.49,.702,2));
  const pdex=.00536*dprime-.2-cbase/(100+cbase);
  const P=Math.max(pas+pdex,0);
  const body=.00536*(stamina+.3*will)-.2,spirit=.00536*(will+.3*stamina)-.2;
  const defence=type==='energy'?spirit:body;
  const spellDef=attack==='skill'?num('v08-spell-def'):0,spellPierce=attack==='skill'?num('v08-spell-pierce'):0;
  const x=defence+spellDef-(P+spellPierce),q=(x>0||attack==='basic')?1:.75;
  const bounded=clamp(x,-.75,.75),M=1-q*bounded;
  const rollHit=attack==='basic'&&evadable&&!tick('v08-friendly');
  const hit=rollHit?(1-clamp(Math.trunc(num('v08-miss')),0,100)/100)*(1-clamp(Math.trunc(num('v08-evasion')),0,100)/100):1;
  const critmult=Math.max(0,num('v08-crit-mult'));
  const critical=crit&&critChance>0;
  const modifiedRaw=critical?raw*critmult:raw;
  const normal=(type==='physical'||type==='energy');
  const reduction=normal&&!ignore?Math.max(0,type==='energy'?num('v08-energy-red'):num('v08-phys-red')):0;
  const mana=type==='mana';
  const energy=Math.max(0,num('v08-current-energy'));
  const validTarget=isAlive(hp);
  const burned=mana&&validTarget?Math.min(energy,modifiedRaw):0;
  const beforeShield=mana||!validTarget?0:normal&&!ignore?Math.max(modifiedRaw,0)*(1-reduction/100)*M:modifiedRaw;
  const absorbed=ignore||shield===0?0:Math.min(beforeShield,shield);
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
   'C11 可闪避概率：'+(rollHit?'命中率 = (1 − int(MissChance)/100) × (1 − int(Evasion)/100) = '+fixed(hit*100,3)+'%。':'本次不满足普通可闪避攻击前提，跳过两次独立闪避检定。')+'后续数值均假设命中。',
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
 function refresh(){calculateNova();calculateNival();calculateHeal()}
 const lab=document.querySelector('.v08-lab-page');if(!lab)return;
 lab.addEventListener('input',e=>{if(!e.target.matches('input,select'))return; if(e.target.id==='v08-nova-range'){get('v08-nova-x').value=e.target.value}else if(e.target.id==='v08-nova-x'){const v=Number(e.target.value);if(Number.isFinite(v))get('v08-nova-range').value=clamp(v,.333,2.7)}refresh()});
 lab.addEventListener('change',e=>{if(!e.target.matches('input,select'))return;if(e.target.id==='v08-nova-x'){const e0=e.target;e0.value=String(clamp(num('v08-nova-x'),.333,2.7));get('v08-nova-range').value=e0.value}refresh()});
 refresh();
})();
