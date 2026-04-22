name = "backend"
compatibility_date = "2024-02-08"
compatibility_flags = ["nodejs_compat"]


# 静态资源指向 (Astro SSR)
pages_build_output_dir = "./dist"

# D1 数据库绑定（仅后端可见）
[[d1_databases]]
binding = "DB"
database_name = "trade_system_db"
database_id = "placeholder-id"
migrations_dir = "./src/db/migrations"

# R2 存储项绑定
[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "trade-media-bucket"

# KV 缓存绑定 (用于域名调度)
[[kv_namespaces]]
binding = "NS_CONFIG"
id = "placeholder-kv-id"

[vars]
# 这里也可以存放 CF_ACCOUNT_ID 等，但我们遵循根目录配置
CF_ACCOUNT_ID = "id"
CF_API_TOKEN = "token"
DEFAULT_ADMIN_PASSWORD="password"

[observations]
enabled = true
