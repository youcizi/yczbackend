import React from 'react';
import { SystemConfigProvider } from '../../contexts/SystemConfigContext';

export interface SystemUser {
  id: string;
  email: string;
  userType: 'admin' | 'member';
  status: 'active' | 'inactive' | 'banned';
  createdAt: Date | string;
  username?: string;
  [key: string]: any;
}

interface UserListProps {
  users: SystemUser[];
  activePlugins?: string[]; // 提供系统级插件激活状态，供 Weaver 注入组件（如 PluginGate）使用
  onEdit?: (id: string) => void;
  onStatusChange?: (id: string, status: SystemUser['status']) => void;
}

/**
 * 核心系统用户列表组件
 * 职责：提供基础身份展示，并作为插件织入的 Context 锚点
 */
export const AdminList: React.FC<UserListProps> = ({ 
  users, 
  activePlugins = [],
  onEdit, 
  onStatusChange 
}) => {
  return (
    <SystemConfigProvider config={{ activePlugins }}>
      <div className="user-list-wrapper w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead className="bg-slate-50/80 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-900">用户身份/名称</th>
              <th className="px-6 py-4 font-semibold text-slate-900">电子邮箱</th>
              <th className="px-6 py-4 font-semibold text-slate-900">账户状态</th>
              <th className="px-6 py-4 font-semibold text-slate-900">创建日期</th>
              <th className="px-6 py-4 font-semibold text-slate-900 text-right">管理操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      user.userType === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {user.userType === 'admin' ? 'A' : 'U'}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">
                        {user.userType === 'admin' ? (user.username || '管理员') : '系统用户'}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-tighter">
                        {user.userType === 'admin' ? 'Administrator' : 'Standard User'}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {user.email}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    user.status === 'active' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    {user.status === 'active' ? '正常' : '已禁用'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-400">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Weaver 注入锚点：操作栏起始位置 */}
                    <button 
                      onClick={() => onEdit?.(user.id)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                      title="编辑用户"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                  暂未发现任何用户记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SystemConfigProvider>
  );
};
