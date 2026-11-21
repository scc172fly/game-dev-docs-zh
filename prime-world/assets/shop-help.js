(() => {
  const sharedItems = {
    "EyeOfSeeing": "<b>魔法提灯</b>在 <strong>14</strong> 距离内放置隐形提灯，为友军提供 <strong>16</strong> 范围视野，<strong>可以反隐</strong>。持续 <strong>360 秒</strong>，灯消失后失去该视野来源。",
    "EyeOfSeeingCheap": "<b>提灯</b>在 <strong>14</strong> 距离内放置隐形提灯，为友军提供 <strong>16</strong> 范围视野，<strong>不能反隐</strong>。持续 <strong>360 秒</strong>，灯消失后失去该视野来源。",
    "EyeOfSeeingCheapest": "<b>微光提灯</b>在 <strong>11</strong> 距离内放置可见提灯，为友军提供 <strong>16</strong> 范围视野，<strong>不能反隐</strong>。持续 <strong>360 秒</strong>，灯消失后失去该视野来源。",
    "SignOfBirds": "<b>群鸟印记</b>在半径 <strong>11</strong> 的区域内持续 <strong>10 秒</strong>。友军力量和智力提高 <strong>15%</strong>，敌军两项属性降低 <strong>15%</strong>、受到的治疗降低 <strong>50%</strong>。远古单位免疫。",
    "SignOfCopy": "<b>分身印记</b>召出自身的分身，持续 <strong>35 秒</strong>。分身拥有本体 <strong>60% 生命和能量</strong>、<strong>110% 力量和智力</strong>。分身在场时，本体天赋冷却时间缩短 <strong>20%</strong>。",
    "SignOfNova": "<b>辉光印记</b>使自身周围 <strong>14</strong> 范围内的敌人致盲 <strong>6 秒</strong>，其攻击未命中概率增加 <strong>50 个百分点</strong>。",
    "SignOfPriestess": "<b>巫女印记</b>为自身储存 <strong>100＋最大生命的 75%</strong> 的治疗量。每 <strong>3 秒</strong>最多恢复最大生命的 <strong>2.1%</strong>，按实际回血扣除储量，直到用完。治疗期间阵亡，本次复活时间缩短 <strong>20%</strong>。",
    "SignOfStarfall": "<b>星落印记</b>选定地点后 <strong>0.7 秒</strong>打击半径 <strong>9</strong> 内的敌人一次。对英雄造成的能量伤害为 <strong>50＋自身力量与智力中的较高值</strong>，对小兵为该值的 <strong>3 倍</strong>。",
    "HealingPotion": "<b>治疗药水</b>为自身每 2 秒恢复 <strong>40 生命</strong>，持续 <strong>20 秒</strong>，共 400。天赋 G723 额外恢复最大生命的 10%。",
    "EnergyPotion": "<b>能量药水</b>为自身每 2 秒恢复 <strong>40 能量</strong>，持续 <strong>20 秒</strong>，共 400。天赋 G722 额外恢复最大能量的 10%。",
    "SpeedPotion": "<b>迅捷药水</b>自身<strong>移动速度提高 40%</strong>，持续 <strong>10 秒</strong>。天赋 G727 将加速提高至 60%。",
    "TeleportScroll": "<b>传送卷轴</b>自身引导 <strong>6 秒</strong>后，传送至距指定地点最近的<strong>友方建筑</strong>。天赋 G728 使友方单位也可成为落点。",
    "CleansingPotion": "<b>净化药水</b>立即移除自身 <strong>1 个可驱散的负面效果</strong>，按驱散优先级选择。天赋 G726 将数量上限提高至 100。",
    "LittleTSightPotion": "<b>警觉药水</b>自身获得<strong>反隐</strong>，持续 <strong>15 秒</strong>。只能发现自己视野内的隐形敌人，探测距离上限为 16。",
    "TrueSightPotion": "<b>洞察灵药</b>自身获得<strong>反隐</strong>，持续 <strong>180 秒</strong>。只能发现自己视野内的隐形敌人，探测距离上限为 16。",
    "KU-Stick": "<b>仪式匕首</b>命中指定<strong>敌方英雄</strong>时造成一次物理伤害，等于自身力量与智力较高值的 <strong>1.5 倍</strong>。天赋 G725 使伤害提高 25%。若这一击击杀敌方英雄，使用者获得功绩。",
    "DispellPotion": "<b>压制卷轴</b>立即驱散指定地点半径 <strong>5</strong> 内敌人身上的<strong>可驱散增益</strong>，驱散数量上限为 <strong>99</strong>。",
    "CleansingAllPotion": "<b>净化护符</b>立即移除自身的<strong>可驱散负面效果</strong>，数量上限为 <strong>100</strong>。",
    "InvulnerabilityAmulet": "<b>护身符</b>自身获得 <strong>3 秒无敌</strong>，期间<strong>无法攻击</strong>。",
    "StealthCloak": "<b>伪装卷轴</b>实际淡入约 <strong>1 秒</strong>，伪装总时限 <strong>11.5 秒</strong>。近期受到伤害会中止，普攻起手会破隐。",
    "PrimeRune": "<b>Prime 符文</b>拾取生效时，<strong>同阵营每名符合条件的英雄</strong>立即获得 Prime。基础奖励为 <strong>70</strong>，己方主建筑记录的对局时间每满 <strong>300 秒</strong>，每人再加 70。"
};

  for (const button of document.querySelectorAll('.shop-help')) {
    const id = button.getAttribute('aria-describedby');
    const key = id.slice(4);
    if (!sharedItems[key]) continue;
    const tip = document.createElement('span');
    tip.className = 'shop-tip';
    tip.id = id;
    tip.popover = 'manual';
    tip.setAttribute('role', 'tooltip');
    tip.innerHTML = sharedItems[key];
    document.body.append(tip);
    const description = document.querySelector('[data-shop-effect="' + key + '"]');
    if (description) {
      for (const node of Array.from(tip.childNodes).slice(1)) {
        description.append(node.cloneNode(true));
      }
    }
  }
  let active;
  let pinned = false;
  const tipFor = button => document.getElementById(button.getAttribute('aria-describedby'));
  function close() {
    if (!active) return;
    tipFor(active).hidePopover();
    active.setAttribute('aria-expanded', 'false');
    active = null;
    pinned = false;
  }
  function open(button) {
    if (active === button) return;
    close();
    active = button;
    const tip = tipFor(button);
    tip.showPopover();
    button.setAttribute('aria-expanded', 'true');
    const box = button.getBoundingClientRect();
    tip.style.left = Math.min(Math.max(8, box.left), innerWidth - tip.offsetWidth - 8) + 'px';
    tip.style.top = (box.top >= tip.offsetHeight + 8 ? box.top - tip.offsetHeight : box.bottom) + 'px';
  }
  for (const button of document.querySelectorAll('.shop-help')) {
    button.onpointerenter = e => { if (e.pointerType === 'mouse') open(button); };
    button.onpointerleave = e => { if (active === button && !pinned && e.relatedTarget !== tipFor(button) && !tipFor(button).contains(e.relatedTarget)) close(); };
    tipFor(button).onpointerleave = e => { if (!pinned && !button.contains(e.relatedTarget)) close(); };
    button.onfocus = () => open(button);
    button.onblur = () => { if (active === button) close(); };
    button.onclick = () => {
      if (active === button && pinned) close();
      else { open(button); pinned = true; }
    };
  }
  document.addEventListener('pointerdown', e => { if (active && !active.contains(e.target) && !tipFor(active).contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  window.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);
})();
