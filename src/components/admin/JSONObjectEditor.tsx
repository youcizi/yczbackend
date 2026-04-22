import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import { Label } from '../ui/Label';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { Plus, Trash2, AlertCircle, RefreshCcw, Type, Hash, ToggleLeft } from 'lucide-react';

interface Entry {
  id: string;
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean';
}

interface JSONObjectEditorProps {
  value: any;
  onChange: (val: any) => void;
  hasError?: boolean;
}

/**
 * 可视化 JSON 对象编辑器 (v3.0)
 * 支持类型强制转换、Key 冲突检测与非对象数据兜底
 */
export const JSONObjectEditor: React.FC<JSONObjectEditorProps> = ({ value, onChange, hasError }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isInvalidState, setIsInvalidState] = useState(false);
  const [duplicateKeys, setDuplicateKeys] = useState<Set<string>>(new Set());

  // 1. 初始化切换：将 Object 转换为 Entries 数组
  useEffect(() => {
    try {
      if (value === null || value === undefined) {
        setEntries([]);
        setIsInvalidState(false);
        return;
      }

      if (typeof value !== 'object' || Array.isArray(value)) {
        setIsInvalidState(true);
        return;
      }

      // 如果内部已经有数据且与传入数据生成的 JSON 一致，则跳过（防止编辑过程中的抖动）
      const currentObj: Record<string, any> = {};
      entries.forEach(e => {
        currentObj[e.key] = e.value;
      });
      
      if (JSON.stringify(currentObj) === JSON.stringify(value) && entries.length > 0) {
        return;
      }

      const initialEntries: Entry[] = Object.entries(value).map(([k, v]) => {
        let type: 'string' | 'number' | 'boolean' = 'string';
        if (typeof v === 'number') type = 'number';
        else if (typeof v === 'boolean') type = 'boolean';
        
        return {
          id: Math.random().toString(36).slice(2, 9),
          key: k,
          value: v,
          type
        };
      });
      setEntries(initialEntries);
      setIsInvalidState(false);
    } catch (e) {
      setIsInvalidState(true);
    }
  }, [value]); // 监听 value 以支持外部同步，但在内部通过 stringify 比较避免循环更新

  // 2. 核心逻辑：从 Entries 构建 Object 并回传
  const syncToParent = useCallback((currentEntries: Entry[]) => {
    const nextObj: Record<string, any> = {};
    const keys = new Set<string>();
    const duplicates = new Set<string>();

    currentEntries.forEach(entry => {
      const trimmedKey = entry.key.trim();
      
      // 冲突检测 (含空 Key 检测)
      if (keys.has(trimmedKey) || trimmedKey === '') {
        duplicates.add(entry.key); // 记录原始 key 以便在 UI 标记
      }
      keys.add(trimmedKey);

      // 类型强制转换确保原始性
      let coercedValue = entry.value;
      if (entry.type === 'number') {
        coercedValue = Number(entry.value);
        if (isNaN(coercedValue)) coercedValue = 0;
      } else if (entry.type === 'boolean') {
        coercedValue = Boolean(entry.value);
      } else {
        coercedValue = String(entry.value);
      }

      nextObj[trimmedKey] = coercedValue;
    });

    setDuplicateKeys(duplicates);
    
    // 只有在没有重复且 KEY 不为空时才同步
    const hasEmptyKey = currentEntries.some(e => e.key.trim() === '');
    if (duplicates.size === 0 && !hasEmptyKey) {
      onChange(nextObj);
    }
  }, [onChange]);

  // 3. 交互方法
  const addEntry = () => {
    const newEntry: Entry = {
      id: Math.random().toString(36).slice(2, 9),
      key: `key_${entries.length + 1}`,
      value: "",
      type: 'string'
    };
    const next = [...entries, newEntry];
    setEntries(next);
    syncToParent(next);
  };

  const removeEntry = (id: string) => {
    const next = entries.filter(e => e.id !== id);
    setEntries(next);
    syncToParent(next);
  };

  const updateEntry = (id: string, updates: Partial<Entry>) => {
    const next = entries.map(e => {
      if (e.id === id) {
        const updated = { ...e, ...updates };
        // 如果改变了类型，执行立即转换
        if (updates.type) {
          if (updates.type === 'number') updated.value = 0;
          else if (updates.type === 'boolean') updated.value = false;
          else updated.value = "";
        }
        return updated;
      }
      return e;
    });
    setEntries(next);
    syncToParent(next);
  };

  const handleReset = () => {
    const empty = {};
    setEntries([]);
    setIsInvalidState(false);
    onChange(empty);
  };

  // 4. 渲染分层
  if (isInvalidState) {
    return (
      <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg flex flex-col items-center gap-3 animate-in fade-in zoom-in-95">
        <AlertCircle className="text-amber-500 w-8 h-8" />
        <div className="text-center">
          <p className="text-sm font-bold text-amber-900">非标准对象结构</p>
          <p className="text-[10px] text-amber-700 mt-1">检测到原始数据为数组或基础类型，当前编辑器仅支持扁平对象 ( {`{}`} )。</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleReset}
          className="bg-white border-amber-300 text-amber-700 hover:bg-amber-100"
        >
          <RefreshCcw className="w-3 h-3 mr-2" />
          重置为清空对象
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 p-3 bg-slate-50/50 border rounded-lg transition-all", hasError ? "border-red-500 ring-1 ring-red-500" : "border-slate-200")}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
           <Badge variant="outline" className="bg-slate-900 text-slate-100 border-0 text-[9px] px-1.5 py-0">V3.0 VISUAL_JSON</Badge>
           {duplicateKeys.size > 0 && <span className="text-[10px] text-red-500 font-bold animate-pulse">检测到 Key 冲突！</span>}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={addEntry} className="h-7 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50">
          <Plus className="w-3 h-3 mr-1" /> 添加属性
        </Button>
      </div>

      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className="py-6 text-center border-2 border-dashed border-slate-200 rounded-md">
            <p className="text-xs text-slate-400 italic">空对象数据</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 animate-in slide-in-from-left-2 duration-200">
              {/* Key Input */}
              <div className="flex-1 space-y-1">
                <Input 
                  className={cn("h-8 text-xs font-mono", duplicateKeys.has(entry.key) ? "border-red-400 focus-visible:ring-red-400 bg-red-50" : "")}
                  value={entry.key}
                  onChange={(e) => updateEntry(entry.id, { key: e.target.value })}
                  placeholder="Key"
                />
              </div>

              {/* Type Switcher */}
              <select 
                className="h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                value={entry.type}
                onChange={(e) => updateEntry(entry.id, { type: e.target.value as any })}
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </select>

              {/* Value Input Area */}
              <div className="flex-[1.5] flex items-center gap-2 min-h-[32px]">
                {entry.type === 'boolean' ? (
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-md border border-slate-200 h-8 flex-1">
                    <Switch 
                      checked={entry.value === true}
                      onCheckedChange={(checked) => updateEntry(entry.id, { value: checked })}
                    />
                    <span className="text-[10px] uppercase font-bold text-slate-500">{String(entry.value)}</span>
                  </div>
                ) : (
                  <Input 
                    type={entry.type === 'number' ? 'number' : 'text'}
                    className="h-8 text-xs bg-white"
                    value={entry.value}
                    onChange={(e) => updateEntry(entry.id, { value: e.target.value })}
                    placeholder="Value..."
                  />
                )}
                
                <Button 
                   type="button" 
                   variant="ghost" 
                   size="icon" 
                   className="h-8 w-8 text-slate-400 hover:text-red-500 transition-colors"
                   onClick={() => removeEntry(entry.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 底部摘要预览 */}
      <div className="pt-2 border-t border-slate-100 mt-2 flex items-center justify-between">
         <div className="flex gap-3">
            <span className="flex items-center gap-1 text-[9px] text-slate-400"><Type size={10} /> {entries.filter(e => e.type === 'string').length}</span>
            <span className="flex items-center gap-1 text-[9px] text-slate-400"><Hash size={10} /> {entries.filter(e => e.type === 'number').length}</span>
            <span className="flex items-center gap-1 text-[9px] text-slate-400"><ToggleLeft size={10} /> {entries.filter(e => e.type === 'boolean').length}</span>
         </div>
      </div>
    </div>
  );
};
