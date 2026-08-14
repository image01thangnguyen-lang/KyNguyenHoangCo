/**
 * Script tự động hóa toàn bộ quy trình build APK Android độc lập:
 * 1. Đóng gói Web Assets sang android/app/src/main/assets/www
 * 2. Tự động tải cmdline-tools & cài đặt platforms;android-34, build-tools;34.0.0
 * 3. Biên dịch APK qua Gradle 8.7 + JDK 21
 * 4. Xuất file APK hoàn chỉnh: ky-nguyen-hoang-co.apk
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile, copyFile, rename, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApkAssets } from './build-apk-assets.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ANDROID_DIR = join(ROOT, 'android');
const USER_HOME = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Thang';
const TOOLS_DIR = join(USER_HOME, '.kynguyenhoangco_tools');
const GRADLE_DIR = join(TOOLS_DIR, 'gradle-8.7');
const GRADLE_BIN = join(GRADLE_DIR, 'bin', process.platform === 'win32' ? 'gradle.bat' : 'gradle');
const SDK_DIR = process.env.ANDROID_HOME || join(USER_HOME, 'AppData', 'Local', 'Android', 'Sdk');
const CMDLINE_TOOLS_DIR = join(SDK_DIR, 'cmdline-tools', 'latest');
const SDKMANAGER_BIN = join(CMDLINE_TOOLS_DIR, 'bin', process.platform === 'win32' ? 'sdkmanager.bat' : 'sdkmanager');

const JDK_PATH = 'C:\\Program Files\\Java\\jdk-21.0.11';

function runCmd(
  command: string,
  args: string[],
  cwd: string,
  env?: Record<string, string>,
  input?: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    console.log(`▶️ [CMD] ${command} ${args.join(' ')}`);
    const proc = spawn(command, args, {
      cwd,
      stdio: input !== undefined ? ['pipe', 'inherit', 'inherit'] : 'inherit',
      shell: true,
      env: { ...process.env, ...env },
    });

    if (input !== undefined && proc.stdin) {
      proc.stdin.write(input);
      proc.stdin.end();
    }

    proc.on('close', (code) => {
      if (code === 0) resolve(code);
      else reject(new Error(`Command failed with code ${code}`));
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function downloadAndExtractZip(url: string, destDir: string): Promise<void> {
  console.log(`⬇️ Đang tải từ ${url}...`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Tải thất bại: ${res.statusText}`);

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const tempZip = join(TOOLS_DIR, 'temp_' + Date.now() + '.zip');

  await mkdir(TOOLS_DIR, { recursive: true });
  await writeFile(tempZip, buffer);

  console.log(`📦 Đang giải nén vào ${destDir}...`);
  await mkdir(destDir, { recursive: true });
  await runCmd('powershell', ['-Command', `Expand-Archive -Path "${tempZip}" -DestinationPath "${destDir}" -Force`], ROOT);
  try {
    await rm(tempZip, { force: true });
  } catch {}
}

async function ensureGradle(): Promise<string> {
  if (existsSync(GRADLE_BIN)) {
    console.log(`✅ Đã tìm thấy Gradle: ${GRADLE_BIN}`);
    return GRADLE_BIN;
  }

  console.log('⚡ Chưa có Gradle 8.7. Đang tải và cấu hình...');
  await mkdir(TOOLS_DIR, { recursive: true });
  const gradleZipUrl = 'https://services.gradle.org/distributions/gradle-8.7-bin.zip';
  await downloadAndExtractZip(gradleZipUrl, TOOLS_DIR);

  if (existsSync(GRADLE_BIN)) {
    console.log(`✅ Cài đặt Gradle thành công: ${GRADLE_BIN}`);
    return GRADLE_BIN;
  }
  throw new Error('Không tìm thấy Gradle sau khi giải nén.');
}

async function ensureCmdlineTools(): Promise<void> {
  if (existsSync(SDKMANAGER_BIN)) {
    console.log(`✅ Đã có sdkmanager tại: ${SDKMANAGER_BIN}`);
    return;
  }

  console.log('⚡ Đang tải Android Command Line Tools từ Google...');
  const cmdlineUrl = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip';
  const tempExtract = join(TOOLS_DIR, 'cmdline_temp');
  await rm(tempExtract, { recursive: true, force: true });
  await downloadAndExtractZip(cmdlineUrl, tempExtract);

  // Cấu trúc zip là cmdline-tools/..., chuyển vào SDK_DIR/cmdline-tools/latest
  await mkdir(join(SDK_DIR, 'cmdline-tools'), { recursive: true });
  await rm(CMDLINE_TOOLS_DIR, { recursive: true, force: true });
  const innerFolder = join(tempExtract, 'cmdline-tools');
  await rename(innerFolder, CMDLINE_TOOLS_DIR);
  await rm(tempExtract, { recursive: true, force: true });

  console.log(`✅ Đã cài đặt Android Command Line Tools vào: ${CMDLINE_TOOLS_DIR}`);
}

async function ensureAndroidSdk(): Promise<string> {
  await mkdir(SDK_DIR, { recursive: true });

  const localPropsPath = join(ANDROID_DIR, 'local.properties');
  const escapedSdkPath = SDK_DIR.replace(/\\/g, '\\\\');
  await writeFile(localPropsPath, `sdk.dir=${escapedSdkPath}\n`);

  await ensureCmdlineTools();

  const customEnv: Record<string, string> = {
    ANDROID_HOME: SDK_DIR,
    ANDROID_SDK_ROOT: SDK_DIR,
  };
  if (existsSync(JDK_PATH)) {
    customEnv.JAVA_HOME = JDK_PATH;
    customEnv.PATH = `${join(JDK_PATH, 'bin')};${process.env.PATH}`;
  }

  // Chấp nhận licenses
  console.log('✍️ Đang tự động phê duyệt Android licenses...');
  const licenseYesInput = 'y\ny\ny\ny\ny\ny\ny\ny\ny\n';
  try {
    await runCmd(SDKMANAGER_BIN, ['--licenses'], ROOT, customEnv, licenseYesInput);
  } catch {
    // Không chặn nếu đã chấp nhận trước đó
  }

  // Cài đặt platform 34 và build-tools 34.0.0 nếu chưa có
  const platform34Path = join(SDK_DIR, 'platforms', 'android-34');
  const buildTools34Path = join(SDK_DIR, 'build-tools', '34.0.0');

  if (!existsSync(platform34Path) || !existsSync(buildTools34Path)) {
    console.log('📦 Đang cài đặt platforms;android-34 và build-tools;34.0.0...');
    await runCmd(
      SDKMANAGER_BIN,
      ['"platforms;android-34"', '"build-tools;34.0.0"', '"platform-tools"'],
      ROOT,
      customEnv,
      licenseYesInput,
    );
  }

  console.log('✅ Android SDK sẵn sàng.');
  return SDK_DIR;
}

export async function buildApk(): Promise<void> {
  console.log('🚀 === BẮT ĐẦU QUY TRÌNH BUILD APK KỶ NGUYÊN HOANG CỔ ===');

  // 1. Đóng gói assets
  await buildApkAssets();

  // 2. Chuẩn bị SDK & Gradle
  const sdkPath = await ensureAndroidSdk();
  const gradleBin = await ensureGradle();

  // 3. Thiết lập biến môi trường JDK 21
  const customEnv: Record<string, string> = {
    ANDROID_HOME: sdkPath,
    ANDROID_SDK_ROOT: sdkPath,
  };

  if (existsSync(JDK_PATH)) {
    customEnv.JAVA_HOME = JDK_PATH;
    customEnv.PATH = `${join(JDK_PATH, 'bin')};${process.env.PATH}`;
    console.log(`☕ Sử dụng JDK 21 tại: ${JDK_PATH}`);
  }

  // 4. Chạy Gradle build
  console.log('🔨 Đang biên dịch Android APK bằng Gradle...');
  await runCmd(gradleBin, ['assembleDebug', '--stacktrace'], ANDROID_DIR, customEnv);

  // 5. Tìm kiếm APK đầu ra
  const outputApk = join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const targetApk = join(ROOT, 'ky-nguyen-hoang-co.apk');

  if (existsSync(outputApk)) {
    await copyFile(outputApk, targetApk);
    console.log('\n🎉 ====================================================');
    console.log('✅ XUẤT FILE APK THÀNH CÔNG:');
    console.log(`📍 Đường dẫn file APK: ${targetApk}`);
    console.log('====================================================\n');
  } else {
    throw new Error(`Không tìm thấy file APK đầu ra tại: ${outputApk}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildApk().catch((err) => {
    console.error('\n❌ LỖI BUILD APK:', err);
    process.exit(1);
  });
}
