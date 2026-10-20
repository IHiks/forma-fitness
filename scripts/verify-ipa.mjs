#!/usr/bin/env node
// Structural verification of the unsigned Forma.ipa + AltSource source.json
// generation. Pure Node (no deps) so it runs on the CI runner and on Windows.
//
//   node scripts/verify-ipa.mjs build/Forma.ipa
//   node scripts/verify-ipa.mjs build/Forma.ipa --write-source build/source.json \
//        --url https://github.com/<owner>/<repo>/releases/latest/download/Forma.ipa

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';

// --- Minimal ZIP reader (store + deflate) ----------------------------------

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

/**
 * @typedef {{
 *   name: string, method: number, compressedSize: number, size: number, read: () => Buffer
 * }} ZipEntry
 */

/**
 * @param {Buffer} buf
 * @returns {ZipEntry[]}
 */
export function readZipEntries(buf) {
  if (buf.length < 22 || buf.readUInt32LE(0) !== LFH_SIG) {
    throw new Error('Это не ZIP-архив (нет сигнатуры локального заголовка)');
  }
  // Find EOCD by scanning backwards (comment may be up to 64 KiB).
  let eocd = -1;
  const scanFrom = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= scanFrom; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Не найден конец центрального каталога (архив повреждён)');

  const total = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (cdOffset + cdSize > buf.length) throw new Error('Центральный каталог выходит за границы файла');

  /** @type {ZipEntry[]} */
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < total; i += 1) {
    if (buf.readUInt32LE(p) !== CD_SIG) throw new Error(`Повреждённая запись каталога #${i}`);
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    entries.push({
      name,
      method,
      compressedSize,
      size,
      read() {
        if (buf.readUInt32LE(localOffset) !== LFH_SIG) {
          throw new Error(`Повреждённый локальный заголовок: ${name}`);
        }
        const lNameLen = buf.readUInt16LE(localOffset + 26);
        const lExtraLen = buf.readUInt16LE(localOffset + 28);
        const start = localOffset + 30 + lNameLen + lExtraLen;
        const raw = buf.subarray(start, start + compressedSize);
        if (method === 0) return Buffer.from(raw);
        if (method === 8) return inflateRawSync(raw);
        throw new Error(`Неподдерживаемый метод сжатия ${method} в ${name}`);
      },
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// --- Minimal binary/XML plist reader ---------------------------------------
// Only what verification needs: string and number values of flat keys.

function readPlistInt(buf, offset, len) {
  let value = 0n;
  for (let i = 0; i < len; i += 1) value = (value << 8n) | BigInt(buf[offset + i]);
  return Number(value);
}

/**
 * Parses a binary plist (bplist00) into a flat key -> string/number map.
 * Nested containers are skipped: verification only needs top-level Info.plist keys.
 *
 * @param {Buffer} buf
 * @returns {Record<string, string | number>}
 */
export function parseBinaryPlist(buf) {
  if (buf.length < 40 || buf.toString('ascii', 0, 8) !== 'bplist00') {
    throw new Error('Не binary plist');
  }
  const trailer = buf.subarray(buf.length - 32);
  const offsetIntSize = trailer[6];
  const objectRefSize = trailer[7];
  const numObjects = Number(trailer.readBigUInt64BE(8));
  const offsetTableOffset = Number(trailer.readBigUInt64BE(24));

  const offsets = [];
  for (let i = 0; i < numObjects; i += 1) {
    offsets.push(readPlistInt(buf, offsetTableOffset + i * offsetIntSize, offsetIntSize));
  }

  /** @type {Record<string, string | number>} */
  const result = {};

  /** @returns {string | number | null} */
  function parseObject(idx, depth) {
    if (depth > 4) return null; // do not descend into nested structures
    const off = offsets[idx];
    const marker = buf[off];
    const type = marker >> 4;
    const info = marker & 0x0f;

    if (type === 0x0) return info === 0x08 ? 1 : info === 0x09 ? 0 : null; // bool / null
    if (type === 0x1) return readPlistInt(buf, off + 1, 1 << info); // int
    if (type === 0x2) return null; // real (not needed)
    if (type === 0x5) return buf.toString('utf8', off + 1, off + 1 + info); // ascii string
    if (type === 0x6) {
      // utf16 string: length in info units
      return buf.toString('utf16le', off + 2, off + 2 + info * 2);
    }
    if (type === 0xa || type === 0xc) {
      const count = info === 0xf ? readPlistInt(buf, off + 1, 1) : info;
      const items = [];
      for (let i = 0; i < count; i += 1) {
        items.push(parseObject(readPlistInt(buf, off + (info === 0xf ? 2 : 1) + i * objectRefSize, objectRefSize), depth + 1));
      }
      return items.join(', ');
    }
    if (type === 0xd) {
      // dict: only read scalar values; keys are always strings in Info.plist
      const count = info === 0xf ? readPlistInt(buf, off + 1, 1) : info;
      const base = off + (info === 0xf ? 2 : 1);
      const keys = [];
      for (let i = 0; i < count; i += 1) {
        keys.push(parseObject(readPlistInt(buf, base + i * objectRefSize, objectRefSize), depth + 1));
      }
      const valBase = base + count * objectRefSize;
      for (let i = 0; i < count; i += 1) {
        const key = keys[i];
        if (typeof key !== 'string') continue;
        const value = parseObject(readPlistInt(buf, valBase + i * objectRefSize, objectRefSize), depth + 1);
        if (typeof value === 'string' || typeof value === 'number') result[key] = value;
      }
    }
    return null;
  }

  parseObject(0, 0);
  return result;
}

/** Reads Info.plist whether it is binary or XML; returns a flat key map. */
export function parseInfoPlist(buf) {
  if (buf.toString('ascii', 0, 8) === 'bplist00') return parseBinaryPlist(buf);
  // XML plist fallback: only scalar <string>/<integer> entries.
  /** @type {Record<string, string | number>} */
  const result = {};
  const xml = buf.toString('utf8');
  const re = /<key>([^<]+)<\/key>\s*<(string|integer)>([^<]*)<\/\2>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    result[m[1]] = m[2] === 'integer' ? Number(m[3]) : m[3];
  }
  return result;
}

// --- Mach-O sanity ----------------------------------------------------------

const CPU_TYPE_ARM64 = 0x0100000c;
const MH_EXECUTE = 0x2;

/**
 * @param {Buffer} macho first bytes of the main executable
 * @returns {{arm64: boolean, executable: boolean}}
 */
export function inspectMachO(macho) {
  if (macho.length < 16) return { arm64: false, executable: false };
  const magic = macho.readUInt32LE(0);
  if (magic !== 0xfeedfacf) return { arm64: false, executable: false }; // not MH_MAGIC_64 LE
  return {
    arm64: macho.readUInt32LE(4) === CPU_TYPE_ARM64,
    executable: macho.readUInt32LE(12) === MH_EXECUTE,
  };
}

// --- IPA checks -------------------------------------------------------------

const HERMES_MAGICS = [
  Buffer.from([0xc6, 0x1f, 0xbc, 0x03]),
  Buffer.from([0x03, 0xbc, 0x1f, 0xc6]),
  Buffer.from([0x1f, 0xc6, 0x03, 0xbc]),
];

export const MIN_IOS_VERSION = '16.4';

function versionAtLeast(actual, required) {
  const a = String(actual).split('.').map(Number);
  const r = String(required).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, r.length); i += 1) {
    const av = a[i] ?? 0;
    const rv = r[i] ?? 0;
    if (av > rv) return true;
    if (av < rv) return false;
  }
  return true;
}

