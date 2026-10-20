# Статус проекта «Форма» — 20.10.2026 (первая облачная сборка успешна)

## Главное

- Публичный репозиторий: **https://github.com/IHiks/forma-fitness** (ветка `main`).
- Первая облачная сборка **успешна**: run
  https://github.com/IHiks/forma-fitness/actions/runs/39410967330 —
  job «Unsigned IPA (Xcode 27)» ✓ за 14m31s (runner `xcode-27`, Xcode 27.0).
- Артефакт: Release **v1.0.0-unsigned**
  (https://github.com/IHiks/forma-fitness/releases/tag/v1.0.0-unsigned):
  `Forma.ipa` (11 637 589 байт, sha256
  `280a8e26da147b3ddbfae7767d0bfb106e8a195ed25816d922c5a7aeed3d7f59`) +
  `source.json` (для SideStore; UTF-8, без `marketplaceID`/`build`).
- IPA проверен локально `scripts/verify-ipa.mjs`: Payload/Forma.app, arm64
  Mach-O, Hermes-бандл, bundle id `com.ihiks.forma`, версия 1.0.0,
  MinimumOSVersion 16.4, профиль подписи отсутствует; sha256 совпадает с
  `source.json` релиза.
- Установка на iPhone — по `docs/INSTALL.md` (SideStore: LocalDevVPN +
  iloader → переподпись Personal Team).

## Как прошла сборка и что было исправлено

1. Первая попытка (run 39408565522) упала НЕ из-за Xcode: архив собрался
   (`Archive Succeeded`), но `verify-ipa.mjs` отклонил Info.plist — его
   бинарный парсер не умел (а) корневой объект не на индексе 0 (поле
   `topObject` в trailer), (б) строки/словари с расширенной длиной (0x5f),
   в которых у реального Info.plist от Xcode 27 лежат длинные ключи
   (`CFBundleIdentifier` = 18 символов). Синтетические тесты использовали
   XML-plist и этот путь не покрывали.
2. Исправлено в коммите `a3cea74`: чтение `topObject`, fallback-обход всех
   объектов, поддержка расширенных длин (строки/массивы/словари), исправлен
   сдвиг данных UTF-16; добавлен регрессионный тест с бинарным plist
   (корень ≠ 0, длинные ключи). Тестов стало 106 — все зелёные.
3. Вторая попытка (run 39410967330) — успех с первой ошибки.

## Где мы сейчас

Приложение **написано полностью**; локальные проверки зелёные:

```
npm run typecheck   # ✅ 0 ошибок
npm run lint        # ✅ 0 ошибок, 0 предупреждений
npx jest            # ✅ 8 suites, 106 тестов
npx expo export --platform ios   # ✅ Hermes-бандл 6.6 МБ в dist/
```

Что **не проверено локально** (честно): запуск на реальном iPhone, сборка
Xcode на macOS, установка через SideStore. Это невозможно без iPhone и Mac —
все они выполняются через GitHub Actions + SideStore по `docs/INSTALL.md`.

## Что сделано в этой сессии

1. **12 ошибок tsc исправлены**: number-варианты `TextVariant`, fallback для
   `muscleColors[i]`, `trendFromSeries` для готовых точек, неиспользуемые импорты,
   `setSaving` в `onSubmit`.
2. **Три недостающих экрана**:
   - `app/(tabs)/settings.tsx` — тема (system/dark/light), стартовый/целевой
     вес, менеджер привычек, экспорт JSON (File/Paths + Sharing), импорт
     (DocumentPicker + `parseBackupText` + подтверждение «объединить/заменить»),
     стирание данных, версия.
   - `app/nutrition/day.tsx` — отметка «план соблюдён / отход / не отмечено»
     (тройное состояние, ≠ пропуск), заметка, дата.
   - `app/habit/manage.tsx` — добавление, переименование, архивирование,
     возврат из архива, удаление (с каскадом чеков).
3. **БД**: `HabitRepository.remove()` (каскад) и `unarchive()`; в контекст
   добавлены `habitsArchived`, `deleteHabit`, `unarchiveHabit`.
4. **Тесты (105)**:
   - домены: вес (округление, дубликаты, пропуски, тренд, недельные средние,
     периоды с якорем), тренировки (12 групп, мультивыбор, статистика,
     распределение, фильтры), даты (RU-формат, границы недель/месяцев),
     календарь («нет записи» ≠ «отход», детали дня), бэкап (валидация,
     ошибки с путями, `describeImport`);
   - репозитории на in-memory SQLite (sql.js): upsert веса, мультигруппы,
     каскадное удаление привычек, **персистентность через переоткрытие БД**,
     экспорт→импорт (replace/merge, идемпотентность привычек), стирание;
   - компоненты: WeightChart (пустое состояние, разрывы), MonthSwitcher, Pill;
   - CI: `scripts/verify-ipa.mjs` прогнан на синтетических IPA (9 сценариев:
     ок, чужой bundle id, нет бандла, малый бандл, профиль подписи, не-zip,
     старый iOS, генерация source.json без marketplaceID/build).
5. **CI/доставка**:
   - `scripts/build-unsigned-ipa.sh` — npm ci → prebuild → pod install →
     archive (CODE_SIGNING_ALLOWED=NO) → ditto IPA → verify;
   - `scripts/verify-ipa.mjs` — без зависимостей: ZIP-ридер, мини-парсер
     binary/XML plist, Mach-O arm64, Hermes-сигнатура, мин. iOS 16.4,
     генерация и перекрёстная проверка AltSource `source.json`;
   - `.github/workflows/ios-unsigned.yml` — runner `xcode-27` (fallback
     `macos-26` задокументирован), workflow_dispatch + push в main, кеш pods,
     Release с `Forma.ipa` + `source.json`, step summary.
6. **Документация**: `docs/INSTALL.md` — полный путь установки на iPhone.

## Подготовка к первой облачной сборке (проверено 20.10.2026)

- **Runner**: `xcode-27` числится в официальной таблице стандартных
  GitHub-hosted runner'ов для **публичных** репозиториев (docs.github.com →
  GitHub-hosted runners), образ: macOS 27.0.1, **Xcode 27.0 default**
  (iOS SDK 27.0), Node 24.21, npm 11.19, CocoaPods 1.17 — совместимо с
  Expo SDK 58 (нужен Xcode 26.4+). Платные larger runners не используются.
  Запасной вариант `macos-26` оставлен в workflow и документации.
