const { withEntitlementsPlist, withInfoPlist, withXcodeProject } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;
const TARGET = 'LoreMoreShare';

module.exports = function withShareExtension(config) {
  const bundle = config.ios?.bundleIdentifier;
  if (!bundle) throw new Error('An iOS bundle identifier is required for the share extension.');
  const extensionBundle = process.env.SHARE_EXTENSION_BUNDLE_ID || `${bundle}.share`;
  const group = process.env.IOS_APP_GROUP_ID || `group.${bundle}.shared`;
  if (!extensionBundle.startsWith(`${bundle}.`) || !/^[a-zA-Z0-9.-]+$/.test(extensionBundle)) {
    throw new Error('SHARE_EXTENSION_BUNDLE_ID must be a child of IOS_BUNDLE_ID.');
  }
  if (!/^group\.[a-zA-Z0-9.-]+$/.test(group)) throw new Error('Invalid IOS_APP_GROUP_ID.');
  const entitlements = { 'com.apple.security.application-groups': [group] };
  config = withEntitlementsPlist(config, c => {
    c.modResults['com.apple.security.application-groups'] = [...new Set([...(c.modResults['com.apple.security.application-groups'] || []), group])];
    return c;
  });
  config = withInfoPlist(config, c => { c.modResults.LoreMoreAppGroup = group; return c; });
  // EAS must know about the extension before prebuild to provision both targets.
  const eas = config.extra?.eas || {};
  const build = eas.build || {};
  const experimental = build.experimental || {};
  config.extra = { ...config.extra, eas: { ...eas, build: { ...build, experimental: {
    ...experimental, ios: { ...experimental.ios, appExtensions: [
      ...(experimental.ios?.appExtensions || []).filter(item => item.targetName !== TARGET),
      { targetName: TARGET, bundleIdentifier: extensionBundle, entitlements },
    ] },
  } } } };
  return withXcodeProject(config, c => {
    const project = c.modResults;
    const directory = path.join(c.modRequest.platformProjectRoot, TARGET);
    fs.mkdirSync(directory, { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'share-extension/ShareViewController.swift'), path.join(directory, 'ShareViewController.swift'));
    fs.copyFileSync(path.join(c.modRequest.projectRoot, 'modules/loremore-share/ios/ShareInbox.swift'), path.join(directory, 'ShareInbox.swift'));
    fs.writeFileSync(path.join(directory, 'Info.plist'), plist.build({
      CFBundleDisplayName: 'Add to LoreMore', CFBundleName: TARGET,
      CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)', CFBundleExecutable: '$(EXECUTABLE_NAME)',
      CFBundlePackageType: 'XPC!', CFBundleShortVersionString: c.version || '1.0.0',
      CFBundleVersion: c.ios?.buildNumber || '1', LoreMoreAppGroup: group,
      NSExtension: { NSExtensionPointIdentifier: 'com.apple.share-services',
        NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).ShareViewController',
        NSExtensionAttributes: { NSExtensionActivationRule: { NSExtensionActivationSupportsImageWithMaxCount: 1 } } },
    }));
    fs.writeFileSync(path.join(directory, `${TARGET}.entitlements`), plist.build(entitlements));
    let entry = Object.entries(project.pbxNativeTargetSection()).find(([key, value]) => !key.endsWith('_comment') && value.name?.replaceAll('"', '') === TARGET);
    if (!entry) {
      project.hash.project.objects.PBXTargetDependency ||= {};
      project.hash.project.objects.PBXContainerItemProxy ||= {};
      const target = project.addTarget(TARGET, 'app_extension', TARGET, extensionBundle);
      entry = [target.uuid, target.pbxNativeTarget];
      project.addBuildPhase([`${TARGET}/ShareViewController.swift`, `${TARGET}/ShareInbox.swift`], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
      project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
      const mainGroup = project.getFirstProject().firstProject.mainGroup;
      for (const [id, file] of Object.entries(project.pbxFileReferenceSection())) {
        if (!id.endsWith('_comment') && file.path?.includes(`${TARGET}/`) && file.path.endsWith('.swift"')) {
          project.addToPbxGroup({ fileRef: id, basename: path.basename(file.path.replaceAll('"', '')) }, mainGroup);
        }
      }
    }
    const [targetId, target] = entry;
    const configs = project.pbxXCConfigurationList()[target.buildConfigurationList].buildConfigurations;
    for (const ref of configs) {
      Object.assign(project.pbxXCBuildConfigurationSection()[ref.value].buildSettings, {
        PRODUCT_BUNDLE_IDENTIFIER: `"${extensionBundle}"`, PRODUCT_NAME: `"${TARGET}"`,
        INFOPLIST_FILE: `"${TARGET}/Info.plist"`, CODE_SIGN_ENTITLEMENTS: `"${TARGET}/${TARGET}.entitlements"`,
        SWIFT_VERSION: '5.9', IPHONEOS_DEPLOYMENT_TARGET: '16.4', TARGETED_DEVICE_FAMILY: '"1,2"',
        APPLICATION_EXTENSION_API_ONLY: 'YES', SKIP_INSTALL: 'YES', GENERATE_INFOPLIST_FILE: 'NO',
        CURRENT_PROJECT_VERSION: c.ios?.buildNumber || '1', MARKETING_VERSION: c.version || '1.0.0',
        CODE_SIGN_STYLE: 'Automatic', ...(c.ios?.appleTeamId ? { DEVELOPMENT_TEAM: c.ios.appleTeamId } : {}),
      });
    }
    project.addTargetAttribute('ProvisioningStyle', 'Automatic', { uuid: targetId });
    return c;
  });
};