/**
 * Verifies the IPA structure. Returns { errors, warnings, appDir, info }.
 * Errors mean the artifact is unusable; warnings are informational.
 *
 * @param {Buffer} buf
 * @param {{bundleId: string, expectedVersion?: string}} opts
 */
export function verifyIpa(buf, opts) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  /** @type {Record<string, string | number>} */
  let info = {};

  let entries;
  try {
    entries = readZipEntries(buf);
  } catch (e) {
    return { errors: [e instanceof Error ? e.message : String(e)], warnings, appDir: null, info };
  }

  if (entries.length < 50) {
    errors.push(`Слишком мало файлов в архиве (${entries.length}) — похоже, это не сборка приложения`);
  }

  const outside = entries.filter((e) => !e.name.startsWith('Payload/'));
  if (outside.length > 0) {
    errors.push(`Файлы вне Payload/: ${outside.slice(0, 3).map((e) => e.name).join(', ')}`);
  }

  const appDirs = [
    ...new Set(entries.map((e) => e.name.split('/')[1] ?? '').filter((n) => n.endsWith('.app'))),
  ];
  if (appDirs.length === 0) {
    errors.push('В Payload/ нет каталога *.app');
    return { errors, warnings, appDir: null, info };
  }
  if (appDirs.length > 1) {
    errors.push(`Найдено несколько приложений: ${appDirs.join(', ')}`);
  }
  const appDir = `Payload/${appDirs[0]}`;
  const app = (rel) => `${appDir}/${rel}`;
  const names = new Set(entries.map((e) => e.name));

  // 1-2. Info.plist must exist and parse.
  const plistEntry = entries.find((e) => e.name === app('Info.plist'));
  if (!plistEntry) {
    errors.push('Нет Info.plist');
    return { errors, warnings, appDir, info };
  }
  try {
    info = parseInfoPlist(plistEntry.read());
  } catch (e) {
    errors.push(`Info.plist не удалось разобрать: ${e instanceof Error ? e.message : e}`);
    return { errors, warnings, appDir, info };
  }

  // 3. Bundle id must match the project config.
  if (info.CFBundleIdentifier !== opts.bundleId) {
    errors.push(`CFBundleIdentifier = ${String(info.CFBundleIdentifier)} (ожидался ${opts.bundleId})`);
  }

  // 4. Marketing version matches the expected release.
  if (opts.expectedVersion && info.CFBundleShortVersionString !== opts.expectedVersion) {
    errors.push(
      `CFBundleShortVersionString = ${String(info.CFBundleShortVersionString)} (ожидалась ${opts.expectedVersion})`
    );
  }

  // 6. Deployment target.
  const minOs = String(info.MinimumOSVersion ?? '');
  if (!minOs) {
    warnings.push('MinimumOSVersion отсутствует в Info.plist');
  } else if (!versionAtLeast(minOs, MIN_IOS_VERSION)) {
    errors.push(`MinimumOSVersion ${minOs} ниже требуемой ${MIN_IOS_VERSION}`);
  }

  // 5+7. The declared executable must exist and be an arm64 Mach-O executable.
  const executable = String(info.CFBundleExecutable ?? '');
  if (!executable) {
    errors.push('CFBundleExecutable отсутствует');
  } else if (!names.has(app(executable))) {
    errors.push(`Исполняемый файл ${executable} отсутствует в сборке`);
  } else {
    const macho = entries.find((e) => e.name === app(executable))?.read();
    if (macho) {
      const { arm64, executable: isExec } = inspectMachO(macho);
      if (!arm64) errors.push('Главный бинарник не arm64 (SideStore не сможет установить на реальный iPhone)');
      if (!isExec) errors.push(`Главный бинарник не является executables (MH_EXECUTE)`);
    }
  }

  // JS bundle: must exist, be large, and (almost certainly) be Hermes bytecode.
  const bundle = entries.find((e) => e.name === app('main.jsbundle'));
  if (!bundle) {
    errors.push('Нет main.jsbundle — JS-бандл не был встроен в сборку');
  } else if (bundle.size < 100 * 1024) {
    errors.push(`main.jsbundle подозрительно мал (${bundle.size} байт)`);
  } else {
    const head = bundle.read().subarray(0, 4);
    if (!HERMES_MAGICS.some((m) => m.equals(head))) {
      warnings.push(`Неопознанная сигнатура Hermes в main.jsbundle (${head.toString('hex')})`);
    }
  }

  // The build must be unsigned: SideStore re-signs with its own certificate.
  if (names.has(app('embedded.mobileprovision'))) {
    errors.push('embedded.mobileprovision присутствует — сборка не unsigned (ожидался профиль отсутствует)');
  }
  if ([...names].some((n) => n.startsWith(app('_CodeSignature/')))) {
    warnings.push('_CodeSignature присутствует (SideStore удалит его при переподписи)');
  }

  return { errors, warnings, appDir, info };
}

