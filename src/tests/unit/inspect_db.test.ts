
import { test } from 'vitest';
import { createDbClient } from '../src/db/index.ts';
import { admins, roles, adminsToRoles, rolePermissions } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

test('inspect db permissions', async () => {
  const db = await createDbClient('local.db');
  
  const allAdmins = await db.select().from(admins).all();
  console.log('--- Admins ---');
  console.table(allAdmins.map(a => ({ id: a.id, username: a.username })));

  const testUser = allAdmins.find(a => a.username === 'test');
  if (!testUser) {
    console.log('User "test" not found');
    return;
  }

  const userRoles = await db.select({
    roleId: roles.id,
    roleName: roles.name,
    scope: roles.scope,
    tenantId: adminsToRoles.tenantId
  })
  .from(adminsToRoles)
  .innerJoin(roles, eq(adminsToRoles.roleId, roles.id))
  .where(eq(adminsToRoles.adminId, testUser.id))
  .all();

  console.log(`--- Roles for user "test" (${testUser.id}) ---`);
  console.table(userRoles);

  for (const r of userRoles) {
    const perms = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, r.roleId)).all();
    console.log(`--- Permissions for role "${r.roleName}" ---`);
    console.table(perms);
  }
});
