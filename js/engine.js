(() => {
  const G = window.BeanGame;
  const { COLLECT_SIZE } = G.constants;

  function getSize(board) {
    return board.length;
  }

  function swap(board, a, b) {
    const t = board[a.r][a.c];
    board[a.r][a.c] = board[b.r][b.c];
    board[b.r][b.c] = t;
  }

  function findMatches(board) {
    const size = getSize(board);
    const mark = new Set();

    for (let r = 0; r < size; r += 1) {
      let run = 1;
      for (let c = 1; c <= size; c += 1) {
        if (c < size && board[r][c] === board[r][c - 1]) run += 1;
        else {
          if (run >= 3) for (let k = 0; k < run; k += 1) mark.add(`${r},${c - 1 - k}`);
          run = 1;
        }
      }
    }

    for (let c = 0; c < size; c += 1) {
      let run = 1;
      for (let r = 1; r <= size; r += 1) {
        if (r < size && board[r][c] === board[r - 1][c]) run += 1;
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
    const size = getSize(board);
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (c + 1 < size) {
          swap(board, { r, c }, { r, c: c + 1 });
          const ok = findMatches(board).length > 0;
          swap(board, { r, c }, { r, c: c + 1 });
          if (ok) return true;
        }
        if (r + 1 < size) {
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
    let b = Array.from({ length: COLLECT_SIZE }, () => Array.from({ length: COLLECT_SIZE }, randomColor));
    while (findMatches(b).length > 0 || !hasAnyMove(b)) {
      b = Array.from({ length: COLLECT_SIZE }, () => Array.from({ length: COLLECT_SIZE }, randomColor));
    }
    return b;
  }

  function collapse(board, specials) {
    const randomColor = G.utils.randomColor;
    const size = getSize(board);
    const fx = Array.from({ length: size }, () => Array(size).fill(0));
    for (let c = 0; c < size; c += 1) {
      let write = size - 1;
      for (let read = size - 1; read >= 0; read -= 1) {
        if (!board[read][c]) continue;
        const color = board[read][c];
        const special = specials ? specials[read][c] : null;
        board[read][c] = null;
        if (specials) specials[read][c] = null;
        board[write][c] = color;
        if (specials) specials[write][c] = special;
        fx[write][c] = Math.max(write - read, 0);
        write -= 1;
      }
      while (write >= 0) {
        board[write][c] = randomColor();
        if (specials) specials[write][c] = null;
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
    for (let r = 0; r < app.targetMap.length; r += 1) {
      for (let c = 0; c < app.targetMap.length; c += 1) {
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
