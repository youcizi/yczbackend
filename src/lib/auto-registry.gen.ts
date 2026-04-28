import { lazy } from 'react';
// Plugin: membership
const membershipAdminUI = lazy(() => import('../plugins/membership/admin/index').catch(() => ({ default: () => null })));

export const PLUGIN_CODE_REGISTRY: Record<string, any> = {
  'membership': {
    getAdminApp: async () => (await import('../plugins/membership/index').catch(() => ({}))).default?.admin,
    getStorefrontApp: async () => (await import('../plugins/membership/index').catch(() => ({}))).default?.storefront,
    getManifest: async () => (await import('../plugins/membership/manifest').catch(() => ({}))).MANIFEST,
    getInit: async () => (await import('../plugins/membership/index').catch(() => ({}))).default?.init,
    frontend: membershipAdminUI,
  },
};

/** 全局初始化代理 */
export const initializeAllPlugins = () => {
  Object.keys(PLUGIN_CODE_REGISTRY).forEach(async (slug) => {
    const init = await PLUGIN_CODE_REGISTRY[slug].getInit();
    if (init) init();
  });
};
