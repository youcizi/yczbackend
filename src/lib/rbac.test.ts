import { describe, it, expect } from 'vitest';
import { hasPermission } from './rbac';

describe('RBAC 权限校验单元测试 (hasPermission)', () => {
  it('当用户拥有 "*" 权限时，应允许访问任何功能', () => {
    const userPerms = ['*'];
    expect(hasPermission(userPerms, 'site.edit')).toBe(true);
    expect(hasPermission(userPerms, 'any.hidden.action')).toBe(true);
  });

  it('当用户拥有 "all" 权限时，也应视为超级管理员', () => {
    const userPerms = ['all', 'other.perm'];
    expect(hasPermission(userPerms, 'product.delete')).toBe(true);
  });

  it('支持数组形式的权限检查 (OR 逻辑)', () => {
    const userPerms = ['settings.ai', 'site.view'];
    // 命中其中一个即可
    expect(hasPermission(userPerms, ['settings.ai', 'role.manage'])).toBe(true);
    expect(hasPermission(userPerms, ['settings.general', 'settings.ai'])).toBe(true);
    // 都不命中则失败
    expect(hasPermission(userPerms, ['settings.mail', 'role.manage'])).toBe(false);
  });

  it('当用户拥有特定权限时，应仅允许访问该权限对应的功能的', () => {
    const userPerms = ['site.view', 'product.edit'];
    expect(hasPermission(userPerms, 'site.view')).toBe(true);
    expect(hasPermission(userPerms, 'product.edit')).toBe(true);
    expect(hasPermission(userPerms, 'site.edit')).toBe(false);
  });

  it('当用户没有任何权限时，应拒绝所有访问', () => {
    const userPerms: string[] = [];
    expect(hasPermission(userPerms, 'site.view')).toBe(false);
    expect(hasPermission(userPerms, ['site.view', 'site.edit'])).toBe(false);
  });
});
