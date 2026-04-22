import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { 
  Plus, 
  Trash2, 
  AlertCircle, 
  Code, 
  Eye, 
  ChevronRight, 
  ChevronDown,
  Braces,
  List,
  Type,
  Hash,
  ToggleLeft
} from 'lucide-react';

interface AdvancedJSONEditorProps {
  value: any;
  onChange: (val: any) => void;
  hasError?: boolean;
}

/**
 * 高级嵌套 JSON 编辑器 (v4.0)
 * 功能特性：
 * 1. 递归渲染：支持 Object 与 Array 无限层级嵌套
 * 2. 双模式切换：可视化交互 (Visual) 与 源码编辑 (Source)
 * 3. 实时校验：源码模式粘贴时自动校验并显示错误位置
 * 4. 类型自愈：支持在界面一键切换节点类型
 */
export const AdvancedJSONEditor: React.FC<AdvancedJSONEditorProps> = ({ value, onChange, hasError }) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'source'>('visual');
  const [rawText, setRawText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // 初始化 rawText
  useEffect(() => {
    try {
      const stringified = JSON.stringify(value, null, 2);
      if (stringified !== rawText) {
        setRawText(stringified === 'null' ? '' : stringified);
      }
    } catch (e) {
      // 容错处
    }
  }, [value, activeTab]);

  const handleSourceChange = (text: string) => {
    setRawText(text);
    if (!text.trim()) {
      setJsonError(null);
      onChange({});
      return;
    }
    try {
      const parsed = JSON.parse(text);
      setJsonError(null);
      onChange(parsed);
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  return (
    <div className={cn(
      "flex flex-col border rounded-xl overflow-hidden bg-white transition-all shadow-sm",
      hasError ? "border-red-500 ring-2 ring-red-500/20" : "border-slate-200"
    )}>
      {/* 头部 Tab 切换 */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex bg-slate-200/50 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('visual')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all",
              activeTab === 'visual' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Eye size={12} /> 可视化编辑
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('source')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all",
              activeTab === 'source' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Code size={12} /> 源码模式
          </button>
        </div>
        <Badge variant="outline" className="text-[10px] bg-slate-100 font-mono">JSON_V4_NESTED</Badge>
      </div>

      {/* 内容区域 */}
      <div className="min-h-[200px] max-h-[500px] overflow-y-auto">
        {activeTab === 'source' ? (
          <div className="p-4 space-y-3 relative h-full">
            <textarea
              className={cn(
                "w-full h-[300px] font-mono text-[11px] p-4 bg-slate-900 text-blue-300 rounded-lg outline-none selection:bg-blue-500/30",
                jsonError ? "ring-1 ring-red-500" : ""
              )}
              spellCheck={false}
              value={rawText}
              onChange={(e) => handleSourceChange(e.target.value)}
              placeholder='{"key": "value"}'
            />
            {jsonError && (
              <div className="absolute bottom-6 left-6 right-6 p-2 bg-red-500 text-white text-[10px] rounded flex items-center gap-2 animate-in slide-in-from-bottom-2">
                <AlertCircle size={12} />
                <span>JSON 格式错误: {jsonError}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            <VisualNode 
              data={value} 
              onChange={onChange} 
              depth={0}
              isLast={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 递归节点组件
 */
const VisualNode: React.FC<{
  data: any;
  onChange: (val: any) => void;
  onKeyChange?: (newKey: string) => void;
  depth: number;
  label?: string;
  isLast?: boolean;
}> = ({ data, onChange, onKeyChange, depth, label, isLast }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingKey, setEditingKey] = useState(label || "");

  const isObject = data !== null && typeof data === 'object' && !Array.isArray(data);
  const isArray = Array.isArray(data);
  const isPrimitive = !isObject && !isArray;

  // 当外部 label 变化时同步内部 editingKey
  useEffect(() => {
    if (label !== undefined) setEditingKey(label);
  }, [label]);

  // 类型处理
  const updateType = (newType: 'string' | 'number' | 'boolean' | 'object' | 'array') => {
    switch (newType) {
      case 'string': onChange(""); break;
      case 'number': onChange(0); break;
      case 'boolean': onChange(false); break;
      case 'object': onChange({}); break;
      case 'array': onChange([]); break;
    }
  };

  const renderLabel = () => {
    if (!label && depth === 0) return null;
    
    // 如果存在 onKeyChange，说明该节点是 Object 的属性，允许编辑键名
    if (onKeyChange) {
      return (
        <input
          type="text"
          className={cn(
            "text-xs font-mono px-1 py-0.5 rounded outline-none w-24 transition-all focus:bg-white focus:ring-1 focus:ring-blue-400",
            isObject ? "text-blue-600 font-bold" : "text-slate-600"
          )}
          value={editingKey}
          onChange={(e) => setEditingKey(e.target.value)}
          onBlur={() => {
            if (editingKey !== label && editingKey.trim()) {
              onKeyChange(editingKey.trim());
            } else {
              setEditingKey(label || "");
            }
          }}
          onKeyDown={(e) => {
             if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      );
    }

    return (
      <span className={cn(
        "text-xs font-mono shrink-0",
        isObject ? "text-blue-600 font-bold" : "text-slate-600"
      )}>
        {label}:
      </span>
    );
  };

  // 基础类型渲染
  if (isPrimitive) {
    return (
      <div className="flex items-center gap-2 py-1 group">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {renderLabel()}
          {typeof data === 'boolean' ? (
            <div className="flex items-center gap-2">
              <Switch checked={data} onCheckedChange={onChange} />
              <span className="text-[10px] font-bold text-slate-400 capitalize">{String(data)}</span>
            </div>
          ) : (
            <input
              type={typeof data === 'number' ? 'number' : 'text'}
              className="flex-1 bg-white border-b border-transparent hover:border-slate-200 focus:border-blue-400 focus:outline-none text-xs px-1 py-0.5 font-mono"
              value={data ?? ""}
              onChange={(e) => onChange(typeof data === 'number' ? Number(e.target.value) : e.target.value)}
            />
          )}
        </div>
        <NodeControls onTypeChange={updateType} type={typeof data as any} />
      </div>
    );
  }

  // 对象/数组 渲染
  return (
    <div className={cn("flex flex-col", depth > 0 && "ml-4 border-l border-slate-100 pl-4")}>
      <div className="flex items-center justify-between py-1 group">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          {renderLabel()}
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
            {isObject ? <Braces size={10} /> : <List size={10} />}
            {isObject ? 'Object' : 'Array'} 
            <span className="text-[9px] lowercase font-normal">({Object.keys(data || {}).length} items)</span>
          </span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
          <Button 
            type="button"
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-blue-500 hover:bg-blue-50"
            onClick={(e) => {
              e.stopPropagation();
              if (isObject) {
                let i = 0;
                while (Object.keys(data).includes(`key_${Object.keys(data).length + i}`)) i++;
                const key = `key_${Object.keys(data).length + i}`;
                onChange({ ...data, [key]: "" });
              } else {
                onChange([...data, ""]);
              }
              setIsExpanded(true);
            }}
          >
            <Plus size={12} />
          </Button>
          <NodeControls onTypeChange={updateType} type={isObject ? 'object' : 'array'} hideDelete={depth === 0} />
        </div>
      </div>

      {isExpanded && (
        <div className="flex flex-col">
          {isObject ? (
            Object.entries(data || {}).map(([key, val], idx, arr) => (
              <div key={key} className="flex items-start">
                <div className="flex-1 min-w-0">
                  <VisualNode
                    label={key}
                    data={val}
                    depth={depth + 1}
                    isLast={idx === arr.length - 1}
                    onKeyChange={(newKey) => {
                      if (newKey === key) return;
                      if (Object.keys(data).includes(newKey)) return;
                      const next = {};
                      Object.entries(data).forEach(([k, v]) => {
                        if (k === key) next[newKey] = v;
                        else next[k] = v;
                      });
                      onChange(next);
                    }}
                    onChange={(newVal) => {
                      const next = { ...data };
                      next[key] = newVal;
                      onChange(next);
                    }}
                  />
                </div>
                {/* 仅在顶级或作为对象成员时支持删除属性 */}
                <div className="mt-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                        const next = { ...data };
                        delete next[key];
                        onChange(next);
                    }}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            (data as any[]).map((val, idx, arr) => (
              <div key={idx} className="flex items-start">
                 <div className="flex-1 min-w-0">
                  <VisualNode
                    label={String(idx)}
                    data={val}
                    depth={depth + 1}
                    isLast={idx === arr.length - 1}
                    onChange={(newVal) => {
                      const next = [...data];
                      next[idx] = newVal;
                      onChange(next);
                    }}
                  />
                </div>
                <div className="mt-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                        const next = [...data];
                        next.splice(idx, 1);
                        onChange(next);
                    }}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 节点类型切换工具栏
 */
const NodeControls: React.FC<{ 
  onTypeChange: (t: any) => void; 
  type: string;
  hideDelete?: boolean;
}> = ({ onTypeChange, type, hideDelete }) => {
  return (
    <div className="flex items-center gap-1 origin-right">
      <select
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
        className="text-[11px] border rounded bg-slate-50 px-1 py-0.5 outline-none cursor-pointer hover:bg-white transition-colors"
      >
        <option value="string">Str</option>
        <option value="number">Num</option>
        <option value="boolean">Bool</option>
        <option value="object">Obj</option>
        <option value="array">Arr</option>
      </select>
    </div>
  );
};
