(() => {
  const G = window.BeanGame;
  const { app, refs } = G;
  const { COLOR_KEYS, COLORS } = G.constants;
  const { generateTargetMap, initNeeded, levelStepLimit, levelCraftTime, isHardLevel } = G.utils;
  const { swap, findMatches, hasAnyMove, createBoard, collapse, isCollectDone, isCraftDone } = G.engine;
  const {
    updateRunStats,
    applyDifficultyUI,
    updateActionButtons,
    showHelp,
    hideHelp,
    updateCraftTimer,
    toast,
    showCombo,
    showCelebration,
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
  } = G.ui;
  const { ensureAudio, sfxMatch, sfxCombo, sfxPlace, sfxFail, sfxSuccess, sfxHardAlert, startBgm, stopBgm, refreshBgm, updateSoundButton } =
    G.audioApi;
  const audio = G.audio;

  function addScore(delta) {
    app.score += delta;
    updateRunStats();
  }

  function startCraftTimer() {
    clearInterval(app.craftTimer);
    app.craftTimer = setInterval(() => {
      app.craftTime -= 1;
      updateCraftTimer();
      if (app.craftTime <= 0) {
        clearInterval(app.craftTimer);
        endRun("时间到，拼搭失败");
      }
    }, 1000);
  }

  function pauseGame() {
    if (app.paused || (app.phase !== "collect" && app.phase !== "craft")) return;
    app.paused = true;
    if (app.phase === "craft") clearInterval(app.craftTimer);
    app.locked = true;
    refs.pauseText.textContent =
      app.phase === "craft" ? `当前是拼搭阶段，还剩 ${app.craftTime} 秒。` : `当前是收集阶段，还剩 ${app.steps} 步。`;
    refs.pauseLayer.classList.remove("hidden");
    updateActionButtons();
  }

  function resumeGame() {
    if (!app.paused) return;
    app.paused = false;
    refs.pauseLayer.classList.add("hidden");
    app.locked = false;
    if (app.phase === "craft") startCraftTimer();
    updateActionButtons();
  }

  async function shareGame(extra = "") {
    const base = extra || `我在拼豆猫闯到第${app.clearedLevels}关，拿到${app.score}分，快来挑战。`;
    const text = `${base}`;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "拼豆猫", text, url });
        return;
      }
    } catch (e) {}
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast("分享文案已复制");
    } catch (e) {
      toast("当前环境不支持分享");
    }
  }

  function checkCollectFail() {
    if (app.steps <= 0) {
      endRun("步数已耗尽，收集失败");
      return;
    }
    if (!hasAnyMove(app.board)) {
      endRun("棋盘无可消除组合，本局结束");
    }
  }

  function onPickColor(color) {
    app.activeColor = color;
    drawResources(onPickColor);
  }

  function enterCraft() {
    app.phase = "craft";
    app.paused = false;
    app.resources = { ...app.collected };
    app.activeColor = COLOR_KEYS.find((k) => app.resources[k] > 0) || "red";
    refs.collectPhase.classList.add("phase-hidden");
    refs.craftPhase.classList.remove("phase-hidden");
    refs.phaseLabel.textContent = `第${app.level}关${app.hardLevel ? " · 超难" : ""} · 拼搭图案`;
    app.craftTime = levelCraftTime(app.level);
    updateCraftTimer();
    drawCraft(onCraftCell);
    drawResources(onPickColor);
    toast(`进入拼搭阶段，${app.craftTime} 秒内完成`);
    startCraftTimer();
    updateActionButtons();
  }

  function markMatches(matchCells, chain) {
    matchCells.forEach(({ r, c }) => {
      const cell = refs.board.querySelector(`[data-r="${r}"][data-c="${c}"]`);
      if (!cell) return;
      cell.classList.add("matching");
      if (chain > 1) cell.classList.add(`cascade-${Math.min(chain, 4)}`);
      const bean = cell.querySelector(".bean");
      if (bean) {
        const rect = bean.getBoundingClientRect();
        const ring = document.createElement("div");
        ring.className = "burst-ring";
        ring.style.left = `${rect.left + rect.width / 2 - 11}px`;
        ring.style.top = `${rect.top + rect.height / 2 - 11}px`;
        ring.style.borderColor = COLORS[app.board[r][c]].hex;
        document.body.appendChild(ring);
        setTimeout(() => ring.remove(), 540);
      }
    });
  }

  async function animateCollect(matchCells, chain) {
    const tasks = [];
    matchCells.forEach(({ r, c }) => {
      const color = app.board[r][c];
      app.collected[color] += 1;
      addScore(10 + (chain - 1) * 4);
      const source = refs.board.querySelector(`[data-r="${r}"][data-c="${c}"] .bean`);
      const target = refs.progressBoard.querySelector(`.progress-item[data-color="${color}"] .dot`);
      if (!source || !target) return;
      const s = source.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      const fly = document.createElement("div");
      fly.className = "bean";
      fly.style.background = COLORS[color].hex;
      fly.style.width = "20px";
      fly.style.height = "20px";
      fly.style.position = "fixed";
      fly.style.left = s.left + s.width / 2 - 10 + "px";
      fly.style.top = s.top + s.height / 2 - 10 + "px";
      fly.style.zIndex = 50;
      fly.style.transition = "transform 0.58s cubic-bezier(.2,.8,.2,1), opacity 0.58s";
      document.body.appendChild(fly);
      requestAnimationFrame(() => {
        fly.style.transform = `translate(${t.left - s.left}px, ${t.top - s.top}px) scale(0.35)`;
        fly.style.opacity = "0.16";
      });
      tasks.push(
        new Promise((resolve) => {
          setTimeout(() => {
            fly.remove();
            resolve();
          }, 620);
        })
      );
    });
    return Promise.all(tasks);
  }

  async function resolveBoard(initialMatches) {
    let matches = initialMatches;
    let chain = 1;
    while (matches.length) {
      renderBoard(onCellTap);
      markMatches(matches, chain);
      await new Promise((resolve) => setTimeout(resolve, 180));
      sfxMatch(matches.length);
      if (chain > 1) {
        sfxCombo(chain);
        showCombo(chain, matches.length);
      }
      await animateCollect(matches, chain);
      matches.forEach(({ r, c }) => {
        app.board[r][c] = null;
      });
      collapse(app.board);
      drawProgress();
      renderBoard(onCellTap);
      await new Promise((resolve) => setTimeout(resolve, 220));
      matches = findMatches(app.board);
      chain += 1;
    }
    app.comboChain = 0;
    app.locked = false;

    if (isCollectDone(app)) {
      enterCraft();
      return;
    }
    checkCollectFail();
  }

  function onCellTap(r, c) {
    if (app.phase !== "collect" || app.locked || app.paused) return;
    if (!app.selected) {
      app.selected = { r, c };
      renderBoard(onCellTap);
      return;
    }
    if (app.selected.r === r && app.selected.c === c) {
      app.selected = null;
      renderBoard(onCellTap);
      return;
    }
    const near = Math.abs(app.selected.r - r) + Math.abs(app.selected.c - c) === 1;
    if (!near) {
      app.selected = { r, c };
      renderBoard(onCellTap);
      return;
    }
    app.locked = true;
    swap(app.board, app.selected, { r, c });
    app.steps -= 1;
    refs.stepText.textContent = app.steps;
    refs.timerText.textContent = `步数 ${app.steps}`;
    const matches = findMatches(app.board);
    if (!matches.length) {
      swap(app.board, app.selected, { r, c });
      app.selected = null;
      app.locked = false;
      toast("没有形成消除");
      renderBoard(onCellTap);
      checkCollectFail();
      return;
    }
    app.selected = null;
    resolveBoard(matches);
  }

  function onCraftCell(r, c, cellEl) {
    if (app.phase !== "craft" || app.paused || app.locked) return;
    const target = app.targetMap[r][c];
    const placed = app.placed[r][c];

    if (placed) {
      app.placed[r][c] = null;
      app.resources[placed] += 1;
      drawCraft(onCraftCell);
      drawResources(onPickColor);
      return;
    }

    if (!target) {
      toast("这里不需要放豆子");
      return;
    }

    if (!app.activeColor || app.resources[app.activeColor] <= 0) {
      toast("该颜色豆子不足");
      return;
    }

    if (app.activeColor !== target) {
      cellEl.classList.add("wrong");
      setTimeout(() => cellEl.classList.remove("wrong"), 220);
      toast("颜色不匹配");
      return;
    }

    app.placed[r][c] = app.activeColor;
    app.resources[app.activeColor] -= 1;
    sfxPlace();
    drawCraft(onCraftCell);
    drawResources(onPickColor);

    if (isCraftDone(app)) {
      app.locked = true;
      clearInterval(app.craftTimer);
      refs.ironSweep.classList.add("play");
      setTimeout(() => {
        refs.ironSweep.classList.remove("play");
        completeLevel();
      }, 900);
    }
  }

  function completeLevel() {
    const bonus = 180 + app.level * 45 + app.steps * 15 + app.craftTime * 12;
    addScore(bonus);
    app.clearedLevels += 1;
    sfxSuccess();
    toast(`第${app.clearedLevels}关通关 +${bonus}分`);
    showCelebration({
      bonus,
      nextLevel: app.level + 1,
      hardLevel: app.hardLevel
    });
    app.level += 1;
    app.phase = "transition";
    clearTimeout(app.levelTransitionTimer);
    app.levelTransitionTimer = setTimeout(() => {
      if (app.phase === "transition") startLevel(false);
    }, 1180);
  }

  function endRun(detail) {
    app.phase = "done";
    app.paused = false;
    app.locked = false;
    clearInterval(app.craftTimer);
    clearTimeout(app.levelTransitionTimer);
    clearTimeout(app.introOverlayTimer);
    clearTimeout(app.celebrationTimer);
    clearTimeout(app.comboTimer);
    sfxFail();
    const record = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      score: app.score,
      levels: app.clearedLevels
    };
    const list = getLeaderboard();
    list.push(record);
    list.sort((a, b) => b.score - a.score || b.levels - a.levels);
    saveLeaderboard(list);
    showFailureResult({
      badge: app.clearedLevels > 0 ? "挑战中断" : "首次尝试",
      title: app.clearedLevels > 0 ? "差一点就更远了" : "先热热身",
      detail: `${detail}。本次通关 ${app.clearedLevels} 关，总分 ${app.score} 分。`,
      score: app.score,
      levels: app.clearedLevels
    });
    renderLeaderboard(record.id);
    updateBestStats();
    refs.pauseLayer.classList.add("hidden");
    updateActionButtons();
  }

  function startLevel(showIntro) {
    app.phase = "collect";
    app.paused = false;
    clearTimeout(app.levelTransitionTimer);
    clearTimeout(app.introOverlayTimer);
    clearTimeout(app.celebrationTimer);
    clearTimeout(app.comboTimer);
    app.hardLevel = isHardLevel(app.level);
    applyDifficultyUI();
    app.steps = levelStepLimit(app.level);
    app.selected = null;
    const generated = generateTargetMap(app.level);
    app.targetMap = generated.map;
    app.currentAnimal = generated.animalName;
    app.needed = initNeeded(app.targetMap);
    app.collected = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
    app.resources = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
    app.placed = Array.from({ length: G.constants.SIZE }, () => Array(G.constants.SIZE).fill(null));
    app.activeColor = null;
    app.locked = false;
    refs.phaseLabel.textContent = `第${app.level}关${app.hardLevel ? " · 超难" : ""} · 收集豆子`;
    refs.timerText.classList.remove("warn");
    refs.timerText.textContent = `步数 ${app.steps}`;
    refs.stepText.textContent = app.steps;
    refs.resultLayer.classList.add("hidden");
    refs.celebrationLayer.classList.add("hidden");
    refs.celebrationLayer.classList.remove("show");
    refs.pauseLayer.classList.add("hidden");
    refs.helpLayer.classList.add("hidden");
    refs.collectPhase.classList.remove("phase-hidden");
    refs.craftPhase.classList.add("phase-hidden");
    updateRunStats();

    app.board = createBoard();
    drawMini(refs.miniTarget);
    drawMini(refs.overlayMini);
    drawNeedList();
    drawProgress();
    renderBoard(onCellTap);
    refs.introTitle.textContent = `${app.currentAnimal}拼豆图`;
    refs.introDesc.textContent = `${app.hardLevel ? "超难关" : "普通关"}：先收集再拼搭，拼豆时间 ${levelCraftTime(app.level)} 秒`;
    if (app.hardLevel) sfxHardAlert();
    refreshBgm();

    const introMs = showIntro ? 3000 : 1400;
    refs.introOverlay.classList.remove("hidden");
    app.introOverlayTimer = setTimeout(() => {
      refs.introOverlay.classList.add("hidden");
    }, introMs);
    updateActionButtons();
  }

  function resetGame() {
    clearInterval(app.craftTimer);
    app.paused = false;
    app.comboChain = 0;
    clearTimeout(app.comboTimer);
    app.level = 1;
    app.clearedLevels = 0;
    app.score = 0;
    app.lastAnimal = "";
    app.animalQueue = [];
    startLevel(true);
  }

  function showStartMenu() {
    app.phase = "idle";
    app.paused = false;
    app.hardLevel = false;
    clearInterval(app.craftTimer);
    clearTimeout(app.levelTransitionTimer);
    clearTimeout(app.introOverlayTimer);
    clearTimeout(app.celebrationTimer);
    clearTimeout(app.comboTimer);
    applyDifficultyUI();
    refs.startLayer.classList.remove("hidden");
    refs.introOverlay.classList.add("hidden");
    refs.resultLayer.classList.add("hidden");
    refs.celebrationLayer.classList.add("hidden");
    refs.pauseLayer.classList.add("hidden");
    refs.helpLayer.classList.add("hidden");
    renderLeaderboard();
    updateBestStats();
    updateActionButtons();
  }

  refs.restartBtn.onclick = resetGame;
  refs.restartBtn.type = "button";
  refs.startGameBtn.onclick = () => {
    refs.startLayer.classList.add("hidden");
    resetGame();
  };
  refs.helpMenuBtn.onclick = showHelp;
  refs.helpBtn.onclick = showHelp;
  refs.closeHelpBtn.onclick = hideHelp;
  refs.pauseBtn.onclick = () => {
    if (app.paused) resumeGame();
    else pauseGame();
  };
  refs.restartGameBtn.onclick = resetGame;
  refs.resumeBtn.onclick = resumeGame;
  refs.pauseRestartBtn.onclick = resetGame;
  refs.shareGameBtn.onclick = () => shareGame("我在玩拼豆猫，来一起拼小动物吧。");
  refs.soundBtn.onclick = () => {
    ensureAudio();
    audio.enabled = !audio.enabled;
    if (audio.enabled) startBgm();
    else stopBgm();
    updateSoundButton();
  };
  refs.shareBtn.onclick = () => shareGame();
  document.addEventListener(
    "pointerdown",
    () => {
      ensureAudio();
      if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
    },
    { once: true }
  );

  updateSoundButton();
  showStartMenu();
})();
