// "Play Together" test: verifies that shared puzzle links are deterministic
// (two players opening the same link get the IDENTICAL crossword) and that
// invalid links fall back to the setup screen.
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const files = ["js/words.js", "js/generator.js", "js/game.js"].map((f) =>
  fs.readFileSync(path.join(__dirname, f), "utf8")
);

function load(url) {
  // Silence jsdom "Not implemented" notes (e.g. window.scrollTo) for clean output.
  const vc = new VirtualConsole();
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url, virtualConsole: vc });
  const { window } = dom;
  files.forEach((code) => {
    const s = window.document.createElement("script");
    s.textContent = code;
    window.document.body.appendChild(s);
  });
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  return dom;
}

function snapshot(doc) {
  return {
    gameShown: doc.getElementById("game-screen").hidden === false,
    banner: doc.getElementById("share-banner").hidden === false,
    theme: doc.getElementById("game-theme-label").textContent,
    level: doc.getElementById("game-level-label").textContent,
    cells: [...doc.querySelectorAll(".cell.in-word")].map((c) => c.dataset.key).join("|"),
    across: [...doc.querySelectorAll("#across-clues li")].map((li) => li.textContent).join("~"),
    down: [...doc.querySelectorAll("#down-clues li")].map((li) => li.textContent).join("~"),
  };
}

let failures = 0;
const check = (name, cond) => {
  console.log((cond ? "OK   " : "FAIL ") + name);
  if (!cond) failures++;
};

const LINK = "https://x.dev/?game=halloween-tricky-k3f9";
const d1 = load(LINK), d2 = load(LINK);
const a = snapshot(d1.window.document);
const b = snapshot(d2.window.document);

check("shared link starts the game directly", a.gameShown);
check("shared banner is shown", a.banner);
check("correct theme loaded from link", a.theme.includes("Halloween"));
check("correct level loaded from link", a.level.includes("Tricky"));
check("SAME link => identical grid for both players",
  a.cells === b.cells && a.across === b.across && a.down === b.down);

const c = snapshot(load("https://x.dev/?game=halloween-tricky-ZZZZ").window.document);
check("different seed => different puzzle", a.cells !== c.cells);

const e = snapshot(load("https://x.dev/?game=space-easy-k3f9").window.document);
check("different theme/level link loads correctly",
  e.gameShown && e.theme.includes("Outer Space") && e.level.includes("Easy"));

const bad = load("https://x.dev/?game=notreal-xx-1").window.document;
check("invalid link falls back to the setup screen", bad.getElementById("game-screen").hidden === true);

const none = load("https://x.dev/").window.document;
check("no link => normal setup screen", none.getElementById("game-screen").hidden === true);

console.log("\n----");
console.log(failures ? `${failures} FAILURES` : "All Play Together tests passed!");
process.exit(failures ? 1 : 0);
