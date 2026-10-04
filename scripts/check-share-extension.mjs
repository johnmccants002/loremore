// Verify generated native configuration in a throwaway project, never reset ios/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const xcode = require('xcode');
const plist = require('@expo/plist').default;
const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'loremore-native-'));
const env = { ...process.env, CI: '1', IOS_BUNDLE_ID: 'com.loremore.nativecheck', SHARE_EXTENSION_BUNDLE_ID: '', IOS_APP_GROUP_ID: '' };
try {
  for (const file of ['package.json', 'package-lock.json', 'app.config.ts', 'modules', 'plugins', 'src', 'tsconfig.json']) {
    fs.cpSync(path.join(root, file), path.join(temp, file), { recursive: true });
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(temp, 'node_modules'), 'dir');
  const prebuild = () => execFileSync(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'prebuild', '--no-install', '--platform', 'ios'], { cwd: temp, env, stdio: 'pipe' });
  prebuild();
  prebuild(); // A second prebuild must not duplicate targets or build phases.
  const ios = path.join(temp, 'ios');
  const projectName = fs.readdirSync(ios).find(name => name.endsWith('.xcodeproj'));
  assert(projectName, 'Xcode project generated');
  const projectPath = path.join(ios, projectName, 'project.pbxproj');
  const project = xcode.project(projectPath); project.parseSync();
  const targets = Object.entries(project.pbxNativeTargetSection()).filter(([key, value]) => !key.endsWith('_comment') && value.name?.replaceAll('"', '') === 'LoreMoreShare');
  assert.equal(targets.length, 1, 'one extension target after repeated prebuild');
  const [targetId, target] = targets[0];
  assert.equal(target.buildPhases.length, 3, 'sources, frameworks, resources only');
  const objects = project.hash.project.objects;
  assert(Object.values(objects.PBXTargetDependency).some(value => value.target === targetId), 'main app depends on extension');
  const embed = Object.values(objects.PBXCopyFilesBuildPhase).filter(value => value.dstSubfolderSpec === 13);
  assert(embed.some(phase => phase.files.some(file => objects.PBXBuildFile[file.value].fileRef === target.productReference)), 'extension embedded in app');
  const readPlist = relative => plist.parse(fs.readFileSync(path.join(ios, relative), 'utf8'));
  const extension = readPlist('LoreMoreShare/Info.plist');
  assert.equal(extension.NSExtension.NSExtensionPointIdentifier, 'com.apple.share-services');
  assert.deepEqual({ ...extension.NSExtension.NSExtensionAttributes.NSExtensionActivationRule }, { NSExtensionActivationSupportsImageWithMaxCount: 1 });
  const entitlements = readPlist('LoreMoreShare/LoreMoreShare.entitlements');
  const appFolder = fs.readdirSync(ios).find(name => fs.existsSync(path.join(ios, name, 'Info.plist')) && name !== 'LoreMoreShare');
  const appEntitlement = fs.readdirSync(path.join(ios, appFolder)).find(name => name.endsWith('.entitlements'));
  assert.deepEqual(entitlements['com.apple.security.application-groups'], readPlist(`${appFolder}/${appEntitlement}`)['com.apple.security.application-groups']);
  assert.equal(extension.LoreMoreAppGroup, readPlist(`${appFolder}/Info.plist`).LoreMoreAppGroup);
  const config = JSON.parse(execFileSync(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'config', '--type', 'public', '--json'], { cwd: temp, env, encoding: 'utf8' }));
  assert.equal(config.extra.eas.build.experimental.ios.appExtensions[0].bundleIdentifier, 'com.loremore.nativecheck.share');
  const autolink = JSON.parse(execFileSync(process.execPath, [path.join(root, 'node_modules/expo/bin/autolinking'), 'resolve', '--platform', 'apple', '--json'], { cwd: temp, env, encoding: 'utf8' }));
  assert(autolink.modules.some(module => module.packageName === 'loremore-share'), 'local native module autolinks');
  if (process.platform === 'darwin') {
    execFileSync('xcrun', ['swiftc', '-swift-version', '5', path.join(root, 'modules/loremore-share/ios/ShareInbox.swift'), path.join(root, 'tests/native/main.swift'), '-o', path.join(temp, 'inbox-tests')], { stdio: 'pipe' });
    execFileSync(path.join(temp, 'inbox-tests'), [], { stdio: 'inherit' });
    // The extension is pure Swift/UIKit and can build independently of Expo's
    // newer host-app toolchain requirement. No signing or Apple account needed.
    execFileSync('xcodebuild', ['-project', path.join(ios, projectName), '-target', 'LoreMoreShare', '-configuration', 'Release', '-sdk', 'iphonesimulator', 'CODE_SIGNING_ALLOWED=NO', `CONFIGURATION_BUILD_DIR=${path.join(temp, 'build')}`], { env, stdio: 'pipe' });
    console.log('Unsigned iOS Share Extension compiled successfully.');
  }
  console.log('Native target, embedding, App Groups, EAS metadata, autolinking, and repeat-prebuild checks passed.');
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
