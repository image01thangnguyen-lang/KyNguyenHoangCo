const fs = require('fs');
const content = fs.readFileSync('tools/original_index.html', 'utf8');
const scriptStart = content.indexOf('<script>');
const scriptEnd = content.lastIndexOf('</script>');
const jsCode = content.substring(scriptStart + 8, scriptEnd);

console.log('Original JS Code length:', jsCode.length, 'bytes');

// Search for key sections
const sections = [
  'CHƯƠNG I',
  'CHƯƠNG II',
  'CHƯƠNG III',
  'CHƯƠNG IV',
  'CHƯƠNG V',
  'CHƯƠNG VI',
  'CHƯƠNG VII',
  'CHƯƠNG VIII',
  'CHƯƠNG IX',
  'btn-start-game',
  'QuestManager',
  'selectHeroGender',
  'loadWarriorCharacter',
  'openTownHallModal'
];

sections.forEach(s => {
  console.log('Section/Symbol:', s, '-> found at index:', jsCode.indexOf(s));
});