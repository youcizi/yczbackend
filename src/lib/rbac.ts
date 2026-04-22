import { createMiddleware } from 'hono/factory';
import { eq, inArray } from 'drizzle-orm';
import { roles as rolesTable, adminsToRoles, rolePermissions } from '../db/schema';
import { createDbClient } from '../db';

/**
 * 角色类型定义 (兼容旧代码标识)
 */
export type AdminRole = 'super' | 'editor' | 'viewer';

/**
 * 获取管理员的所有权限标识 (Slugs) 与 角色列表
 */
export const getAdminAuthInfo = async (db: any, adminId: string): Promise<{ permissions: string[], roles: string[] }> => {
  const userRoles = await db.select({ 
    roleId: rolesTable.id,
    roleName: rolesTable.name 
  })
    .from(adminsToRoles)
    .innerJoin(rolesTable, eq(adminsToRoles.roleId, rolesTable.id))
    .where(eq(adminsToRoles.adminId, adminId));
  
  const roleNames = userRoles.map((r: any) => r.roleName);
  if (roleNames.length === 0) return { permissions: [], roles: [] };

  const isSuper = roleNames.includes('SuperAdmin');
  if (isSuper) return { permissions: ['*'], roles: roleNames };

  const roleIds = userRoles.map((r: any) => r.roleId);
  const perms = await db.select({ slug: rolePermissions.permissionSlug })
    .from(rolePermissions)
    .where(inArray(rolePermissions.roleId, roleIds));

  return {
    permissions: Array.from(new Set(perms.map((p: any) => p.slug))),
    roles: roleNames
  };
};

/**
 * 获取管理员的所有权限标识 (向后兼容)
 */
export const getAdminPermissions = async (db: any, adminId: string): Promise<string[]> => {
  const info = await getAdminAuthInfo(db, adminId);
  return info.permissions;
};

/**
 * Hono 动态权限检查中间件
 * @param requiredPermission 需要的权限标识 (单个字符串或字符串数组，数组形式代表 OR 逻辑)
 */
export const requirePermission = (requiredPermission: string | string[]) => {
  return createMiddleware(async (c, next) => {
    const user = c.get('user') as any;

    if (!user) {
      const isTestBypass = c.env.NODE_ENV === 'test' && c.req.header('X-Test-Bypass') === 'true';
      if (isTestBypass) {
        return await next();
      }
      return c.json({ error: '未授权访问: 请先登录' }, 401);
    }

    const db = await createDbClient(c.env.DB);
    const authInfo = await getAdminAuthInfo(db, user.id);
    const userPerms = authInfo.permissions;

    // 存入上下文供后续业务（如数据隔离）使用
    c.set('userPermissions', userPerms);
    c.set('userRoles', authInfo.roles);
    c.set('isAdmin', authInfo.roles.includes('SuperAdmin'));

    // 权限校验逻辑
    const hasFullAccess = userPerms.includes('all') || userPerms.includes('*');
    
    // 支持单权限或多权限数组 (Any Match)
    const matchesPermission = Array.isArray(requiredPermission)
      ? requiredPermission.some(p => userPerms.includes(p))
      : userPerms.includes(requiredPermission);

    if (hasFullAccess || matchesPermission) {
      await next();
    } else {
      console.warn(`🔒 [RBAC] 拦截越权访问: 用户 ${user.username} 缺少所需权限 [${requiredPermission}]`);
      return c.json({ error: '权限不足', required: requiredPermission }, 403);
    }
  });
};

/**
 * 视图层权限检查辅助函数 (React 使用)
 * @param userPermissions 用户拥有的所有权限列表
 * @param targetPermission 目标权限 (支持单个或数组)
 */
export const hasPermission = (userPermissions: string[], targetPermission: string | string[]): boolean => {
  if (userPermissions.includes('all') || userPermissions.includes('*')) return true;
  
  if (Array.isArray(targetPermission)) {
    return targetPermission.some(p => userPermissions.includes(p));
  }
  return userPermissions.includes(targetPermission);
};
