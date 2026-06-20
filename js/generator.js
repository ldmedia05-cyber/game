/*
 * Crossword layout generator.
 *
 * Takes a list of { a: ANSWER, c: clue } entries and arranges the words on a
 * grid so they interlock at shared letters, just like a real crossword.
 *
 * Strategy:
 *   1. Shuffle + sort candidate words (longest first tends to interlock best).
 *   2. Place the first word horizontally near the origin.
 *   3. For every other word, scan all placed letters for a matching letter and
 *      try to cross there (perpendicular direction). Validate that the
 *      placement does not collide or illegally touch other words.
 *   4. Keep the placement with the most crossings.
 *   5. Run several attempts and return the layout that places the most words.
 *
 * The result is normalized to a tight grid with numbered clue starts.
 */

(function (global) {
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // A single attempt at building a layout from the given entries.
  // Stops once `maxWords` have been placed.
  function buildAttempt(entries, maxWords) {
    // grid: Map "r,c" -> { ch, words: Set }
    const cells = new Map();
    const placed = []; // { answer, clue, row, col, dir, len }

    const key = (r, c) => r + "," + c;

    function getCell(r, c) {
      return cells.get(key(r, c));
    }

    // Can `word` be placed at (row,col) going dir without breaking rules?
    // dir: "across" or "down". Returns number of crossings, or -1 if invalid.
    function canPlace(word, row, col, dir) {
      let crossings = 0;
      const dr = dir === "down" ? 1 : 0;
      const dc = dir === "across" ? 1 : 0;

      // Cell immediately before the word must be empty.
      const beforeR = row - dr;
      const beforeC = col - dc;
      if (getCell(beforeR, beforeC)) return -1;

      // Cell immediately after the word must be empty.
      const afterR = row + dr * word.length;
      const afterC = col + dc * word.length;
      if (getCell(afterR, afterC)) return -1;

      for (let i = 0; i < word.length; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        const existing = getCell(r, c);

        if (existing) {
          // Must match the letter to cross here.
          if (existing.ch !== word[i]) return -1;
          crossings++;
          // A crossing is fine; neighbors checked below are allowed at a cross.
        } else {
          // Empty cell: the two side neighbors (perpendicular) must be empty,
          // otherwise the new word would illegally run alongside another word.
          if (dir === "across") {
            if (getCell(r - 1, c) || getCell(r + 1, c)) return -1;
          } else {
            if (getCell(r, c - 1) || getCell(r, c + 1)) return -1;
          }
        }
      }
      return crossings;
    }

    function commit(word, clue, row, col, dir) {
      const dr = dir === "down" ? 1 : 0;
      const dc = dir === "across" ? 1 : 0;
      for (let i = 0; i < word.length; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        const k = key(r, c);
        if (!cells.has(k)) cells.set(k, { ch: word[i] });
      }
      placed.push({ answer: word, clue, row, col, dir, len: word.length });
    }

    entries.forEach((entry, idx) => {
      if (placed.length >= maxWords) return;
      const word = entry.a;
      if (idx === 0) {
        commit(word, entry.c, 0, 0, "across");
        return;
      }

      let best = null; // { row, col, dir, crossings }

      // Try crossing at every placed cell that shares a letter.
      for (let li = 0; li < word.length; li++) {
        const letter = word[li];
        for (const [k, cell] of cells) {
          if (cell.ch !== letter) continue;
          const [cr, cc] = k.split(",").map(Number);

          // Try placing the new word DOWN through this cell.
          let row = cr - li;
          let col = cc;
          let cross = canPlace(word, row, col, "down");
          if (cross > 0 && (!best || cross > best.crossings)) {
            best = { row, col, dir: "down", crossings: cross };
          }

          // Try placing the new word ACROSS through this cell.
          row = cr;
          col = cc - li;
          cross = canPlace(word, row, col, "across");
          if (cross > 0 && (!best || cross > best.crossings)) {
            best = { row, col, dir: "across", crossings: cross };
          }
        }
      }

      if (best) commit(word, entry.c, best.row, best.col, best.dir);
    });

    return placed;
  }

  // Normalize placed words into a tight numbered grid.
  function normalize(placed) {
    let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
    placed.forEach((p) => {
      const dr = p.dir === "down" ? 1 : 0;
      const dc = p.dir === "across" ? 1 : 0;
      const endR = p.row + dr * (p.len - 1);
      const endC = p.col + dc * (p.len - 1);
      minR = Math.min(minR, p.row, endR);
      minC = Math.min(minC, p.col, endC);
      maxR = Math.max(maxR, p.row, endR);
      maxC = Math.max(maxC, p.col, endC);
    });

    const rows = maxR - minR + 1;
    const cols = maxC - minC + 1;

    // Build the solution grid + which cells are used.
    const grid = []; // grid[r][c] = letter or null
    for (let r = 0; r < rows; r++) grid.push(new Array(cols).fill(null));

    const shifted = placed.map((p) => ({
      ...p,
      row: p.row - minR,
      col: p.col - minC,
    }));

    shifted.forEach((p) => {
      const dr = p.dir === "down" ? 1 : 0;
      const dc = p.dir === "across" ? 1 : 0;
      for (let i = 0; i < p.len; i++) {
        grid[p.row + dr * i][p.col + dc * i] = p.answer[i];
      }
    });

    // Assign numbers to clue starts. A cell gets a number if a word starts there.
    const numberAt = {}; // "r,c" -> number
    let counter = 0;
    // Number in reading order (top-to-bottom, left-to-right) like real puzzles.
    const startCells = new Set();
    shifted.forEach((p) => startCells.add(p.row + "," + p.col));

    const orderedStarts = Array.from(startCells)
      .map((k) => k.split(",").map(Number))
      .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));

    orderedStarts.forEach(([r, c]) => {
      counter++;
      numberAt[r + "," + c] = counter;
    });

    const clues = shifted.map((p) => ({
      number: numberAt[p.row + "," + p.col],
      answer: p.answer,
      clue: p.clue,
      row: p.row,
      col: p.col,
      dir: p.dir,
      len: p.len,
    }));

    clues.sort((a, b) => (a.number - b.number));

    return { rows, cols, grid, numberAt, clues };
  }

  // Public: generate the best layout from a pool of entries.
  // wantCount = how many words we aim to include.
  function generate(pool, wantCount) {
    let best = null;
    const attempts = 25;

    for (let t = 0; t < attempts; t++) {
      // Pick a working set of the desired size, then prefer longer words first
      // for the seed so they interlock well.
      const shuffled = shuffle(pool);
      const sorted = shuffled
        .slice(0, Math.min(pool.length, wantCount + 3))
        .sort((a, b) => b.a.length - a.a.length);

      const placed = buildAttempt(sorted, wantCount);
      if (placed.length < 2) continue;

      const layout = normalize(placed);
      const longest = Math.max(layout.rows, layout.cols);
      const area = layout.rows * layout.cols;
      // Score: maximize words placed, then prefer compact, balanced grids.
      const score = placed.length * 1000 - area - longest * 5;

      if (!best || score > best.score) {
        best = { score, layout, count: placed.length };
      }

      // Good enough early exit: most words placed in a compact grid.
      if (placed.length >= wantCount && longest <= 15) {
        break;
      }
    }

    return best ? best.layout : null;
  }

  const api = { generate };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.CrosswordGen = api;
})(typeof window !== "undefined" ? window : globalThis);
