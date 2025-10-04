interface ExtensionManifest {
  name?: string;
  version?: string;
}

const runtimeManifest: ExtensionManifest | null =
  typeof chrome !== 'undefined' && typeof chrome.runtime?.getManifest === 'function'
    ? (chrome.runtime.getManifest() as ExtensionManifest)
    : null;

const envName = import.meta.env.VITE_APP_NAME;
const envVersion = import.meta.env.VITE_APP_VERSION ?? import.meta.env.npm_package_version;

export const APP_NAME =
  runtimeManifest?.name && runtimeManifest.name.trim().length > 0
    ? runtimeManifest.name
    : envName && envName.trim().length > 0
      ? envName
      : 'Veles Tools';

export const APP_VERSION =
  runtimeManifest?.version && runtimeManifest.version.trim().length > 0
    ? runtimeManifest.version
    : envVersion && envVersion.trim().length > 0
      ? envVersion
      : '0.0.0';
