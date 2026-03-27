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
  const HISTORY_KEY = "bean_game_gallery_v1";

  function parseArt(lines) {
    const width = lines.reduce((max, line) => Math.max(max, line.length), 0);
    return lines.map((line) => line.padEnd(width, ".").slice(0, width).split(""));
  }

  const BASE_MASKS = [
    {
      name: "企鹅仔",
      art: parseArt([
        "......0000......",
        "....00111100....",
        "...0111111110...",
        "..011440044110..",
        "..011440044110..",
        "..011133331110..",
        "..011111111110..",
        "..011122221110..",
        "..011222222110..",
        ".00112222221100.",
        ".01112222221110.",
        ".01111222211110.",
        "..011111111110..",
        "...0011111100...",
        "....00300300....",
        ".....000000....."
      ])
    },
    {
      name: "猫咪",
      art: parseArt([
        ".....000000.....",
        "...0001111000...",
        "..001111111100..",
        "..011440044110..",
        ".01114444444110.",
        ".01111111111110.",
        ".01112222221110.",
        ".01112222221110.",
        ".01112222221110.",
        ".01111111111110.",
        "..011133333110..",
        "..011033333110..",
        "...0110..0110...",
        "...010....010...",
        "...000....000...",
        "................"
      ])
    },
    {
      name: "兔兔",
      art: parseArt([
        "....00....00....",
        "...0110..0110...",
        "...0110..0110...",
        "..001110011100..",
        "..011111111110..",
        ".0114400444110..",
        ".0111144441110..",
        ".0111222222110..",
        ".0111222222110..",
        ".0111222222110..",
        ".0111111111110..",
        "..011133331110..",
        "..001133331100..",
        "...0110..0110...",
        "...000....000...",
        "................"
      ])
    },
    {
      name: "小龟",
      art: parseArt([
        "................",
        "...0000000000...",
        "..011111111110..",
        ".01111111111110.",
        ".01112222111110.",
        ".01112222111110.",
        ".01111111111110.",
        ".01111222111110.",
        ".01111222111110.",
        ".01111111111110.",
        "..011111111110..",
        "..0011001100....",
        "...0100..0010...",
        "...000....000...",
        "................",
        "................"
      ])
    },
    {
      name: "小狐",
      art: parseArt([
        "....00....00....",
        "...0110..0110...",
        "..011111111110..",
        ".01144004441110.",
        ".01114444441110.",
        ".01113333331110.",
        ".01112222221110.",
        ".01112222221110.",
        ".01112222221110.",
        ".01111111111110.",
        "..011111111110..",
        "..011100001110..",
        "...0110001110...",
        "...0011111100...",
        "....00111100....",
        "......0000......"
      ])
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
    const sizes = [8, 10, 12, 16, 24, 32, 40, 48, 56, 64];
    return sizes[Math.min(sizes.length - 1, Math.floor((level - 1) / 2))];
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
    collectTargets: Array.from({ length: COLLECT_SIZE }, () => Array(COLLECT_SIZE).fill(false)),
    collectTargetStates: Array.from({ length: COLLECT_SIZE }, () => Array(COLLECT_SIZE).fill(null)),
    selected: null,
    needed: {},
    collected: {},
    completedGoals: {},
    resources: {},
    placed: [],
    activeColor: null,
    showcaseIndex: 0,
    showcaseBatch: 1,
    showcaseTimer: null,
    showcaseStage: "idle",
    showcaseSequence: [],
    showcaseRecent: [],
    levelTransitionTimer: null,
    introOverlayTimer: null,
    storageWarned: false,
    comboChain: 0,
    comboTimer: null,
    celebrationTimer: null,
    locked: false,
    paused: false,
    drag: null,
    shuffleCharges: 1,
    staleTurns: 0,
    hintMove: null,
    targetRuleWarned: false
  };

  const refs = {
    board: document.getElementById("board"),
    craftGrid: document.getElementById("craftGrid"),
    craftReference: document.getElementById("craftReference"),
    craftPreviewTitle: document.getElementById("craftPreviewTitle"),
    craftPreviewText: document.getElementById("craftPreviewText"),
    craftPreviewHint: document.getElementById("craftPreviewHint"),
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
    resultCompare: document.getElementById("resultCompare"),
    answerGrid: document.getElementById("answerGrid"),
    attemptGrid: document.getElementById("attemptGrid"),
    introTitle: document.getElementById("introTitle"),
    introDesc: document.getElementById("introDesc"),
    startLayer: document.getElementById("startLayer"),
    startGameBtn: document.getElementById("startGameBtn"),
    historyBtn: document.getElementById("historyBtn"),
    historyLayer: document.getElementById("historyLayer"),
    historyList: document.getElementById("historyList"),
    closeHistoryBtn: document.getElementById("closeHistoryBtn"),
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
    shuffleBtn: document.getElementById("shuffleBtn"),
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

  function pickPaletteForAnimal(name, level) {
    const palettes = {
      "企鹅仔": [
        ["purple", "blue", "yellow", "red", "green"],
        ["blue", "purple", "yellow", "red", "green"]
      ],
      "猫咪": [
        ["purple", "yellow", "blue", "red", "green"],
        ["blue", "yellow", "purple", "red", "green"]
      ],
      "兔兔": [
        ["purple", "blue", "yellow", "red", "green"],
        ["blue", "purple", "yellow", "red", "green"]
      ],
      "小龟": [
        ["green", "yellow", "blue", "purple", "red"],
        ["blue", "green", "yellow", "purple", "red"]
      ],
      "小狐": [
        ["red", "yellow", "purple", "blue", "green"],
        ["yellow", "red", "purple", "blue", "green"]
      ]
    };
    const set = palettes[name] || [COLOR_KEYS];
    return set[level % set.length].slice(0, 5);
  }

  function buildMapFromArt(art, palette) {
    return art.map((row) =>
      row.map((token) => {
        if (token === ".") return null;
        const colorIndex = Math.max(0, Math.min(palette.length - 1, Number(token) || 0));
        return palette[colorIndex];
      })
    );
  }

  function generateTargetMap(level) {
    const animal = pickAnimal();
    const targetSize = chooseCraftSize(level);
    const palette = pickPaletteForAnimal(animal.name, level);
    const art = resizeMask(animal.art, targetSize);
    const map = buildMapFromArt(art, palette);
    return { map, animalName: animal.name, size: targetSize };
  }

  function initNeeded(targetMap, level = 1, hardLevel = false) {
    const needed = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
    const counts = { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
    let filled = 0;
    targetMap.forEach((row) => {
      row.forEach((c) => {
        if (!c) return;
        counts[c] += 1;
        filled += 1;
      });
    });
    const activeColors = COLOR_KEYS.filter((color) => counts[color] > 0);
    const size = targetMap.length;
    const sizeNeedBase = Math.round(18 + size * 2.4);
    const levelNeedBoost = Math.min(42, level * 2);
    const totalNeed = Math.min(240, sizeNeedBase + levelNeedBoost + (hardLevel ? 12 : 0));
    let assigned = 0;
    activeColors.forEach((color, index) => {
      const remainColors = activeColors.length - index - 1;
      const weighted = Math.max(5, Math.round((counts[color] / filled) * totalNeed));
      const maxAllowed = totalNeed - assigned - remainColors * 5;
      needed[color] = Math.max(5, Math.min(weighted, maxAllowed));
      assigned += needed[color];
    });
    return needed;
  }

  function levelStepLimit(level) {
    return START_STEPS + Math.min(10, Math.floor((level - 1) / 2));
  }

  function levelShowcaseDuration(targetMap, hardLevel = false) {
    const gridSize = targetMap.length;
    const base = 1200 + Math.max(0, gridSize - 8) * 42;
    return base + (hardLevel ? 260 : 0);
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
    HISTORY_KEY,
    ANIMAL_MASKS: BASE_MASKS
  };

  G.app = app;
  G.refs = refs;
  G.utils = {
    shuffle,
    isHardLevel,
    pickAnimal,
    generateTargetMap,
    resizeMask,
    initNeeded,
    levelStepLimit,
    levelShowcaseDuration,
    randomColor,
    chooseCraftSize
  };
})();
