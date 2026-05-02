import { lazy } from 'react';
// Plugin: membership
const membershipAdminUI = lazy(() => import('../plugins/membership/admin/index').catch(() => ({ default: () => null })));

export const PLUGIN_CODE_REGISTRY: Record<string, any> = {
  'membership': {
    getAdminApp: async () => {
      try {
        const mod = await import('../plugins/membership/index');
        return mod.default?.admin || mod.admin || mod.adminApp;
      } catch (e) {
        console.error('❌ [Registry] Failed to load admin app for membership:', e);
        return null;
      }
    },
    getStorefrontApp: async () => {
      try {
        const mod = await import('../plugins/membership/index');
        return mod.default?.storefront || mod.storefront || mod.sfApp;
      } catch (e) {
        return null;
      }
    },
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
