const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('tools/original_index.html', 'utf8');
const scriptStart = content.indexOf('<script>');
const scriptEnd = content.lastIndexOf('</script>');
const originalJs = content.substring(scriptStart + 8, scriptEnd).trim();

// Tách bỏ wrapper closure IIFE (function() { ... })();
let cleanJs = originalJs;
if (cleanJs.startsWith('(function () {')) {
  cleanJs = cleanJs.substring(14);
}
if (cleanJs.endsWith('})();')) {
  cleanJs = cleanJs.substring(0, cleanJs.length - 5);
}
cleanJs = cleanJs.trim();

// Tích hợp thêm CanvasOverlay 2D và Spatial Grid vào trong main.ts
const mainTsHeader = `// ====================================================
// MODULE: main.ts — THREE.JS ARPG ENGINE HOÀN CHỈNH
// ====================================================

import { SpatialGrid, worldSpatialGrid } from './world/SpatialGrid.ts';
import { CanvasOverlay } from './ui/CanvasOverlay.ts';

export const canvasOverlay = new CanvasOverlay('hud-canvas');
`;

const finalMainTs = mainTsHeader + '\n' + cleanJs;

fs.writeFileSync('apps/game/src/main.ts', finalMainTs, 'utf8');
console.log('Successfully generated full complete apps/game/src/main.ts! Size:', finalMainTs.length, 'bytes');