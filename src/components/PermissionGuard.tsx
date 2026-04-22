import React from 'react';
import { hasPermission } from '../lib/rbac';

interface PermissionGuardProps {
  permissions: string[]; // 当前用户拥有的权限列表
  required: string;      // 需要的权限标识
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * 权限守卫组件 (React)
 * 用于根据权限动态隐藏/显示 UI 元素（如按钮、操作项）
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({ 
  permissions, 
  required, 
  children, 
  fallback = null 
}) => {
  const allowed = hasPermission(permissions, required);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
