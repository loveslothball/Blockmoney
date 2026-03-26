(() => {
  const G = window.BeanGame;
  const { SIZE } = G.constants;

  function swap(board, a, b) {
    const t = board[a.r][a.c];
    board[a.r][a.c] = board[b.r][b.c];
    board[b.r][b.c] = t;
  }

  function findMatches(board) {
    const mark = new Set();

    for (let r = 0; r < SIZE; r += 1) {
      let run = 1;
      for (let c = 1; c <= SIZE; c += 1) {
        if (c < SIZE && board[r][c] === board[r][c - 1]) run += 1;
        else {
          if (run >= 3) for (let k = 0; k < run; k += 1) mark.add(`${r},${c - 1 - k}`);
          run = 1;
        }
      }
    }

    for (let c = 0; c < SIZE; c += 1) {
      let run = 1;
      for (let r = 1; r <= SIZE; r += 1) {
        if (r < SIZE && board[r][c] === board[r - 1][c]) run += 1;
        else {
          if (run >= 3) for (let k = 0; k < run; k += 1) mark.add(`${r - 1 - k},${c}`);
          run = 1;
        }
      }
    }

    return Array.from(mark).map((s) => {
      const [r, c] = s.split(",").map(Number);
      return { r, c };
    });
  }

  function hasAnyMove(board) {
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (c + 1 < SIZE) {
          swap(board, { r, c }, { r, c: c + 1 });
          const ok = findMatches(board).length > 0;
          swap(board, { r, c }, { r, c: c + 1 });
          if (ok) return true;
        }
        if (r + 1 < SIZE) {
          swap(board, { r, c }, { r: r + 1, c });
          const ok = findMatches(board).length > 0;
          swap(board, { r, c }, { r: r + 1, c });
          if (ok) return true;
        }
      }
    }
    return false;
  }

  function createBoard() {
    const randomColor = G.utils.randomColor;
    let b = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, randomColor));
    while (findMatches(b).length > 0 || !hasAnyMove(b)) {
      b = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, randomColor));
    }
    return b;
  }

  function collapse(board) {
    const randomColor = G.utils.randomColor;
    const fx = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    for (let c = 0; c < SIZE; c += 1) {
      let write = SIZE - 1;
      for (let read = SIZE - 1; read >= 0; read -= 1) {
        if (!board[read][c]) continue;
        const color = board[read][c];
        board[read][c] = null;
        board[write][c] = color;
        fx[write][c] = Math.max(write - read, 0);
        write -= 1;
      }
      while (write >= 0) {
        board[write][c] = randomColor();
        fx[write][c] = write + 1;
        write -= 1;
      }
    }
    return fx;
  }

  function isCollectDone(app) {
    const { COLOR_KEYS } = G.constants;
    return COLOR_KEYS.every((k) => app.collected[k] >= app.needed[k]);
  }

  function isCraftDone(app) {
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (app.targetMap[r][c] && app.placed[r][c] !== app.targetMap[r][c]) return false;
      }
    }
    return true;
  }

  G.engine = {
    swap,
    findMatches,
    hasAnyMove,
    createBoard,
    collapse,
    isCollectDone,
    isCraftDone
  };
})();
