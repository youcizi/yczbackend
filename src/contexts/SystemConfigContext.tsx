import React, { createContext, useContext, useMemo } from 'react';

interface SystemConfig {
  activePlugins: string[];
}

const SystemConfigContext = createContext<SystemConfig | undefined>(undefined);

export const SystemConfigProvider: React.FC<{ config: SystemConfig; children: React.ReactNode }> = ({ 
  config, 
  children 
}) => {
  return (
    <SystemConfigContext.Provider value={config}>
      {children}
    </SystemConfigContext.Provider>
  );
};

export const useSystemConfig = () => {
  const context = useContext(SystemConfigContext);
  if (!context) {
    throw new Error('useSystemConfig must be used within a SystemConfigProvider');
  }
  return context;
};

export const useIsPluginActive = (slug: string) => {
  const { activePlugins } = useSystemConfig();
  return useMemo(() => activePlugins.includes(slug), [activePlugins, slug]);
};
