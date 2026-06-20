/* ===========================================================
   Puzzle Pals — game logic
   Wires up theme/level selection, renders the crossword, handles
   typing, navigation, checking, hints, scoring, and the win flow.
   =========================================================== */

(function () {
  "use strict";

  // ---------- DOM helpers ----------
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  // ---------- Game state ----------
  const state = {
    theme: "regular",
    level: "easy",
    layout: null,
    // grid model: cellInfo["r,c"] = { letter, input, number, acrossClue, downClue }
    cells: {},
    cellEls: {},          // "r,c" -> DOM element
    activeKey: null,      // "r,c"
    dir: "across",        // current typing direction
    hintsLeft: 3,
    revealedKeys: new Set(),
    startTime: null,
    timerId: null,
    finished: false,
  };

  // ---------- Setup screen rendering ----------
  function renderThemePicker() {
    const grid = $("theme-grid");
    grid.innerHTML = "";
    Object.keys(THEMES).forEach((key) => {
      const t = THEMES[key];
      const card = el("button", "theme-card");
      card.type = "button";
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", key === state.theme ? "true" : "false");
      card.dataset.theme = key;
      card.innerHTML =
        `<span class="t-emoji">${t.emoji}</span>` +
        `<span class="t-name">${t.name}</span>` +
        `<span class="t-blurb">${t.blurb}</span>`;
      card.addEventListener("click", () => {
        state.theme = key;
        document.body.setAttribute("data-theme", key);
        [...grid.children].forEach((c) =>
          c.setAttribute("aria-checked", c.dataset.theme === key ? "true" : "false")
        );
      });
      grid.appendChild(card);
    });
  }

  function renderDifficultyPicker() {
    const row = $("difficulty-row");
    row.innerHTML = "";
    const descs = {
      easy: "Short words & simple clues",
      medium: "A little more thinking",
      tricky: "Longer words & riddles",
    };
    DIFFICULTIES.forEach((d) => {
      const card = el("button", "diff-card");
      card.type = "button";
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", d.id === state.level ? "true" : "false");
      card.dataset.level = d.id;
      card.innerHTML =
        `<div class="d-stars">${d.stars}</div>` +
        `<div class="d-label">${d.label}</div>` +
        `<div class="d-desc">${descs[d.id]}</div>`;
      card.addEventListener("click", () => {
        state.level = d.id;
        [...row.children].forEach((c) =>
          c.setAttribute("aria-checked", c.dataset.level === d.id ? "true" : "false")
        );
      });
      row.appendChild(card);
    });
  }

  // ---------- Build a puzzle ----------
  function buildPuzzle() {
    const pool = THEMES[state.theme].levels[state.level];
    const want = (DIFFICULTIES.find((d) => d.id === state.level) || {}).words || 7;
    let layout = null;
    // A few tries in case a rare attempt returns something tiny.
    for (let i = 0; i < 6 && !layout; i++) {
      const candidate = CrosswordGen.generate(pool, want);
      if (candidate && candidate.clues.length >= Math.min(want, 5)) layout = candidate;
      else if (candidate && (!layout || candidate.clues.length > layout.clues.length)) layout = candidate;
    }
    state.layout = layout;

    // Build the cell model.
    state.cells = {};
    state.revealedKeys = new Set();
    layout.clues.forEach((clue) => {
      const dr = clue.dir === "down" ? 1 : 0;
      const dc = clue.dir === "across" ? 1 : 0;
      for (let i = 0; i < clue.len; i++) {
        const r = clue.row + dr * i;
        const c = clue.col + dc * i;
        const key = r + "," + c;
        if (!state.cells[key]) {
          state.cells[key] = { letter: clue.answer[i], input: "", r, c };
        }
        if (i === 0) state.cells[key].number = clue.number;
        if (clue.dir === "across") state.cells[key].acrossClue = clue;
        else state.cells[key].downClue = clue;
      }
    });
  }

  // ---------- Render the crossword grid ----------
  function renderGrid() {
    const board = $("crossword");
    board.innerHTML = "";
    state.cellEls = {};
    const { rows, cols } = state.layout;
    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    // Pick a cell size that fits comfortably; CSS aspect-ratio keeps squares.
    const maxBoard = Math.min(window.innerWidth - 48, 560);
    const cellSize = Math.floor(Math.min(maxBoard / cols, 46));
    board.style.width = cellSize * cols + (cols - 1) * 2 + "px";

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = r + "," + c;
        const info = state.cells[key];
        if (!info) {
          board.appendChild(el("div", "cell block"));
          continue;
        }
        const cell = el("div", "cell in-word");
        cell.dataset.key = key;
        if (info.number) cell.appendChild(el("span", "cell-num", String(info.number)));
        const letterSpan = el("span", "cell-letter");
        cell.appendChild(letterSpan);
        cell.addEventListener("click", () => onCellClick(key));
        board.appendChild(cell);
        state.cellEls[key] = cell;
      }
    }
    refreshLetters();
  }

  function refreshLetters() {
    Object.keys(state.cellEls).forEach((key) => {
      const span = state.cellEls[key].querySelector(".cell-letter");
      span.textContent = state.cells[key].input || "";
    });
  }

  // ---------- Clue list rendering ----------
  function renderClues() {
    const across = $("across-clues");
    const down = $("down-clues");
    across.innerHTML = "";
    down.innerHTML = "";
    state.layout.clues.forEach((clue) => {
      const li = el("li");
      li.dataset.clue = clue.dir + ":" + clue.number;
      li.innerHTML = `<span class="cnum">${clue.number}.</span>${clue.clue}`;
      li.addEventListener("click", () => selectClue(clue));
      (clue.dir === "across" ? across : down).appendChild(li);
    });
  }

  // ---------- Selection / navigation ----------
  function clueKeys(clue) {
    const keys = [];
    const dr = clue.dir === "down" ? 1 : 0;
    const dc = clue.dir === "across" ? 1 : 0;
    for (let i = 0; i < clue.len; i++) {
      keys.push((clue.row + dr * i) + "," + (clue.col + dc * i));
    }
    return keys;
  }

  function activeClue() {
    const info = state.cells[state.activeKey];
    if (!info) return null;
    if (state.dir === "across" && info.acrossClue) return info.acrossClue;
    if (state.dir === "down" && info.downClue) return info.downClue;
    return info.acrossClue || info.downClue;
  }

  function onCellClick(key) {
    if (state.activeKey === key) {
      // Toggle direction if the cell belongs to both an across and a down word.
      const info = state.cells[key];
      if (info.acrossClue && info.downClue) {
        state.dir = state.dir === "across" ? "down" : "across";
      }
    } else {
      const info = state.cells[key];
      // Prefer a direction the cell actually participates in.
      if (state.dir === "across" && !info.acrossClue) state.dir = "down";
      if (state.dir === "down" && !info.downClue) state.dir = "across";
    }
    state.activeKey = key;
    focusInput();
    updateHighlight();
  }

  function selectClue(clue) {
    state.dir = clue.dir;
    state.activeKey = clue.row + "," + clue.col;
    focusInput();
    updateHighlight();
  }

  function updateHighlight() {
    // Clear
    Object.values(state.cellEls).forEach((c) => c.classList.remove("active"));
    document.querySelectorAll(".clue-list li").forEach((li) => li.classList.remove("active"));

    const clue = activeClue();
    if (clue) {
      clueKeys(clue).forEach((k) => state.cellEls[k] && state.cellEls[k].classList.add("active"));
      const li = document.querySelector(`.clue-list li[data-clue="${clue.dir}:${clue.number}"]`);
      if (li) {
        li.classList.add("active");
        if (typeof li.scrollIntoView === "function") {
          li.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
      $("current-clue").textContent =
        `${clue.number} ${clue.dir === "across" ? "Across →" : "Down ↓"}: ${clue.clue}`;
    }
    // Emphasize the single active cell.
    if (state.activeKey && state.cellEls[state.activeKey]) {
      state.cellEls[state.activeKey].classList.add("active");
    }
  }

  // ---------- Typing ----------
  function focusInput() {
    const input = $("hidden-input");
    input.value = "";
    // Focus without scrolling the page on mobile.
    input.focus({ preventScroll: true });
  }

  function typeLetter(ch) {
    if (!state.activeKey || state.finished) return;
    const info = state.cells[state.activeKey];
    if (!info) return;
    info.input = ch.toUpperCase();
    const cellEl = state.cellEls[state.activeKey];
    cellEl.querySelector(".cell-letter").textContent = info.input;
    cellEl.classList.remove("wrong", "correct");
    cellEl.classList.add("just-filled");
    setTimeout(() => cellEl.classList.remove("just-filled"), 250);
    advance(1);
    checkSolvedWords();
    maybeWin();
  }

  function backspace() {
    if (!state.activeKey || state.finished) return;
    const info = state.cells[state.activeKey];
    if (info.input) {
      info.input = "";
      state.cellEls[state.activeKey].querySelector(".cell-letter").textContent = "";
      state.cellEls[state.activeKey].classList.remove("wrong", "correct");
    } else {
      advance(-1);
      const prev = state.cells[state.activeKey];
      if (prev) {
        prev.input = "";
        state.cellEls[state.activeKey].querySelector(".cell-letter").textContent = "";
        state.cellEls[state.activeKey].classList.remove("wrong", "correct");
      }
    }
  }

  function advance(step) {
    const clue = activeClue();
    if (!clue) return;
    const keys = clueKeys(clue);
    let idx = keys.indexOf(state.activeKey);
    idx += step;
    if (idx >= 0 && idx < keys.length) {
      state.activeKey = keys[idx];
      updateHighlight();
    } else {
      // Stay on the last/first cell.
      updateHighlight();
    }
  }

  // ---------- Checking & solving ----------
  function checkSolvedWords() {
    state.layout.clues.forEach((clue) => {
      const keys = clueKeys(clue);
      const done = keys.every((k) => state.cells[k].input === state.cells[k].letter);
      const li = document.querySelector(`.clue-list li[data-clue="${clue.dir}:${clue.number}"]`);
      if (li) li.classList.toggle("done", done);
    });
    updateSolvedCount();
  }

  function updateSolvedCount() {
    const total = state.layout.clues.length;
    const solved = state.layout.clues.filter((clue) =>
      clueKeys(clue).every((k) => state.cells[k].input === state.cells[k].letter)
    ).length;
    $("solved-count").textContent = `${solved}/${total}`;
    return { solved, total };
  }

  // "Check" button: mark right/wrong on filled cells.
  function checkAnswers() {
    let anyWrong = false;
    Object.keys(state.cells).forEach((key) => {
      const info = state.cells[key];
      const cellEl = state.cellEls[key];
      cellEl.classList.remove("correct", "wrong");
      if (!info.input) return;
      if (info.input === info.letter) {
        cellEl.classList.add("correct");
      } else {
        cellEl.classList.add("wrong");
        anyWrong = true;
      }
    });
    if (!anyWrong) {
      $("current-clue").textContent = "Looking great — every letter you filled is correct! 🌟";
    } else {
      $("current-clue").textContent = "Some letters are off — the red ones need another try!";
    }
    // Remove correct tint after a moment so it isn't permanent.
    setTimeout(() => {
      Object.values(state.cellEls).forEach((c) => c.classList.remove("correct", "wrong"));
    }, 1500);
  }

  // ---------- Hints & reveal ----------
  function useHint() {
    if (state.hintsLeft <= 0 || state.finished) {
      $("current-clue").textContent = "No hints left — you can do it! 💪";
      return;
    }
    const clue = activeClue();
    if (!clue) {
      $("current-clue").textContent = "Tap a word first, then I can reveal a letter.";
      return;
    }
    // Find first empty or wrong cell in the active word.
    const target = clueKeys(clue).find(
      (k) => state.cells[k].input !== state.cells[k].letter
    );
    if (!target) {
      $("current-clue").textContent = "That word is already solved! 🎉";
      return;
    }
    revealCell(target);
    state.hintsLeft--;
    $("hints-left").textContent = state.hintsLeft;
    checkSolvedWords();
    maybeWin();
  }

  function revealCell(key) {
    const info = state.cells[key];
    info.input = info.letter;
    state.revealedKeys.add(key);
    const cellEl = state.cellEls[key];
    cellEl.querySelector(".cell-letter").textContent = info.letter;
    cellEl.classList.add("just-filled");
    setTimeout(() => cellEl.classList.remove("just-filled"), 250);
  }

  function revealWord() {
    const clue = activeClue();
    if (!clue) {
      $("current-clue").textContent = "Tap a word first to reveal it.";
      return;
    }
    clueKeys(clue).forEach((k) => {
      if (state.cells[k].input !== state.cells[k].letter) {
        revealCell(k);
      }
    });
    checkSolvedWords();
    maybeWin();
  }

  // ---------- Win flow ----------
  function maybeWin() {
    const { solved, total } = updateSolvedCount();
    if (solved === total && !state.finished) {
      finishGame();
    }
  }

  function finishGame() {
    state.finished = true;
    stopTimer();
    const seconds = elapsedSeconds();

    // Score: base per word, time bonus, minus hints/reveals used.
    const totalCells = Object.keys(state.cells).length;
    const revealed = state.revealedKeys.size;
    const earnedCells = totalCells - revealed;
    const base = earnedCells * 100;
    const timeBonus = Math.max(0, 600 - seconds * 2);
    const score = Math.max(0, Math.round(base + timeBonus));

    // Stars based on how much help was used relative to puzzle size.
    let stars = "⭐⭐⭐";
    const helpRatio = revealed / totalCells;
    if (helpRatio > 0.35) stars = "⭐";
    else if (helpRatio > 0.1) stars = "⭐⭐";

    $("win-time").textContent = formatTime(seconds);
    $("win-score").textContent = score;
    $("win-stars").textContent = stars;
    $("win-message").textContent = winMessage(state.theme, revealed);
    spawnConfetti();
    $("win-modal").hidden = false;
  }

  function winMessage(theme, revealed) {
    const cheers = {
      regular: "Brilliant work, word wizard!",
      halloween: "Spook-tacular solving! 🎃",
      valentines: "You filled it with love! 💖",
      christmas: "Ho ho ho — puzzle unwrapped! 🎁",
      space: "Out of this world! 🚀",
      ocean: "Fin-tastic job! 🐠",
      jungle: "Wildly well done! 🦁",
    };
    let msg = cheers[theme] || "Awesome job!";
    if (revealed === 0) msg += " You solved every square all by yourself!";
    return msg;
  }

  function spawnConfetti() {
    const box = document.querySelector("#win-modal .confetti");
    box.innerHTML = "";
    const colors = ["#ff4d8d", "#ffd166", "#06d6a0", "#3b82f6", "#ff7a18", "#7c5cff"];
    for (let i = 0; i < 40; i++) {
      const piece = el("i");
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = Math.random() * 1.5 + "s";
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.appendChild(piece);
    }
  }

  // ---------- Timer ----------
  function startTimer() {
    state.startTime = Date.now();
    stopTimer();
    state.timerId = setInterval(() => {
      $("timer").textContent = formatTime(elapsedSeconds());
    }, 1000);
  }
  function stopTimer() { if (state.timerId) clearInterval(state.timerId); state.timerId = null; }
  function elapsedSeconds() { return state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0; }
  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  // ---------- Screen switching ----------
  function startGame() {
    buildPuzzle();
    if (!state.layout) {
      alert("Oops! Could not build a puzzle. Please try another theme or level.");
      return;
    }
    state.finished = false;
    state.hintsLeft = 3;
    state.activeKey = null;
    state.dir = "across";
    $("hints-left").textContent = state.hintsLeft;

    const themeData = THEMES[state.theme];
    const diff = DIFFICULTIES.find((d) => d.id === state.level);
    $("game-theme-label").textContent = `${themeData.emoji} ${themeData.name}`;
    $("game-level-label").textContent = `${diff.stars} ${diff.label}`;

    renderGrid();
    renderClues();
    updateSolvedCount();

    $("setup-screen").hidden = true;
    $("game-screen").hidden = false;

    // Auto-select the first clue.
    selectClue(state.layout.clues[0]);
    startTimer();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToMenu() {
    stopTimer();
    $("game-screen").hidden = true;
    $("setup-screen").hidden = false;
  }

  // ---------- Input wiring ----------
  function wireInput() {
    const input = $("hidden-input");

    // Physical keyboard (desktop).
    document.addEventListener("keydown", (e) => {
      if ($("game-screen").hidden) return;
      if ($("win-modal").hidden === false) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        typeLetter(e.key);
        e.preventDefault();
      } else if (e.key === "Backspace") {
        backspace();
        e.preventDefault();
      } else if (e.key === "ArrowRight") { moveCursor(0, 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { moveCursor(0, -1); e.preventDefault(); }
      else if (e.key === "ArrowDown") { moveCursor(1, 0); e.preventDefault(); }
      else if (e.key === "ArrowUp") { moveCursor(-1, 0); e.preventDefault(); }
      else if (e.key === "Tab") { jumpToNextClue(e.shiftKey ? -1 : 1); e.preventDefault(); }
    });

    // Mobile / soft keyboard via hidden input.
    input.addEventListener("input", () => {
      const v = input.value;
      const last = v.slice(-1);
      if (/[a-zA-Z]/.test(last)) typeLetter(last);
      input.value = "";
    });
  }

  function moveCursor(dr, dc) {
    if (!state.activeKey) return;
    // Set direction based on movement.
    if (dr !== 0) state.dir = "down";
    if (dc !== 0) state.dir = "across";
    const [r, c] = state.activeKey.split(",").map(Number);
    let nr = r + dr, nc = c + dc;
    // Skip over blocks until a playable cell is found (within a few steps).
    for (let i = 0; i < 30; i++) {
      const k = nr + "," + nc;
      if (state.cells[k]) { state.activeKey = k; updateHighlight(); return; }
      nr += dr; nc += dc;
      if (nr < 0 || nc < 0 || nr > 60 || nc > 60) break;
    }
  }

  function jumpToNextClue(step) {
    const clues = state.layout.clues;
    const cur = activeClue();
    let idx = cur ? clues.findIndex((c) => c.dir === cur.dir && c.number === cur.number) : -1;
    idx = (idx + step + clues.length) % clues.length;
    selectClue(clues[idx]);
  }

  // ---------- Buttons ----------
  function wireButtons() {
    $("start-btn").addEventListener("click", startGame);
    $("back-btn").addEventListener("click", backToMenu);
    $("check-btn").addEventListener("click", checkAnswers);
    $("hint-btn").addEventListener("click", useHint);
    $("reveal-btn").addEventListener("click", revealWord);
    $("new-btn").addEventListener("click", startGame);
    $("play-again-btn").addEventListener("click", () => {
      $("win-modal").hidden = true;
      startGame();
    });
    $("menu-btn").addEventListener("click", () => {
      $("win-modal").hidden = true;
      backToMenu();
    });
    // Keep the board tappable -> refocus hidden input.
    $("crossword").addEventListener("click", () => focusInput());
  }

  // ---------- Init ----------
  function init() {
    document.body.setAttribute("data-theme", state.theme);
    renderThemePicker();
    renderDifficultyPicker();
    wireButtons();
    wireInput();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
