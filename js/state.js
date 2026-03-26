(() => {
  const G = (window.BeanGame = window.BeanGame || {});

  const COLORS = {
    red: { name: "粉", hex: "var(--red)", soft: "rgba(255,127,150,0.24)" },
    blue: { name: "蓝", hex: "var(--blue)", soft: "rgba(114,197,255,0.24)" },
    green: { name: "绿", hex: "var(--green)", soft: "rgba(105,216,167,0.24)" },
    yellow: { name: "黄", hex: "var(--yellow)", soft: "rgba(255,216,111,0.24)" },
    purple: { name: "紫", hex: "var(--purple)", soft: "rgba(184,156,255,0.24)" }
  };

  const COLOR_KEYS = Object.keys(COLORS);
  const COLLECT_SIZE = 8;
  const START_STEPS = 28;
  const LEADERBOARD_KEY = "bean_game_leaderboard_v1";

  const BASE_MASKS = [
    {
      name: "猫咪",
      mask: [
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 0, 0, 0, 0, 0, 0, 1, 1],
        [1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
        [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
        [0, 0, 0, 1, 1, 1, 1, 0, 0, 0]
      ]
    },
    {
      name: "兔兔",
      mask: [
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 0, 0, 0, 0, 0, 0, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
        [0, 0, 0, 1, 1, 1, 1, 0, 0, 0]
      ]
    },
    {
      name: "小鱼",
      mask: [
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 1, 0, 0, 1],
        [0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 0, 0, 1, 1, 1, 1, 0, 0, 1],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0]
      ]
    },
    {
      name: "小龟",
      mask: [
        [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
        [1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
        [0, 0, 1, 0, 0, 0, 0, 1, 0, 0]
      ]
    },
    {
      name: "小鸟",
      mask: [
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
        [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
        [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0]
      ]
    }
  ];

  function resizeMask(mask, targetSize) {
    const sourceSize = mask.length;
    if (sourceSize === targetSize) return mask.map((row) => [...row]);
    return Array.from({ length: targetSize }, (_, r) =>
      Array.from({ length: targetSize }, (_, c) => {
        const sr = Math.min(sourceSize - 1, Math.floor((r / targetSize) * sourceSize));
        const sc = Math.min(sourceSize - 1, Math.floor((c / targetSize) * sourceSize));
        return mask[sr][sc];
      })
    );
  }

  function chooseCraftSize(level) {
    if (level >= 8) return 12;
    if (level >= 4) return 10;
    return 8;
  }

  const app = {
    phase: "collect",
    level: 1,
    clearedLevels: 0,
    score: 0,
    currentAnimal: "",
    lastAnimal: "",
    animalQueue: [],
    hardLevel: false,
    steps: START_STEPS,
    targetMap: [],
    craftSize: 8,
    board: [],
    boardFx: Array.from({ length: COLLECT_SIZE }, () => Array(COLLECT_SIZE).fill(0)),
    specials: Array.from({ length: COLLECT_SIZE }, () => Array(COLLECT_SIZE).fill(null)),
    selected: null,
    needed: {},
    collected: {},
    resources: {},
    placed: [],
    activeColor: null,
    craftTime: 48,
    craftTimer: null,
    levelTransitionTimer: null,
    introOverlayTimer: null,
    storageWarned: false,
    comboChain: 0,
    comboTimer: null,
    celebrationTimer: null,
    locked: false,
    paused: false
  };

  const refs = {
    board: document.getElementById("board"),
    craftGrid: document.getElementById("craftGrid"),
    miniTarget: document.getElementById("miniTarget"),
    overlayMini: document.getElementById("overlayMini"),
    progressBoard: document.getElementById("progressBoard"),
    resourcePanel: document.getElementById("resourcePanel"),
    needList: document.getElementById("needList"),
    phaseLabel: document.getElementById("phaseLabel"),
    timerText: document.getElementById("timerText"),
    stepText: document.getElementById("stepText"),
    collectPhase: document.getElementById("collectPhase"),
    craftPhase: document.getElementById("craftPhase"),
    introOverlay: document.getElementById("introOverlay"),
    comboFx: document.getElementById("comboFx"),
    celebrationLayer: document.getElementById("celebrationLayer"),
    celebrationKicker: document.getElementById("celebrationKicker"),
    celebrationTitle: document.getElementById("celebrationTitle"),
    celebrationText: document.getElementById("celebrationText"),
    celebrationScore: document.getElementById("celebrationScore"),
    celebrationLevel: document.getElementById("celebrationLevel"),
    toast: document.getElementById("toast"),
    resultLayer: document.getElementById("resultLayer"),
    resultBadge: document.getElementById("resultBadge"),
    resultTitle: document.getElementById("resultTitle"),
    resultText: document.getElementById("resultText"),
    resultScore: document.getElementById("resultScore"),
    resultLevels: document.getElementById("resultLevels"),
    introTitle: document.getElementById("introTitle"),
    introDesc: document.getElementById("introDesc"),
    startLayer: document.getElementById("startLayer"),
    startGameBtn: document.getElementById("startGameBtn"),
    shareGameBtn: document.getElementById("shareGameBtn"),
    leaderboardList: document.getElementById("leaderboardList"),
    restartBtn: document.getElementById("restartBtn"),
    ironSweep: document.getElementById("ironSweep"),
    soundBtn: document.getElementById("soundBtn"),
    shareBtn: document.getElementById("shareBtn"),
    hardBadge: document.getElementById("hardBadge"),
    appRoot: document.getElementById("app"),
    runStats: document.getElementById("runStats"),
    helpBtn: document.getElementById("helpBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    restartGameBtn: document.getElementById("restartGameBtn"),
    helpMenuBtn: document.getElementById("helpMenuBtn"),
    helpLayer: document.getElementById("helpLayer"),
    closeHelpBtn: document.getElementById("closeHelpBtn"),
    pauseLayer: document.getElementById("pauseLayer"),
    pauseText: document.getElementById("pauseText"),
    resumeBtn: document.getElementById("resumeBtn"),
    pauseRestartBtn: document.getElementById("pauseRestartBtn"),
    bestScore: document.getElementById("bestScore"),
    bestLevel: document.getElementById("bestLevel")
  };

  function shuffle(arr) {
    const n = [...arr];
    for (let i = n.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [n[i], n[j]] = [n[j], n[i]];
    }
    return n;
  }

  function isHardLevel(level) {
    return level % 5 === 0;
  }

  function pickAnimal() {
    if (!app.animalQueue.length) {
      app.animalQueue = shuffle(BASE_MASKS);
      if (app.animalQueue[0] && app.animalQueue[0].name === app.lastAnimal) {
        app.animalQueue.push(app.animalQueue.shift());
      }
    }
    const chosen = app.animalQueue.shift() || BASE_MASKS[0];
    app.lastAnimal = chosen.name;
    return chosen;
  }

  function generateTargetMap(level) {
    const animal = pickAnimal();
    const targetSize = chooseCraftSize(level);
    const mask = resizeMask(animal.mask, targetSize);
    const activeCount = Math.min(5, 3 + Math.floor((level - 1) / 2));
    const palette = shuffle(COLOR_KEYS).slice(0, activeCount);
    const map = Array.from({ length: targetSize }, () => Array(targetSize).fill(null));
    for (let r = 0; r < targetSize; r += 1) {
      for (let c = 0; c < targetSize; c += 1) {
        if (!mask[r][c]) continue;
        const rowBand = Math.floor((r / targetSize) * activeCount);
        const colBand = Math.floor(
          (Math.min(c, targetSize - 1 - c) / Math.ceil(targetSize / 2)) * Math.max(1, activeCount - 1)
        );
        const zone = (rowBand + colBand + (level % activeCount)) % activeCount;
        map[r][c] = palette[zone];
      }
    }
    return { map, animalName: animal.name, size: targetSize };
  }

  function initNeeded(targetMap) {
    const needed = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
    targetMap.flat().forEach((c) => {
      if (c) needed[c] += 1;
    });
    return needed;
  }

  function levelStepLimit(level) {
    return START_STEPS + Math.min(8, Math.floor((level - 1) / 2));
  }

  function levelCraftTime(targetMap, hardLevel = false) {
    const filled = targetMap.flat().filter(Boolean).length;
    const activeColors = new Set(targetMap.flat().filter(Boolean)).size;
    const gridSize = targetMap.length;
    const base = 18 + Math.round(filled * 0.36) + activeColors * 2 + Math.max(0, gridSize - 8) * 5;
    return base + (hardLevel ? 8 : 0);
  }

  function randomColor() {
    return COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
  }

  G.constants = {
    COLORS,
    COLOR_KEYS,
    COLLECT_SIZE,
    START_STEPS,
    LEADERBOARD_KEY,
    ANIMAL_MASKS: BASE_MASKS
  };

  G.app = app;
  G.refs = refs;
  G.utils = {
    shuffle,
    isHardLevel,
    pickAnimal,
    generateTargetMap,
    initNeeded,
    levelStepLimit,
    levelCraftTime,
    randomColor,
    chooseCraftSize
  };
})();
