# LoreMore

An Expo + React Native + TypeScript journal app that turns daily moments into a personal story. The first foundation includes Today, Story, Projects, and Profile tabs. These are honest placeholder screens; authentication, capture, and AI are tracked in issues #2–#15.

## Run locally

Use Node.js 24 LTS (see `.nvmrc`) and npm. From the repository root:

```sh
nvm use
npm ci
cp .env.example .env  # only on a fresh checkout; preserve existing local values
npm run web
```

The shell runs without API keys. For an iOS development build, install Xcode with Swift 6.2 or later, an iOS Simulator runtime, and CocoaPods, then run `npm run ios`. That command generates the native iOS project, builds the development client, and starts Metro. For later sessions use `npm start`. Android developers can run `npm run android` with Android Studio and an emulator installed.

`eas.json` also provides `development`, `development-simulator`, and `production` build profiles for a future EAS project. No EAS account, remote build, or store release is configured yet. The default native identifier `com.loremore.app.dev` is a development placeholder; set `IOS_BUNDLE_ID` before signing or distributing on devices, and choose the Android package in `app.config.ts` before publishing.

## Configuration and secrets

Expo automatically loads root `.env` files. Only explicit `EXPO_PUBLIC_*` references are read by client code in `src/config/environment.ts`:

- `EXPO_PUBLIC_SUPABASE_URL` identifies the Supabase project.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the preferred public client key.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` is a legacy alternative used when the publishable key is blank.

Copy these public values from [Supabase API Keys](https://supabase.com/dashboard/project/mkfkevnncrxmtnbgwzup/settings/api-keys) when implementing auth. MCP login does not provide application credentials. Unprefixed `SUPABASE_URL` and key variables remain available for server tooling, but are not used by the mobile app. Do not add server credentials to public variables or Expo's `extra` config.

The root `.env.example` also documents server-only AI, voice, and webhook settings. `supabase/functions/.env.example` is the separate Edge Function template: Supabase injects its own reserved `SUPABASE_*` variables there, so custom bucket and webhook settings use `LOREMORE_*`. Local and hosted secrets must be configured separately. Bucket names do not create buckets.

All local env files and `Secrets.xcconfig` files are ignored. The original native-only xcconfig template is preserved in `config/native-reference/` as a reference; Expo does not load it. Native `ios/` and `android/` directories are generated and ignored. Put persistent native configuration in app config/config plugins, including the future share extension.

## Structure

- `src/app/`: Expo Router layouts and four tab screens.
- `src/components/`: shared journal screen and empty-state components.
- `src/theme/`: color, spacing, radius, and typography tokens.
- `src/config/`: explicit public environment configuration.
- `supabase/functions/`: server environment template; functions will follow.

## Validation

```sh
npm run typecheck
npx expo install --check
npm run export
```

CI checks types, Expo dependency compatibility, and iOS/Android/web bundling. Native builds additionally require the platform toolchain. On the initial development Mac, Xcode 16.3 / Swift 6.1 blocks ExpoModulesJSI: its Apple package requires Swift tools 6.2. CocoaPods installs successfully with the workaround below, but native launch remains unverified until Xcode is updated. Before merging, open all four tabs and confirm headings, empty states, tab selection, and scrolling at a phone size. No sign-in or backend connection is expected in issue #1.

If CocoaPods reports Ruby gem path conflicts on a Mac with both RVM and Homebrew Ruby, use one consistent Ruby installation. A command-scoped workaround for the Homebrew CocoaPods installation is `env -u GEM_HOME -u GEM_PATH LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 pod install` inside the generated `ios/` directory.

The initial dependency audit reports transitive advisories in Expo tooling/navigation dependencies (`braces`, `node-forge`, `uuid`, and `decode-uri-component`). There is no compatible automatic fix across the installed SDK; do not use `npm audit fix --force`, which suggests incompatible SDK changes. Review upstream updates before production deployment.

References: [Expo environment variables](https://docs.expo.dev/guides/environment-variables/), [Expo project setup](https://docs.expo.dev/get-started/create-a-project/), and [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets).
