// Windows-only helper: lets `expo prebuild -p ios` generate the native project locally
// so that CI configuration (app config, plugins, Info.plist) can be validated before
// the real macOS build. It does NOT produce a buildable app on Windows (no Xcode/pods).
// Usage: node scripts/win-prebuild-ios.js
const Module = require('module');
const path = require('path');

if (process.platform !== 'win32') {
  console.log('Not Windows — run `npx expo prebuild -p ios` directly.');
  process.exit(0);
}

const cliBuild = path.dirname(
  require.resolve('expo/package.json', { paths: [process.cwd()] })
) + '/node_modules/@expo/cli/build';

const target = require.resolve(path.join(cliBuild, 'src/prebuild/resolveOptions.js'));

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const os = originalLoad.apply(this, arguments);
  if (
    (request === 'os' || request === 'node:os') &&
    os &&
    typeof os.platform === 'function'
  ) {
    return Object.assign({}, os, { platform: () => 'darwin' });
  }
  return os;
};

const originalCompile = Module.prototype._compile;
Module.prototype._compile = function (content, filename) {
  if (filename === target) {
    content = content.replace(
      'process.platform === \'win32\' && platforms.includes(\'ios\')',
      'false'
    );
  }
  return originalCompile.call(this, content, filename);
};

process.argv = [process.argv[0], process.argv[1], 'prebuild', '-p', 'ios', '--no-install'];
require(path.join(cliBuild, 'src/index.js'));
