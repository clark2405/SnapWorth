const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

/**
 * iOS 27 stops any app at launch that hasn't adopted the scene life cycle. Expo's template adopts
 * it from SDK 58 (its own `SceneDelegate.swift` and scene manifest); earlier templates still have
 * the app delegate create its own window. For those, this moves window creation into a scene
 * delegate (Expo's `ExpoAppSceneDelegate`, which starts React Native in the scene's window) and
 * declares it in Info.plist. The app delegate keeps creating the React Native factory, and hands
 * it to the scene delegate through `ExpoReactNativeFactoryProvider`.
 *
 * On a template that already adopts scenes it changes nothing, so it's safe to keep as a guard.
 */
function withSceneLifecycle(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest ??= {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return mod;
  });

  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error('with-scene-lifecycle expects a Swift AppDelegate.');
    }
    mod.modResults.contents = adoptScenes(mod.modResults.contents);
    return mod;
  });
}

function adoptScenes(source) {
  // Already scene-based: the template's own (SDK 58 on), or this plugin's from an earlier run.
  if (source.includes('ExpoReactNativeFactoryProvider')) return source;

  const declaration = /class AppDelegate: ExpoAppDelegate \{/;
  // The template's own window: a scene delegate makes it from the scene instead.
  const ownWindow =
    /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;
  // Failing loudly beats generating an app that builds and then closes at launch.
  if (!declaration.test(source) || !ownWindow.test(source)) {
    throw new Error(
      "with-scene-lifecycle couldn't find the parts of AppDelegate.swift it changes, and the app " +
        "doesn't adopt scenes yet. Expo's template may have changed shape.",
    );
  }

  return (
    source
      .replace(declaration, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
      .replace(
        ownWindow,
        '\n    // The scene delegate creates the window and starts React Native in it.\n',
      ) +
    "\n/// Creates the app's window from its scene and starts React Native in it.\n" +
    'class SceneDelegate: ExpoAppSceneDelegate {}\n'
  );
}

module.exports = withSceneLifecycle;
