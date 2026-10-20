#!/usr/bin/env bash
# Builds an unsigned Forma.ipa on macOS. Run from the repo root.
# Requirements: Node 24, Xcode 26.4+ (27.x preferred), CocoaPods.
set -euo pipefail

APP_NAME="Forma"
IPA_NAME="${APP_NAME}.ipa"

echo "==> Node $(node --version)"
echo "==> Xcode:"; xcodebuild -version
echo "==> Ruby/CocoaPods:"; pod --version

# Guard: Expo SDK 58 needs Xcode 26.4+.
XCODE_MAJOR="$(xcodebuild -version | awk 'NR==1 {print $2}' | cut -d. -f1)"
if [ "${XCODE_MAJOR}" -lt 26 ]; then
  echo "ERROR: Xcode ${XCODE_MAJOR} is too old for Expo SDK 58 (needs 26.4+)." >&2
  exit 1
fi

echo "==> Installing JS dependencies"
npm ci

echo "==> Ensuring icons exist"
if [ ! -f assets/icon.png ]; then
  node scripts/make-icons.js
fi

echo "==> expo prebuild (ios, no install)"
npx expo prebuild --platform ios --no-install

echo "==> pod install"
cd ios && pod install --repo-update && cd ..

echo "==> Archiving (unsigned)"
xcodebuild \
  -workspace "ios/${APP_NAME}.xcworkspace" \
  -scheme "${APP_NAME}" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "build/${APP_NAME}.xcarchive" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  DEVELOPMENT_TEAM="" \
  archive | xcbeautify --renderer github-actions || true

# xcbeautify may be absent or swallow the exit code above; verify the archive exists.
if [ ! -d "build/${APP_NAME}.xcarchive/Products/Applications/${APP_NAME}.app" ]; then
  echo "ERROR: archive was not produced; rerunning without xcbeautify to surface errors"
  xcodebuild \
    -workspace "ios/${APP_NAME}.xcworkspace" \
    -scheme "${APP_NAME}" \
    -configuration Release \
    -destination "generic/platform=iOS" \
    -archivePath "build/${APP_NAME}.xcarchive" \
    CODE_SIGNING_ALLOWED=NO \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    DEVELOPMENT_TEAM="" \
    archive
fi

APP_PATH="build/${APP_NAME}.xcarchive/Products/Applications/${APP_NAME}.app"

echo "==> Assembling IPA"
rm -f "build/${IPA_NAME}"
mkdir -p build/Payload
rm -rf "build/Payload/${APP_NAME}.app"
# ditto preserves symlinks and resource forks, which naive zip/cp mangle.
ditto "${APP_PATH}" "build/Payload/${APP_NAME}.app"
cd build && ditto -c -k --sequesterRsrc --keepParent "Payload" "${IPA_NAME}" && cd ..

echo "==> Verifying IPA"
node scripts/verify-ipa.mjs "build/${IPA_NAME}"

echo "==> Done: build/${IPA_NAME}"
