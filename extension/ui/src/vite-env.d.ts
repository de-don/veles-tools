/// <reference types="vite/client" />
/// <reference types="chrome" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_VERSION?: string;
  readonly npm_package_version?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
