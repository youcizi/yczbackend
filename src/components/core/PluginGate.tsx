import React from 'react';
import { useIsPluginActive } from '../../contexts/SystemConfigContext';

interface PluginGateProps {
  slug: string;
  children: React.ReactNode;
}

/**
 * 运行时插件门控组件
 * 职责：根据插件是否激活决定是否渲染包裹的内容
 */
export const PluginGate: React.FC<PluginGateProps> = ({ slug, children }) => {
  const isActive = useIsPluginActive(slug);

  if (!isActive) {
    return null;
  }

  return <>{children}</>;
};
