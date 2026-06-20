// Integration test: load the real index.html + scripts in jsdom, then
// simulate playing a full game for every theme/level and confirm the win modal.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

const themes = ["regular", "halloween", "valentines", "christmas", "space", "ocean", "jungle"];
const levels = ["easy", "medium", "tricky"];

let failures = 0;
let count = 0;

async function runOne(theme, level) {
  count++;
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true });
  const { window } = dom;

  // Inject scripts manually so we control execution order.
  ["js/words.js", "js/generator.js", "js/game.js"].forEach((f) => {
    const code = fs.readFileSync(path.join(__dirname, f), "utf8");
    const scriptEl = window.document.createElement("script");
    scriptEl.textContent = code;
    window.document.body.appendChild(scriptEl);
  });

  // Fire DOMContentLoaded so init() runs.
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));

  const doc = window.document;

  // Select theme + level.
  doc.querySelector(`.theme-card[data-theme="${theme}"]`).click();
  doc.querySelector(`.diff-card[data-level="${level}"]`).click();
  doc.getElementById("start-btn").click();

  if (doc.getElementById("game-screen").hidden) {
    console.log(`FAIL ${theme}/${level}: game screen did not show`);
    failures++; return;
  }

  // Read the solution from the rendered cells via the state. We can't access
  // closure state directly, so reconstruct from clue list + grid letters by
  // simulating typing using the known answers from THEMES is not possible
  // (generator picks subset). Instead, type letters using keydown events by
  // selecting each clue and typing its answer — but we need the answer text.
  // The clue <li> only has the clue text. So instead, we reveal every word.
  const cells = doc.querySelectorAll(".cell.in-word");
  const total = doc.querySelectorAll(".clue-list li").length;

  // Strategy: click each clue, then press Reveal Word for each.
  const acrossLis = doc.querySelectorAll("#across-clues li");
  const downLis = doc.querySelectorAll("#down-clues li");
  [...acrossLis, ...downLis].forEach((li) => {
    li.click();
    doc.getElementById("reveal-btn").click();
  });

  const solvedText = doc.getElementById("solved-count").textContent;
  const winShown = doc.getElementById("win-modal").hidden === false;

  if (!winShown) {
    console.log(`FAIL ${theme}/${level}: win modal not shown (solved ${solvedText})`);
    failures++; return;
  }
  const [s, t] = solvedText.split("/").map(Number);
  if (s !== t || t < 1) {
    console.log(`FAIL ${theme}/${level}: solved mismatch ${solvedText}`);
    failures++; return;
  }
  console.log(`OK   ${theme}/${level}: ${total} clues, ${cells.length} cells, solved ${solvedText}, score ${doc.getElementById("win-score").textContent}, stars ${doc.getElementById("win-stars").textContent}`);
}

(async () => {
  for (const th of themes) for (const lv of levels) await runOne(th, lv);
  console.log("\n----");
  console.log(`Ran ${count} games, ${failures} failures`);
  process.exit(failures ? 1 : 0);
})();
