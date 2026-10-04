# LoreMore

An Expo + React Native + TypeScript journal app that turns daily moments into a personal story. The app includes email/password authentication and protected Today, Story, Projects, and Profile tabs. Today shows a chronological local-day timeline and supports manual photo imports into private Supabase Storage. Additional capture and AI features are tracked in issues #6–#15.

## Run locally

Use Node.js 24 LTS (see `.nvmrc`) and npm. From the repository root:

```sh
nvm use
npm ci
cp .env.example .env  # only on a fresh checkout; preserve existing local values
npm run web
```

Without a public Supabase key, the app shows a setup screen and keeps the main tabs inaccessible. For an iOS development build, install Xcode with Swift 6.2 or later, an iOS Simulator runtime, and CocoaPods, then run `npm run ios`. That command generates the native iOS project, builds the development client, and starts Metro. For later sessions use `npm start`. Android developers can run `npm run android` with Android Studio and an emulator installed.

`eas.json` also provides `development`, `development-simulator`, and `production` build profiles for a future EAS project. No EAS account, remote build, or store release is configured yet. The default native identifier `com.loremore.app.dev` is a development placeholder; set `IOS_BUNDLE_ID` before signing or distributing on devices, and choose the Android package in `app.config.ts` before publishing.

## Configuration and secrets

Expo automatically loads root `.env` files. Only explicit `EXPO_PUBLIC_*` references are read by client code in `src/config/environment.ts`:

- `EXPO_PUBLIC_SUPABASE_URL` identifies the Supabase project.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the preferred public client key.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` is a legacy alternative used when the publishable key is blank.

Copy these public values from [Supabase API Keys](https://supabase.com/dashboard/project/mkfkevnncrxmtnbgwzup/settings/api-keys) to enable authentication. MCP login does not provide application credentials. Unprefixed `SUPABASE_URL` and key variables remain available for server tooling, but are not used by the mobile app. Do not add server credentials to public variables or Expo's `extra` config.

The root `.env.example` also documents server-only AI, voice, and webhook settings. `supabase/functions/.env.example` is the separate Edge Function template: Supabase injects its own reserved `SUPABASE_*` variables there, so custom bucket and webhook settings use `LOREMORE_*`. Local and hosted secrets must be configured separately. Bucket names do not create buckets.

All local env files and `Secrets.xcconfig` files are ignored. The original native-only xcconfig template is preserved in `config/native-reference/` as a reference; Expo does not load it. Native `ios/` and `android/` directories are generated and ignored. Put persistent native configuration in app config/config plugins, including the future share extension.

## Authentication

The client reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY`). These are Expo’s client equivalents of the unprefixed server variables. Invalid URLs and secret/service-role credentials are rejected by the client configuration guard. This guard is not a substitute for keeping privileged values out of public build variables: Expo embeds public values in the bundle.

Create an account with an email and a password of at least eight characters. Supabase may enforce additional password requirements. With email confirmation enabled, the app stays signed out and asks the user to confirm their email, then return to sign in. No automatic email-link session exchange is implemented in this foundation. Set a working Supabase Auth Site URL for the confirmation landing page and configure SMTP/delivery settings for real users; do not disable email confirmation to bypass testing.

Native sessions are stored in encrypted Expo SecureStore, split into small ASCII chunks to stay within platform value-size limits. A manifest is committed only after all chunks are saved. Web sessions use the Supabase SDK's default browser local storage. Browser scripts can access that storage, so keep the web deployment free of untrusted scripts. Tokens and passwords are never logged or added to app config.

During startup, the provider restores the session and verifies the user with Supabase before rendering protected routes. Verification/network errors fail closed with retry and sign-out actions. Foreground/background events control native token refresh; listeners are removed on unmount. Sign-out uses local scope (this device), and errors are displayed instead of pretending logout succeeded.

