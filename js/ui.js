(() => {
  const G = window.BeanGame;
  const { COLORS, COLOR_KEYS, LEADERBOARD_KEY, HISTORY_KEY, COLLECT_SIZE } = G.constants;
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
    const running = app.phase === "collect" || app.phase === "showcase";
    refs.pauseBtn.classList.toggle("hidden", !running);
    refs.restartGameBtn.classList.toggle("hidden", !running);
    if (refs.shuffleBtn) {
      const canShuffle = app.phase === "collect" && !app.paused && !app.locked;
      refs.shuffleBtn.classList.toggle("hidden", app.phase !== "collect");
      refs.shuffleBtn.disabled = !canShuffle || app.shuffleCharges <= 0;
      refs.shuffleBtn.textContent = app.shuffleCharges > 0 ? `洗牌 ${app.shuffleCharges}` : "洗牌 0";
    }
    refs.pauseBtn.textContent = app.paused ? "继续" : "暂停";
  }

  function showHelp() {
    refs.helpLayer.classList.remove("hidden");
  }

  function hideHelp() {
    refs.helpLayer.classList.add("hidden");
  }

  function updateCraftTimer() {
    refs.timerText.textContent = app.phase === "showcase" ? "展示中" : refs.timerText.textContent;
    refs.timerText.classList.remove("warn");
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
    refs.comboFx.classList.remove("goal");
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

  function showGoalComplete(color) {
    if (!refs.comboFx) return;
    clearTimeout(app.comboTimer);
    refs.comboFx.classList.add("goal");
    refs.comboFx.innerHTML = `<strong>${COLORS[color].name} 豆收齐</strong><span>这一色已经够用了，换下一个目标</span>`;
    refs.comboFx.classList.remove("show");
    void refs.comboFx.offsetWidth;
    refs.comboFx.classList.add("show");
    app.comboTimer = setTimeout(() => {
      refs.comboFx.classList.remove("show");
      refs.comboFx.classList.remove("goal");
    }, 980);
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

  function getGallery() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveGallery(list) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 24)));
    } catch (e) {
      if (!app.storageWarned) {
        app.storageWarned = true;
        toast("本地图鉴保存失败，已继续游戏");
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
    drawPatternGrid(gridEl, app.targetMap, "mini-cell");
  }

  function drawPatternGrid(gridEl, map, baseClass = "mini-cell", attemptMap = null) {
    const size = map.length;
    gridEl.style.setProperty("--grid-size", size);
    gridEl.innerHTML = "";
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const target = map[r][c];
        const attempt = attemptMap?.[r]?.[c] ?? null;
        const cell = document.createElement("div");
        cell.className = baseClass + (target ? " fill" : "");
        if (baseClass === "compare-cell" && target && attempt !== target) cell.classList.add("miss");
        if (attemptMap) {
          if (attempt) cell.style.background = COLORS[attempt].hex;
          else if (target) cell.style.background = COLORS[target].soft;
        } else if (target) {
          cell.style.background = COLORS[target].hex;
        }
        gridEl.appendChild(cell);
      }
    }
  }

  function drawProgress() {
    const remaining = COLOR_KEYS.map((k) => Math.max(app.needed[k] - app.collected[k], 0));
    const focusRemain = Math.max(...remaining, 0);
    refs.progressBoard.innerHTML = "";
    COLOR_KEYS.forEach((k) => {
      const remain = Math.max(app.needed[k] - app.collected[k], 0);
      const el = document.createElement("div");
      el.className = "progress-item";
      if (app.needed[k] > 0 && remain === 0) el.classList.add("done");
      else if (app.needed[k] > 0 && remain === focusRemain && focusRemain > 0) el.classList.add("urgent");
      el.dataset.color = k;
      el.innerHTML = `<div class="dot" style="background:${COLORS[k].hex}"></div><strong>${remain}</strong><small>${COLORS[k].name}目标豆</small>`;
      refs.progressBoard.appendChild(el);
    });
  }

  function drawNeedList() {
    refs.needList.innerHTML = "";
    const hint = document.createElement("span");
    hint.className = "need need-hint";
    hint.textContent = "星标有效；锁链先解锁；冰冻需敲两次";
    refs.needList.appendChild(hint);
    const countRow = document.createElement("div");
    countRow.className = "need-count-row";
    COLOR_KEYS.forEach((k) => {
      const need = app.needed[k];
      if (!need) return;
      const tag = document.createElement("span");
      tag.className = "need";
      tag.textContent = `${COLORS[k].name} x ${need}`;
      countRow.appendChild(tag);
    });
    refs.needList.appendChild(countRow);
  }

  function renderBoard(onCellTap) {
    refs.board.style.setProperty("--grid-size", COLLECT_SIZE);
    const fxMap = app.boardFx || Array.from({ length: COLLECT_SIZE }, () => Array(COLLECT_SIZE).fill(0));
    refs.board.innerHTML = "";
    for (let r = 0; r < COLLECT_SIZE; r += 1) {
      for (let c = 0; c < COLLECT_SIZE; c += 1) {
        const color = app.board[r][c];
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        if (app.selected && app.selected.r === r && app.selected.c === c) cell.classList.add("selected");
        if (
          app.hintMove &&
          ((app.hintMove.a.r === r && app.hintMove.a.c === c) || (app.hintMove.b.r === r && app.hintMove.b.c === c))
        ) {
          cell.classList.add("hinted");
        }
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (color) {
          cell.setAttribute("aria-label", `棋盘第${r + 1}行第${c + 1}列，豆子颜色${COLORS[color].name}`);
        } else {
          cell.setAttribute("aria-label", `棋盘第${r + 1}行第${c + 1}列，空格`);
        }
        if (color) {
          const bean = document.createElement("div");
          bean.className = "bean";
          const special = app.specials?.[r]?.[c];
          const isTarget = app.collectTargets?.[r]?.[c];
          const targetState = app.collectTargetStates?.[r]?.[c];
          if (special) {
            bean.classList.add("special");
            bean.dataset.special = special;
          }
          if (isTarget) bean.classList.add("target-bean");
          if (targetState) bean.dataset.targetState = targetState;
          if (fxMap[r][c] > 0) {
            bean.classList.add("drop");
            bean.style.setProperty("--fall-distance", `${fxMap[r][c]}`);
            bean.style.setProperty("--fall-delay", `${c * 18}ms`);
          }
          bean.style.background = COLORS[color].hex;
          if (isTarget) {
            const marker = document.createElement("span");
            marker.className = "target-marker";
            marker.textContent = "★";
            bean.appendChild(marker);
          }
          if (targetState) {
            const badge = document.createElement("span");
            badge.className = `target-state-badge target-state-${targetState}`;
            badge.textContent = targetState === "lock" ? "锁" : targetState === "ice" ? "冰" : "裂";
            bean.appendChild(badge);
          }
          cell.appendChild(bean);
        }
        refs.board.appendChild(cell);
      }
    }
    app.boardFx = Array.from({ length: COLLECT_SIZE }, () => Array(COLLECT_SIZE).fill(0));
  }

  function drawCraft() {
    const size = app.targetMap.length;
    let filledSlots = 0;
    let totalSlots = 0;
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const target = app.targetMap[r][c];
        if (!target) continue;
        totalSlots += 1;
        if (app.placed[r][c] === target) filledSlots += 1;
      }
    }
    const ratio = totalSlots ? filledSlots / totalSlots : 1;
    const stageLabel = app.showcaseStage === "polish" ? "细节收尾" : app.showcaseStage === "finish" ? "最终定格" : "自动组装";
    refs.craftPreviewText.textContent = `${stageLabel}：${filledSlots}/${totalSlots} 块 · 画布 ${size}x${size}`;
    refs.craftPreviewHint.textContent =
      app.showcaseStage === "finish"
        ? "图案已经完整还原，准备进入结算。"
        : ratio > 0.85
          ? "只剩最后一小段，正在修整轮廓和细节。"
          : "收集到的豆子会自动铺成图案，这一段是通关奖励展示。";
    refs.craftGrid.style.setProperty("--grid-size", size);
    refs.craftGrid.dataset.gridSize = String(size);
    refs.craftGrid.classList.toggle("revealing", app.showcaseStage === "assemble");
    refs.craftGrid.classList.toggle("polishing", app.showcaseStage === "polish");
    refs.craftGrid.classList.toggle("finished", app.showcaseStage === "finish");
    const recentSet = new Set(app.showcaseRecent || []);
    refs.craftGrid.innerHTML = "";
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const target = app.targetMap[r][c];
        const placed = app.placed[r][c];
        const cell = document.createElement("div");
        cell.className = "craft-cell" + (target ? " target" : "");
        if (target) cell.style.background = COLORS[target].soft;

        if (placed) {
          const bean = document.createElement("div");
          bean.className = "bean";
          if (recentSet.has(`${r},${c}`)) bean.classList.add("showcase-recent");
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

  function drawResources() {
    const total = app.targetMap.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
    const stageText = app.showcaseStage === "polish" ? "细节收尾" : app.showcaseStage === "finish" ? "完成定格" : "自动组装";
    refs.resourcePanel.innerHTML = `
      <div class="resource-btn active" aria-label="自动拼豆信息">
        <div class="dot" style="background:var(--gold)"></div>
        <strong>${app.craftSize}x${app.craftSize}</strong>
        <div style="font-size:12px;color:var(--ink-soft)">拼豆分辨率</div>
      </div>
      <div class="resource-btn active" aria-label="自动拼豆进度">
        <div class="dot" style="background:var(--celebrate)"></div>
        <strong>${app.showcaseIndex}</strong>
        <div style="font-size:12px;color:var(--ink-soft)">当前已还原</div>
      </div>
      <div class="resource-btn active" aria-label="展示阶段">
        <div class="dot" style="background:var(--blue)"></div>
        <strong>${stageText}</strong>
        <div style="font-size:12px;color:var(--ink-soft)">像素 ${total}</div>
      </div>
    `;
  }

  function renderGallery() {
    const list = getGallery();
    refs.historyList.innerHTML = "";
    refs.historyList.classList.toggle("empty", !list.length);
    if (!list.length) {
      refs.historyList.textContent = "还没有收录图案，先去通关一局吧。";
      return;
    }
    list.forEach((item) => {
      const card = document.createElement("div");
      card.className = "history-card";
      const grid = document.createElement("div");
      grid.className = "mini-grid";
      drawPatternGrid(grid, item.previewMap || item.map, "mini-cell");
      const meta = document.createElement("div");
      meta.className = "history-meta";
      meta.innerHTML = `<strong>${item.name}</strong><span>Lv.${item.level} · ${item.size}x${item.size}</span><span>${item.date}</span>`;
      card.appendChild(grid);
      card.appendChild(meta);
      refs.historyList.appendChild(card);
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
    showGoalComplete,
    showCelebration,
    showResult,
    showFailureResult,
    getLeaderboard,
    saveLeaderboard,
    getGallery,
    saveGallery,
    renderLeaderboard,
    renderGallery,
    updateBestStats,
    drawMini,
    drawPatternGrid,
    drawProgress,
    drawNeedList,
    renderBoard,
    drawCraft,
    drawResources
  };
})();
