(() => {
  const simulator = document.getElementById('talent-simulator');
  if (!simulator) return;

  const number = new Intl.NumberFormat('zh-CN');
  const boards = [...document.querySelectorAll('.talent-board')].map(board =>
    [...board.querySelectorAll('.talent-slot')].map((slot, index) => slot.dataset.simCost === undefined ? null : {
      index,
      tier: Math.floor(index / 6),
      name: slot.querySelector('img + span, .icon-placeholder + span')?.textContent || slot.querySelector('span')?.textContent,
      icon: slot.querySelector('img'),
      href: slot.getAttribute('href'),
      tooltip: slot.dataset.pwTooltip || slot.getAttribute('href'),
      cost: Number(slot.dataset.simCost),
      points: Number(slot.dataset.simPoints),
      signature: slot.dataset.simClass === 'true',
      auto: slot.classList.contains('start') && Number(slot.dataset.simCost) === 0,
    })
  );
  if (boards.length !== 2 || boards.some(board => board.length !== 36)) return;

  const get = selector => simulator.querySelector(selector);
  const boardSelect = get('#hero-sim-board');
  const budgetInput = get('#hero-sim-budget');
  const grid = get('.hero-sim-grid');
  const notice = get('.hero-sim-notice');
  const detail = get('.hero-sim-detail');
  const undo = get('#hero-sim-undo');
  const reset = get('#hero-sim-reset');
  const share = get('#hero-sim-share');
  const shareField = get('#hero-sim-link');
  const routeSelect = get('#hero-sim-route');
  const routeList = get('.hero-sim-route-list');
  const states = boards.map(() => ({ budget: 400, order: [] }));
  let selected = 0;
  let tiles = [];

  function metrics(board, state) {
    const learned = new Set(state.order);
    let spent = 0;
    let points = 0;
    for (const talent of board) {
      if (!talent) continue;
      if (talent.auto) learned.add(talent.index);
      if (learned.has(talent.index)) {
        spent += talent.cost;
        points += talent.points;
      }
    }
    return { learned, spent, points, balance: state.budget - spent };
  }

  function restriction(talent, current) {
    if (current.learned.has(talent.index)) return talent.auto ? '开局自动取得' : '已点亮';
    if (current.points < talent.tier * 4) return `需要 ${talent.tier * 4} 成长点`;
    if (current.balance < talent.cost) return `还差 ${number.format(talent.cost - current.balance)} Prime`;
    return '';
  }

  function cheapestUnlock(candidates, needed) {
    const plans = [{ cost: 0, picks: [] }];
    for (const talent of candidates) {
      if (!talent.points) continue;
      for (let have = needed - 1; have >= 0; have--) {
        if (!plans[have]) continue;
        const next = Math.min(needed, have + talent.points);
        const cost = plans[have].cost + talent.cost;
        if (!plans[next] || cost < plans[next].cost) {
          plans[next] = { cost, picks: [...plans[have].picks, talent] };
        }
      }
    }
    return plans[needed]?.picks[0];
  }

  function showRoute() {
    const board = boards[selected];
    const future = { ...states[selected], order: [...states[selected].order] };
    const initial = metrics(board, future);
    routeList.replaceChildren();
    for (let step = 0; step < 6; step++) {
      const current = metrics(board, future);
      const tier = Math.min(5, Math.floor(current.points / 4));
      const candidates = board.filter(t => t && t.tier <= tier && !current.learned.has(t.index));
      if (!candidates.length) break;
      candidates.sort((a, b) => a.cost - b.cost || a.index - b.index);
      const talent = (routeSelect.value === 'signature' && candidates.find(t => t.signature))
        || (tier < 5 && cheapestUnlock(candidates, (tier + 1) * 4 - current.points))
        || candidates[0];
      future.order.push(talent.index);
      const item = document.createElement('li');
      const cost = metrics(board, future).spent - initial.spent;
      const shortfall = Math.max(0, cost - initial.balance);
      item.textContent = `${talent.name} · ${number.format(talent.cost)} Prime · +${talent.points} 成长点`;
      if (shortfall) item.append(`（累计还差 ${number.format(shortfall)} Prime）`);
      if (step === 0 && !shortfall) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button quiet';
        button.textContent = '点亮这一步';
        button.addEventListener('click', () => selectTalent(talent));
        item.append(' ', button);
      }
      routeList.append(item);
    }
    if (!routeList.children.length) {
      const item = document.createElement('li');
      item.textContent = '当前没有可推荐的下一步。';
      routeList.append(item);
    }
  }

  function update() {
    const current = metrics(boards[selected], states[selected]);
    get('#hero-sim-balance').textContent = number.format(current.balance);
    get('#hero-sim-spent').textContent = number.format(current.spent);
    get('#hero-sim-points').textContent = number.format(current.points);
    get('#hero-sim-tier').textContent = Math.min(6, Math.floor(current.points / 4) + 1);
    for (const { button, talent } of tiles) {
      if (!talent) continue;
      const blocked = restriction(talent, current);
      const learned = current.learned.has(talent.index);
      button.dataset.state = talent.auto ? 'auto' : learned ? 'learned' : blocked ? 'locked' : 'ready';
      button.setAttribute('aria-pressed', String(learned));
      button.setAttribute('aria-disabled', String(Boolean(blocked)));
      button.setAttribute('aria-label', `${talent.name}，第 ${talent.tier + 1} 层，${number.format(talent.cost)} Prime${blocked ? '，' + blocked : ''}`);
      button.title = button.getAttribute('aria-label');
    }
    undo.disabled = reset.disabled = states[selected].order.length === 0;
    shareField.hidden = true;
    showRoute();
  }

  function selectTalent(talent) {
    const state = states[selected];
    const blocked = restriction(talent, metrics(boards[selected], state));
    const link = document.createElement('a');
    link.href = talent.href;
    link.textContent = `查看 ${talent.name} 的技能详情`;
    detail.replaceChildren(link);
    if (blocked) {
      notice.textContent = `${talent.name} · ${blocked}`;
      return;
    }
    state.order.push(talent.index);
    notice.textContent = `已点亮 ${talent.name}`;
    update();
  }

  function render() {
    const board = boards[selected];
    grid.replaceChildren();
    tiles = [];
    for (let tier = 0; tier < 6; tier++) {
      const label = document.createElement('span');
      label.className = 'hero-sim-layer';
      label.textContent = `${tier + 1} 层`;
      label.title = `需要 ${tier * 4} 成长点`;
      grid.append(label);
      for (const talent of board.slice(tier * 6, tier * 6 + 6)) {
        if (!talent) {
          const empty = document.createElement('span');
          empty.className = 'hero-sim-empty';
          empty.setAttribute('aria-label', '原版空格');
          grid.append(empty);
          continue;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hero-sim-slot';
        button.dataset.pwTooltip = talent.tooltip;
        if (talent.icon) button.append(talent.icon.cloneNode(true));
        else button.textContent = '✦';
        button.addEventListener('click', () => selectTalent(talent));
        tiles.push({ button, talent });
        grid.append(button);
      }
    }
    budgetInput.value = states[selected].budget;
    detail.replaceChildren();
    update();
  }

  function restore(hash) {
    const match = /^#build=1:([01]):(\d{1,9}):([0-9a-z]{0,36})$/.exec(hash);
    if (!match) return false;
    const index = Number(match[1]);
    const board = boards[index];
    const state = { budget: Number(match[2]), order: [] };
    for (const digit of match[3]) {
      const talent = board[parseInt(digit, 36)];
      if (!talent || restriction(talent, metrics(board, state))) return false;
      state.order.push(talent.index);
    }
    selected = index;
    states[index] = state;
    boardSelect.value = String(selected);
    return true;
  }

  boardSelect.addEventListener('change', () => {
    selected = Number(boardSelect.value);
    notice.textContent = '';
    render();
  });
  routeSelect.addEventListener('change', showRoute);
  budgetInput.addEventListener('change', () => {
    const state = states[selected];
    const budget = budgetInput.valueAsNumber;
    const { spent } = metrics(boards[selected], state);
    if (!budgetInput.validity.valid || !Number.isSafeInteger(budget) || budget < spent) {
      budgetInput.value = state.budget;
      notice.textContent = `总 Prime 需为整数，且不能低于已消耗的 ${number.format(spent)}。`;
      return;
    }
    state.budget = budget;
    notice.textContent = '';
    update();
  });
  undo.addEventListener('click', () => {
    const index = states[selected].order.pop();
    if (index === undefined) return;
    notice.textContent = `已撤销 ${boards[selected][index].name}`;
    update();
  });
  reset.addEventListener('click', () => {
    states[selected].order = [];
    notice.textContent = '已重置当前天赋盘的手动点亮记录。';
    update();
  });
  share.addEventListener('click', async () => {
    const state = states[selected];
    const url = new URL(location.href);
    url.hash = `build=1:${selected}:${state.budget}:${state.order.map(index => index.toString(36)).join('')}`;
    shareField.hidden = false;
    shareField.value = url.href;
    shareField.focus();
    shareField.select();
    try {
      await navigator.clipboard.writeText(url.href);
      notice.textContent = '配装链接已复制。';
    } catch {
      notice.textContent = '链接已选中，可手动复制。';
    }
  });

  simulator.addEventListener('toggle', () => {
    if (simulator.open && !tiles.length) render();
  });
  function openSharedBuild() {
    if (location.hash === '#talent-simulator') {
      simulator.open = true;
      if (!tiles.length) render();
      return;
    }
    if (!location.hash.startsWith('#build=')) return;
    const valid = restore(location.hash);
    simulator.open = true;
    render();
    notice.textContent = valid ? '已载入分享的配装。' : '配装链接无效，未应用点亮记录。';
    requestAnimationFrame(() => simulator.scrollIntoView({ block: 'start' }));
  }
  window.addEventListener('hashchange', openSharedBuild);
  openSharedBuild();
})();
