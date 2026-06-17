const fs = require('fs');
const path = require('path');

const gitHooksDir = path.join(__dirname, '..', '.git', 'hooks');
if (!fs.existsSync(gitHooksDir)) {
  console.log('Not a git repository or .git/hooks directory not found. Skipping hook installation.');
  process.exit(0);
}

const hookPath = path.join(gitHooksDir, 'commit-msg');
const hookScript = `#!/bin/sh
node "${path.join(__dirname, 'verify-commit-msg.js')}" "$1"
`;

try {
  fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });
  // Ensure correct permission for macOS/Linux systems explicitly
  try {
    fs.chmodSync(hookPath, '755');
  } catch (chmodErr) {
    // ignore, on Windows chmodSync might fail or do nothing depending on environment
  }
  console.log('Successfully installed commit-msg git hook.');
} catch (err) {
  console.error('Failed to install commit-msg hook:', err.message);
}
