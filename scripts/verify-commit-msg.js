const fs = require('fs');

const msgPath = process.argv[2];
if (!msgPath) {
  console.error('No commit message file path provided.');
  process.exit(1);
}

const commitMsg = fs.readFileSync(msgPath, 'utf8').trim();

// Conventional Commits regex pattern
const conventionalCommitRegex = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([a-z0-9\-]+\))?: .+/i;

const isMergeCommit = /^Merge branch/i.test(commitMsg) || /^Merge pull request/i.test(commitMsg);
const isRevertCommit = /^Revert/i.test(commitMsg);

if (!conventionalCommitRegex.test(commitMsg) && !isMergeCommit && !isRevertCommit) {
  console.error('\n\x1b[31m[ERROR] Invalid commit message format.\x1b[0m');
  console.error('Commit messages must follow the Conventional Commits specification:');
  console.error('  <type>(<scope>): <description>');
  console.error('\nAllowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert');
  console.error('Example: feat(ui): add height counter in meters\n');
  process.exit(1);
}
