// End-to-end tests for scripts/verify-ipa.mjs: the script is executed as a
// child process against synthetic IPAs built in-memory. This keeps the
// production script dependency-free (it must run on the CI runner) and still
// verifies the checks that guard the SideStore installation path.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'verify-ipa.mjs');
const BUNDLE_ID = 'com.ihiks.forma';

// --- minimal ZIP writer (stored entries, no compression) -------------------

function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt32LE(0, 14); // crc32 (not verified by the reader)
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, file.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 10); // method
    central.writeUInt32LE(0, 16); // crc32
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += 30 + nameBuf.length + file.data.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([Buffer.concat(locals), centralBuf, eocd]);
}

// --- fake app pieces --------------------------------------------------------

const XML_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>${BUNDLE_ID}</string>
  <key>CFBundleExecutable</key><string>Forma</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>MinimumOSVersion</key><string>16.4</string>
</dict>
</plist>`;

function machOArm64(): Buffer {
  const header = Buffer.alloc(32);
  header.writeUInt32LE(0xfeedfacf, 0); // MH_MAGIC_64
  header.writeUInt32LE(0x0100000c, 4); // CPU_TYPE_ARM64
  header.writeUInt32LE(0, 8); // cpusubtype
  header.writeUInt32LE(2, 12); // MH_EXECUTE
  return header;
}

function hermesBundle(size = 120 * 1024): Buffer {
  const buf = Buffer.alloc(size, 0x61);
  Buffer.from([0xc6, 0x1f, 0xbc, 0x03]).copy(buf, 0);
  return buf;
}

function fillerFiles(n: number): { name: string; data: Buffer }[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `Payload/Forma.app/assets/file${i}.png`,
    data: Buffer.from([i % 256]),
  }));
}

function goodIpa(overrides: {
  plist?: string;
  bundle?: Buffer | null;
  withProvision?: boolean;
} = {}): Buffer {
  const files = [
    { name: 'Payload/Forma.app/Info.plist', data: Buffer.from(overrides.plist ?? XML_PLIST, 'utf8') },
    { name: 'Payload/Forma.app/Forma', data: machOArm64() },
    ...(overrides.bundle === null
      ? []
      : [{ name: 'Payload/Forma.app/main.jsbundle', data: overrides.bundle ?? hermesBundle() }]),
    ...(overrides.withProvision
      ? [{ name: 'Payload/Forma.app/embedded.mobileprovision', data: Buffer.from('profile') }]
      : []),
    ...fillerFiles(60),
  ];
  return buildZip(files);
}

// --- harness ----------------------------------------------------------------

const workDir = mkdtempSync(path.join(tmpdir(), 'verify-ipa-'));

function runIpa(buf: Buffer, extraArgs: string[] = []) {
  const ipaPath = path.join(workDir, 'Forma.ipa');
  writeFileSync(ipaPath, buf);
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ipaPath, ...extraArgs], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, output: stdout };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { status: err.status ?? 1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

afterAll(() => rmSync(workDir, { recursive: true, force: true }));

describe('verify-ipa.mjs', () => {
  it('accepts a well-formed unsigned IPA', () => {
    const result = runIpa(goodIpa());
    expect(result.status).toBe(0);
    expect(result.output).toContain('OK');
  });

  it('fails when the bundle id does not match', () => {
    const result = runIpa(goodIpa({ plist: XML_PLIST.replace(BUNDLE_ID, 'com.evil.app') }));
    expect(result.status).toBe(1);
    expect(result.output).toContain('CFBundleIdentifier');
  });

  it('fails when main.jsbundle is missing', () => {
    const result = runIpa(goodIpa({ bundle: null }));
    expect(result.status).toBe(1);
    expect(result.output).toContain('main.jsbundle');
  });

  it('fails when the bundle is tiny (broken export)', () => {
    const result = runIpa(goodIpa({ bundle: hermesBundle(1024) }));
    expect(result.status).toBe(1);
    expect(result.output).toContain('подозрительно мал');
  });

  it('fails when a provisioning profile is embedded', () => {
    const result = runIpa(goodIpa({ withProvision: true }));
    expect(result.status).toBe(1);
    expect(result.output).toContain('embedded.mobileprovision');
  });

  it('fails on a non-zip file', () => {
    const result = runIpa(Buffer.from('это не архив'));
    expect(result.status).toBe(1);
    expect(result.output).toContain('ZIP');
  });

  it('fails when the deployment target is below iOS 16.4', () => {
    const result = runIpa(goodIpa({ plist: XML_PLIST.replace('16.4', '14.0') }));
    expect(result.status).toBe(1);
    expect(result.output).toContain('MinimumOSVersion');
  });

  it('generates a SideStore-compatible source.json matching the artifact', () => {
    const outPath = path.join(workDir, 'source.json');
    const url = 'https://example.com/releases/latest/download/Forma.ipa';
    const result = runIpa(goodIpa(), ['--write-source', outPath, '--url', url]);
    expect(result.status).toBe(0);

    const source = JSON.parse(readFileSync(outPath, 'utf8'));
    expect(source.identifier).toBe(BUNDLE_ID);
    expect(source.downloadURL).toBe(url);
    expect(source.appVersion).toBe('1.0.0');
    expect(source.name).toBe('Форма');
    // SideStore rejects sources that claim a notarized marketplace.
    expect(source.marketplaceID).toBeUndefined();
    expect(source.build).toBeUndefined();
    expect(typeof source.size).toBe('number');
    expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
