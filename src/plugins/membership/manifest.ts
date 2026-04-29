export const MANIFEST = {
  slug: 'membership',
  name: '会员插件',
  description: '支持 B2C/B2B 模式的高级会员管理体系，具备租户隔离的画像、等级与定价引擎。',
  version: '2.0.0',
  author: 'Antigravity Store',
  
  // 插件权限条目声明：激活时自动注入主系统
  permissions: [
    { slug: 'membership.view', name: '查看会员数据', description: '允许查看会员画像、地址与等级' },
    { slug: 'membership.manage', name: '管理会员体系', description: '允许编辑等级定价、审核会员资料' },
  ],

  // UI 挂载点声明
  adminMenu: {
    title: '会员管理',
    icon: 'Users',
    path: '/admin/plugins/membership',
  }
};
