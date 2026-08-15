/**
 * Tool tự động thiết kế và tạo trọn bộ Icon ứng dụng chuẩn AAA
 * cho cả Android (Mipmap đa độ phân giải), iOS (1024x1024 AppIcon) và Web (PWA Icons / Favicon).
 * 
 * Sử dụng thuần Node.js standard library (node:zlib, node:fs, node:path) — 0 dependencies.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');

// ==================== PNG ENCODER THUẦN NODE.JS ====================

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcPayload = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcPayload);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width: number, height: number, rgbaPixels: Uint8Array): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bit depth
  ihdrData[9] = 6; // RGBA color type
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // No interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Scanlines with filter byte 0 (None)
  const scanlineWidth = 1 + width * 4;
  const rawScanlines = Buffer.alloc(height * scanlineWidth);

  for (let y = 0; y < height; y++) {
    const destOffset = y * scanlineWidth;
    rawScanlines[destOffset] = 0; // Filter: None
    const srcOffset = y * width * 4;
    for (let i = 0; i < width * 4; i++) {
      rawScanlines[destOffset + 1 + i] = rgbaPixels[srcOffset + i];
    }
  }

  // Compress IDAT
  const compressed = zlib.deflateSync(rawScanlines, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// ==================== PROCEDURAL AAA DONG SON ICON RENDERER ====================

interface PixelShader {
  (u: number, v: number, isRound?: boolean): [number, number, number, number]; // returns [r, g, b, a] 0..255
}

function renderImage(size: number, shader: PixelShader, isRound = false): Buffer {
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const [r, g, b, a] = shader(u, v, isRound);
      const idx = (y * size + x) * 4;
      pixels[idx] = Math.max(0, Math.min(255, Math.round(r)));
      pixels[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      pixels[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      pixels[idx + 3] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }

  return encodePng(size, size, pixels);
}

/**
 * Shader vẽ Trống Đồng Đông Sơn & Lửa Thiêng Thời Tiền Sử
 */
const dongSonShader: PixelShader = (u, v, isRound = false) => {
  // Center coordinates (-1..1)
  const cx = u * 2 - 1;
  const cy = v * 2 - 1;
  const dist = Math.sqrt(cx * cx + cy * cy);
  const angle = Math.atan2(cy, cx); // -PI..PI

  // Mask góc bo tròn nếu không phải chế độ hình tròn thuần
  if (isRound) {
    if (dist > 0.98) {
      const alpha = Math.max(0, 1 - (dist - 0.98) / 0.02);
      if (alpha <= 0) return [0, 0, 0, 0];
    }
  } else {
    // Bo góc nhẹ 22% theo chuẩn Apple/Android squircle
    const sqDist = Math.pow(Math.abs(cx), 4.5) + Math.pow(Math.abs(cy), 4.5);
    if (sqDist > 0.96) {
      const edge = Math.max(0, 1 - (sqDist - 0.96) / 0.04);
      if (edge <= 0) return [0, 0, 0, 0];
    }
  }

  // 1. Nền Kim Loại Đồng Đen Cổ Điển & Gradient Ánh Lửa Huyền Bí
  const bgGrad = 1 - Math.min(1, dist * 0.9);
  // Nền đỏ thẫm / đồng tối hoàng gia
  let r = 24 + bgGrad * 38 + (1 - v) * 15;
  let g = 14 + bgGrad * 20;
  let b = 10 + bgGrad * 12;

  // 2. Viền ngoài Trống Đồng Đúc Nổi 3D
  if (dist >= 0.86 && dist <= 0.93) {
    const rim = Math.sin((dist - 0.86) / 0.07 * Math.PI);
    r += rim * 180;
    g += rim * 140;
    b += rim * 50;
  }

  // Vòng chấm hạt cườm Đông Sơn (outer beaded ring)
  if (dist >= 0.78 && dist <= 0.83) {
    const dotCount = 36;
    const dotAngle = (angle + Math.PI) * dotCount / (Math.PI * 2);
    const dotFrac = Math.abs((dotAngle % 1) - 0.5) * 2;
    const dotDist = 1 - Math.abs(dist - 0.805) / 0.025;
    if (dotDist > 0 && dotFrac < 0.6) {
      const dotIntensity = dotDist * (1 - dotFrac / 0.6);
      r += dotIntensity * 220;
      g += dotIntensity * 180;
      b += dotIntensity * 70;
    }
  }

  // 3. Vòng Chim Lạc Tung Cánh Bay Ngược Chiều Kim Đồng Hồ
  if (dist >= 0.61 && dist <= 0.74) {
    const birdCount = 8;
    const normAngle = ((angle + Math.PI + 0.1) * birdCount / (Math.PI * 2)) % 1;
    // Hình dáng cách điệu cánh chim Lạc
    if (normAngle > 0.15 && normAngle < 0.85) {
      const birdShape = Math.sin((normAngle - 0.15) / 0.7 * Math.PI);
      const ringMid = 1 - Math.abs(dist - 0.675) / 0.065;
      if (ringMid > 0) {
        const birdVal = birdShape * ringMid;
        r += birdVal * 235;
        g += birdVal * 190;
        b += birdVal * 75;
      }
    }
  }

  // 4. Vòng Răng Cưa Tiền Sử (Geometric sawtooth ring)
  if (dist >= 0.49 && dist <= 0.57) {
    const teethCount = 24;
    const tAngle = ((angle + Math.PI) * teethCount / (Math.PI * 2)) % 1;
    const tShape = Math.abs(tAngle - 0.5) * 2;
    const tRing = 1 - Math.abs(dist - 0.53) / 0.04;
    if (tRing > 0 && tShape > 0.3) {
      const tVal = tRing * tShape;
      r += tVal * 210;
      g += tVal * 165;
      b += tVal * 60;
    }
  }

  // 5. Ngôi Sao Mặt Trời Đông Sơn 14 Cánh Trung Tâm
  if (dist <= 0.45) {
    const starRays = 14;
    const starAngle = (angle + Math.PI) * starRays / (Math.PI * 2);
    const starFrac = Math.abs((starAngle % 1) - 0.5) * 2; // 0 ở đỉnh tia, 1 ở giữa 2 tia
    const rayLength = 0.16 + (1 - starFrac) * 0.26; // Độ dài tia nhọn từ 0.16 đến 0.42

    if (dist <= rayLength) {
      const rayCore = 1 - dist / rayLength;
      // Ánh sáng kim loại hoàng kim pha lửa rực rỡ
      r += 245 + rayCore * 10;
      g += 185 + rayCore * 60;
      b += 65 + rayCore * 120;
    }

    // Tâm điểm ngọn lửa thiêng Lạc Long Quân
    if (dist <= 0.14) {
      const core = 1 - dist / 0.14;
      r = Math.min(255, r + core * 255);
      g = Math.min(255, g + core * 220);
      b = Math.min(255, b + core * 140);
    }
  }

  // 6. Ánh Sáng Góc 3D Specular Highlight (Ánh kim rọi từ góc Tây Bắc 135 độ)
  const lightX = -0.55;
  const lightY = -0.55;
  const lightDist = Math.sqrt((cx - lightX) * (cx - lightX) + (cy - lightY) * (cy - lightY));
  const spec = Math.max(0, 1 - lightDist * 0.7);
  r += spec * 35;
  g += spec * 28;
  b += spec * 12;

  return [Math.min(255, r), Math.min(255, g), Math.min(255, b), 255];
};

