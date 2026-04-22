const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const baseDir = path.resolve(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/');
const files = fs.readdirSync(baseDir).filter(f => f.endsWith('.sqlite'));

if (files.length === 0) {
    console.error('No SQLite files found in wrangler state.');
    process.exit(1);
}

const dbPath = path.join(baseDir, files[0]);
console.log('Connecting to real Wrangler DB:', dbPath);

const db = new Database(dbPath);

try {
    // 1. 获取所有合法集合标识
    const collections = db.prepare("SELECT slug FROM collections").all();
    const validSlugs = new Set();
    collections.forEach(c => {
        validSlugs.add(`collection:${c.slug}:view`);
        validSlugs.add(`collection:${c.slug}:edit`);
        validSlugs.add(`collection:${c.slug}:delete`);
    });

    console.log('Valid Collection Slugs Count:', validSlugs.size);

    // 2. 找出僵尸权限 (在 permissions 里但没有对应 collection)
    const allColPerms = db.prepare("SELECT slug FROM permissions WHERE slug LIKE 'collection:%'").all();
    const toDelete = allColPerms.filter(p => !validSlugs.has(p.slug)).map(p => p.slug);

    console.log('Orphaned permissions detected:', toDelete.length);

    if (toDelete.length > 0) {
        console.log('Slugs to clean:', toDelete);
        
        const deleteRelStmt = db.prepare("DELETE FROM role_permissions WHERE permission_slug = ?");
        const deleteStmt = db.prepare("DELETE FROM permissions WHERE slug = ?");
        
        const transaction = db.transaction((slugs) => {
            for (const slug of slugs) {
                deleteRelStmt.run(slug);
                deleteStmt.run(slug);
            }
        });

        transaction(toDelete);
        console.log('✅ Cleanup successful.');
    } else {
        console.log('No orphans found.');
    }

} catch (e) {
    console.error('Cleanup failed:', e);
} finally {
    db.close();
}
