import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Globe,
  Package,
  Settings,
  ChevronRight,
  ShieldCheck,
  UserCircle2,
  Lock,
  Database,
  Layers,
  Wand2,
  Languages,
  Mail,
  Code2,
  LayoutGrid,
  Users,
  MessageSquare
} from 'lucide-react';
import { type AdminRole, hasPermission } from '../lib/rbac';
import { TemplateWizard } from './admin/TemplateWizard';
import { buildTree } from '../lib/tree-utils';
import * as LucideIcons from 'lucide-react';

/**
 * 助手工具：将字符串图标名称转换为 Lucide 组件
 */
const getIcon = (name: string | undefined | null): React.ElementType => {
  if (!name) return LucideIcons.Layers;
  return (LucideIcons as any)[name] || LucideIcons.Layers;
};

interface SidebarProps {
  permissions: string[];
  currentPath: string;
  username?: string;
  models?: any[];
  collections?: any[];
}

interface MenuItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  requiredPermission: string;
  subItems?: {
    title: string;
    href: string;
    icon: React.ElementType;
    requiredPermission: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({ permissions, currentPath, username, models = [], collections = [] }) => {
  const [dynamicCollections, setDynamicCollections] = useState(collections);
  const [pluginItems, setPluginItems] = useState<any[]>([]);

  // 客户端数据刷新逻辑
  const refreshCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/rbac/collections');
      if (res.ok) {
        const data = await res.json();
        setDynamicCollections(data);
      }
    } catch (e) {
      console.warn('⚠️ [Sidebar] Failed to refresh collections:', e);
    }
  }, []);

  /**
   * 刷新插件菜单
   */
  const refreshPlugins = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/plugins/menu');
      if (res.ok) {
        const { data } = await res.json();
        const formattedItems = data.map((p: any) => ({
          title: p.title,
          href: p.path,
          icon: getIcon(p.icon),
          requiredPermission: 'plugins.manage'
        }));
        setPluginItems(formattedItems);
      }
    } catch (e) {
      console.warn('⚠️ [Sidebar] Failed to load plugins:', e);
    }
  }, []);

  // 监听全局插件更新事件
  useEffect(() => {
    const handlePluginUpdate = () => {
      console.log('📡 [Sidebar] Received plugins-updated event, refreshing menus...');
      if (hasPermission(permissions, 'plugins.manage')) {
        refreshPlugins();
      }
    };

    window.addEventListener('plugins-updated', handlePluginUpdate);
    return () => window.removeEventListener('plugins-updated', handlePluginUpdate);
  }, [permissions, refreshPlugins]);

  useEffect(() => {
    if (hasPermission(permissions, 'plugins.manage')) {
      refreshPlugins();
    }
  }, [permissions, refreshPlugins]);

  // 1. 构建动态分级菜单
  const groupedCollections = dynamicCollections.reduce((acc: Record<string, any[]>, c) => {
    const groupName = c.menuGroup || '其它内容';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(c);
    return acc;
  }, {});

  const dynamicGroups = Object.entries(groupedCollections).map(([groupName, items]) => {
    // 为每个分组构建树形结构
    const tree = buildTree(items, { idKey: 'id', parentKey: 'parentId' });
    
    // 递归转换树节点为菜单项格式
    const mapTreeToMenuItems = (nodes: any[]): any[] => {
      return nodes
        .map(node => ({
          title: node.name,
          href: `/admin/collections/${node.slug}`,
          icon: getIcon(node.icon),
          requiredPermission: `collection:${node.slug}:view`,
          menuOrder: node.menuOrder || 0,
          subItems: node.children && node.children.length > 0 ? mapTreeToMenuItems(node.children) : undefined
        }))
        .filter(item => hasPermission(permissions, item.requiredPermission))
        .sort((a, b) => a.menuOrder - b.menuOrder);
    };

    return {
      title: groupName,
      icon: getIcon(items[0]?.icon),
      requiredPermission: 'site.view',
      subItems: mapTreeToMenuItems(tree)
    };
  }).filter(group => group.subItems.length > 0);

  const MENU_ITEMS: MenuItem[] = [
    { title: '概览', href: '/admin', icon: LayoutDashboard, requiredPermission: 'site.view' },
    // NOTE: 线索中心使用独立的 leads.view 权限，而非通用的 site.view
    { title: '线索中心', href: '/admin/leads', icon: Users, requiredPermission: 'leads.view' },
    { title: '用户管理', href: '/admin/users', icon: UserCircle2, requiredPermission: 'site.view' },
    ...dynamicGroups,
    {
      title: '模型管理',
      icon: Database,
      requiredPermission: 'role.manage',
      subItems: [
        { title: '模型引擎', href: '/admin/models', icon: Database, requiredPermission: 'role.manage' },
        { title: '业务集合管理', href: '/admin/collections', icon: Layers, requiredPermission: 'role.manage' },
        { title: 'API 管理', href: '/admin/api-management', icon: Code2, requiredPermission: 'role.manage' },
      ]
    },
    {
      title: '权限管理',
      icon: ShieldCheck,
      requiredPermission: 'role.manage',
      subItems: [
        { title: '角色权限', href: '/admin/roles', icon: ShieldCheck, requiredPermission: 'role.manage' },
        { title: '操作员管理', href: '/admin/managers', icon: UserCircle2, requiredPermission: 'admin.manage' },
      ]
    },
    {
      title: '系统管理',
      icon: Settings,
      requiredPermission: 'media.manage',
      subItems: [
        { title: '附件管理', href: '/admin/media', icon: Package, requiredPermission: 'media.manage' },
        { title: '常规设置', href: '/admin/settings/general', icon: Settings, requiredPermission: ['settings.general', 'role.manage'] },
        { title: '语言设置', href: '/admin/languages', icon: Languages, requiredPermission: ['languages.manage', 'role.manage'] },
        { title: '邮件服务', href: '/admin/settings/mail', icon: Mail, requiredPermission: ['settings.mail', 'role.manage'] },
        { title: 'AI 网关', href: '/admin/settings/ai', icon: Wand2, requiredPermission: ['settings.ai', 'role.manage'] },
      ]
    },
    ...(pluginItems.length > 0 ? [{
      title: '扩展功能',
      icon: LucideIcons.Plug,
      requiredPermission: 'plugins.manage',
      subItems: pluginItems
    }] : []),
  ];

  const autoExpanded = React.useMemo(() => {
    const expanded = ['内容管理']; 
    MENU_ITEMS.forEach(menu => {
      const hasActiveSub = menu.subItems?.some(sub => currentPath === sub.href);
      if (hasActiveSub && !expanded.includes(menu.title)) {
        expanded.push(menu.title);
      }
    });
    return expanded;
  }, [currentPath]);

  const [expandedMenus, setExpandedMenus] = useState<string[]>(autoExpanded);

  const handleSidebarMenuToggle = (title: string) => {
    setExpandedMenus(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };

  useEffect(() => {
    setExpandedMenus(prev => {
      const next = [...prev];
      autoExpanded.forEach(title => {
        if (!next.includes(title)) next.push(title);
      });
      return next;
    });
  }, [autoExpanded]);

  useEffect(() => {
    setDynamicCollections(collections);
  }, [collections]);

  useEffect(() => {
    const handleUpdate = () => {
      refreshCollections();
    };
    window.addEventListener('collections-updated', handleUpdate);
    return () => window.removeEventListener('collections-updated', handleUpdate);
  }, [refreshCollections]);

  const [isWizardOpen, setIsWizardOpen] = useState(false);

  return (
    <ErrorBoundary fallback={<div className="p-4 text-xs text-red-500 bg-red-950/20 rounded m-4 border border-red-900/50">侧边栏组件渲染异常，请尝试刷新页面或联系技术支持。</div>}>
      <div className="w-64 h-full bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-xs text-white">Y</div>
            YCZ.ME
          </h2>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">专业独立站构建平台</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto mt-4">
          <RecursiveMenu 
            items={MENU_ITEMS} 
            permissions={permissions} 
            currentPath={currentPath} 
            expandedMenus={expandedMenus}
            onToggle={handleSidebarMenuToggle}
          />
        </nav>

        {hasPermission(permissions, 'site.init') && (
          <div className="px-4 mb-4">
            <button
              onClick={() => setIsWizardOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-blue-900/40 transition-all duration-300 group"
            >
              <Wand2 size={16} className="group-hover:rotate-12 transition-transform" />
              <span className="text-sm font-semibold">初始化站点</span>
            </button>
          </div>
        )}

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
              {username?.[0].toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{username || 'Administrator'}</p>
              <p className="text-[10px] text-slate-500 capitalize">
                {permissions.includes('all') ? 'Super Admin' : 'Manager'}
              </p>
            </div>
          </div>
        </div>

        <TemplateWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
        />
      </div>
    </ErrorBoundary>
  );
};

const RecursiveMenu: React.FC<{
  items: any[];
  permissions: string[];
  currentPath: string;
  expandedMenus: string[];
  onToggle: (title: string) => void;
  level?: number;
}> = ({ items, permissions, currentPath, expandedMenus, onToggle, level = 0 }) => {
  const hasActiveChild = (item: any): boolean => {
    if (item.href && currentPath === item.href) return true;
    if (item.subItems) {
      return item.subItems.some((sub: any) => hasActiveChild(sub));
    }
    return false;
  };

  return (
    <>
      {items.map((item) => {
        if (!hasPermission(permissions, item.requiredPermission)) return null;

        const hasSubItems = item.subItems && item.subItems.length > 0;
        const isExpanded = expandedMenus.includes(item.title);
        const isParentActive = hasSubItems && item.subItems.some((sub: any) => hasActiveChild(sub));
        const isActive = item.href && currentPath === item.href;

        return (
          <div key={item.title} className="space-y-1">
            {hasSubItems ? (
              <button
                type="button"
                onClick={() => onToggle(item.title)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200 group ${
                  isParentActive ? 'bg-slate-800/50 text-white' : 'hover:bg-slate-800 hover:text-white'
                } ${level > 0 ? 'ml-2 pr-2' : ''}`}
              >
                <div className="flex items-center gap-3">
                  {level === 0 ? (
                    <item.icon size={18} className={isParentActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-400'} />
                  ) : (
                    <div className={`w-1.5 h-1.5 rounded-full ${isParentActive ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]' : 'bg-slate-600 group-hover:bg-blue-400'} transition-all`} />
                  )}
                  <span className={`${level === 0 ? 'font-medium' : 'text-xs'} truncate`}>{item.title}</span>
                </div>
                <ChevronRight
                  size={14}
                  className={`transition-transform duration-200 ${isExpanded ? 'rotate-90 text-blue-400' : 'text-slate-50'}`}
                />
              </button>
            ) : (
              <a
                href={item.href}
                className={`flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'hover:bg-slate-800 hover:text-white'
                } ${level > 0 ? 'ml-2 pr-2' : ''}`}
              >
                <div className="flex items-center gap-3">
                  {level === 0 ? (
                    <item.icon size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'} />
                  ) : (
                    <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-slate-700'} group-hover:bg-blue-400 transition-all`} />
                  )}
                  <span className={`${level === 0 ? 'font-medium' : 'text-xs'} truncate`}>{item.title}</span>
                </div>
              </a>
            )}

            {hasSubItems && isExpanded && (
              <div className={`border-l border-slate-800 space-y-1 mt-1 ${level === 0 ? 'ml-4' : 'ml-4'}`}>
                <RecursiveMenu 
                  items={item.subItems} 
                  permissions={permissions} 
                  currentPath={currentPath} 
                  expandedMenus={expandedMenus} 
                  onToggle={onToggle}
                  level={level + 1}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode, fallback: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("🚨 [ErrorBoundary] Caught error:", error, errorInfo); }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
