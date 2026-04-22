
import { registry } from '../src/lib/permission-registry';

console.log('--- Permission Registry Audit ---');
registry.initCorePermissions();
const allPerms = registry.getAll();
const aiPerm = allPerms.find(p => p.slug === 'settings.ai');

if (aiPerm) {
  console.log('✅ Found settings.ai permission:');
  console.log(JSON.stringify(aiPerm, null, 2));
} else {
  console.error('❌ settings.ai permission NOT found!');
}

const mailPerm = allPerms.find(p => p.slug === 'settings.mail');
console.log(`Mail permission: ${mailPerm ? '✅' : '❌'}`);

const generalPerm = allPerms.find(p => p.slug === 'settings.general');
console.log(`General permission: ${generalPerm ? '✅' : '❌'}`);
