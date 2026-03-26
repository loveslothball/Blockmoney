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
  const SIZE = 8;
  const START_STEPS = 24;
  const NORMAL_CRAFT_TIME = 35;
  const HARD_CRAFT_TIME = 60;
  const LEADERBOARD_KEY = "bean_game_leaderboard_v1";

  const ANIMAL_MASKS = [
    {
      name: "猫咪",
      mask: [
        [1, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 0, 0, 0, 0, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [0, 1, 0, 1, 1, 0, 1, 0],
        [0, 0, 1, 0, 0, 1, 0, 0]
      ]
    },
    {
      name: "兔兔",
      mask: [
        [1, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 0, 0, 0, 0, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [0, 0, 1, 1, 1, 1, 0, 0]
      ]
    },
    {
      name: "小鱼",
      mask: [
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 1, 1, 1, 1, 0, 1],
        [0, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 1, 1, 1, 1, 1],
        [0, 0, 1, 1, 1, 1, 0, 1],
        [0, 0, 0, 1, 1, 0, 0, 0]
      ]
    },
    {
      name: "小龟",
      mask: [
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [0, 1, 0, 1, 1, 0, 1, 0],
        [1, 0, 0, 1, 1, 0, 0, 1]
      ]
    },
    {
      name: "小鸟",
      mask: [
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 1, 1, 1, 1, 1],
        [0, 0, 1, 1, 1, 1, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0]
      ]
    }
  ];

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
    board: [],
    selected: null,
    needed: {},
    collected: {},
    resources: {},
    placed: Array.from({ length: SIZE }, () => Array(SIZE).fill(null)),
    activeColor: null,
    craftTime: NORMAL_CRAFT_TIME,
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
      app.animalQueue = shuffle(ANIMAL_MASKS);
      if (app.animalQueue[0] && app.animalQueue[0].name === app.lastAnimal) {
        app.animalQueue.push(app.animalQueue.shift());
      }
    }
    const chosen = app.animalQueue.shift() || ANIMAL_MASKS[0];
    app.lastAnimal = chosen.name;
    return chosen;
  }

  function generateTargetMap(level) {
    const animal = pickAnimal();
    const mask = animal.mask;
    const activeCount = Math.min(5, 3 + Math.floor((level - 1) / 2));
    const palette = shuffle(COLOR_KEYS).slice(0, activeCount);
    const map = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (!mask[r][c]) continue;
        const rowBand = Math.floor((r / SIZE) * activeCount);
        const colBand = Math.floor((Math.min(c, SIZE - 1 - c) / Math.ceil(SIZE / 2)) * Math.max(1, activeCount - 1));
        const zone = (rowBand + colBand + (level % activeCount)) % activeCount;
        map[r][c] = palette[zone];
      }
    }
    return { map, animalName: animal.name };
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

  function levelCraftTime(level) {
    return isHardLevel(level) ? HARD_CRAFT_TIME : NORMAL_CRAFT_TIME;
  }

  function randomColor() {
    return COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
  }

  G.constants = {
    COLORS,
    COLOR_KEYS,
    SIZE,
    START_STEPS,
    NORMAL_CRAFT_TIME,
    HARD_CRAFT_TIME,
    LEADERBOARD_KEY,
    ANIMAL_MASKS
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
    randomColor
  };
})();
