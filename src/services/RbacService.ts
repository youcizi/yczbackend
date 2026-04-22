import { eq, and, or, inArray } from 'drizzle-orm';
import { adminsToRoles, roles, rolePermissions } from '../db/schema';

/**
 * RbacService: 具备租户感知能力的权限逻辑引擎
 */
export class RbacService {
  /**
   * 校验管理员在特定租户下是否具备某项权限
   * @param db 数据库客户端
   * @param adminId 管理员 ID
   * @param action 权限标识 (Slug)
   * @param tenantId 租户 ID (对应 sites.id 或 0)
   */
  static async checkPermission(db: any, adminId: string, action: string, tenantId: number): Promise<boolean> {
    // 1. 并行获取：(该租户下的专属角色) + (全局系统级角色)
    const activeRoles = await db.select({
      id: roles.id,
      name: roles.name,
      scope: roles.scope
    })
    .from(adminsToRoles)
    .innerJoin(roles, eq(adminsToRoles.roleId, roles.id))
    .where(and(
      eq(adminsToRoles.adminId, adminId),
      or(
        eq(adminsToRoles.tenantId, tenantId),
        eq(roles.scope, 'system')
      )
    )).all();

    if (activeRoles.length === 0) return false;

    // 2. 超级管理员直接放行
    if (activeRoles.some((r: any) => r.name === 'SuperAdmin')) return true;

    // 3. 获取所有关联的权限标识
    const roleIds = activeRoles.map((r: any) => r.id);
    const perms = await db.select({ slug: rolePermissions.permissionSlug })
      .from(rolePermissions)
      .where(inArray(rolePermissions.roleId, roleIds))
      .all();

    const slugs = perms.map((p: any) => p.slug);

    // 4. 判定
    return slugs.includes('*') || slugs.includes('all') || slugs.includes(action);
  }

  /**
   * 获取用户在特定租户下的所有权限列表
   */
  static async getPermissions(db: any, adminId: string, tenantId: number): Promise<string[]> {
    const activeRoles = await db.select({
      id: roles.id
    })
    .from(adminsToRoles)
    .innerJoin(roles, eq(adminsToRoles.roleId, roles.id))
    .where(and(
      eq(adminsToRoles.adminId, adminId),
      or(
        eq(adminsToRoles.tenantId, tenantId),
        eq(roles.scope, 'system')
      )
    )).all();

    if (activeRoles.length === 0) return [];

    const roleIds = activeRoles.map((r: any) => r.id);
    const perms = await db.select({ slug: rolePermissions.permissionSlug })
      .from(rolePermissions)
      .where(inArray(rolePermissions.roleId, roleIds))
      .all();

    return Array.from(new Set(perms.map((p: any) => p.slug)));
  }
}
