# Технический план: бесплатная установка на iPhone без Mac

Дата проверки источников: 19.10.2026.
Все утверждения ниже сверены с официальной документацией и исходным кодом; ссылки приведены в тексте.

## 1. Итог по техническим рискам (закрыты до реализации)

| Риск | Решение | Статус |
| --- | --- | --- |
| Xcode на GitHub runner не совпадает с Expo SDK 58 | Runner-образ `xcode-27` = macOS 27 + Xcode **27.0 (default)**, iOS 27.0 SDK, CocoaPods 1.17, Node 24. Expo SDK 58 собран под iOS 27 и требует Xcode 26.4+. Мы используем `xcode-27`, где Xcode 27 — ровно та версия, на которую ориентирован SDK 58. | подтверждено по `actions/runner-images` |
| Несуществующие версии пакетов | Все версии взяты из `bundledNativeModules` установленного `expo@58.0.16`; tsc/eslint/tests/export проходят локально. | подтверждено локально |
| Цепочка prebuild → pods → xcodebuild → IPA | Скрипт выполняет prebuild, `pod install`, archive без подписи, упаковку через `ditto` (symlink + права), затем **проверку структуры IPA** (`verify-ipa.mjs`). Сборка без подписи корректна: SideStore копирует бандл, ставит свой профиль, удаляет `_CodeSignature` и подписывает (исходники `ResignAppOperation.swift`). | цепочка проверяема только запуском workflow |
| Совместимость с Personal Team | Entitlements приложения пустые, расширений нет, однопользовательские функции не нужны. SideStore (исходники `FetchProvisioningProfilesOperation.swift`) регистрирует App ID вида `com.ihiks.forma.<TeamID>` под бесплатный аккаунт. | подтверждено по исходникам SideStore |
| Платные runner'ы / минуты | Только стандартные runner'ы, только публичный репозиторий (public = бесплатные минуты для стандартных runner'ов). Larger runners (`*-xlarge`) не используются. | подтверждено по докам GitHub |
| AltSource | SideStore полностью совместим с AltStore-источниками. Workflow генерирует `source.json` с полями из официальной схемы (без `marketplaceID` и `build`, иначе SideStore примет источник за notarized). Также есть `sidestore://install?url=…ipa` и установка из Files. | подтверждено по докам |
| Секреты в публичном репозитории | Workflow не использует никаких секретов и Apple credentials. В репозиторий не попадают ключи, pairing-файлы, аккаунты. | проверено статически |

## 2. Почему именно `xcode-27`, а не `macos-26`

- Expo SDK 58: «built for iOS 27», React Native 0.88. Expo apps уже используют scene-based lifecycle, нужный iOS 27.
- Таблица требований Expo: SDK 58 требует **Xcode 26.4+**; `macos-26` с Xcode 26.6 формально проходит, но SDK 58 ориентирован на iOS 27 SDK.
- В `actions/runner-images` (обновление от 12.10.2026):
  - `xcode-27` (macOS 27.0.1): Xcode **27.0 (default)**, 27.1, 27.2 beta; **iOS 27.0 SDK**; CocoaPods 1.17.0; Node 24.21.
  - `macos-26`: Xcode 26.6 (iOS 26.5 SDK).
- Выбран `xcode-27` + явная проверка версии Xcode в workflow (`xcodebuild -version` должен начинаться с 27). Если GitHub уберёт preview-образ, workflow упадёт с понятной ошибкой; в инструкции указан запасной вариант (`macos-26`, Xcode 26.6 — формально поддерживается SDK 58).

Источник: https://github.com/actions/runner-images/blob/main/images/macos/xcode-27-arm64-Readme.md

## 3. Цепочка сборки и что именно проверяется

```
Windows ── git push ──> GitHub public repo
                             │  Actions: xcode-27 (стандартный, бесплатный для public)
                             ▼
                 npm ci
                 npx expo prebuild --platform ios --no-install
                 pod install (ios/)
                 xcodebuild -workspace … -scheme … archive CODE_SIGNING_ALLOWED=NO
                 ditto -c -k --sequesterRsrc --keepParent Payload/Forma.app Forma.ipa
                             ▼
                 node scripts/verify-ipa.mjs Forma.ipa
                             ▼
                 Release: Forma.ipa + source.json (+ sha256)
                             ▼
       iPhone: SideStore (iloader → Apple ID) → Add Source / Install → re-sign
```

`verify-ipa.mjs` (запускается в CI, тестируется локально) проверяет:

1. ZIP содержит ровно один `Payload/*.app`;
2. `Payload/Forma.app/Info.plist` существует и парсится;
3. `CFBundleIdentifier = com.ihiks.forma` (совпадает с `bundleIdentifier` в source.json);
4. `CFBundleShortVersionString` / `CFBundleVersion` совпадают с источником;
5. `CFBundleExecutable` присутствует в бандле и исполняемый;
6. `MinimumOSVersion >= 16.4`;
7. есть `Assets.car` / иконка и `embedded.mobileprovision` **отсутствует** (неподписанная сборка);
8. присутствует JS-бандл (`main.jsbundle`), т.е. это Release-сборка, а не dev;
9. Mach-O архитектуры содержат `arm64` (требование реального iPhone и Personal Team);
10. `size` и `sha256` в `source.json` совпадают с IPA;
11. в `source.json` нет `marketplaceID` / `build` (иначе SideStore считает источник notarized и не принимает его).

Проверка совпадает с реальными проверками SideStore: bundle ID и минимальная iOS (`VerifyAppOperation.swift`), размер и хэш из источника, затем переподпись.

## 4. Ограничения бесплатного Apple ID (Personal Team)

По официальной справке Apple и исходникам SideStore:
- 3 активных приложения, установленных вашим Apple ID (SideStore сам занимает одно место);
- до 10 новых App ID за 7 дней;
- профиль живёт 7 дней → «Refresh» в SideStore (данные сохраняются, пока приложение не удалено);
- только стандартные возможности (без push, App Groups и т.п.). Наше приложение их не использует.

## 5. Ограничения GitHub Actions / Expo

- Публичный репозиторий: стандартные runner'ы бесплатны, лимита минут нет; artifacts/release storage — в рамках бесплатного лимита аккаунта (у Free 500 MB artifacts, releases в публичном репо считаются отдельно от artifacts — но артефакты мы храним только 14 дней и не накапливаем).
- Приватный репозиторий: 2 000 минут/мес и macOS-минуты с множителем ~10 × $0.062/мин — **не используется**.
- Larger runners платные даже для public — **не используются**.
- Expo/EAS не используются в основном пути: EAS free tier — это ограниченные сборки и передача Apple credentials сервису; local CLI бесплатен.
- Никаких платёжных данных не требуется; workflow не может инициировать платные ресурсы (нет larger runners, нет секретов, нет API биллинга).

## 6. AltSource / прямая установка

- SideStore поддерживает AltStore-источники («fully compatible with AltStore Sources»).
- `source.json` публикуется как asset latest release: стабильные URL вида
  `https://github.com/<owner>/<repo>/releases/latest/download/Forma.ipa` и `…/source.json`.
- В SideStore: `sidestore://source?url=<source.json>` или вручную добавить источник.
- Прямая установка без источника: скачать `Forma.ipa` в Files и открыть в SideStore — тоже работает (`sidestore://install?url=…`).
- `marketplaceID`/`build` не указываем — это признак notarized (AltStore PAL), иначе SideStore откажется добавлять источник.

## 7. Что подтверждено локально, а что — нет

Подтверждено на Windows:
- `npm ci`, `tsc --noEmit`, `eslint`, `jest` (логика + компоненты), `expo export --platform ios`;
- генерация iOS-проекта (`scripts/win-prebuild-ios.js`) — позволяет проверить Bundle ID, Info.plist, entitlements, deployment target;
- тесты валидатора IPA и source.json на фикстурах.

Не подтверждено (требует запуска macOS/iPhone):
- реальная компиляция Xcode, успешность `pod install` для всех нативных модулей;
- фактическая установка и подпись через SideStore;
- поведение на реальном iPhone (шрифты, анимации, календарь).
Эти пункты явно помечены в итоговом отчёте и в `docs/INSTALL.md`.

## 8. Действия владельца

1. Разрешить публикацию: `git init`, public repo, `git push` (я подготовлю файлы, но не создаю репозиторий и не пушу без разрешения).
2. Запустить workflow `Build unsigned iOS IPA` (кнопка Run workflow).
3. Скачать `Forma.ipa` из Release (или Artifacts).
4. Установить SideStore на iPhone через iloader (Windows), затем установить `Forma.ipa` (Files или источник).
