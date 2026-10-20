// Generates the app icon and splash mark without external assets.
// Run: node scripts/make-icons.js
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'assets');

// A minimal "forma" mark: a rising bar/arc composition in emerald on graphite.
function iconSvg(size, { background = '#0B0D0C', mark = '#4CE39A', pad = 0 } = {}) {
  const s = size;
  const inner = s - pad * 2;
  const u = inner / 100;
  const x = (n) => pad + n * u;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" fill="${background}"/>
    <g>
      <path d="M ${x(22)} ${x(68)} C ${x(30)} ${x(52)}, ${x(38)} ${x(62)}, ${x(48)} ${x(48)} C ${x(58)} ${x(34)}, ${x(66)} ${x(44)}, ${x(78)} ${x(26)}"
        fill="none" stroke="${mark}" stroke-width="${x(7)}" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${x(78)}" cy="${x(26)}" r="${x(6.5)}" fill="${mark}"/>
      <rect x="${x(22)}" y="${x(80)}" width="${x(56)}" height="${x(5)}" rx="${x(2.5)}" fill="${mark}" opacity="0.28"/>
    </g>
  </svg>`;
}

async function main() {
  await sharp(Buffer.from(iconSvg(1024))).png().toFile(path.join(OUT, 'icon.png'));
  // Splash: transparent mark, the splash plugin supplies the background.
  const splash = iconSvg(512, { background: 'none' }).replace(
    '<rect width="512" height="512" fill="none"/>',
    ''
  );
  await sharp(Buffer.from(iconSvg(512, { background: 'rgba(0,0,0,0)' })))
    .png()
    .toFile(path.join(OUT, 'splash-icon.png'));
  // Adaptive icon foreground is not needed for iOS-only builds.
  console.log('Icons written to', OUT, splash.length > 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