// ==================== TIẾN HÀNH THIẾT KẾ & XUẤT ASSETS ====================

console.log('🎨 Bắt đầu render và xuất bộ Icon Game Kỷ Nguyên Hoang Cổ...');

// 1. iOS AppIcon 1024x1024
const iosDir = path.join(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
fs.mkdirSync(iosDir, { recursive: true });

console.log('📱 1. Đang tạo iOS 1024x1024 AppIcon...');
const iosIcon1024 = renderImage(1024, dongSonShader, false);
fs.writeFileSync(path.join(iosDir, 'AppIcon-512@2x.png'), iosIcon1024);

const iosContentsJson = {
  images: [
    {
      filename: 'AppIcon-512@2x.png',
      idiom: 'universal',
      platform: 'ios',
      size: '1024x1024',
    },
  ],
  info: {
    author: 'xcode',
    version: 1,
  },
};
fs.writeFileSync(path.join(iosDir, 'Contents.json'), JSON.stringify(iosContentsJson, null, 2));

// 2. Android Mipmaps (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
console.log('🤖 2. Đang tạo Android Mipmap Icons đa độ phân giải...');
const androidRes = path.join(ROOT, 'android/app/src/main/res');

const androidSizes: { dir: string; size: number }[] = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

for (const { dir, size } of androidSizes) {
  const targetDir = path.join(androidRes, dir);
  fs.mkdirSync(targetDir, { recursive: true });

  const squareIcon = renderImage(size, dongSonShader, false);
  fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), squareIcon);

  const roundIcon = renderImage(size, dongSonShader, true);
  fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), roundIcon);
}

// 3. Web & PWA Assets (apps/game/)
console.log('🌐 3. Đang tạo Web PWA Icons & Favicon...');
const webDir = path.join(ROOT, 'apps/game');

const icon192 = renderImage(192, dongSonShader, false);
fs.writeFileSync(path.join(webDir, 'icon-192.png'), icon192);

const icon512 = renderImage(512, dongSonShader, false);
fs.writeFileSync(path.join(webDir, 'icon-512.png'), icon512);

const appleTouchIcon = renderImage(180, dongSonShader, false);
fs.writeFileSync(path.join(webDir, 'apple-touch-icon.png'), appleTouchIcon);

const favicon = renderImage(64, dongSonShader, true);
fs.writeFileSync(path.join(webDir, 'favicon.png'), favicon);

console.log('✨ THÀNH CÔNG! Đã tạo đầy đủ bộ Icon cho iOS, Android và Web.');
