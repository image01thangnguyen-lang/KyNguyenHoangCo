import { execSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

console.log('🔄 1. Đồng bộ web assets vào Android project...');
execSync('node tools/build-apk-assets.ts', { stdio: 'inherit' });

console.log('📦 2. Biên dịch APK với Gradle 8.7...');
const gradlePath = join(process.cwd(), 'gradle-dist', 'gradle-8.7', 'bin', 'gradle.bat');
const javaHome = 'C:\\Program Files\\Java\\jdk-21.0.11';

process.env.JAVA_HOME = javaHome;
execSync(`"${gradlePath}" assembleDebug`, {
  cwd: join(process.cwd(), 'android'),
  stdio: 'inherit',
  env: { ...process.env, JAVA_HOME: javaHome },
});

const srcApk = join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const destApk = join(process.cwd(), 'ky-nguyen-hoang-co.apk');

if (existsSync(srcApk)) {
  copyFileSync(srcApk, destApk);
  console.log(`\n🎉 THÀNH CÔNG! Đã tạo file APK tại: ${destApk}`);
} else {
  console.error('❌ Không tìm thấy file APK đầu ra.');
}