// --- AltSource source.json --------------------------------------------------

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Builds an AltSource JSON that SideStore accepts: intentionally WITHOUT
 * `marketplaceID` and `build` (SideStore rejects sources that claim a
 * marketplace without notarization).
 */
export function buildSourceJson({ size, sha, downloadUrl, appVersion, bundleId, displayName, versionDate }) {
  return {
    name: displayName,
    identifier: bundleId,
    subtitle: 'Трекер веса, тренировок и привычек',
    description:
      'Форма — локальный журнал формы: вес с трендом и разрывами, тренировки по группам мышц, календарь, питание и привычки. Данные хранятся только на устройстве, без аккаунтов и аналитики.',
    language: 'ru-RU',
    appVersion,
    versionDate,
    size,
    sha256: sha,
    downloadURL: downloadUrl,
    developerName: 'ihiks',
  };
}

/** Cross-checks a source.json against the actual artifact it describes. */
export function verifySourceJson(source, { ipaSize, ipaSha, bundleId }) {
  /** @type {string[]} */
  const errors = [];
  if (source.marketplaceID !== undefined) {
    errors.push('source.json не должен содержать marketplaceID (SideStore отклонит источник)');
  }
  if (source.build !== undefined) {
    errors.push('source.json не должен содержать build (нет notarization)');
  }
  if (source.identifier !== bundleId) errors.push(`identifier ${source.identifier} != ${bundleId}`);
  if (source.size !== ipaSize) errors.push(`size ${source.size} != размер IPA ${ipaSize}`);
  if (source.sha256 !== ipaSha) errors.push('sha256 в source.json не совпадает с IPA');
  if (!source.downloadURL) errors.push('нет downloadURL');
  if (!source.appVersion) errors.push('нет appVersion');
  if (!source.versionDate) errors.push('нет versionDate');
  return errors;
}

