// Typing test: simulate a real player typing answers with the keyboard.
// We map each clue's text back to its answer via THEMES, select the clue,
// then dispatch keydown events for each letter. Confirms typeLetter/advance/
// win detection all work end to end.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const { THEMES } = require("./js/words.js");

// Build clue-text -> answer lookup across all themes/levels.
const clueToAnswer = {};
for (const t of Object.values(THEMES))
  for (const lvl of Object.values(t.levels))
    for (const { a, c } of lvl) clueToAnswer[c] = a;

function press(window, key) {
  window.document.dispatchEvent(
    new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
  );
}

let failures = 0;

function runOne(theme, level) {
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true });
  const { window } = dom;
  const doc = window.document;
  ["js/words.js", "js/generator.js", "js/game.js"].forEach((f) => {
    const s = doc.createElement("script");
    s.textContent = fs.readFileSync(path.join(__dirname, f), "utf8");
    doc.body.appendChild(s);
  });
  doc.dispatchEvent(new window.Event("DOMContentLoaded"));

  doc.querySelector(`.theme-card[data-theme="${theme}"]`).click();
  doc.querySelector(`.diff-card[data-level="${level}"]`).click();
  doc.getElementById("start-btn").click();

  // For each clue, select it and type the answer.
  const lis = doc.querySelectorAll(".clue-list li");
  lis.forEach((li) => {
    const clueText = li.textContent.replace(/^\d+\.\s*/, "");
    const answer = clueToAnswer[clueText];
    if (!answer) { console.log(`  ! no answer for clue: ${clueText}`); return; }
    li.click(); // selects clue, sets active cell to first letter
    for (const ch of answer) press(window, ch);
  });

  const solved = doc.getElementById("solved-count").textContent;
  const win = doc.getElementById("win-modal").hidden === false;
  const [s, t] = solved.split("/").map(Number);
  if (win && s === t) {
    console.log(`OK   ${theme}/${level}: typed to win, solved ${solved}, stars ${doc.getElementById("win-stars").textContent}`);
  } else {
    console.log(`FAIL ${theme}/${level}: solved ${solved}, win=${win}`);
    failures++;
  }
}

// Test a representative sample (typing every puzzle is slow but let's do all).
const themes = Object.keys(THEMES);
const levels = ["easy", "medium", "tricky"];
for (const th of themes) for (const lv of levels) runOne(th, lv);
console.log("\n----");
console.log(failures ? `${failures} FAILURES` : "All typing tests passed!");
process.exit(failures ? 1 : 0);
