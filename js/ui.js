(() => {
  const G = window.BeanGame;
  const { COLORS, COLOR_KEYS, LEADERBOARD_KEY, SIZE } = G.constants;
  const { app, refs } = G;

  function updateRunStats() {
    const tag = app.hardLevel ? "超难" : "普通";
    refs.runStats.textContent = `Lv.${app.level}(${tag}) · ${app.score}分`;
  }

  function applyDifficultyUI() {
    refs.appRoot.classList.toggle("hard-mode", app.hardLevel);
    refs.hardBadge.classList.toggle("hidden", !app.hardLevel);
    refs.hardBadge.textContent = app.hardLevel ? "超难警报" : "警报";
  }

  function updateActionButtons() {
    const running = app.phase === "collect" || app.phase === "craft";
    refs.pauseBtn.classList.toggle("hidden", !running);
    refs.restartGameBtn.classList.toggle("hidden", !running);
    refs.pauseBtn.textContent = app.paused ? "继续" : "暂停";
  }

  function showHelp() {
    refs.helpLayer.classList.remove("hidden");
  }

  function hideHelp() {
    refs.helpLayer.classList.add("hidden");
  }

  function updateCraftTimer() {
    refs.timerText.textContent = `倒计时 ${app.craftTime}s`;
    refs.timerText.classList.toggle("warn", app.craftTime <= 8);
  }

  function toast(msg) {
    refs.toast.textContent = msg;
    refs.toast.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => refs.toast.classList.remove("show"), 1800);
  }

  function showCombo(chain, count) {
    if (!refs.comboFx) return;
    clearTimeout(app.comboTimer);
    const labels = {
      2: "顺手两连",
      3: "漂亮三连",
      4: "节奏爆发"
    };
    const title = chain >= 5 ? `${chain}x 连锁` : labels[chain] || `${chain}x 连击`;
    refs.comboFx.innerHTML = `<strong>${title}</strong><span>${count} 颗拼豆同时起飞</span>`;
    refs.comboFx.classList.remove("show");
    void refs.comboFx.offsetWidth;
    refs.comboFx.classList.add("show");
    app.comboTimer = setTimeout(() => refs.comboFx.classList.remove("show"), 900);
  }

  function showCelebration({ bonus, nextLevel, hardLevel }) {
    clearTimeout(app.celebrationTimer);
    refs.celebrationKicker.textContent = hardLevel ? "超难完成" : "关卡完成";
    refs.celebrationTitle.textContent = hardLevel ? "硬核拿下" : "完美出炉";
    refs.celebrationText.textContent = hardLevel
      ? "你把高压关也拼得整整齐齐。"
      : "这一关的拼豆图收得很利落。";
    refs.celebrationScore.textContent = `+${bonus}`;
    refs.celebrationLevel.textContent = `Lv.${nextLevel}`;
    refs.celebrationLayer.classList.remove("hidden");
    refs.celebrationLayer.classList.remove("show");
    void refs.celebrationLayer.offsetWidth;
    refs.celebrationLayer.classList.add("show");
    app.celebrationTimer = setTimeout(() => {
      refs.celebrationLayer.classList.add("hidden");
      refs.celebrationLayer.classList.remove("show");
    }, 1080);
  }

  function showResult({ title, detail, score, levels, badge }) {
    const card = refs.resultLayer.querySelector(".result-card");
    card.classList.remove("fail");
    card.style.animation = "none";
    void card.offsetWidth;
    card.style.animation = "";
    if (badge) refs.resultBadge.textContent = badge;
    refs.resultTitle.textContent = title;
    refs.resultText.textContent = detail;
    refs.resultScore.textContent = `${score}`;
    refs.resultLevels.textContent = `${levels}`;
    refs.resultLayer.classList.remove("hidden");
  }

  function showFailureResult(payload) {
    showResult(payload);
    refs.resultLayer.querySelector(".result-card").classList.add("fail");
  }

  function getLeaderboard() {
    try {
      const raw = localStorage.getItem(LEADERBOARD_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveLeaderboard(list) {
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list.slice(0, 10)));
    } catch (e) {
      if (!app.storageWarned) {
        app.storageWarned = true;
        toast("本地记录保存失败，已继续游戏");
      }
    }
  }

  function renderLeaderboard(currentId = null) {
    const list = getLeaderboard();
    refs.leaderboardList.innerHTML = "";
    if (!list.length) {
      const li = document.createElement("li");
      li.textContent = "暂无记录";
      refs.leaderboardList.appendChild(li);
      return;
    }
    list.slice(0, 8).forEach((it, i) => {
      const li = document.createElement("li");
      if (currentId && it.id === currentId) li.classList.add("current");
      li.textContent = `#${i + 1} ${it.score}分 · 通关${it.levels}关`;
      refs.leaderboardList.appendChild(li);
    });
  }

  function updateBestStats() {
    const list = getLeaderboard();
    const best = list[0] || { score: 0, levels: 0 };
    refs.bestScore.textContent = `${best.score}`;
    refs.bestLevel.textContent = `${best.levels}`;
  }

  function drawMini(gridEl) {
    gridEl.innerHTML = "";
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const cell = document.createElement("div");
        cell.className = "mini-cell" + (app.targetMap[r][c] ? " fill" : "");
        if (app.targetMap[r][c]) cell.style.background = COLORS[app.targetMap[r][c]].hex;
        gridEl.appendChild(cell);
      }
    }
  }

  function drawProgress() {
    refs.progressBoard.innerHTML = "";
    COLOR_KEYS.forEach((k) => {
      const remain = Math.max(app.needed[k] - app.collected[k], 0);
      const el = document.createElement("div");
      el.className = "progress-item";
      el.dataset.color = k;
      el.innerHTML = `<div class="dot" style="background:${COLORS[k].hex}"></div><strong>${remain}</strong><small>${COLORS[k].name}</small>`;
      refs.progressBoard.appendChild(el);
    });
  }

  function drawNeedList() {
    refs.needList.innerHTML = "";
    COLOR_KEYS.forEach((k) => {
      const need = app.needed[k];
      if (!need) return;
      const tag = document.createElement("span");
      tag.className = "need";
      tag.textContent = `${COLORS[k].name} x ${need}`;
      refs.needList.appendChild(tag);
    });
  }

  function renderBoard(onCellTap) {
    const fxMap = app.boardFx || Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    refs.board.innerHTML = "";
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const color = app.board[r][c];
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        if (app.selected && app.selected.r === r && app.selected.c === c) cell.classList.add("selected");
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (color) {
          cell.setAttribute("aria-label", `棋盘第${r + 1}行第${c + 1}列，豆子颜色${COLORS[color].name}`);
        } else {
          cell.setAttribute("aria-label", `棋盘第${r + 1}行第${c + 1}列，空格`);
        }
        cell.onclick = () => onCellTap(r, c, cell);
        if (color) {
          const bean = document.createElement("div");
          bean.className = "bean";
          if (fxMap[r][c] > 0) {
            bean.classList.add("drop");
            bean.style.setProperty("--fall-distance", `${fxMap[r][c]}`);
          }
          bean.style.background = COLORS[color].hex;
          cell.appendChild(bean);
        }
        refs.board.appendChild(cell);
      }
    }
    app.boardFx = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function drawCraft(onCraftCell) {
    refs.craftGrid.innerHTML = "";
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const target = app.targetMap[r][c];
        const placed = app.placed[r][c];
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "craft-cell" + (target ? " target" : "");
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.onclick = () => onCraftCell(r, c, cell);
        const label = target ? `目标格${r + 1}-${c + 1}，需要${COLORS[target].name}` : `空白格${r + 1}-${c + 1}`;
        cell.setAttribute("aria-label", label);
        if (target) cell.style.background = COLORS[target].soft;

        if (placed) {
          const bean = document.createElement("div");
          bean.className = "bean";
          bean.style.background = COLORS[placed].hex;
          cell.appendChild(bean);
        } else if (target) {
          const dot = document.createElement("div");
          dot.className = "outline-dot";
          dot.style.setProperty("--hint-color", COLORS[target].soft);
          cell.appendChild(dot);
        }
        refs.craftGrid.appendChild(cell);
      }
    }
  }

  function drawResources(onPickColor) {
    refs.resourcePanel.innerHTML = "";
    COLOR_KEYS.forEach((k) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "resource-btn" + (app.activeColor === k ? " active" : "");
      btn.disabled = app.resources[k] <= 0;
      btn.onclick = () => onPickColor(k);
      btn.setAttribute("aria-label", `${COLORS[k].name}色豆子，剩余${app.resources[k]}个`);
      btn.innerHTML = `<div class="dot" style="background:${COLORS[k].hex}"></div><strong>${app.resources[k]}</strong><div style="font-size:12px;color:var(--ink-soft)">${COLORS[k].name}</div>`;
      refs.resourcePanel.appendChild(btn);
    });
  }

  G.ui = {
    updateRunStats,
    applyDifficultyUI,
    updateActionButtons,
    showHelp,
    hideHelp,
    updateCraftTimer,
    toast,
    showCombo,
    showCelebration,
    showResult,
    showFailureResult,
    getLeaderboard,
    saveLeaderboard,
    renderLeaderboard,
    updateBestStats,
    drawMini,
    drawProgress,
    drawNeedList,
    renderBoard,
    drawCraft,
    drawResources
  };
})();