// --- CLI --------------------------------------------------------------------

function parseArgs(argv) {
  const args = { ipa: null, writeSource: null, url: null, appVersion: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--write-source') args.writeSource = argv[++i];
    else if (a === '--url') args.url = argv[++i];
    else if (a === '--app-version') args.appVersion = argv[++i];
    else if (!args.ipa) args.ipa = a;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const root = path.join(scriptDir, '..');

  if (!args.ipa || !existsSync(args.ipa)) {
    console.error(
      'Использование: node scripts/verify-ipa.mjs <Forma.ipa> [--write-source out.json] [--url URL] [--app-version X.Y.Z]'
    );
    process.exit(2);
  }

  const appJson = JSON.parse(readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  const bundleId = appJson.ios.bundleIdentifier;
  const displayName = appJson.ios.infoPlist?.CFBundleDisplayName ?? appJson.name;

  const buf = readFileSync(args.ipa);
  const { errors, warnings, appDir } = verifyIpa(buf, {
    bundleId,
    expectedVersion: args.appVersion ?? appJson.version,
  });

  for (const w of warnings) console.warn(`WARN: ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`FAIL: ${e}`);
    process.exit(1);
  }

  const hash = sha256(buf);
  console.log(`OK: ${path.basename(args.ipa)} — ${buf.length} байт, sha256 ${hash}`);
  console.log(`OK: приложение найдено в ${appDir}/`);

  if (args.writeSource) {
    if (!args.url) {
      console.error('--write-source требует --url (публичная ссылка на релиз)');
      process.exit(2);
    }
    const source = buildSourceJson({
      size: buf.length,
      sha: hash,
      downloadUrl: args.url,
      appVersion: args.appVersion ?? appJson.version,
      bundleId,
      displayName,
      versionDate: new Date(statSync(args.ipa).mtimeMs).toISOString(),
    });
    const sourceErrors = verifySourceJson(source, { ipaSize: buf.length, ipaSha: hash, bundleId });
    if (sourceErrors.length > 0) {
      for (const e of sourceErrors) console.error(`FAIL source.json: ${e}`);
      process.exit(1);
    }
    writeFileSync(args.writeSource, `${JSON.stringify(source, null, 2)}\n`);
    console.log(`OK: source.json записан в ${args.writeSource}`);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
