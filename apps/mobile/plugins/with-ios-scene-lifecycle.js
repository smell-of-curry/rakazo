const { withDangerousMod, withInfoPlist, withXcodeProject } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const SCENE_FILE = "SceneDelegate.swift";

const SCENE_SOURCE = `internal import Expo
import React
import UIKit

@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    var launchOptions = appDelegate.launchOptions ?? [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    if let userActivity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType: userActivity.activityType
      ]
    }

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions
    )
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    _ = RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }
}
`;

const WINDOW_BLOCK = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return config;
  });

  config = withDangerousMod(config, [
    "ios",
    (config) => {
      const projectName = config.modRequest.projectName;
      if (!projectName) return config;
      const dir = path.join(config.modRequest.platformProjectRoot, projectName);
      fs.writeFileSync(path.join(dir, SCENE_FILE), SCENE_SOURCE);

      const appDelegatePath = path.join(dir, "AppDelegate.swift");
      if (fs.existsSync(appDelegatePath)) {
        let source = fs.readFileSync(appDelegatePath, "utf8");
        if (!source.includes("var launchOptions:")) {
          source = source.replace(
            "var reactNativeFactory: RCTReactNativeFactory?",
            "var reactNativeFactory: RCTReactNativeFactory?\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?",
          );
        }
        if (
          source.includes("didFinishLaunchingWithOptions launchOptions") &&
          !source.includes("self.launchOptions = launchOptions")
        ) {
          source = source.replace(
            "  ) -> Bool {\n    let delegate = ReactNativeDelegate()",
            "  ) -> Bool {\n    self.launchOptions = launchOptions\n    let delegate = ReactNativeDelegate()",
          );
        }
        if (source.includes(WINDOW_BLOCK)) {
          source = source.replace(WINDOW_BLOCK, "");
        }
        fs.writeFileSync(appDelegatePath, source);
      }
      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName;
    if (!projectName) return config;
    const filePath = `${projectName}/${SCENE_FILE}`;
    if (!project.hasFile(filePath)) {
      project.addSourceFile(
        filePath,
        { target: project.getFirstTarget().uuid },
        project.findPBXGroupKey({ name: projectName }),
      );
    }
    return config;
  });

  return config;
}

module.exports = withIosSceneLifecycle;
