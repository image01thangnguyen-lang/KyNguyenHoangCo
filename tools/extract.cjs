const fs = require('fs');
const readline = require('readline');

async function main() {
  const logPath = 'C:/Users/Thang/.gemini/antigravity/brain/ab216034-0e05-4094-9ed4-20173cfcaa98/.system_generated/logs/transcript_full.jsonl';
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let foundScript = null;

  for await (const line of rl) {
    if (line.includes('CHƯƠNG I: CẤU TRÚC DỮ LIỆU TRẠNG THÁI') && line.includes('QuestManager')) {
      try {
        const obj = JSON.parse(line);
        // find ReplacementContent or TargetContent or CodeContent
        const str = JSON.stringify(obj);
        if (str.length > 50000) {
          foundScript = str;
        }
      } catch (e) {}
    }
  }

  if (foundScript) {
    fs.writeFileSync('tools/last_saved_full.txt', foundScript, 'utf8');
    console.log('Found full script, saved length:', foundScript.length);
  } else {
    console.log('Searching git history or previous files...');
  }
}

main();