/// <reference types="vite/client" />

interface ImportMetaEnv { readonly VITE_KAKAO_JAVASCRIPT_KEY?: string; readonly VITE_APP_BRAND?: string }
interface ImportMeta { readonly env: ImportMetaEnv }


declare const __DAON_INCLUDE_LOCAL_BOOTSTRAP__: boolean;
