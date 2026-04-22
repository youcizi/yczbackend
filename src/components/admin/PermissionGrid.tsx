import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Switch } from '../ui/Switch';
import { Label } from '../ui/Checkbox';
import { Skeleton } from '../ui/Skeleton';
import { Button } from '../ui/Button';

interface PermissionSnapshot {
  slug: string;
  name: string;
  permCategory: string; // 适配最新 schema
}

interface PermissionGridProps {
  allPermissions: PermissionSnapshot[];
  selectedSlugs: string[];
  onChange: (slugs: string[]) => void;
  loading?: boolean;
  highlightCategory?: string; // 支持参数化高亮
}

/**
 * 权限勾选网格 (适配新 Schema 字段 permCategory)
 */
export const PermissionGrid: React.FC<PermissionGridProps> = ({ 
  allPermissions, 
  selectedSlugs, 
  onChange,
  loading = false,
  highlightCategory
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    );
  }

  // 按模块分组
  const groups = allPermissions.reduce((acc, perm) => {
    const category = perm.permCategory || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(perm);
    return acc;
  }, {} as Record<string, PermissionSnapshot[]>);

  const togglePermission = (slug: string) => {
    if (selectedSlugs.includes(slug)) {
      onChange(selectedSlugs.filter(s => s !== slug));
    } else {
      onChange([...selectedSlugs, slug]);
    }
  };

  const toggleModule = (category: string, perms: PermissionSnapshot[]) => {
    const moduleSlugs = perms.map(p => p.slug);
    const allSelected = moduleSlugs.every(s => selectedSlugs.includes(s));
    
    if (allSelected) {
      onChange(selectedSlugs.filter(s => !moduleSlugs.includes(s)));
    } else {
      const otherSlugs = selectedSlugs.filter(s => !moduleSlugs.includes(s));
      onChange([...otherSlugs, ...moduleSlugs]);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {Object.entries(groups).map(([category, perms]) => {
        const isHighlighted = highlightCategory && category.toLowerCase().includes(highlightCategory.toLowerCase());
        
        return (
          <Card 
            key={category} 
            className={`shadow-none border-slate-200 transition-all duration-1000 ${
              isHighlighted ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/10 shadow-lg shadow-blue-50' : ''
            }`}
          >
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 py-3 ${
              isHighlighted ? 'bg-blue-50' : 'bg-slate-50/50'
            }`}>
              <CardTitle className={`text-sm font-bold tracking-tight ${isHighlighted ? 'text-blue-700' : 'text-slate-700'}`}>
                {category}
                {isHighlighted && <span className="ml-2 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">NEW</span>}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-[10px] px-2"
                onClick={(e) => { e.preventDefault(); toggleModule(category, perms); }}
              >
                全选 / 反选
              </Button>
            </CardHeader>
            <CardContent className="p-4 grid gap-4">
              {perms.map((perm) => (
                <div key={perm.slug} className="flex items-center justify-between space-x-2">
                  <div className="flex flex-col space-y-0.5">
                    <Label className="text-xs font-semibold cursor-pointer" onClick={() => togglePermission(perm.slug)}>
                      {perm.name}
                    </Label>
                    <span className="text-[10px] font-mono text-muted-foreground">{perm.slug}</span>
                  </div>
                  <Switch 
                    checked={selectedSlugs.includes(perm.slug)} 
                    onCheckedChange={() => togglePermission(perm.slug)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
