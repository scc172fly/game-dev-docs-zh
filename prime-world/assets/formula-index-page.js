(() => {
  'use strict';

  const names = { scale: '属性标尺', refine: '等级强化', conditional: '条件分支', expression: '表达式', fixed: '固定值' };
  const uses = [
    ['timing', '时长、距离与控制', /冷却|持续|时间|间隔|周期|时长|延迟|施法距离|施放距离|使用距离|范围|半径|控制|眩晕|定身|沉默|减速/],
    ['recovery', '治疗、护盾与资源', /护盾|治疗|回复|恢复|再生|灼烧能量|能量消耗|法力|偷取|吸取|吸血/],
    ['damage', '伤害与命中', /伤害|命中|闪避|暴击|穿透|减伤|承伤|斩杀/],
    ['growth', '属性、强化与成长', /成长|属性|强化|星级|坚韧|意志|力量|灵巧|智力|攻速|战力/],
  ];

  function setupSeriesFilter() {
    const select = document.getElementById('pw-formula-series');
    const status = document.getElementById('pw-formula-series-status');
    if (!select || !status) return;

    const cards = [...document.querySelectorAll('[data-formula-code]')];
    const groups = [...document.querySelectorAll('.pw-formula-use')];

    function update() {
      const series = select.value;
      let shown = 0;
      for (const card of cards) {
        card.hidden = series !== 'all' && !card.dataset.formulaCode.startsWith(series);
        if (!card.hidden) shown += 1;
      }
      for (const group of groups) group.hidden = !group.querySelector('li:not([hidden])');
      status.textContent = series === 'all' ? cards.length + ' 张核验卡' : shown + ' / ' + cards.length + ' 张';
    }

    select.addEventListener('change', update);
    update();
  }

  function start() {
    setupSeriesFilter();
    const query = document.getElementById('pw-formula-query');
    const type = document.getElementById('pw-formula-type');
    const use = document.getElementById('pw-formula-use');
    const list = document.getElementById('pw-formula-list');
    const count = document.getElementById('pw-formula-count');
    const more = document.getElementById('pw-formula-more');
    if (!query || !type || !use || !list || !count || !more) return;

    const data = (window.PW_FORMULA_INDEX || []).map(entry => {
      const [key, label] = uses.find(([, , pattern]) => pattern.test(entry.label)) || ['other', '其他效果参数'];
      return { ...entry, use: key, useLabel: label, searchable: [entry.f, entry.label, entry.hero, label].join(' ').toLowerCase() };
    });
    let filtered = [];
    let visible = 0;

    function make(entry) {
      const article = document.createElement('article');
      article.className = 'pw-formula-entry';
      const header = document.createElement('div');
      header.className = 'pw-formula-entry-header';
      const link = document.createElement('a');
      link.href = entry.url;
      link.textContent = entry.hero + ' · ' + entry.label;
      const meta = document.createElement('small');
      meta.textContent = ['Nival 原版', entry.useLabel, names[entry.type], entry.count + ' 处引用'].join(' · ');
      header.append(link, meta);
      const equation = document.createElement('code');
      equation.textContent = entry.f;
      const result = document.createElement('p');
      result.textContent = entry.result
        ? '该页面已有结果／演算：' + entry.result
        : '结果读取英雄或天赋的状态。打开来源查看成立条件。';
      article.append(header, equation, result);
      return article;
    }

    function draw(reset) {
      if (reset) {
        visible = 0;
        list.replaceChildren();
      }
      const target = Math.min(visible + 48, filtered.length);
      const fragment = document.createDocumentFragment();
      for (let i = visible; i < target; i++) fragment.append(make(filtered[i]));
      list.append(fragment);
      visible = target;
      more.hidden = visible >= filtered.length;
      count.textContent = '匹配 ' + filtered.length.toLocaleString() + ' 条 · 已显示 ' + visible.toLocaleString() + ' 条';
      if (!filtered.length) {
        const empty = document.createElement('p');
        empty.textContent = '没有匹配结果，试试技能名、公式变量或其他筛选条件。';
        list.append(empty);
      }
    }

    function filter() {
      const term = query.value.trim().toLowerCase();
      filtered = data.filter(entry =>
        (type.value === 'all' || entry.type === type.value) &&
        (use.value === 'all' || entry.use === use.value) &&
        entry.searchable.includes(term)
      );
      draw(true);
    }

    query.addEventListener('input', filter);
    type.addEventListener('change', filter);
    use.addEventListener('change', filter);
    more.addEventListener('click', () => draw(false));
    filter();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
