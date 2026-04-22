import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Settings2, 
  Database,
  ArrowRight,
  Loader2,
  Info
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../ui/Table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from '../ui/Dialog';
import { Badge } from '../ui/Badge';
import { Switch } from '../ui/Switch';
import { Label } from '../ui/Checkbox';
import { useToast } from '../ui/Toaster';

interface ModelField {
  name: string;
  type: 'text' | 'textarea' | 'number' | 'richtext' | 'image' | 'media' | 'json' | 'multi_image' | 'multi_file' | 'radio' | 'select' | 'multi_select' | 'checkbox' | 'relation_single' | 'relation_multi';
  label: string;
  placeholder?: string;
  required: boolean;
  isListDisplay: boolean;
}

interface ModelDefinition {
  id?: number;
  name: string;
  slug: string;
  description: string;
  fieldsJson: ModelField[];
}

export const ModelsManagement: React.FC = () => {
  const [models, setModels] = useState<ModelDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // 删除确认弹窗状态
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 表单状态
  const [form, setForm] = useState<ModelDefinition>({
    name: '',
    slug: '',
    description: '',
    fieldsJson: []
  });

  // 监听编辑对象
  useEffect(() => {
    if (editingModel) {
      setForm({ ...editingModel });
    } else {
      setForm({ name: '', slug: '', description: '', fieldsJson: [] });
    }
  }, [editingModel]);

  // 动态字段状态
  const [newField, setNewField] = useState<ModelField>({
    name: '',
    type: 'text',
    label: '',
    placeholder: '',
    required: false,
    isListDisplay: true
  });

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/rbac/models');
      const data = await res.json();
      setModels(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch models');
    } finally {
      setLoading(false);
    }
  };

  // 自动生成 Slug 逻辑
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-') // 替换非字母数字字符为横线
      .replace(/^-+|-+$/g, '');   // 去除首尾横线
    
    setForm(prev => ({ ...prev, name, slug }));
  };

  // 添加字段到列表
  const addField = () => {
    if (!newField.name || !newField.label) {
      toast({
        variant: "destructive",
        title: "校验失败",
        description: "字段标识 (Key) 和显示标签不能为空。"
      });
      return;
    }
    
    // 检查 Key 是否重复
    if (form.fieldsJson.some(f => f.name.toLowerCase() === newField.name.toLowerCase())) {
        toast({
          variant: "destructive",
          title: "命名冲突",
          description: `字段 Key [${newField.name}] 已存在，请使用其他名称。`
        });
        return;
    }
    
    // 自动清洗字段名
    const cleanName = newField.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    
    setForm(prev => ({
      ...prev,
      fieldsJson: [...prev.fieldsJson, { ...newField, name: cleanName }]
    }));

    // 重置字段表单
    setNewField({
      name: '',
      type: 'text',
      label: '',
      placeholder: '',
      required: false,
      isListDisplay: true
    });
  };

  // 移除字段
  const removeField = (index: number) => {
    setForm(prev => ({
      ...prev,
      fieldsJson: prev.fieldsJson.filter((_, i) => i !== index)
    }));
  };

  // 保存模型 (支持新增与修改)
  const handleSaveModel = async () => {
    if (!form.name || !form.slug) return;
    setSaving(true);
    try {
      const isEdit = !!form.id;
      const res = await fetch(isEdit ? `/api/v1/rbac/models/${form.id}` : '/api/v1/rbac/models', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      
      if (res.ok) {
        setIsCreateOpen(false);
        setEditingModel(null);
        window.dispatchEvent(new CustomEvent('collections-updated'));
        fetchModels();
        toast({ title: isEdit ? '更新成功' : '创建成功', description: '模型定义已同步至 D1 数据库' });
      } else {
        const err = await res.json();
        toast({ variant: 'destructive', title: '保存失败', description: err.error });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: '网络错误', description: '无法连接至后台服务' });
    } finally {
      setSaving(false);
    }
  };

  // 删除模型
  const handleDeleteModel = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/rbac/models/${deleteId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: "删除成功", description: "内容模型及其关联权限已移除" });
        setDeleteId(null);
        fetchModels();
      } else {
        const err = await res.json();
        throw new Error(err.error || '删除失败');
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "删除操作失败", description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const getFieldTypeBadge = (type: string) => {
    switch (type) {
      case 'text': return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">文本</Badge>;
      case 'textarea': return <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100">多行文本</Badge>;
      case 'number': return <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100">数字</Badge>;
      case 'richtext': return <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100">富文本</Badge>;
      case 'image': return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">图片</Badge>;
      case 'multi_image': return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">多图</Badge>;
      case 'media': return <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">单文件</Badge>;
      case 'multi_file': return <Badge variant="secondary" className="bg-violet-100 text-violet-700 hover:bg-violet-100">多文件</Badge>;
      case 'radio': return <Badge variant="secondary" className="bg-pink-100 text-pink-700 hover:bg-pink-100">单选</Badge>;
      case 'checkbox': return <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100">多选</Badge>;
      case 'select': return <Badge variant="secondary" className="bg-rose-100 text-rose-700 hover:bg-rose-100">下拉单选</Badge>;
      case 'multi_select': return <Badge variant="secondary" className="bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100">下拉多选</Badge>;
      case 'relation_single': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">关联单选</Badge>;
      case 'relation_multi': return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">关联多选</Badge>;
      case 'json': return <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100 font-mono">JSON</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Database className="text-blue-600" size={24} />
            内容模型定义
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            定义您的业务模型，系统将自动生成对应的数据库表、CRUD 接口及 RBAC 权限。
          </p>
        </div>

            <Dialog open={isCreateOpen || !!editingModel} onOpenChange={(v) => {
          if(!v) { setIsCreateOpen(false); setEditingModel(null); }
          else if (!editingModel) setIsCreateOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 gap-2">
              <Plus size={18} />
              新建模型
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[80%] max-h-[90vh] overflow-y-auto rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="text-blue-600" size={20} />
                {editingModel ? '编辑内容模型' : '定义新模型'}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-6 py-4">
              {/* 基础信息 */}
              <div className="grid grid-cols-2 gap-4 border-b pb-6">
                <div className="space-y-2">
                  <Label htmlFor="name">模型显示名称 (如：产品)</Label>
                  <Input 
                    id="name" 
                    placeholder="中文名称" 
                    value={form.name} 
                    onChange={e => handleNameChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">模型标识符 (Slug)</Label>
                  <Input 
                    id="slug" 
                    placeholder="仅限字母、数字、横线" 
                    value={form.slug}
                    disabled={!!editingModel} // Slug 禁止编辑
                    onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
                  />
                </div>
              </div>

              {/* 动态字段配置器 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">字段配置 ({form.fieldsJson.length})</Label>
                  <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    <Info size={12} />
                    保存后将自动生成 entity:{form.slug}:* 权限
                  </div>
                </div>

                {/* 字段添加表单 */}
                <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-3 space-y-1.5">
                    <Label className="text-[10px] uppercase text-slate-500">显示名称</Label>
                    <Input 
                      className="h-8 text-sm" 
                      placeholder="e.g. 标题" 
                      value={newField.label} 
                      onChange={e => setNewField({...newField, label: e.target.value})}
                    />
                  </div>
                  <div className="col-span-3 space-y-1.5">
                    <Label className="text-[10px] uppercase text-slate-500">类型</Label>
                    <select 
                      className="w-full h-8 px-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={newField.type}
                      onChange={e => setNewField({...newField, type: e.target.value as any})}
                    >
                      <option value="text">文本 (Text)</option>
                      <option value="textarea">多行文本 (Textarea)</option>
                      <option value="number">数字 (Number)</option>
                      <option value="richtext">富文本 (RichText)</option>
                      <option value="image">图片单张 (Image)</option>
                      <option value="multi_image">图片多张 (Multi-image)</option>
                      <option value="media">单文件/媒体 (Media)</option>
                      <option value="multi_file">多文件/媒体 (Multi-file)</option>
                      <option value="radio">单选 (Radio)</option>
                      <option value="checkbox">多选 (Checkbox / Multi-selection)</option>
                      <option value="select">下拉单选 (Select)</option>
                      <option value="multi_select">下拉多选 (Multi-select)</option>
                      <option value="relation_single">关联单选 (Relation Single)</option>
                      <option value="relation_multi">关联多选 (Relation Multi)</option>
                      <option value="json">JSON 对象/数组</option>
                    </select>
                  </div>
                  <div className="col-span-3 space-y-1.5">
                    <Label className="text-[10px] uppercase text-slate-500">字段 Key 值</Label>
                    <Input 
                      className="h-8 text-sm" 
                      placeholder="e.g. title" 
                      value={newField.name} 
                      onChange={e => setNewField({...newField, name: e.target.value})}
                    />
                  </div>
                  <div className="col-span-3">
                    <Button onClick={addField} size="sm" className="w-full h-8 bg-slate-800 hover:bg-slate-900">
                      <Plus size={14} className="mr-1" /> 添加
                    </Button>
                  </div>

                  <div className="col-span-12 flex gap-6 pt-1">
                    <div className="flex items-center space-x-2">
                       <Switch 
                        id="required-toggle" 
                        checked={newField.required} 
                        onCheckedChange={v => setNewField({...newField, required: v})}
                       />
                       <Label htmlFor="required-toggle" className="text-xs font-normal">必填项</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                       <Switch 
                        id="list-toggle" 
                        checked={newField.isListDisplay} 
                        onCheckedChange={v => setNewField({...newField, isListDisplay: v})}
                       />
                       <Label htmlFor="list-toggle" className="text-xs font-normal">在列表中展示</Label>
                    </div>
                  </div>
                </div>

                {/* 字段列表渲染 */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-[120px]">字段 Key</TableHead>
                        <TableHead>显示名称</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead className="text-center">属性</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.fieldsJson.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-slate-400 text-sm italic">
                            尚未添加任何字段...
                          </TableCell>
                        </TableRow>
                      ) : (
                        form.fieldsJson.map((field, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{field.name}</TableCell>
                            <TableCell>{field.label}</TableCell>
                            <TableCell>{getFieldTypeBadge(field.type)}</TableCell>
                            <TableCell>
                              <div className="flex gap-2 justify-center">
                                {field.required && <Badge className="bg-red-50 text-red-600 border-none px-1 text-[10px]">REQUIRED</Badge>}
                                {field.isListDisplay && <Badge className="bg-blue-50 text-blue-600 border-none px-1 text-[10px]">LIST</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => removeField(idx)} className="text-slate-400 hover:text-red-600 h-8 w-8 p-0">
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-4">
              <Button variant="ghost" onClick={() => { setIsCreateOpen(false); setEditingModel(null); }} disabled={saving}>取消</Button>
              <Button 
                onClick={handleSaveModel} 
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                disabled={saving || !form.name || form.fieldsJson.length === 0}
              >
                {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                保存模型定义
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="pl-6">模型名称</TableHead>
              <TableHead>标识 (Slug)</TableHead>
              <TableHead>字段概览</TableHead>
              <TableHead className="text-right pr-6">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                 <TableCell colSpan={4} className="py-20 text-center">
                    <Loader2 className="animate-spin inline-block text-blue-500 mb-2" size={32} />
                    <p className="text-sm text-slate-500">正在通过 Drizzle 拉取模型定义...</p>
                 </TableCell>
              </TableRow>
            ) : models.length === 0 ? (
              <TableRow>
                 <TableCell colSpan={4} className="py-20 text-center">
                    <Database size={48} className="text-slate-200 inline-block mb-4" />
                    <p className="text-slate-500">尚未定义任何动态模型</p>
                    <Button variant="outline" className="mt-4" onClick={() => setIsCreateOpen(true)}>点击开始创建</Button>
                 </TableCell>
              </TableRow>
            ) : (
              models.map((model) => (
                <TableRow key={model.id} className="hover:bg-slate-50/50 group">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-bold">
                        {model.name[0]}
                      </div>
                      <span className="font-semibold text-slate-800">{model.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{model.slug}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {model.fieldsJson.slice(0, 3).map((f, i) => (
                        <span key={i} className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                          {f.label}
                        </span>
                      ))}
                      {model.fieldsJson.length > 3 && <span className="text-[10px] text-slate-400">+{model.fieldsJson.length - 3}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2">
                       <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500" onClick={() => setEditingModel(model)}>
                         编辑定义 <Settings2 size={14} className="ml-1" />
                       </Button>
                       <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-600" onClick={() => setDeleteId(model.id!)}>
                         <Trash2 size={16} />
                       </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">危除删除操作</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-slate-500">
            确定要删除该模型吗？这将同步删除相关的权限定义。若该模型已有业务数据，删除可能导致系统异常。此操作不可恢复。
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>取消</Button>
            <Button 
              disabled={isDeleting}
              onClick={handleDeleteModel}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? <Loader2 className="animate-spin mr-2" size={14} /> : <Trash2 size={14} className="mr-2" />}
              彻底删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
