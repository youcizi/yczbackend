/**
 * 会员插件 UI 织入声明
 * 由 System Weaver 在构建阶段解析并缝合进主系统
 */
export const injections = [
  // 1. 注入表头
  {
    file: 'src/components/admin/AdminList.tsx',
    target: 'AdminList',
    find: 'thead > tr',
    position: 'beforeEnd',
    code: '<th className="px-6 py-4 font-semibold text-slate-900 text-blue-500 font-bold">会员等级</th>'
  },
  // 2. 注入数据列 (利用 AdminList 中的 admin 变量)
  {
    file: 'src/components/admin/AdminList.tsx',
    target: 'AdminList',
    find: 'tbody > tr',
    position: 'beforeEnd',
    code: `
      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-500 font-bold">
        <PluginGate slug="membership">
          {user.userType === 'member' ? (user.tierName || '普通会员') : '-'}
        </PluginGate>
      </td>
    `
  },
  // 3. 注入操作按钮 (Action Column)
  {
    file: 'src/components/admin/AdminList.tsx',
    target: 'AdminList',
    find: 'tbody > tr > td > div', // 这里的 div 是操作按钮的容器
    position: 'afterBegin',
    code: `
      <PluginGate slug="membership">
        <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md" title="会员详情">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        </button>
      </PluginGate>
    `
  }
];
