(() => {
  const G = window.BeanGame;
  const { app, refs } = G;
  const { COLOR_KEYS, COLORS, COLLECT_SIZE } = G.constants;
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
    showGoalComplete,
    showCelebration,
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
  } = G.ui;
  const { ensureAudio, sfxMatch, sfxCombo, sfxPlace, sfxFail, sfxSuccess, sfxHardAlert, sfxPhaseShift, startBgm, stopBgm, refreshBgm, updateSoundButton } =
    G.audioApi;
  const audio = G.audio;

  function addScore(delta) {
    app.score += delta;
    updateRunStats();
  }

  function createCollectGrid(fill = null) {
    return Array.from({ length: COLLECT_SIZE }, () => Array(COLLECT_SIZE).fill(fill));
  }

  function shuffleList(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function remainingNeed(color) {
    return Math.max((app.needed[color] || 0) - (app.collected[color] || 0), 0);
  }

  function pickTargetState() {
    const roll = Math.random();
    if (app.level >= 5 && roll < Math.min(0.14, 0.06 + app.level * 0.01)) return "ice";
    if (app.level >= 2 && roll < Math.min(0.34, 0.16 + app.level * 0.015)) return "lock";
    return null;
  }

  function refreshCollectTargets() {
    const nextTargets = createCollectGrid(false);
    const nextStates = createCollectGrid(null);
    const positionsByColor = Object.fromEntries(COLOR_KEYS.map((key) => [key, []]));
    const currentCount = Object.fromEntries(COLOR_KEYS.map((key) => [key, 0]));
    for (let r = 0; r < COLLECT_SIZE; r += 1) {
      for (let c = 0; c < COLLECT_SIZE; c += 1) {
        const color = app.board[r][c];
        if (!color || !remainingNeed(color)) continue;
        positionsByColor[color].push({ r, c });
        if (app.collectTargets?.[r]?.[c]) {
          nextTargets[r][c] = true;
          nextStates[r][c] = app.collectTargetStates?.[r]?.[c] || null;
          currentCount[color] += 1;
        }
      }
    }

    const activeColors = COLOR_KEYS.filter((color) => remainingNeed(color) > 0);
    activeColors.forEach((color) => {
      positionsByColor[color] = shuffleList(positionsByColor[color]);
      const remain = remainingNeed(color);
      const desiredCount = Math.min(
        positionsByColor[color].length,
        Math.max(1, Math.min(remain, 2 + Math.floor(app.level / 3)))
      );
      for (let i = currentCount[color]; i < desiredCount; i += 1) {
        const pos = positionsByColor[color].find(({ r, c }) => !nextTargets[r][c]);
        if (!pos) break;
        nextTargets[pos.r][pos.c] = true;
        nextStates[pos.r][pos.c] = pickTargetState();
        currentCount[color] += 1;
      }
    });

    let totalMarked = nextTargets.flat().filter(Boolean).length;
    const desiredTotal = Math.min(18, Math.max(8, 10 + Math.floor(app.level / 2)));
    const colorCycle = shuffleList(
      activeColors.slice().sort((a, b) => remainingNeed(b) - remainingNeed(a))
    );
    let cursor = 0;
    let safety = 0;
    while (totalMarked < desiredTotal && colorCycle.length && safety < 280) {
      const color = colorCycle[cursor % colorCycle.length];
      cursor += 1;
      safety += 1;
      const pos = positionsByColor[color].find(({ r, c }) => !nextTargets[r][c]);
      if (!pos) continue;
      nextTargets[pos.r][pos.c] = true;
      nextStates[pos.r][pos.c] = pickTargetState();
      totalMarked += 1;
    }

    app.collectTargets = nextTargets;
    app.collectTargetStates = nextStates;
  }

  function buildShuffledBoardState() {
    const entries = [];
    for (let r = 0; r < COLLECT_SIZE; r += 1) {
      for (let c = 0; c < COLLECT_SIZE; c += 1) {
        entries.push({
          color: app.board[r][c],
          special: app.specials[r][c],
          target: app.collectTargets[r][c],
          targetState: app.collectTargetStates[r][c]
        });
      }
    }

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const shuffled = shuffleList(entries);
      const board = createCollectGrid(null);
      const specials = createCollectGrid(null);
      const targets = createCollectGrid(false);
      const targetStates = createCollectGrid(null);
      shuffled.forEach((entry, index) => {
        const r = Math.floor(index / COLLECT_SIZE);
        const c = index % COLLECT_SIZE;
        board[r][c] = entry.color;
        specials[r][c] = entry.special;
        targets[r][c] = entry.target;
        targetStates[r][c] = entry.targetState;
      });
      if (!findMatches(board).length && hasAnyMove(board)) return { board, specials, targets, targetStates };
    }

    return {
      board: createBoard(),
      specials: createCollectGrid(null),
      targets: createCollectGrid(false),
      targetStates: createCollectGrid(null)
    };
  }

  function cloneGrid(grid) {
    return grid.map((row) => [...row]);
  }

  function swapSpecials(a, b) {
    const t = app.specials[a.r][a.c];
    app.specials[a.r][a.c] = app.specials[b.r][b.c];
    app.specials[b.r][b.c] = t;
  }

  function swapTargets(a, b) {
    const target = app.collectTargets[a.r][a.c];
    app.collectTargets[a.r][a.c] = app.collectTargets[b.r][b.c];
    app.collectTargets[b.r][b.c] = target;
    const state = app.collectTargetStates[a.r][a.c];
    app.collectTargetStates[a.r][a.c] = app.collectTargetStates[b.r][b.c];
    app.collectTargetStates[b.r][b.c] = state;
  }

  function scoreMoveTargets(matches, targets, targetStates) {
    let score = 0;
    matches.forEach(({ r, c }) => {
      if (!targets[r][c]) return;
      const state = targetStates[r][c];
      if (state === "lock") score += 6;
      else if (state === "ice") score += 5;
      else if (state === "cracked") score += 8;
      else score += 10;
    });
    return score;
  }

  function findSuggestedMove() {
    let best = null;
    for (let r = 0; r < COLLECT_SIZE; r += 1) {
      for (let c = 0; c < COLLECT_SIZE; c += 1) {
        const neighbors = [
          { r, c: c + 1 },
          { r: r + 1, c }
        ];
        for (const next of neighbors) {
          if (next.r >= COLLECT_SIZE || next.c >= COLLECT_SIZE) continue;
          const board = cloneGrid(app.board);
          const specials = cloneGrid(app.specials);
          const targets = cloneGrid(app.collectTargets);
          const targetStates = cloneGrid(app.collectTargetStates);
          swap(board, { r, c }, next);
          const sp = specials[r][c];
          specials[r][c] = specials[next.r][next.c];
          specials[next.r][next.c] = sp;
          const tg = targets[r][c];
          targets[r][c] = targets[next.r][next.c];
          targets[next.r][next.c] = tg;
          const ts = targetStates[r][c];
          targetStates[r][c] = targetStates[next.r][next.c];
          targetStates[next.r][next.c] = ts;
          const specialCombo = specials[r][c] && specials[next.r][next.c];
          const matches = specialCombo ? [{ r, c }, next] : findMatches(board);
          if (!matches.length) continue;
          const targetScore = scoreMoveTargets(matches, targets, targetStates);
          const sizeScore = matches.length;
          const specialScore = specialCombo ? 30 : 0;
          const total = specialScore + targetScore * 3 + sizeScore;
          if (!best || total > best.score) {
            best = { a: { r, c }, b: { ...next }, score: total };
          }
        }
      }
    }
    return best ? { a: best.a, b: best.b } : null;
  }

  function maybeShowWeakHint() {
    if (app.phase !== "collect" || app.locked || app.paused) return;
    if (app.staleTurns < 3) return;
    app.hintMove = findSuggestedMove();
    if (app.hintMove) {
      renderBoard(onCellTap);
      toast("先试试这组蓝光提示，尽量碰目标豆");
    }
  }

  function clearWeakHint() {
    if (!app.hintMove) return;
    app.hintMove = null;
  }

  function parseBoardCell(target) {
    const cell = target?.closest?.(".cell");
    if (!cell || !refs.board.contains(cell)) return null;
    return {
      r: Number(cell.dataset.r),
      c: Number(cell.dataset.c)
    };
  }

  function resetDrag() {
    app.drag = null;
  }

  function triggerDragSwap(pos) {
    if (!app.drag || app.drag.moved) return false;
    const start = app.drag.start;
    const near = Math.abs(start.r - pos.r) + Math.abs(start.c - pos.c) === 1;
    if (!near) return false;
    app.drag.moved = true;
    onCellTap(start.r, start.c);
    onCellTap(pos.r, pos.c);
    return true;
  }

  function expandMatchesWithSpecials(matchCells) {
    const mark = new Set(matchCells.map(({ r, c }) => `${r},${c}`));
    const matchedSpecials = [];
    matchCells.forEach(({ r, c }) => {
      const special = app.specials[r][c];
      if (special) matchedSpecials.push({ r, c, type: special });
      if (special === "cross") {
        for (let i = 0; i < COLLECT_SIZE; i += 1) {
          mark.add(`${r},${i}`);
          mark.add(`${i},${c}`);
        }
      }
      if (special === "burst") {
        for (let rr = Math.max(0, r - 1); rr <= Math.min(COLLECT_SIZE - 1, r + 1); rr += 1) {
          for (let cc = Math.max(0, c - 1); cc <= Math.min(COLLECT_SIZE - 1, c + 1); cc += 1) {
            mark.add(`${rr},${cc}`);
          }
        }
      }
    });
    if (matchedSpecials.length >= 2) {
      const comboKey = matchedSpecials
        .map((item) => item.type)
        .sort()
        .join("+");
      if (comboKey === "burst+cross") {
        matchedSpecials.forEach(({ r, c }) => {
          for (let rr = Math.max(0, r - 2); rr <= Math.min(COLLECT_SIZE - 1, r + 2); rr += 1) {
            for (let cc = 0; cc < COLLECT_SIZE; cc += 1) mark.add(`${rr},${cc}`);
          }
          for (let cc = Math.max(0, c - 2); cc <= Math.min(COLLECT_SIZE - 1, c + 2); cc += 1) {
            for (let rr = 0; rr < COLLECT_SIZE; rr += 1) mark.add(`${rr},${cc}`);
          }
        });
      } else if (comboKey === "burst+burst") {
        matchedSpecials.forEach(({ r, c }) => {
          for (let rr = Math.max(0, r - 2); rr <= Math.min(COLLECT_SIZE - 1, r + 2); rr += 1) {
            for (let cc = Math.max(0, c - 2); cc <= Math.min(COLLECT_SIZE - 1, c + 2); cc += 1) {
              mark.add(`${rr},${cc}`);
            }
          }
        });
      } else if (comboKey === "cross+cross") {
        for (let i = 0; i < COLLECT_SIZE; i += 1) {
          for (let j = 0; j < COLLECT_SIZE; j += 1) {
            if (i % 2 === 0 || j % 2 === 0) mark.add(`${i},${j}`);
          }
        }
      }
    }
    return Array.from(mark).map((key) => {
      const [r, c] = key.split(",").map(Number);
      return { r, c };
    });
  }

  function pickSpecialReward(matchCells) {
    if (matchCells.length < 4) return null;
    const anchor = matchCells[Math.floor(matchCells.length / 2)];
    return {
      r: anchor.r,
      c: anchor.c,
      type: matchCells.length >= 5 ? "cross" : "burst"
    };
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

  function resolveSpecialSwapCombo(a, b) {
    const types = [app.specials[a.r][a.c], app.specials[b.r][b.c]].sort().join("+");
    const mark = new Set([`${a.r},${a.c}`, `${b.r},${b.c}`]);

    if (types === "burst+burst") {
      [a, b].forEach(({ r, c }) => {
        for (let rr = Math.max(0, r - 2); rr <= Math.min(COLLECT_SIZE - 1, r + 2); rr += 1) {
          for (let cc = Math.max(0, c - 2); cc <= Math.min(COLLECT_SIZE - 1, c + 2); cc += 1) {
            mark.add(`${rr},${cc}`);
          }
        }
      });
    } else if (types === "burst+cross") {
      [a, b].forEach(({ r, c }) => {
        for (let rr = Math.max(0, r - 2); rr <= Math.min(COLLECT_SIZE - 1, r + 2); rr += 1) {
          for (let cc = 0; cc < COLLECT_SIZE; cc += 1) mark.add(`${rr},${cc}`);
        }
        for (let cc = Math.max(0, c - 2); cc <= Math.min(COLLECT_SIZE - 1, c + 2); cc += 1) {
          for (let rr = 0; rr < COLLECT_SIZE; rr += 1) mark.add(`${rr},${cc}`);
        }
      });
    } else if (types === "cross+cross") {
      for (let r = 0; r < COLLECT_SIZE; r += 1) {
        for (let c = 0; c < COLLECT_SIZE; c += 1) {
          if (r % 2 === 0 || c % 2 === 0) mark.add(`${r},${c}`);
        }
      }
    }

    return Array.from(mark).map((key) => {
      const [r, c] = key.split(",").map(Number);
      return { r, c };
    });
  }

  function registerGoalCompletion(color) {
    if (!app.needed[color] || app.completedGoals[color]) return;
    if (app.collected[color] < app.needed[color]) return;
    app.completedGoals[color] = true;
    showGoalComplete(color);
    toast(`${COLORS[color].name} 豆已经收齐`);
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
      if (app.shuffleCharges > 0) {
        toast("棋盘卡住了，试试洗牌按钮");
        updateActionButtons();
        return;
      }
      endRun("棋盘无可消除组合，本局结束");
    }
  }

  function shuffleBoard() {
    if (app.phase !== "collect" || app.locked || app.paused) return;
    if (app.shuffleCharges <= 0) {
      toast("本关洗牌次数已经用完");
      return;
    }
    app.shuffleCharges -= 1;
    app.selected = null;
    clearWeakHint();
    app.staleTurns = 0;
    app.locked = true;
    const nextState = buildShuffledBoardState();
    app.board = nextState.board;
    app.specials = nextState.specials;
    app.collectTargets = nextState.targets;
    app.collectTargetStates = nextState.targetStates;
    app.boardFx = createCollectGrid(0);
    refreshCollectTargets();
    renderBoard(onCellTap);
    drawProgress();
    updateActionButtons();
    app.locked = false;
    toast("棋盘已洗牌，继续找目标豆");
  }

  function onPickColor(color) {
    app.activeColor = color;
    drawResources(onPickColor);
  }

  function enterCraft() {
    app.phase = "craft";
    app.paused = false;
    clearWeakHint();
    app.staleTurns = 0;
    app.hasCraftPlaced = false;
    app.resources = { ...app.collected };
    app.activeColor = COLOR_KEYS.find((k) => app.resources[k] > 0) || "red";
    refs.collectPhase.classList.add("phase-hidden");
    refs.craftPhase.classList.remove("phase-hidden");
    refs.phaseLabel.textContent = `第${app.level}关${app.hardLevel ? " · 超难" : ""} · 拼搭图案`;
    refs.craftPreviewTitle.textContent = `${app.currentAnimal}参考图`;
    refs.craftPreviewText.textContent = `先补最亮的缺口区域，当前拼图尺寸 ${app.craftSize} x ${app.craftSize}`;
    drawPatternGrid(refs.craftReference, app.targetMap, "mini-cell");
    app.craftTime = levelCraftTime(app.targetMap, app.hardLevel);
    updateCraftTimer();
    drawCraft(onCraftCell);
    drawResources(onPickColor);
    toast(`进入拼搭阶段，${app.craftTime} 秒内完成`);
    sfxPhaseShift("craft");
    refreshBgm();
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
      if (!app.collectTargets?.[r]?.[c]) return;
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
      fly.style.pointerEvents = "none";
      document.body.appendChild(fly);
      const dx = t.left - s.left;
      const dy = t.top - s.top;
      const item = target.closest(".progress-item");
      if (item) {
        item.classList.remove("hit");
      }
      fly.animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${dx * 0.48}px, ${dy * 0.56 - 28}px) scale(0.82)`, opacity: 1, offset: 0.58 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.34)`, opacity: 0.18 }
        ],
        {
          duration: 620,
          easing: "cubic-bezier(.2,.86,.24,1)",
          fill: "forwards"
        }
      );
      tasks.push(
        new Promise((resolve) => {
          setTimeout(() => {
            if (item) {
              item.classList.add("hit");
              setTimeout(() => item.classList.remove("hit"), 320);
            }
            registerGoalCompletion(color);
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
    let meaningfulProgress = false;
    while (matches.length) {
      const expandedMatches = expandMatchesWithSpecials(matches);
      const collectCells = [];
      const clearedCells = [];
      let unlockedCount = 0;
      let crackedCount = 0;
      let anyTargetTouched = false;
      expandedMatches.forEach(({ r, c }) => {
        const isTarget = app.collectTargets?.[r]?.[c];
        const targetState = app.collectTargetStates?.[r]?.[c];
        if (isTarget) {
          anyTargetTouched = true;
          meaningfulProgress = true;
        }
        if (targetState === "lock") {
          app.collectTargetStates[r][c] = null;
          unlockedCount += 1;
          return;
        }
        if (targetState === "ice") {
          app.collectTargetStates[r][c] = "cracked";
          crackedCount += 1;
          return;
        }
        if (isTarget) collectCells.push({ r, c });
        clearedCells.push({ r, c });
      });
      const reward = pickSpecialReward(expandedMatches);
      renderBoard(onCellTap);
      markMatches(expandedMatches, chain);
      await new Promise((resolve) => setTimeout(resolve, 180));
      sfxMatch(expandedMatches.length);
      if (chain > 1) {
        sfxCombo(chain);
        showCombo(chain, expandedMatches.length);
      }
      if (!anyTargetTouched && chain === 1) toast("只有带星目标豆才会计入收集");
      else if (unlockedCount > 0 && crackedCount > 0) toast(`解锁 ${unlockedCount} 颗，冰裂 ${crackedCount} 颗`);
      else if (unlockedCount > 0) toast(`锁定目标豆已解锁 ${unlockedCount} 颗`);
      else if (crackedCount > 0) toast(`冰冻目标豆已敲裂 ${crackedCount} 颗`);
      await animateCollect(collectCells, chain);
      clearedCells.forEach(({ r, c }) => {
        app.board[r][c] = null;
        app.specials[r][c] = null;
        app.collectTargets[r][c] = false;
        app.collectTargetStates[r][c] = null;
      });
      app.boardFx = createCollectGrid(0);
      renderBoard(onCellTap);
      await new Promise((resolve) => setTimeout(resolve, 140));
      app.boardFx = collapse(app.board, app.specials, app.collectTargets, app.collectTargetStates);
      if (reward && app.board[reward.r]?.[reward.c]) {
        app.specials[reward.r][reward.c] = reward.type;
      }
      refreshCollectTargets();
      drawProgress();
      renderBoard(onCellTap);
      await new Promise((resolve) => setTimeout(resolve, 380));
      matches = findMatches(app.board);
      chain += 1;
    }
    app.comboChain = 0;
    app.locked = false;
    if (meaningfulProgress) {
      app.staleTurns = 0;
      clearWeakHint();
    } else {
      app.staleTurns += 1;
      maybeShowWeakHint();
    }

    if (isCollectDone(app)) {
      enterCraft();
      return;
    }
    checkCollectFail();
  }

  function onCellTap(r, c) {
    if (app.phase !== "collect" || app.locked || app.paused) return;
    if (!app.selected) {
      clearWeakHint();
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
    swapSpecials(app.selected, { r, c });
    swapTargets(app.selected, { r, c });
    app.steps -= 1;
    refs.stepText.textContent = app.steps;
    refs.timerText.textContent = `步数 ${app.steps}`;
    const specialA = app.specials[r][c];
    const specialB = app.specials[app.selected.r][app.selected.c];
    const comboMatches = specialA && specialB ? resolveSpecialSwapCombo({ r, c }, app.selected) : null;
    const matches = comboMatches && comboMatches.length ? comboMatches : findMatches(app.board);
    if (!matches.length) {
      swap(app.board, app.selected, { r, c });
      swapSpecials(app.selected, { r, c });
      swapTargets(app.selected, { r, c });
      app.selected = null;
      app.locked = false;
      app.staleTurns += 1;
      maybeShowWeakHint();
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
    app.hasCraftPlaced = true;
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
    const gallery = getGallery();
    gallery.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: app.currentAnimal,
      level: app.level,
      size: app.craftSize,
      date: new Date().toLocaleDateString("zh-CN"),
      map: app.targetMap.map((row) => [...row])
    });
    saveGallery(gallery);
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
    const compareEnabled = app.phase === "craft";
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
    if (compareEnabled) {
      refs.resultCompare.classList.remove("hidden");
      drawPatternGrid(refs.answerGrid, app.targetMap, "compare-cell");
      drawPatternGrid(refs.attemptGrid, app.targetMap, "compare-cell", app.placed);
    } else {
      refs.resultCompare.classList.add("hidden");
      refs.answerGrid.innerHTML = "";
      refs.attemptGrid.innerHTML = "";
    }
    showFailureResult({
      badge: app.clearedLevels > 0 ? "挑战中断" : "首次尝试",
      title: app.clearedLevels > 0 ? "差一点就更远了" : "先热热身",
      detail: compareEnabled
        ? `${detail}。下方能看到目标图和你的拼图对比，再来一次会更稳。`
        : `${detail}。本次通关 ${app.clearedLevels} 关，总分 ${app.score} 分。`,
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
    app.craftSize = generated.size;
    app.needed = initNeeded(app.targetMap);
    app.collected = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
    app.completedGoals = { red: false, blue: false, green: false, yellow: false, purple: false };
    app.resources = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
    app.boardFx = createCollectGrid(0);
    app.specials = createCollectGrid(null);
    app.collectTargets = createCollectGrid(false);
    app.collectTargetStates = createCollectGrid(null);
    app.shuffleCharges = 1;
    app.staleTurns = 0;
    app.hintMove = null;
    app.placed = Array.from({ length: app.craftSize }, () => Array(app.craftSize).fill(null));
    app.activeColor = null;
    app.locked = false;
    refs.phaseLabel.textContent = `第${app.level}关${app.hardLevel ? " · 超难" : ""} · 收集豆子`;
    refs.timerText.classList.remove("warn");
    refs.timerText.textContent = `步数 ${app.steps}`;
    refs.stepText.textContent = app.steps;
    refs.resultLayer.classList.add("hidden");
    refs.resultCompare.classList.add("hidden");
    refs.celebrationLayer.classList.add("hidden");
    refs.celebrationLayer.classList.remove("show");
    refs.pauseLayer.classList.add("hidden");
    refs.helpLayer.classList.add("hidden");
    refs.historyLayer.classList.add("hidden");
    refs.collectPhase.classList.remove("phase-hidden");
    refs.craftPhase.classList.add("phase-hidden");
    updateRunStats();

    app.board = createBoard();
    refreshCollectTargets();
    drawMini(refs.miniTarget);
    drawMini(refs.overlayMini);
    drawNeedList();
    drawProgress();
    renderBoard(onCellTap);
    refs.introTitle.textContent = `${app.currentAnimal}拼豆图`;
    refs.introDesc.textContent = `${app.hardLevel ? "超难关" : "普通关"}：先收集再拼搭，拼豆时间 ${levelCraftTime(
      app.targetMap,
      app.hardLevel
    )} 秒`;
    if (app.hardLevel) sfxHardAlert();
    sfxPhaseShift("collect");
    refreshBgm();

    const introMs = showIntro ? 3000 : 1400;
    refs.introOverlay.classList.remove("hidden");
    refs.introOverlay.classList.remove("outro");
    refs.introOverlay.classList.add("intro-show");
    app.introOverlayTimer = setTimeout(() => {
      refs.introOverlay.classList.remove("intro-show");
      refs.introOverlay.classList.add("outro");
      setTimeout(() => {
        refs.introOverlay.classList.add("hidden");
        refs.introOverlay.classList.remove("outro");
      }, 320);
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
    refs.historyLayer.classList.add("hidden");
    renderLeaderboard();
    renderGallery();
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
  refs.historyBtn.onclick = () => {
    renderGallery();
    refs.historyLayer.classList.remove("hidden");
  };
  refs.closeHistoryBtn.onclick = () => refs.historyLayer.classList.add("hidden");
  refs.helpBtn.onclick = showHelp;
  refs.closeHelpBtn.onclick = hideHelp;
  refs.pauseBtn.onclick = () => {
    if (app.paused) resumeGame();
    else pauseGame();
  };
  refs.restartGameBtn.onclick = resetGame;
  refs.shuffleBtn.onclick = shuffleBoard;
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
  refs.board.addEventListener("pointerdown", (e) => {
    const pos = parseBoardCell(e.target);
    if (!pos || app.phase !== "collect" || app.locked || app.paused) return;
    app.drag = {
      pointerId: e.pointerId,
      start: pos,
      moved: false
    };
  });
  refs.board.addEventListener("pointermove", (e) => {
    if (!app.drag || app.drag.pointerId !== e.pointerId) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const pos = parseBoardCell(hit);
    if (pos) triggerDragSwap(pos);
  });
  refs.board.addEventListener("pointerup", (e) => {
    if (!app.drag || app.drag.pointerId !== e.pointerId) return;
    if (!app.drag.moved) onCellTap(app.drag.start.r, app.drag.start.c);
    resetDrag();
  });
  refs.board.addEventListener("pointercancel", resetDrag);
  refs.board.addEventListener("pointerleave", (e) => {
    if (!app.drag || app.drag.pointerId !== e.pointerId) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const pos = parseBoardCell(hit);
    if (pos) return;
    resetDrag();
  });
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