Expo Router removes the main tabs from unauthenticated navigation, including direct links and browser back navigation. This protects UI access only: the database migration enforces RLS and Storage authorization and must be deployed before connecting private data. Public keys are intentionally not an authorization boundary.

### Authentication smoke test

1. Fill the ignored `.env` public client values, then restart/reload the Expo app. Keep committed examples blank for keys.
2. Visit `/projects` while signed out. Expect the sign-in page and no tab bar.
3. Create an account using an email inbox you control; confirm the email, then sign in. Keep the password in the app, not terminal arguments or chat.
4. Open Profile and confirm your email; reload or restart and confirm the session restores.
5. Sign out. Visit a protected route or use Back; expect sign-in. Restart and confirm you remain signed out.
6. Test an incorrect password and a disconnected network; errors must permit retry without exposing private screens.

The automated tests use mocked auth responses and storage. A read-only call to the configured project's Auth settings verified the public key, enabled email auth/sign-up, and required email confirmation. A successful real-account signup/confirmation/login and a native development-device run remain manual checks; no test user was created automatically.

## Structure

- `src/app/`: Expo Router layouts and four tab screens.
- `src/components/`: shared journal screen and empty-state components.
- `src/moments/`: Today feed, photo preparation, private previews, and the moment repository.
- `src/theme/`: color, spacing, radius, and typography tokens.
- `src/config/`: explicit public environment configuration.
- `src/auth/`: session provider, route gate, and chunked native SecureStore adapter.
- `src/lib/supabase.ts`: the single reusable Supabase client.
- `__tests__/`: authentication lifecycle, form, configuration, and storage tests.
- `supabase/`: local configuration, database migrations, ownership tests, and the server environment template.

## Database

See [the database guide](supabase/README.md) for the nine-table schema, private bucket path convention, deletion behavior, local test commands, and hosted deployment boundaries. Migrations have not been applied to the hosted project.

## Validation

```sh
npm run check
npx expo install --check
npm run export
```

CI checks types, auth regression tests, Expo dependency compatibility, and iOS/Android/web bundling. Native builds additionally require the platform toolchain. On the initial development Mac, Xcode 16.3 / Swift 6.1 blocks ExpoModulesJSI: its Apple package requires Swift tools 6.2. CocoaPods installs successfully with the workaround below, but native launch remains unverified until Xcode is updated. Before merging, complete the authentication smoke test below. The JavaScript exports do not prove that native Keychain/Keystore persistence works on a device.

If CocoaPods reports Ruby gem path conflicts on a Mac with both RVM and Homebrew Ruby, use one consistent Ruby installation. A command-scoped workaround for the Homebrew CocoaPods installation is `env -u GEM_HOME -u GEM_PATH LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8 pod install` inside the generated `ios/` directory.

The dependency audit reports transitive advisories in Expo tooling/navigation dependencies (`braces`, `node-forge`, `uuid`, and `decode-uri-component`), with additional advisories in transitive test tooling. There is no compatible automatic fix across the installed SDK; do not use `npm audit fix --force`, which suggests incompatible SDK changes. Review upstream updates before production deployment.

References: [Expo environment variables](https://docs.expo.dev/guides/environment-variables/), [Expo project setup](https://docs.expo.dev/get-started/create-a-project/), and [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets).

## Today and photo import

Apply the migrations described in [supabase/README.md](supabase/README.md) before testing against a project. Sign in, open Today, choose **Add a photo**, and select an image. The app shows preparation, upload, and save stages, then refreshes the timeline. Older photos are added to the day of import; source timestamps are preserved separately when available. Photos are resized to a maximum 2048-pixel long edge and saved as JPEG.

To verify recovery, interrupt the connection during an import, reconnect, and choose **Retry photo import**. It should create one moment. **Remove this import** removes an unfinished import and its file. Keep the app open until completion; background upload recovery is not implemented. Pull down to refresh on mobile, or use **Refresh**. Sign in as a different user to confirm their timeline does not contain the first user's photos.
