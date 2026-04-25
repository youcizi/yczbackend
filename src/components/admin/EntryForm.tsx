import React, { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Button } from '../ui/Button';
import { useToast, toast } from '../ui/Toaster';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger,
  DialogClose
} from '../ui/Dialog';
import { type ModelField, validateEntityData } from '../../lib/model-engine';
import { AlertCircle, Image as ImageIcon, FileJson, Type, Hash, AlignLeft, Search, Loader2, ArrowRight, Braces, Plus, Trash2, X, File as FileIcon, ChevronDown, ChevronRight, CheckCircle2, Globe, Check } from 'lucide-react';
import { AdvancedJSONEditor } from './AdvancedJSONEditor';
import { TiptapEditor } from './TiptapEditor';
import { MediaPicker } from './MediaPicker';
import { cn } from '../../lib/utils';
import { buildTree, flattenTreeWithPrefix, getAllDescendantIds } from '../../lib/tree-utils';
import { Badge } from '../ui/Badge';

/**
 * 关联字段选择组件 (已升级：持搜索过滤与防呆设计)
 */
const RelationSelect: React.FC<{
  field: ModelField;
  value: any;
  onChange: (val: any) => void;
  hasError?: boolean;
  currentId?: number | string; // 新增：当前正在编辑实体的 ID
}> = ({ field, value, onChange, hasError, currentId }) => {
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (field.relationConfig?.collectionSlug) {
      fetchOptions();
    }
  }, [field.relationConfig?.collectionSlug]);

  const fetchOptions = async () => {
    setLoading(true);
    try {
      const slug = field.relationConfig?.collectionSlug;
      const res = await fetch(`/api/v1/entities/${slug}`);
      
      if (!res.ok) {
        // 如果是 404，说明关联的集合尚未创建或被删除
        if (res.status === 404) {
          console.warn(`⚠️ [RelationSelect] 关联集合 [${slug}] 未找到，请检查系统初始化状态。`);
          setOptions([]);
          return;
        }
        throw new Error(`API Error: ${res.status}`);
      }

      const result = await res.json();
      setOptions(Array.isArray(result.data) ? result.data : []);
    } catch (e) {
      console.error('Failed to fetch relation options:', e);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const displayKey = field.relationConfig?.displayField || 'name';
  const parentKey = field.relationConfig?.parentKey || 'parent_id';

  // 核心逻辑：自动感应树形结构
  const processedOptions = React.useMemo(() => {
    // 检查数据中首行是否含有父级关联字段，如果存在则自动开启树形化
    const hasParentLink = options.length > 0 && (parentKey in options[0]);
    
    if (hasParentLink) {
      console.log(`🌲 [Tree] Detected hierarchy via "${parentKey}", auto-building tree...`);
      const tree = buildTree(options, { idKey: 'id', parentKey });
      return flattenTreeWithPrefix(tree, displayKey);
    }
    return options;
  }, [options, displayKey, parentKey]);

  // 关键：计算非法 ID 集合（当前节点 + 所有子孙）
  const forbiddenIds = React.useMemo(() => {
    if (!currentId || !options.length || !('parent_id' in options[0])) return new Set();
    const tree = buildTree(options, { idKey: 'id', parentKey });
    return getAllDescendantIds(tree, currentId);
  }, [options, currentId]);

  const filteredOptions = processedOptions.filter(opt => 
    String(opt[displayKey] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(opt.id).includes(searchTerm)
  );

  const isMultiple = field.type === 'relation_multi';
  const currentValues = isMultiple ? (Array.isArray(value) ? value : []) : [value].filter(Boolean);
  
  const selectedOptions = currentValues.map(v => options.find(opt => String(opt.id) === String(v))).filter(Boolean);

  const toggleOption = (optId: any) => {
    if (isMultiple) {
      if (currentValues.includes(optId)) {
        onChange(currentValues.filter(v => v !== optId));
      } else {
        onChange([...currentValues, optId]);
      }
    } else {
      onChange(optId);
      setIsOpen(false);
    }
  };

  const removeOption = (e: React.MouseEvent, optId: any) => {
    e.stopPropagation();
    onChange(currentValues.filter(v => v !== optId));
  };

  return (
    <div className="relative">
      <div 
        className={`relative w-full min-h-[40px] py-1.5 flex flex-wrap items-center px-3 bg-white border rounded-md text-sm cursor-pointer transition-all ${
          isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-200 hover:border-slate-300'
        } ${hasError ? 'border-red-500 ring-red-500' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Search size={14} className="mr-2 text-slate-400 shrink-0" />
        <div className="flex-1 flex flex-wrap gap-1.5 items-center">
          {selectedOptions.length > 0 ? (
            isMultiple ? (
              selectedOptions.map((opt: any) => (
                <Badge key={opt.id} variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200 pr-1 border-blue-200 group/badge">
                  {opt[displayKey] || `ID: ${opt.id}`}
                  <X 
                    size={12} 
                    className="ml-1 cursor-pointer opacity-50 group-hover/badge:opacity-100" 
                    onClick={(e) => removeOption(e, opt.id)}
                  />
                </Badge>
              ))
            ) : (
              <span className="text-slate-900 font-medium">
                {selectedOptions[0]?.[displayKey] || `ID: ${selectedOptions[0]?.id}`}
              </span>
            )
          ) : (
            <span className="text-slate-400">选择 {field.label}...</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {loading && <Loader2 size={12} className="animate-spin text-slate-400" />}
          <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isOpen && "rotate-180")} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-2 border-b border-slate-50 bg-slate-50/50">
            <input 
              autoFocus
              className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={`搜索 ${field.label}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-[250px] overflow-y-auto p-1 scrollbar-thin">
            {loading ? (
              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                正在努力构建树形层级...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-4 text-center space-y-2">
                <p className="text-xs text-slate-500">{searchTerm ? '未找到匹配结果' : `暂无可关联的${field.label}`}</p>
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isForbidden = forbiddenIds.has(opt.id);
                const isSelected = currentValues.includes(opt.id);

                return (
                  <div 
                    key={opt.id}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 text-xs rounded transition-colors relative group/item",
                      isSelected ? "bg-blue-600 text-white font-semibold" : "hover:bg-blue-50 text-slate-600",
                      isForbidden && "opacity-40 grayscale cursor-not-allowed hover:bg-transparent pointer-events-none"
                    )}
                    onClick={(e) => {
                      if (isForbidden) return;
                      e.stopPropagation();
                      toggleOption(opt.id);
                    }}
                  >
                    <span className="truncate whitespace-pre flex items-center gap-1.5">
                      {opt.displayLabel || opt[displayKey] || opt.name || `ID: ${opt.id}`}
                      {isForbidden && <span className="text-[10px] bg-slate-100 text-slate-400 px-1 rounded border border-slate-200 ml-1 font-normal not-italic">禁止循环</span>}
                    </span>
                    {isSelected && <CheckCircle2 size={12} className="text-white ml-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
};

/**
 * 枚举值下拉选择组件 (支持单选与多选，带搜索)
 */
const EnumSelect: React.FC<{
  field: ModelField;
  value: any;
  onChange: (val: any) => void;
  hasError?: boolean;
}> = ({ field, value, onChange, hasError }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const options = field.options || [];
  const isMultiple = field.type === 'multi_select';
  const currentValues = isMultiple ? (Array.isArray(value) ? value : []) : [value].filter(v => v !== undefined && v !== null && v !== '');
  
  const filteredOptions = options.filter(opt => 
    String(opt.value || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(opt.key).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOptions = currentValues.map(v => options.find(opt => String(opt.key) === String(v))).filter(Boolean);

  const toggleOption = (key: string) => {
    if (isMultiple) {
      if (currentValues.includes(key)) {
        onChange(currentValues.filter(v => v !== key));
      } else {
        onChange([...currentValues, key]);
      }
    } else {
      onChange(key);
      setIsOpen(false);
    }
  };

  const removeOption = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    onChange(currentValues.filter(v => v !== key));
  };

  return (
    <div className="relative">
      <div 
        className={cn(
          "relative w-full min-h-[40px] py-1.5 flex flex-wrap items-center px-3 bg-white border rounded-md text-sm cursor-pointer transition-all",
          isOpen ? "ring-2 ring-blue-500 border-blue-500" : "border-slate-200 hover:border-slate-300",
          hasError && "border-red-500 ring-red-500"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex-1 flex flex-wrap gap-1.5 items-center">
          {selectedOptions.length > 0 ? (
            isMultiple ? (
              selectedOptions.map((opt: any) => (
                <Badge key={opt.key} variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200 pr-1 border-blue-200 group/badge">
                  {opt.value}
                  <X 
                    size={12} 
                    className="ml-1 cursor-pointer opacity-50 group-hover/badge:opacity-100" 
                    onClick={(e) => removeOption(e, opt.key)}
                  />
                </Badge>
              ))
            ) : (
              <span className="text-slate-900 font-medium">{selectedOptions[0]?.value}</span>
            )
          ) : (
            <span className="text-slate-400">选择 {field.label}...</span>
          )}
        </div>
        <ChevronDown size={14} className={cn("text-slate-400 transition-transform ml-2", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-50 bg-slate-50/50">
            <input 
              autoFocus
              className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="搜索选项..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 italic">无可用选项</div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = currentValues.includes(opt.key);
                return (
                  <div 
                    key={opt.key}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 text-xs rounded transition-colors cursor-pointer",
                      isSelected ? "bg-blue-600 text-white font-semibold" : "hover:bg-blue-50 text-slate-600"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(opt.key);
                    }}
                  >
                    <span>{opt.value}</span>
                    {isSelected && <CheckCircle2 size={12} className="text-white ml-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
};

interface EntryFormProps {
  slug: string; // 显式要求传入所属集合的 slug
  fields: ModelField[];
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  onLocaleSwitch?: (id: number) => void;
}

/**
 * 元数据驱动的通用表单组件
 */
export const EntryForm: React.FC<EntryFormProps> = ({ 
  slug,
  fields, 
  initialData = {}, 
  onSubmit, 
  onCancel,
  isLoading 
}) => {
  // 核心状态：多语言内存映射表 (locale -> formData_chunk)
  const [translationsMap, setTranslationsMap] = useState<Record<string, any>>({});
  const [formData, setFormData] = useState<any>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isMounted, setIsMounted] = useState(false);
  const [languages, setLanguages] = useState<any[]>([]);
  const [currentLocale, setCurrentLocale] = useState(initialData?.locale || '');
  const [isNewMode] = useState(!initialData?.id);
  const [isMatching, setIsMatching] = useState(false);
  // 维护所有媒体字段的弹窗状态，确保 Hook 顺序稳定
  const [openPickers, setOpenPickers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIsMounted(true);
    fetchInitialData();
  }, [initialData?.id]);

  const fetchInitialData = async () => {
    setIsMatching(true);
    try {
      // 1. 加载可用语种
      const langRes = await fetch('/api/v1/rbac/languages');
      const langs = langRes.ok ? (await langRes.json()).filter((l: any) => l.status === 'active') : [];
      setLanguages(langs);

      // 2. 确定初始语种
      const defaultLocale = langs.find((l: any) => l.isDefault)?.code || langs[0]?.code;
      const startLocale = initialData?.locale || defaultLocale;
      setCurrentLocale(startLocale);

      // 3. 为“内存工作站”加载全量数据
      const tMap: Record<string, any> = {};
      const groupId = initialData?.translationGroup;

      if (groupId) {
        // 编辑模式：一次性获取该组所有译文
        const res = await fetch(`/api/v1/entities/${slug}?translationGroup=${groupId}`);
        if (res.ok) {
          const result = await res.json();
          result.data.forEach((item: any) => {
             tMap[item.locale] = item;
          });
        }
      } else if (initialData?.id) {
        // 回退逻辑：如果仅有 ID 没组 ID (旧数据)
        tMap[startLocale] = initialData;
      }

      setTranslationsMap(tMap);
      setFormData(tMap[startLocale] || { locale: startLocale, translationGroup: groupId });
    } catch (e) {
      console.error('Failed to init EntryForm workstation');
    } finally {
      setIsMatching(false);
    }
  };

  const handleChange = (name: string, value: any) => {
    setFormData((prev: any) => {
      const next = { ...prev, [name]: value };
      // [加固]：立即同步到内存映射表
      setTranslationsMap(curr => ({ 
        ...curr, 
        [currentLocale]: { ...next, locale: currentLocale } 
      }));
      return next;
    });
    
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  /**
   * 语种切换核心 Hook：处理“查到则修，查不到则增”
   */
  const handleLocaleSwitch = async (langCode: string) => {
    if (langCode === currentLocale) return;

    // 1. 强制落盘：将当前表单存入 Map，确保 locale 正确
    const currentData = { ...formData, locale: currentLocale };
    const nextMap = { ...translationsMap, [currentLocale]: currentData };

    // 2. 加载目标：从 Map 取出或初始化
    const targetData = nextMap[langCode] || { 
      locale: langCode, 
      translationGroup: formData.translationGroup // 继承翻译组
    };

    setTranslationsMap(nextMap);
    setFormData({ ...targetData, locale: langCode }); // 显式锁定目标 Locale
    setCurrentLocale(langCode);
    
    toast({ title: `切换至 ${langCode}`, description: nextMap[langCode] ? '载入草稿' : '开启新翻译' });
  };

  /**
   * 增强功能：从默认语种同步 (Copy from Default)
   */
  const handleCopyFromDefault = () => {
    const defaultLang = languages.find(l => l.isDefault) || languages[0];
    if (!defaultLang || defaultLang.code === currentLocale) return;

    const sourceData = translationsMap[defaultLang.code];
    if (!sourceData) {
      toast({ title: '同步失败', description: '默认语种尚未填写内容', variant: 'destructive' });
      return;
    }

    // 执行深拷贝同步 (排除物理 ID)
    const syncedData = {
      ...sourceData,
      id: formData.id, // 保留当前语种的物理 ID
      locale: currentLocale,
      translationGroup: formData.translationGroup
    };

    setFormData(syncedData);
    setTranslationsMap(prev => ({ ...prev, [currentLocale]: syncedData }));
    toast({ title: '同步成功', description: `已从 ${defaultLang.name} 复制关键字段` });
  };

  /**
   * 规格模板应用逻辑 (B2B 专用)
   */
  const handleApplySpecTemplate = async (templateId: any) => {
    if (!templateId) return;
    try {
      const res = await fetch(`/api/v1/entities/spec_templates?id=${templateId}`);
      if (!res.ok) throw new Error('模板加载失败');
      const { data } = await res.json();
      const template = data[0]; // 假设查询返回数组
      if (!template || !template.config) return;

      const templateConfig = typeof template.config === 'string' ? JSON.parse(template.config) : template.config;
      
      // 执行 Merge 操作：保留原有数据，补全模板 Key
      const currentSpecData = formData.spec_data || {};
      const nextSpecData = { ...templateConfig, ...currentSpecData };
      
      handleChange('spec_data', nextSpecData);
      toast({ title: '模板已应用', description: `已注入 ${Object.keys(templateConfig).length} 条规格定义` });
    } catch (err) {
      toast({ title: '应用失败', description: '无法获取模板配置', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      const currentFinalMap = { ...translationsMap, [currentLocale]: formData };
      
      // 1. 前端全量校验 (针对所有已填写的语言版本)
      const allErrors: Record<string, string> = {};
      let firstErrorLocale = '';

      for (const [locale, data] of Object.entries(currentFinalMap)) {
        // 判定依据：如果该语言包没有任何业务字段，则跳过校验（因为它不会被保存）
        const businessKeys = Object.keys(data).filter(k => !['id', 'locale', 'translationGroup', 'createdBy', 'createdAt', 'updatedAt', '_displayValues'].includes(k));
        if (businessKeys.length === 0) continue;

        const validation = validateEntityData(data, fields);
        if (!validation.valid) {
          if (locale === currentLocale) {
            validation.errors.forEach(msg => {
              const field = fields.find(f => msg.includes(`[${f.label}]`));
              if (field) allErrors[field.name] = msg;
            });
          }
          if (!firstErrorLocale) firstErrorLocale = locale;
        }
      }

      if (Object.keys(allErrors).length > 0 || firstErrorLocale) {
        setErrors(allErrors);
        toast({ 
          title: '校验未通过', 
          description: `语种 [${firstErrorLocale}] 的必填项尚未填写完整，请检查。`, 
          variant: 'destructive' 
        });
        return; // 拦截请求
      }

      // 2. 组装批处理 Payload (纠正嵌套结构: 业务字段必须放入 dataJson)
      const batchPayload = Object.values(currentFinalMap).filter((item: any) => {
        // 判定依据：排除只有元数据的空白草稿
        const keys = Object.keys(item).filter(k => !['id', 'locale', 'translationGroup', 'createdBy', 'createdAt', 'updatedAt', '_displayValues'].includes(k));
        return keys.length > 0; 
      }).map((item: any) => {
        // 核心纠正：将业务字段归集到 dataJson 属性中发送
        const { id, locale, translationGroup, _displayValues, ...businessData } = item;
        return {
          id,
          locale,
          translationGroup,
          dataJson: businessData // 后端预期此嵌套结构
        };
      });

      // 2. 调用 Batch 接口
      const res = await fetch(`/api/v1/entities/${slug}/batch-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload)
      });

      if (!res.ok) throw await res.json();

      const { list, translationGroup } = await res.json();
      
      // 3. 闭环 ID 同步：更新本地 Map 与 ID
      const syncedMap = { ...currentFinalMap };
      list.forEach((item: any) => {
        if (syncedMap[item.locale]) {
          syncedMap[item.locale] = { 
            ...syncedMap[item.locale], 
            id: item.id, 
            translationGroup 
          };
        }
      });

      setTranslationsMap(syncedMap);
      setFormData(syncedMap[currentLocale]);
      
      toast({ title: '保存成功', description: '所有语言版本已同步' });

      // [核心交互修复]：发送批处理成功信号，并由 ContentManagement 统一接管关闭逻辑
      if (onSubmit) {
        await onSubmit({ _batchSaved: true, translationGroup });
      }
    } catch (err: any) {
      // 如果后端返回详细的错误列表
      if (err.details && Array.isArray(err.details)) {
        const newErrors: Record<string, string> = {};
        err.details.forEach((msg: string) => {
          // 尝试匹配 "字段 [Label] 是必填项" 之类的模式来高亮对应字段
          const field = fields.find(f => msg.includes(`[${f.label}]`));
          if (field) {
            newErrors[field.name] = msg;
          }
        });
        setErrors(newErrors);
        toast({ title: '校验失败', description: '请检查表单输入', variant: 'destructive' });
      } else {
        toast({ title: '提交失败', description: err.message || '未知错误', variant: 'destructive' });
      }
    }
  };

  const renderField = (field: ModelField) => {
    if (!field) return null;
    const hasError = !!errors[field.name];
    
    const renderControl = () => {
      switch (field.type) {
        case 'text':
          return (
            <div className="relative group">
              <Type size={14} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500" />
              <Input
                id={field.name}
                className={`pl-10 ${hasError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                placeholder={field.placeholder || `请输入${field.label}...`}
                value={formData[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
              />
            </div>
          );
        case 'number':
          return (
            <div className="relative group">
              <Hash size={14} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500" />
              <Input
                type="number"
                className={`pl-10 ${hasError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                placeholder={field.placeholder || `请输入数字...`}
                value={formData[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
              />
            </div>
          );
        case 'richtext':
          return (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-medium w-fit">
                <AlignLeft size={10} />
                <span>RICHTEXT_V2.0_MAPPING</span>
              </div>
              <TiptapEditor
                value={formData[field.name] || ''}
                onChange={(val) => handleChange(field.name, val)}
                placeholder={field.placeholder}
              />
            </div>
          );
        case 'textarea':
           return (
             <div className="relative group">
               <AlignLeft size={14} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500" />
               <textarea
                 className="w-full min-h-[120px] pl-10 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                 placeholder={field.placeholder || `请输入${field.label}...`}
                 value={formData[field.name] || ''}
                 onChange={(e) => handleChange(field.name, e.target.value)}
                 spellCheck={false}
               />
             </div>
           );
        case 'image':
        case 'multi_image':
        case 'multi_file':
        case 'media': {
          const isMultiple = field.type === 'multi_image' || field.type === 'multi_file';
          const currentIds = isMultiple ? (Array.isArray(formData[field.name]) ? formData[field.name] : []) : (formData[field.name] ? [formData[field.name]] : []);
          const isPickerOpen = openPickers[field.name] || false;
          
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-4 flex-wrap">
                {/* 预览图/图标 列表 (附带拖拽排序支持) */}
                {currentIds.map((id: any, index: number) => (
                  <div 
                    key={id}
                    className="relative group w-16 h-16 rounded-lg border bg-slate-50 overflow-hidden shrink-0 shadow-sm animate-in zoom-in-95 cursor-move"
                    draggable={isMultiple}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', index.toString())}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!isMultiple) return;
                      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                      const toIndex = index;
                      if (fromIndex === toIndex || isNaN(fromIndex)) return;
                      const newIds = [...currentIds];
                      const [movedItem] = newIds.splice(fromIndex, 1);
                      newIds.splice(toIndex, 0, movedItem);
                      handleChange(field.name, newIds);
                    }}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                       <FileIcon size={20} className="text-slate-300" />
                       <span className="absolute bottom-1 right-1 text-[8px] bg-slate-800 text-white px-1 rounded opacity-50">{id}</span>
                    </div>
                    {/* 遮罩删除按钮 */}
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isMultiple) {
                           handleChange(field.name, currentIds.filter((cid: any) => cid !== id));
                        } else {
                           handleChange(field.name, null);
                        }
                      }}
                      className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                {/* 触发按钮 */}
                {(!currentIds.length || isMultiple) && (
                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenPickers(prev => ({ ...prev, [field.name]: true }))}
                    className={cn(
                      "h-16 flex-1 min-w-[200px] flex flex-col items-center justify-center gap-1 border-dashed border-2 hover:border-blue-400 hover:bg-blue-50/50 transition-all",
                      hasError ? "border-red-300 bg-red-50 text-red-600" : "text-slate-500"
                    )}
                  >
                    <Plus size={18} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">
                      {isMultiple ? `添加${field.label}` : `点击选取${field.label}`}
                    </span>
                  </Button>
                )}
              </div>
              
              <MediaPicker
                isOpen={isPickerOpen}
                onClose={() => setOpenPickers(prev => ({ ...prev, [field.name]: false }))}
                title={`选取${field.label}`}
                allowedTypes={field.type === 'image' || field.type === 'multi_image' ? ['image/*'] : []}
                onSelect={(item) => {
                  if (isMultiple) {
                    handleChange(field.name, [...currentIds, item.id]);
                  } else {
                    handleChange(field.name, item.id);
                  }
                  setOpenPickers(prev => ({ ...prev, [field.name]: false }));
                }}
              />
            </div>
          );
        }
        case 'json':
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 font-medium">
                  <Braces size={10} />
                  <span>NESTED_JSON_V4.0</span>
                </div>
                
                {/* 规格模板快捷入口 (仅针对 b2b_product.spec_data) */}
                {slug === 'b2b_product' && field.name === 'spec_data' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">应用模板:</span>
                    <select 
                      className="h-6 text-[10px] bg-white border border-slate-200 rounded px-1 outline-none focus:ring-1 focus:ring-blue-500"
                      onChange={(e) => handleApplySpecTemplate(e.target.value)}
                      defaultValue=""
                    >
                      <option value="" disabled>选择规格模板...</option>
                      <SpecTemplateOptions />
                    </select>
                  </div>
                )}
              </div>
              <AdvancedJSONEditor
                value={formData[field.name]}
                onChange={(val) => handleChange(field.name, val)}
                hasError={hasError}
              />
              {errors[field.name] && <p className="text-[10px] text-red-500 mt-1">{errors[field.name]}</p>}
            </div>
          );
        case 'radio':
        case 'checkbox': {
          const isMulti = field.type === 'checkbox';
          const opts = field.options || [];
          const currentVal = formData[field.name];
          const valArr = isMulti ? (Array.isArray(currentVal) ? currentVal : []) : [];

          return (
            <div className="flex flex-wrap gap-2">
              {opts.length === 0 && <span className="text-xs text-slate-400">请前往集合设置配置选项</span>}
              {opts.map((opt: any) => {
                const isChecked = isMulti ? valArr.includes(opt.key) : String(currentVal) === String(opt.key);
                return (
                  <label 
                    key={opt.key} 
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm transition-all overflow-hidden select-none", 
                      isChecked ? "border-blue-500 bg-blue-50 text-blue-700 font-medium ring-1 ring-blue-500" : "border-slate-200 hover:border-blue-200 hover:bg-slate-50"
                    )}
                    onClick={() => {
                      if (isMulti) {
                        const next = isChecked ? valArr.filter(v => v !== opt.key) : [...valArr, opt.key];
                        handleChange(field.name, next);
                      } else {
                        handleChange(field.name, opt.key);
                      }
                    }}
                  >
                    <div className={cn("w-4 h-4 border flex items-center justify-center shrink-0", isMulti ? "rounded" : "rounded-full", isChecked ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white")}>
                       {isChecked && (isMulti ? <Check size={12} className="text-white font-bold" /> : <div className="w-1.5 h-1.5 bg-white rounded-full" />)}
                    </div>
                    {opt.value}
                  </label>
                );
              })}
            </div>
          );
        }
        case 'select':
        case 'multi_select':
          return (
            <EnumSelect 
              field={field} 
              value={formData[field.name]} 
              onChange={(val) => handleChange(field.name, val)}
              hasError={hasError}
            />
          );
        case 'relation':
        case 'relation_single':
        case 'relation_multi':
          return (
            <div className="space-y-1">
              {field.isMedia ? (
                <div className="p-3 border-2 border-dashed border-blue-200 bg-blue-50/30 rounded-lg flex flex-col items-center justify-center gap-2 group hover:border-blue-400 transition-all">
                  <ImageIcon size={20} className="text-blue-500 animate-pulse" />
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Media Hook Integrated</p>
                  <p className="text-[9px] text-blue-400 text-center px-4 italic">系统已自动识别该字段为媒体库关联。点击上方「图片中心」组件可进行交互。</p>
                </div>
              ) : (
                <RelationSelect 
                  field={field} 
                  value={formData[field.name]} 
                  currentId={initialData?.id} // 透传当前记录 ID 以检测循环引用
                  onChange={(val) => handleChange(field.name, val)}
                  hasError={hasError}
                />
              )}
            </div>
          );
        default:
          return <Input value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} />;
      }
    };

    return (
      <div key={field.name} className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-red-500">*</span>}
          </Label>
        </div>
        
        {renderControl()}
        
        {hasError && (
          <p className="text-[11px] font-medium text-red-500 flex items-center gap-1 animate-in slide-in-from-top-1">
            <AlertCircle size={12} />
            {errors[field.name]}
          </p>
        )}
      </div>
    );
  };

  if (!isMounted) return <div className="p-12 text-center text-slate-400">正在初始化编辑器...</div>;

  return (
    <ErrorBoundary fallback={<div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl text-red-600">表单组件加载异常，请尝试重新打开。</div>}>
      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* 状态 Alert：空语种保护 */}
        {languages.length === 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 text-amber-700">
            <AlertCircle size={20} />
            <div className="text-xs">
              <p className="font-bold">未检测到可用语言</p>
              <p className="opacity-80">系统至少需要配置一种启用语种才能创建内容。请先前往「语言设置」添加。</p>
            </div>
          </div>
        )}

        {/* 模式 1: 通用新增模式下的语种选择器 */}
        {isNewMode && languages.length > 0 && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
              <Globe size={14} className="text-blue-500" />
              版本语种设置
            </div>
            <div className="grid grid-cols-2 gap-4">
              {languages.map(lang => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    const targetCode = lang.code;
                    // [核心修复]：如果是新增记录且切换语种，必须执行内存搬运
                    if (isNewMode) {
                      handleLocaleSwitch(targetCode);
                    } else {
                      setCurrentLocale(targetCode);
                      handleChange('locale', targetCode);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all",
                    currentLocale === lang.code 
                      ? "bg-blue-50 border-blue-600 ring-4 ring-blue-500/10" 
                      : "bg-white border-slate-200 hover:border-slate-300 opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", currentLocale === lang.code ? "bg-blue-600" : "bg-slate-300")} />
                    <span className="text-sm font-semibold">{lang.name}</span>
                  </div>
                  {lang.isDefault && <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-none text-[9px]">默认</Badge>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 模式 2: 编辑模式下的语种切换页签 */}
        {!isNewMode && languages.length > 1 && (
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-2">
            <div className="flex items-center gap-1">
              {languages.map((lang) => {
                const hasTranslation = !!translationsMap[lang.code]?.id;
                const isActive = currentLocale === lang.code;

                return (
                  <button
                    key={lang.code}
                    type="button"
                    disabled={isMatching}
                    onClick={() => handleLocaleSwitch(lang.code)}
                    className={cn(
                      "px-4 py-2 text-xs font-bold rounded-full transition-all flex items-center gap-2 border disabled:opacity-50",
                      isActive 
                        ? "bg-blue-600 text-white border-blue-600 shadow-md" 
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
                      !hasTranslation && !isActive && "opacity-60 border-dashed"
                    )}
                  >
                    <Globe size={12} className={isActive ? "text-white" : "text-slate-400"} />
                    {lang.name}
                    {hasTranslation && !isActive && <div className="w-1.5 h-1.5 bg-green-400 rounded-full ml-1" />}
                  </button>
                );
              })}
            </div>

            {/* 增强功能按钮 */}
            {currentLocale !== (languages.find(l => l.isDefault)?.code || languages[0]?.code) && (
              <Button 
                type="button" 
                variant="outline" 
                size="xs" 
                onClick={handleCopyFromDefault}
                className="text-[10px] h-7 gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <Plus size={12} />
                同步默认语种内容
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {fields?.map(renderField)}
        </div>

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-500 hover:text-slate-900"
          >
            取消
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading || languages.length === 0 || isMatching}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px] shadow-lg shadow-blue-500/20"
          >
            {isLoading ? '提交中...' : isMatching ? '正在同步语种...' : '保存更改'}
          </Button>
        </div>
      </form>
    </ErrorBoundary>
  );
};

/**
 * 规格模板选项加载器
 */
const SpecTemplateOptions: React.FC = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/v1/entities/spec_templates')
      .then(res => res.json())
      .then(res => setTemplates(res.data || []))
      .catch(() => setTemplates([]));
  }, []);

  return (
    <>
      {templates.map(t => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </>
  );
};

// 极简错误边界组件
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
