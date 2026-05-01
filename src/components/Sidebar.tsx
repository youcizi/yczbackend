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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['内容管理']);
  const [isMounted, setIsMounted] = useState(false);

  const [activeFlyout, setActiveFlyout] = useState<{
    title: string;
    items: any[];
    top: number;
  } | null>(null);

  const [pluginItems, setPluginItems] = useState<any[]>([]);

  // 1. 挂载后从本地存储恢复状态
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('admin_sidebar_collapsed');
    if (savedCollapsed !== null) {
      setIsCollapsed(savedCollapsed === 'true');
    }

    const savedExpanded = localStorage.getItem('admin_sidebar_expanded_menus');
    if (savedExpanded !== null) {
      try {
        setExpandedMenus(JSON.parse(savedExpanded));
      } catch (e) {
        console.warn('Failed to parse expanded menus from localStorage');
      }
    }
    setIsMounted(true);
  }, []);

  // 2. 持久化状态变更
  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem('admin_sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem('admin_sidebar_expanded_menus', JSON.stringify(expandedMenus));
  }, [expandedMenus, isMounted]);

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

  useEffect(() => {
    const handlePluginUpdate = () => {
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

  // 点击外部关闭浮动菜单
  useEffect(() => {
    if (!activeFlyout) return;
    const handleClickOutside = () => setActiveFlyout(null);
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [activeFlyout]);

  const groupedCollections = dynamicCollections.reduce((acc: Record<string, any[]>, c) => {
    const groupName = c.menuGroup || '其它内容';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(c);
    return acc;
  }, {});

  const dynamicGroups = Object.entries(groupedCollections).map(([groupName, items]) => {
    const tree = buildTree(items, { idKey: 'id', parentKey: 'parentId' });
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

  // 3. 自动计算当前路径所属的父级并保持展开
  useEffect(() => {
    const toExpand: string[] = [];
    MENU_ITEMS.forEach(menu => {
      const hasActiveSub = menu.subItems?.some(sub => currentPath === sub.href);
      if (hasActiveSub && !expandedMenus.includes(menu.title)) {
        toExpand.push(menu.title);
      }
    });

    if (toExpand.length > 0) {
      setExpandedMenus(prev => {
        const next = [...prev];
        toExpand.forEach(title => {
          if (!next.includes(title)) next.push(title);
        });
        return next;
      });
    }
  }, [currentPath]);

  const handleSidebarMenuToggle = (title: string, subItems?: any[], rect?: DOMRect) => {
    if (isCollapsed && subItems && rect) {
      setActiveFlyout({
        title,
        items: subItems,
        top: rect.top
      });
      return;
    }

    setExpandedMenus(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };



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
    <ErrorBoundary fallback={<div className="p-4 text-xs text-red-500 bg-red-950/20 rounded m-4 border border-red-900/50">侧边栏组件渲染异常</div>}>
      <div className={`transition-all duration-300 ease-in-out flex flex-col border-r border-slate-800 h-screen bg-slate-900 text-slate-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        
        {/* Header Section */}
        <div className={`p-6 border-b border-slate-800 flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between'}`}>
          {!isCollapsed && (
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-xs text-white">Y</div>
                YCZ.ME
              </h2>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">独立站平台</p>
            </div>
          )}
          
          <button 
            onClick={() => {
              setIsCollapsed(!isCollapsed);
              setActiveFlyout(null);
            }}
            className={`p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white ${isCollapsed ? '' : 'ml-2'}`}
          >
            {isCollapsed ? <LucideIcons.PanelLeftOpen size={18} /> : <LucideIcons.PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto mt-2 overflow-x-hidden relative">
          <RecursiveMenu 
            items={MENU_ITEMS} 
            permissions={permissions} 
            currentPath={currentPath} 
            expandedMenus={expandedMenus}
            onToggle={handleSidebarMenuToggle}
            isCollapsed={isCollapsed}
          />
        </nav>

        {/* Wizard Button */}
        {hasPermission(permissions, 'site.init') && (
          <div className={`px-4 mb-4 transition-all duration-300 ${isCollapsed ? 'px-2' : ''}`}>
            <button
              onClick={() => setIsWizardOpen(true)}
              title="初始化站点"
              className={`flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-lg transition-all duration-300 group ${isCollapsed ? 'w-12 h-12 p-0 mx-auto' : 'w-full px-4 py-3 gap-2'}`}
            >
              <Wand2 size={16} className="group-hover:rotate-12 transition-transform" />
              {!isCollapsed && <span className="text-sm font-semibold">初始化站点</span>}
            </button>
          </div>
        )}

        {/* User Info */}
        <div className={`p-4 border-t border-slate-800 bg-slate-900/50 transition-all duration-300 ${isCollapsed ? 'px-0' : ''}`}>
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : 'px-2'}`}>
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-inner">
              {username?.[0].toUpperCase() || 'A'}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{username || 'Administrator'}</p>
                <p className="text-[10px] text-slate-500 capitalize">
                  {permissions.includes('all') ? 'Super Admin' : 'Manager'}
                </p>
              </div>
            )}
          </div>
        </div>

        <TemplateWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
        />

        {/* Flyout Submenu for Collapsed Mode */}
        {isCollapsed && activeFlyout && (
          <div 
            className="fixed left-[80px] z-[999] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 min-w-[200px] animate-in slide-in-from-left-2 duration-200"
            style={{ top: Math.min(activeFlyout.top, window.innerHeight - 300) }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-slate-700/50 mb-1">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">{activeFlyout.title}</span>
            </div>
            <div className="space-y-1">
              {activeFlyout.items.map((sub, i) => (
                <a
                  key={i}
                  href={sub.href}
                  onClick={() => setActiveFlyout(null)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    currentPath === sub.href ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <sub.icon size={14} />
                  <span>{sub.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

const RecursiveMenu: React.FC<{
  items: any[];
  permissions: string[];
  currentPath: string;
  expandedMenus: string[];
  onToggle: (title: string, subItems?: any[], rect?: DOMRect) => void;
  isCollapsed?: boolean;
  level?: number;
}> = ({ items, permissions, currentPath, expandedMenus, onToggle, isCollapsed = false, level = 0 }) => {
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
        const isExpanded = expandedMenus.includes(item.title) && !isCollapsed;
        const isParentActive = hasSubItems && item.subItems.some((sub: any) => hasActiveChild(sub));
        const isActive = item.href && currentPath === item.href;

        return (
          <div key={item.title} className="space-y-1">
            {hasSubItems ? (
              <button
                type="button"
                onClick={(e) => onToggle(item.title, item.subItems, e.currentTarget.getBoundingClientRect())}
                title={isCollapsed ? item.title : undefined}
                className={`w-full flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group ${
                  isParentActive ? 'bg-slate-800/50 text-white' : 'hover:bg-slate-800 hover:text-white'
                } ${level > 0 ? 'ml-2 pr-2' : ''} ${isCollapsed ? 'justify-center' : 'justify-between'}`}
              >
                <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                  {level === 0 ? (
                    <item.icon size={18} className={isParentActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-400'} />
                  ) : (
                    !isCollapsed && <div className={`w-1.5 h-1.5 rounded-full ${isParentActive ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]' : 'bg-slate-600 group-hover:bg-blue-400'} transition-all`} />
                  )}
                  {!isCollapsed && <span className={`${level === 0 ? 'font-medium' : 'text-xs'} truncate`}>{item.title}</span>}
                </div>
                {!isCollapsed && (
                  <ChevronRight
                    size={14}
                    className={`transition-transform duration-200 ${isExpanded ? 'rotate-90 text-blue-400' : 'text-slate-50'}`}
                  />
                )}
              </button>
            ) : (
              <a
                href={item.href}
                title={isCollapsed ? item.title : undefined}
                className={`flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'hover:bg-slate-800 hover:text-white'
                } ${level > 0 ? 'ml-2 pr-2' : ''} ${isCollapsed ? 'justify-center' : 'justify-between'}`}
              >
                <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                  {level === 0 ? (
                    <item.icon size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'} />
                  ) : (
                    !isCollapsed && <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-slate-700'} group-hover:bg-blue-400 transition-all`} />
                  )}
                  {!isCollapsed && <span className={`${level === 0 ? 'font-medium' : 'text-xs'} truncate`}>{item.title}</span>}
                </div>
              </a>
            )}

            {hasSubItems && isExpanded && !isCollapsed && (
              <div className={`border-l border-slate-800 space-y-1 mt-1 ${level === 0 ? 'ml-4' : 'ml-4'}`}>
                <RecursiveMenu 
                  items={item.subItems} 
                  permissions={permissions} 
                  currentPath={currentPath} 
                  expandedMenus={expandedMenus} 
                  onToggle={onToggle}
                  isCollapsed={isCollapsed}
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
