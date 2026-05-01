import { createDbClient, schema, eq } from '../src/db';
import { passwordHasher } from '../src/lib/auth';

async function resetAdmin() {
  // 注意：这里需要根据你的环境获取 D1 绑定，如果是本地测试，通常使用 local d1
  // 这里仅作为逻辑参考，或者你可以直接在 auth.ts 中临时写一个 reset 路由
  const password = "admin123";
  const hashedPassword = await passwordHasher.hash(password);
  
  console.log(`Resetting admin password to: ${password}`);
  console.log(`New Hash: ${hashedPassword}`);
  
  // 建议直接在 auth.ts 中添加一个临时路由来执行此操作
}

resetAdmin();
