import { Lucia } from "lucia";
import { DrizzleSQLiteAdapter } from "@lucia-auth/adapter-drizzle";
import bcrypt from "bcryptjs";
import { createDbClient, schema } from "../db";

/**
 * 密码哈希抽象接口 (兼容 Web Crypto / Pure JS)
 * 使用 bcryptjs 确保在 Cloudflare Workers 环境下无原生模块依赖
 */
export const passwordHasher = {
  hash: async (password: string) => bcrypt.hash(password, 10),
  verify: async (hash: string, password: string) => bcrypt.compare(password, hash)
};


/**
 * 获取 Lucia 鉴权实例
 * 分别为管理后台和前台会员提供独立的物理隔离实例
 */
export const getAuthInstances = async (d1: any) => {
  const db = await createDbClient(d1);

  // 1. 管理员鉴权实例
  const adminAdapter = new DrizzleSQLiteAdapter(db, schema.adminSessions, schema.admins);
  const adminAuth = new Lucia(adminAdapter, {
    sessionCookie: {
      name: "admin_session",
      attributes: {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    },
    getUserAttributes: (attributes: any) => {
      return {
        username: attributes.username
      };
    },
  });

  // 2. 会员鉴权实例 (物理隔离，使用新版 Identity Schema)
  const userAdapter = new DrizzleSQLiteAdapter(db, schema.memberSessions, schema.members);
  const userAuth = new Lucia(userAdapter, {
    sessionCookie: {
      name: "user_session",
      attributes: {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    },
    getUserAttributes: (attributes: any) => {
      return {
        email: attributes.email,
        status: (attributes as any).status,
        tenantId: (attributes as any).tenantId
      };
    },
  });

  return { adminAuth, userAuth };
};

// 为 TypeScript 提供类型导出
declare module "lucia" {
  interface Register {
    Lucia: ReturnType<typeof getAuthInstances>["adminAuth"];
    DatabaseUserAttributes: {
      username: string;
      email: string;
      status: string;
    };
  }
}
