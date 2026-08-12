#!/usr/bin/env node
// Guards the binding DOM-testability contract from CLAUDE.md without running
// the full Playwright suite. Cheap enough (pure string scan, zero deps) to run
// from a Claude Code hook after every edit to index.html.
//
//   node scripts/check-contract.js        # check index.html (default)
//   node scripts/check-contract.js path   # check a specific HTML file
//
// Exit 0 = contract intact, exit 1 = a required hook is missing/invalid.
// It does NOT replace `npm test`; it's a fast pre-flight that catches the most
// common way an agent breaks the grader: deleting or renaming a data-testid.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => a !== '--quiet');
const quiet = process.argv.includes('--quiet'); // suppress success line (for hooks)
const file = args[0] || path.join(__dirname, '..', 'index.html');

// data-testids the spec (CLAUDE.md) and the test suite depend on.
//
// There is no `btn-start` testid because the run is started from the hub, by
// clicking #btn-start-adventure. That id and #btn-resume are part of the
// contract even though they are ids rather than testids — the specs drive the
// game through them, and renaming #btn-start-story once broke all 19 at a
// stroke. See rule 5 in CLAUDE.md.
const REQUIRED_TESTIDS = [
  'game-status',          // state machine mirror
  'score', 'lives', 'level',
  'btn-pause', 'btn-reset',
  'game-canvas',
  'player', 'nuts',       // hidden state mirror read by tests
  'volume-input', 'volume-meter',
];

const ALLOWED_STATUS = ['Ready', 'Running', 'Paused', 'Game Over'];

function main() {
  let html;
  try {
    html = fs.readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`check-contract: cannot read ${file}: ${err.message}`);
    process.exit(1);
  }

  const problems = [];

  for (const id of REQUIRED_TESTIDS) {
    const re = new RegExp(`data-testid=["']${id}["']`, 'g');
    const hits = (html.match(re) || []).length;
    if (hits === 0) problems.push(`missing data-testid="${id}"`);
    if (hits > 1) problems.push(`data-testid="${id}" must be unique (found ${hits})`);
  }

  // game-status must default to one of the four allowed strings.
  const statusMatch = html.match(
    /data-testid=["']game-status["']\s*>\s*([^<]*?)\s*</
  );
  if (statusMatch && !ALLOWED_STATUS.includes(statusMatch[1])) {
    problems.push(
      `game-status default "${statusMatch[1]}" is not one of ${ALLOWED_STATUS.join(', ')}`
    );
  }

  if (problems.length) {
    console.error(`check-contract: ${path.relative(process.cwd(), file)} FAILED`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('See CLAUDE.md (DOM testability contract).');
    process.exit(1);
  }

  if (!quiet) {
    console.log(`check-contract: ${REQUIRED_TESTIDS.length} required data-testid hooks present and unique.`);
    console.log('  note: no btn-start testid — a run is started from the hub via');
    console.log('  #btn-start-adventure, which the specs depend on (CLAUDE.md rule 5).');
  }
}

main();
