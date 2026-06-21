# 🧩 Puzzle Pals — Crossword Adventures

A fun, colorful, and *tricky-in-the-right-ways* crossword game built for kids in
**grade 6 and below**. Pick a theme, choose a difficulty, and solve a freshly
generated puzzle every time!

It's a **100% static web app** (plain HTML, CSS, and vanilla JavaScript) — no
build step, no server, no dependencies to ship. Just open it and play.

## ✨ Features

- **7 playful themes**, each with its own colors and decorations:
  - ✏️ Everyday · 🎃 Halloween · 💝 Valentine's Day · 🎄 Christmas · 🚀 Outer Space · 🐠 Under the Sea · 🦁 Jungle Safari
- **3 difficulty levels** tuned for young solvers:
  - ⭐ Easy — short words & direct clues
  - ⭐⭐ Medium — a little more thinking
  - ⭐⭐⭐ Tricky — longer words & riddle-style clues
- **Auto-generated puzzles** — the crossword layout is built fresh each game, so
  no two puzzles are exactly the same. Tap **🔀 New** for another one.
- **Kid-friendly help**: a **Check** button, **💡 Hints** (reveal one letter),
  and **Reveal Word** so nobody gets stuck and frustrated.
- **Timer, score, and star rating** with a celebratory confetti win screen.
- **🤝 Play Together** — share a link and a friend gets the *exact same puzzle*
  on their own device, so you can both solve it and compare your time and score.
- **Works on phones, tablets, and computers** — tap a square and type using your
  device's keyboard, or use a physical keyboard with arrow keys and Tab.

## 🤝 Play Together (shared puzzles)

Want to play the same crossword as a friend? In any puzzle, tap
**🤝 Play Together** (also offered on the win screen) to get a shareable link
like:

```
https://your-site.example/?game=halloween-tricky-k3f9
```

Anyone who opens that link gets the **identical** grid and clues — the puzzle is
generated deterministically from the `theme-level-seed` in the URL, so no server
is needed. Each player solves on their own device; then compare your times,
scores, and stars. Great for siblings or classmates racing each other!

## ▶️ How to play

1. Choose a **theme** and a **level** on the start screen, then press **Start Puzzle**.
2. Tap any square (or a clue) to select a word. Tap a square again to switch
   between the Across and Down word that crosses it.
3. Type letters. The cursor moves along the word automatically.
4. Use **Check** to see which letters are right, **💡 Hint** to reveal a single
   letter, or **Reveal Word** if you're really stuck.
5. Fill every square correctly to win and earn your stars! 🌟

## 🚀 Run it locally

Because it's a static site, you can open `index.html` directly in a browser.
For the cleanest experience (so the browser loads the JS files happily), serve
it from a tiny local server:

```bash
# Option A: Python (built in on most systems)
python3 -m http.server 8080
# then visit http://localhost:8080

# Option B: Node
npx serve .
```

## 🌐 Deploy it (pick any — all are free & easy)

This app is just files, so deployment is effortless:

- **GitHub Pages**: push this repo, then in *Settings → Pages* choose your branch
  and the root (`/`) folder. Your game goes live at
  `https://<your-username>.github.io/<repo>/`.
- **Netlify**: drag-and-drop this folder onto <https://app.netlify.com/drop>, or
  connect the repo (no build command needed; publish directory is the root).
- **Vercel**: import the repo — it auto-detects a static site, no config needed.
- **Cloudflare Pages**: connect the repo, leave the build command empty, set the
  output directory to `/`.

## 🧪 Tests

Automated tests use [jsdom](https://github.com/jsdom/jsdom) to load the real page
and play through every theme/level — both by revealing words and by simulating a
player typing answers on the keyboard.

```bash
npm install   # installs the jsdom dev dependency
npm test
```

## 🗂️ Project structure

```
.
├── index.html          # App shell (setup screen, game screen, win modal)
├── css/
│   └── styles.css       # Theme palettes, grid, buttons, animations
├── js/
│   ├── words.js         # Word banks: themes × difficulty, with clues
│   ├── generator.js     # Crossword layout generator (interlocks words)
│   └── game.js          # Game logic: rendering, input, hints, scoring, win
├── test-integration.js  # jsdom test: solve via Reveal for all puzzles
└── test-typing.js       # jsdom test: solve by typing for all puzzles
```

## 🔧 Adding more words or themes

Open `js/words.js`. Each theme has `easy`, `medium`, and `tricky` lists of
`{ a: "ANSWER", c: "clue" }` entries. Add new entries (uppercase letters only,
no spaces), or copy a theme block to create a brand-new theme. The generator and
UI pick everything up automatically.

---

Made with care for curious kids. Learn & have fun! 🌟
