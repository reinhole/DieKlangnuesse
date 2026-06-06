const fs = require('fs');

const lines = fs.readFileSync('/Users/olereinhold/.gemini/antigravity/brain/cf90282f-7f0b-4950-a2d1-4086c9ef5aba/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');
let originalRenderer = null;

for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  try {
    const log = JSON.parse(lines[i]);
    if (log.type === 'VIEW_FILE' && log.content.includes('function drawTrunk')) {
      console.log('Found it!');
      fs.writeFileSync('original_renderer_snippet.txt', log.content);
      break;
    }
  } catch (e) {}
}