- **Сборка для реального iPhone**: `-destination "generic/platform=iOS"`
  (не Simulator), `CODE_SIGNING_ALLOWED=NO` — неподписанный архив; упаковка
  через `ditto` (Payload/Forma.app), проверка `verify-ipa.mjs`: arm64 Mach-O,
  Hermes, bundle id `com.ihiks.forma`, версия, **MinimumOSVersion = 16.4
  совпадает с IPHONEOS_DEPLOYMENT_TARGET в сгенерированном pbxproj**.
- **Безопасность**: `.env`/ключей/сертификатов/персональных данных в файловом
  дереве нет; `.gitignore` исключает `node_modules/`, `dist/`, `ios/`,
  `build/`, `*.ipa`, `.env*`; workflow использует только `${{ github.token }}`.
  Ничего не опубликовано — проект даже не является git-репозиторием.
- **Release**: содержит `Forma.ipa` + `source.json` (sha256, размер,
  downloadURL), дублируется артефактом на 3 дня; при падении логи шагов
  (npm/pod/xcodebuild) доступны, ошибки Xcode выводятся повторно без
  xcbeautify, есть `::error::`-аннотации и step summary.
- **SideStore**: `docs/INSTALL.md` приведён к актуальной официальной
  документации (docs.sidestore.io): LocalDevVPN из App Store, iloader с
  `github.com/nab138/iloader` (MSI), процедура доверия, Developer Mode,
  вход в SideStore → тап «7 DAYS» → Refresh, лимиты 3 приложений / 10 App ID
  в неделю, официальные Anisette-серверы, pairing после обновления iOS.

## Оставшиеся шаги (требуют действий пользователя)

1. **Запушить проект в публичный репозиторий GitHub** (проект ещё не
   git-репозиторий; мне нужно ваше разрешение на `git init` + push).
2. Запустить Actions → «Build unsigned iOS IPA».
3. Скачать `Forma.ipa`, установить SideStore через iloader, установить приложение
   (`docs/INSTALL.md`).
4. На iPhone проверить то, что локально непроверяемо:
   - первичный запуск, splash, обе темы;
   - добавление/правка веса, тренировки, привычки, питания;
   - перезапуск приложения (персистентность SQLite);
   - экспорт JSON в «Файлы» и импорт обратно;
   - календарь, история, фильтры.

## Известные ограничения / честные оговорки

- `react-native-svg` и шрифты проверены только в Jest и Metro-бандле;
  рендеринг на устройстве непроверяем локально.
- Сборка Xcode никогда не выполнялась (нет Mac) — первая сборка в Actions может
  потребовать правки workflow (все вероятные места помечены комментариями).
- `xcode-27` — проверен по официальной документации GitHub (есть в таблице
  стандартных runner'ов для публичных репозиториев; образ содержит Xcode 27.0
  по умолчанию); запасной вариант `macos-26` задокументирован.
- 7-дневная подпись Personal Team — ограничение Apple, не проекта; SideStore
  обновляет подпись по Wi-Fi при подключённом LocalDevVPN (Refresh).

## Ключевые файлы

| Область | Файлы |
|---|---|
| Экраны | `app/(tabs)/{index,history,workouts,calendar,settings}.tsx`, `app/{weight/add,workout/form,nutrition/day,habit/manage}.tsx` |
| Домен | `src/domain/{dates,weight,workouts,habits,calendar,backup,settings}.ts` |
| БД | `src/db/{sqlite,migrations,repositories,expoDatabase}.ts` |
| UI | `src/ui/{primitives,layout,WeightChart,CalendarSheet}.tsx`, `src/theme/*` |
| Тесты | `src/domain/__tests__/*`, `src/db/__tests__/repositories.test.ts`, `src/ci/__tests__/verifyIpa.test.ts`, `src/ui/__tests__/components/ui.test.tsx`, `src/__tests__/helpers/testDb.ts` |
| CI | `.github/workflows/ios-unsigned.yml`, `scripts/{build-unsigned-ipa.sh,verify-ipa.mjs,make-icons.js,win-prebuild-ios.js}` |
| Документы | `docs/{INSTALL.md,TECHNICAL_PLAN.md,STATUS.md}` |
