/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'demo' | 'static' | 'api';
  readonly VITE_API_URL?: string;
  readonly VITE_ROUTER?: 'memory' | 'browser';
  readonly VITE_SITE_URL?: string;
}
