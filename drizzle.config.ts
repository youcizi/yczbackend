import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    wranglerConfigPath: "./wrangler.toml",
    dbName: "trade_system_db",
  },
} satisfies Config;
