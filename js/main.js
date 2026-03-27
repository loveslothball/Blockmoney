(() => {
  const G = window.BeanGame;
  const { app, refs } = G;
  const { COLOR_KEYS, COLORS, COLLECT_SIZE } = G.constants;
  const { generateTargetMap, resizeMask, initNeeded, levelStepLimit, levelShowcaseDuration, isHardLevel, chooseCraftSize } = G.utils;
  const { swap, findMatches, hasAnyMove, createBoard, collapse, isCollectDone } = G.engine;
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
  const { ensureAudio, sfxMatch, sfxCombo, sfxFail, sfxSuccess, sfxHardAlert, sfxPhaseShift, startBgm, stopBgm, refreshBgm, updateSoundButton } =
    G.audioApi;
  const audio = G.audio;
  const isWechatBrowser = /MicroMessenger/i.test(navigator.userAgent);
  const BEAN_RGB = {
    red: [243, 127, 150],
    blue: [114, 197, 255],
    green: [105, 216, 167],
    yellow: [255, 216, 111],
    purple: [184, 156, 255]
  };

  function nearestBeanColor(r, g, b) {
    let best = "yellow";
    let bestDist = Infinity;
    for (const key of COLOR_KEYS) {
      const [cr, cg, cb] = BEAN_RGB[key];
      const dr = r - cr;
      const dg = g - cg;
      const db = b - cb;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = key;
      }
    }
    return best;
  }

  function isLikelyBgPixel(r, g, b, a) {
    if (a < 20) return true;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max - min;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    return luma > 238 && sat < 18;
  }

  function renderCustomMapFromSource(dataUrl, size, keepBg = false) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          reject(new Error("无法初始化图像画布"));
          return;
        }
        ctx.clearRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = true;
        const scale = Math.min(size / img.width, size / img.height);
        const dw = Math.max(1, Math.round(img.width * scale));
        const dh = Math.max(1, Math.round(img.height * scale));
        const dx = Math.floor((size - dw) / 2);
        const dy = Math.floor((size - dh) / 2);
        ctx.fillStyle = "rgba(255,255,255,0)";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, dx, dy, dw, dh);
        const pixels = ctx.getImageData(0, 0, size, size).data;
        const map = Array.from({ length: size }, () => Array(size).fill(null));
        let filled = 0;
        for (let i = 0; i < size * size; i += 1) {
          const p = i * 4;
          const r = pixels[p];
          const g = pixels[p + 1];
          const b = pixels[p + 2];
          const a = pixels[p + 3];
          if (!keepBg && isLikelyBgPixel(r, g, b, a)) continue;
          const rr = Math.floor(i / size);
          const cc = i % size;
          map[rr][cc] = nearestBeanColor(r, g, b);
          filled += 1;
        }
        resolve({ map, filled });
      };
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = dataUrl;
    });
  }

  async function generateCustomTargetMap(level) {
    const size = chooseCraftSize(level, isHardLevel(level));
    if (app.customMapCache[size]) {
      return { map: app.customMapCache[size], animalName: app.customImageName || "自定义图", size };
    }
    const firstPass = await renderCustomMapFromSource(app.customImageSource, size, false);
    let finalMap = firstPass.map;
    if (firstPass.filled < size * size * 0.3) {
      const secondPass = await renderCustomMapFromSource(app.customImageSource, size, true);
      finalMap = secondPass.map;
    }
    app.customMapCache[size] = finalMap;
    return { map: finalMap, animalName: app.customImageName || "自定义图", size };
  }

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

  function collectProgressRatio() {
    const totalNeed = COLOR_KEYS.reduce((sum, color) => sum + (app.needed[color] || 0), 0);
    const totalCollected = COLOR_KEYS.reduce((sum, color) => sum + (app.collected[color] || 0), 0);
    if (!totalNeed) return 0;
    return totalCollected / totalNeed;
  }

  function getCollectFlowProfile() {
    const progress = collectProgressRatio();
    const levelBias = Math.min(app.level, 10);
    if (progress < 0.34) {
      return {
        desiredPerColor: 1 + Math.floor(levelBias / 4),
        desiredTotal: Math.min(12, 7 + Math.floor(levelBias / 3)),
        lockChance: levelBias >= 4 ? 0.08 : 0,
        iceChance: 0
      };
    }
    if (progress < 0.74) {
      return {
        desiredPerColor: 2 + Math.floor(levelBias / 3),
        desiredTotal: Math.min(18, 9 + Math.floor(levelBias / 2)),
        lockChance: Math.min(0.22, 0.08 + levelBias * 0.012),
        iceChance: levelBias >= 6 ? Math.min(0.12, 0.03 + levelBias * 0.008) : 0
      };
    }
    return {
      desiredPerColor: 2 + Math.floor(levelBias / 4),
      desiredTotal: Math.min(14, 8 + Math.floor(levelBias / 3)),
      lockChance: Math.min(0.14, 0.05 + levelBias * 0.008),
      iceChance: levelBias >= 7 ? Math.min(0.08, 0.02 + levelBias * 0.005) : 0
    };
  }

  function pickTargetState(profile) {
    const roll = Math.random();
    if (profile.iceChance > 0 && roll < profile.iceChance) return "ice";
    if (profile.lockChance > 0 && roll < profile.iceChance + profile.lockChance) return "lock";
    return null;
  }

  function refreshCollectTargets() {
    const profile = getCollectFlowProfile();
    const nextTargets = createCollectGrid(false);
    const nextStates = createCollectGrid(null);
    const positionsByColor = Object.fromEntries(COLOR_KEYS.map((key) => [key, []]));
    const currentCount = Object.fromEntries(COLOR_KEYS.map((key) => [key, 0]));
    for (let r = 0; r < COLLECT_SIZE; r += 1) {
      for (let c = 0; c < COLLECT_SIZE; c += 1) {
        const color = app.board[r][c];
        if (!color || !remainingNeed(color) || app.specials?.[r]?.[c]) continue;
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
        Math.max(1, Math.min(remain, profile.desiredPerColor))
      );
      for (let i = currentCount[color]; i < desiredCount; i += 1) {
        const pos = positionsByColor[color].find(({ r, c }) => !nextTargets[r][c]);
        if (!pos) break;
        nextTargets[pos.r][pos.c] = true;
        nextStates[pos.r][pos.c] = pickTargetState(profile);
        currentCount[color] += 1;
      }
    });

    let totalMarked = 0;
    nextTargets.forEach((row) => row.forEach((cell) => {
      if (cell) totalMarked += 1;
    }));
    const desiredTotal = profile.desiredTotal;
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
      nextStates[pos.r][pos.c] = pickTargetState(profile);
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

  function stopShowcaseAnimation() {
    clearInterval(app.showcaseTimer);
    app.showcaseTimer = null;
    app.showcaseRecent = [];
  }

  function buildShowcaseSequence() {
    const size = app.targetMap.length;
    const center = (size - 1) / 2;
    const cells = [];
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const color = app.targetMap[r][c];
        if (!color) continue;
        const distance = Math.abs(r - center) + Math.abs(c - center);
        const wave = r + (r % 2 === 0 ? c / size : (size - c) / size);
        cells.push({ r, c, color, distance, wave, tie: Math.random() });
      }
    }
    if (size <= 16) {
      cells.sort((a, b) => a.distance - b.distance || a.tie - b.tie);
    } else {
      cells.sort((a, b) => a.wave - b.wave || a.tie - b.tie);
    }
    return cells.map(({ r, c, color }) => ({ r, c, color }));
  }

  function startShowcaseAnimation() {
    stopShowcaseAnimation();
    const cells = app.showcaseSequence.length ? app.showcaseSequence : buildShowcaseSequence();
    app.showcaseSequence = cells;
    const duration = levelShowcaseDuration(app.targetMap, app.hardLevel);
    const tickMs = 34;
    const baseBatch = Math.max(1, Math.ceil(cells.length / Math.max(24, Math.round(duration / tickMs))));
    app.showcaseBatch = baseBatch;
    if (!app.showcaseIndex) {
      app.placed = Array.from({ length: app.craftSize }, () => Array(app.craftSize).fill(null));
      app.showcaseStage = "assemble";
      drawCraft();
      drawResources();
    }
    if (app.showcaseIndex > 0 && app.showcaseIndex < cells.length) {
      app.showcaseStage = app.showcaseIndex / cells.length > 0.85 ? "polish" : "assemble";
    }
    app.showcaseTimer = setInterval(() => {
      const progress = cells.length ? app.showcaseIndex / cells.length : 1;
      const currentBatch = progress > 0.88 ? Math.max(1, Math.ceil(baseBatch * 0.45)) : progress > 0.62 ? Math.max(1, Math.ceil(baseBatch * 0.7)) : Math.max(1, Math.ceil(baseBatch * 1.2));
      const nextChunk = cells.slice(app.showcaseIndex, app.showcaseIndex + currentBatch);
      nextChunk.forEach(({ r, c, color }) => {
        app.placed[r][c] = color;
      });
      app.showcaseRecent = nextChunk.map(({ r, c }) => `${r},${c}`);
      app.showcaseIndex += nextChunk.length;
      app.showcaseStage = app.showcaseIndex >= cells.length ? "finish" : app.showcaseIndex / cells.length > 0.85 ? "polish" : "assemble";
      drawCraft();
      drawResources();
      if (app.showcaseIndex >= cells.length) {
        stopShowcaseAnimation();
        app.locked = true;
        refs.ironSweep.classList.add("play");
        setTimeout(() => {
          refs.ironSweep.classList.remove("play");
          completeLevel();
        }, 1160);
      }
    }, tickMs);
  }

  function pauseGame() {
    if (app.paused || (app.phase !== "collect" && app.phase !== "showcase")) return;
    app.paused = true;
    if (app.phase === "showcase") stopShowcaseAnimation();
    app.locked = true;
    refs.pauseText.textContent =
      app.phase === "showcase" ? "当前是自动拼豆展示阶段，继续后会接着还原图案。" : `当前是收集阶段，还剩 ${app.steps} 步。`;
    refs.pauseLayer.classList.remove("hidden");
    updateActionButtons();
  }

  function resumeGame() {
    if (!app.paused) return;
    app.paused = false;
    refs.pauseLayer.classList.add("hidden");
    app.locked = false;
    if (app.phase === "showcase") startShowcaseAnimation();
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

  function enterCraft() {
    app.phase = "showcase";
    app.paused = false;
    clearWeakHint();
    app.staleTurns = 0;
    app.showcaseIndex = 0;
    app.showcaseStage = "assemble";
    app.showcaseSequence = buildShowcaseSequence();
    app.showcaseRecent = [];
    refs.collectPhase.classList.add("phase-hidden");
    refs.craftPhase.classList.remove("phase-hidden");
    refs.phaseLabel.textContent = `第${app.level}关${app.hardLevel ? " · 超难" : ""} · 自动拼豆展示`;
    refs.craftPreviewTitle.textContent = `${app.currentAnimal} 自动还原`;
    refs.craftPreviewText.textContent = `已解锁 ${app.craftSize} x ${app.craftSize} 拼豆图，正在自动拼装。`;
    drawPatternGrid(refs.craftReference, app.previewMap?.length ? app.previewMap : app.targetMap, "mini-cell");
    updateCraftTimer();
    drawCraft();
    drawResources();
    toast(`收集完成，开始自动拼出 ${app.currentAnimal}`);
    sfxPhaseShift("craft");
    refreshBgm();
    startShowcaseAnimation();
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
      if (!anyTargetTouched && chain === 1 && !app.targetRuleWarned) {
        app.targetRuleWarned = true;
        toast("只有带星目标豆才会计入收集");
      }
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
        app.collectTargets[reward.r][reward.c] = false;
        app.collectTargetStates[reward.r][reward.c] = null;
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

  function completeLevel() {
    const resolutionBonus = 140 + Math.round(app.craftSize * app.craftSize * 0.45);
    const bonus = 120 + app.level * 40 + app.steps * 16 + resolutionBonus;
    addScore(bonus);
    app.clearedLevels += 1;
    const gallery = getGallery();
    gallery.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: app.currentAnimal,
      level: app.level,
      size: app.craftSize,
      date: new Date().toLocaleDateString("zh-CN"),
      previewMap: resizeMask(app.targetMap, 16)
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
    app.phase = "done";
    app.paused = false;
    app.locked = false;
    stopShowcaseAnimation();
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
    refs.resultCompare.classList.add("hidden");
    refs.answerGrid.innerHTML = "";
    refs.attemptGrid.innerHTML = "";
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

  async function startLevel(showIntro) {
    app.phase = "collect";
    app.paused = false;
    clearTimeout(app.levelTransitionTimer);
    clearTimeout(app.introOverlayTimer);
    clearTimeout(app.celebrationTimer);
    clearTimeout(app.comboTimer);
    app.hardLevel = isHardLevel(app.level);
    applyDifficultyUI();
    app.selected = null;
    let generated;
    if (app.customImageEnabled && app.customImageSource) {
      try {
        generated = await generateCustomTargetMap(app.level);
      } catch (err) {
        app.customImageEnabled = false;
        app.customImageSource = "";
        app.customImageName = "";
        app.customMapCache = {};
        toast("自定义图片读取失败，已切回默认图案");
        generated = generateTargetMap(app.level);
      }
    } else {
      generated = generateTargetMap(app.level);
    }
    app.targetMap = generated.map;
    app.previewMap = app.targetMap.length > 24 ? resizeMask(app.targetMap, 24) : app.targetMap.map((row) => [...row]);
    app.currentAnimal = generated.animalName;
    app.craftSize = generated.size;
    app.needed = initNeeded(app.targetMap, app.level, app.hardLevel);
    app.steps = levelStepLimit(app.needed, app.hardLevel);
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
    app.targetRuleWarned = false;
    app.showcaseIndex = 0;
    app.showcaseBatch = 1;
    app.showcaseStage = "idle";
    app.showcaseSequence = [];
    app.showcaseRecent = [];
    app.placed = Array.from({ length: app.craftSize }, () => Array(app.craftSize).fill(null));
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
    refs.introDesc.textContent = `${app.hardLevel ? "超难关" : "普通关"}：先收集目标豆，完成后自动还原 ${app.craftSize}x${app.craftSize} 拼豆图`;
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
    stopShowcaseAnimation();
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
    stopShowcaseAnimation();
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
    if (refs.uploadImageBtn) {
      refs.uploadImageBtn.textContent = app.customImageEnabled ? "更换图片" : "上传图片";
    }
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
  refs.uploadImageBtn.onclick = () => {
    if (!refs.customImageInput) return;
    refs.customImageInput.value = "";
    refs.customImageInput.click();
  };
  refs.customImageInput.onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("请选择图片文件");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast("图片过大，请选 8MB 以内");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const src = String(reader.result || "");
      if (!src) {
        toast("图片读取失败");
        return;
      }
      app.customImageEnabled = true;
      app.customImageSource = src;
      app.customImageName = (file.name || "自定义图").replace(/\.[^.]+$/, "").slice(0, 18) || "自定义图";
      app.customMapCache = {};
      try {
        await generateCustomTargetMap(1);
        if (refs.uploadImageBtn) refs.uploadImageBtn.textContent = "更换图片";
        toast("自定义拼豆图已启用，会随关卡分辨率升级");
      } catch (err) {
        app.customImageEnabled = false;
        app.customImageSource = "";
        app.customImageName = "";
        app.customMapCache = {};
        toast("图片处理失败，请换一张再试");
      }
    };
    reader.readAsDataURL(file);
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
  const primeAudio = () => {
    ensureAudio();
    if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
  };
  document.addEventListener("pointerdown", primeAudio, { once: true });
  document.addEventListener("touchstart", primeAudio, { once: true });
  document.addEventListener("click", primeAudio, { once: true });

  updateSoundButton();
  refs.appRoot.classList.toggle("wechat-browser", isWechatBrowser);
  showStartMenu();
})();
