import React, { useState, useEffect } from 'react';
import { Mail, Save, Loader2, Key, Server, Hash, FileText, Plus, Trash2, Edit2, Code } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toaster';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '../ui/Dialog';
import { Check } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';

export const MailSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('config');

  // --- Mail Config State ---
  const [form, setForm] = useState({
    provider_type: 'resend',
    resend_api_key: '',
    sender_email: '',
    smtp_config: { host: '', port: 465, user: '', pass: '' }
  });

  // --- Templates State ---
  const [templates, setTemplates] = useState<any[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateForm, setTemplateForm] = useState({
    slug: '', name: '', subject: '', content: '', vars: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, templatesRes] = await Promise.all([
        fetch('/api/v1/settings/mail_config'),
        fetch('/api/v1/settings/mail_templates')
      ]);
      
      const configData = await configRes.json();
      const templatesData = await templatesRes.json();

      setForm({
        provider_type: configData.provider_type || 'resend',
        resend_api_key: configData.resend_api_key || '',
        sender_email: configData.sender_email || '',
        smtp_config: {
          host: configData.smtp_config?.host || '',
          port: configData.smtp_config?.port || 465,
          user: configData.smtp_config?.user || '',
          pass: configData.smtp_config?.pass || ''
        }
      });

      if (templatesData.success) {
        setTemplates(templatesData.data);
      }
    } catch (e) {
      toast({ variant: 'destructive', title: '加载失败', description: '无法获取邮件配置' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/settings/mail_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setShowSuccess(true);
      } else {
        throw new Error('保存失败');
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '保存失败', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/settings/mail_templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...templateForm, id: editingTemplate?.id })
      });
      if (res.ok) {
        setIsTemplateModalOpen(false);
        fetchData();
        toast({ title: '模板已保存' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('确定删除此模板吗？')) return;
    try {
      await fetch(`/api/v1/settings/mail_templates/${id}`, { method: 'DELETE' });
      fetchData();
      toast({ title: '模板已删除' });
    } catch (e) {
      toast({ variant: 'destructive', title: '删除失败' });
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500"><Loader2 className="animate-spin mx-auto" /></div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Mail className="text-blue-600" size={24} />
            系统邮件服务
          </h2>
          <p className="text-sm text-slate-500 mt-1">配置全局邮件渠道与动态通知模板。</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl mb-6">
          <TabsTrigger value="config" className="px-8 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">服务渠道配置</TabsTrigger>
          <TabsTrigger value="templates" className="px-8 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">邮件内容模板</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-0">
          <Card className="border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="border-b bg-slate-50/80 px-6 py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">服务商选择 (Provider Selection)</CardTitle>
                <div className="flex gap-2 p-1 bg-slate-200/50 rounded-lg">
                  <button 
                    onClick={() => setForm({...form, provider_type: 'resend'})}
                    className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${form.provider_type === 'resend' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >Resend API</button>
                  <button 
                    onClick={() => setForm({...form, provider_type: 'smtp'})}
                    className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${form.provider_type === 'smtp' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >自定义 SMTP</button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl text-sm text-blue-800">
                <div className="mt-0.5"><Code size={16} /></div>
                <div>
                  <p className="font-semibold mb-1">当前生效模式：{form.provider_type === 'resend' ? 'Resend API' : '自定义 SMTP'}</p>
                  <p className="opacity-80">系统将仅使用您下方选中的配置项进行发送。{form.provider_type === 'resend' ? '推荐在 Serverless 环境中使用 Resend 以获得最佳可靠性。' : '使用 SMTP 时请确保 465 端口或 TLS 环境畅通。'}</p>
                </div>
              </div>

              {form.provider_type === 'resend' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Key size={14} /> API Key</label>
                      <Input value={form.resend_api_key} onChange={e => setForm({...form, resend_api_key: e.target.value})} placeholder="re_xxxxxxxxxxxxxxxxx" className="font-mono bg-slate-50/50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Mail size={14} /> 发件人邮箱</label>
                      <Input value={form.sender_email} onChange={e => setForm({...form, sender_email: e.target.value})} placeholder="no-reply@yourdomain.com" className="bg-slate-50/50" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Server size={14} /> SMTP 主机 (Host)</label>
                      <Input value={form.smtp_config.host} onChange={e => setForm({...form, smtp_config: {...form.smtp_config, host: e.target.value}})} placeholder="smtp.example.com" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Hash size={14} /> 端口 (Port)</label>
                      <Input type="number" value={form.smtp_config.port} onChange={e => setForm({...form, smtp_config: {...form.smtp_config, port: parseInt(e.target.value) || 465}})} placeholder="465" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">认证账号 (User)</label>
                      <Input value={form.smtp_config.user} onChange={e => setForm({...form, smtp_config: {...form.smtp_config, user: e.target.value}})} placeholder="no-reply@example.com" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">认证密码 (Password)</label>
                      <Input type="password" value={form.smtp_config.pass} onChange={e => setForm({...form, smtp_config: {...form.smtp_config, pass: e.target.value}})} placeholder="********" />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-10 pt-6 border-t flex justify-end">
                <Button onClick={handleSaveConfig} loading={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-11 rounded-xl shadow-lg shadow-blue-600/20">
                  {!saving && <Save className="mr-2" size={18} />}
                  保存渠道配置
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-0 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-slate-800">邮件业务模板</h3>
            <Button onClick={() => { setEditingTemplate(null); setTemplateForm({ slug: '', name: '', subject: '', content: '', vars: '' }); setIsTemplateModalOpen(true); }} className="bg-slate-900 text-white rounded-xl">
              <Plus size={16} className="mr-2" /> 新增模板
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(tpl => (
              <Card key={tpl.id} className="border-slate-200 hover:border-blue-300 transition-colors group">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{tpl.name}</h4>
                        <code className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{tpl.slug}</code>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="sm" onClick={() => { setEditingTemplate(tpl); setTemplateForm({ slug: tpl.slug, name: tpl.name, subject: tpl.subject, content: tpl.content, vars: tpl.vars || '' }); setIsTemplateModalOpen(true); }} className="h-8 w-8 p-0"><Edit2 size={14} /></Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteTemplate(tpl.id)} className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50"><Trash2 size={14} /></Button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                    主题：{tpl.subject}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* --- Success Dialog --- */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="max-w-sm text-center py-10">
          <div className="flex justify-center mb-4"><div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center"><Check className="text-emerald-600 w-8 h-8" /></div></div>
          <DialogHeader><DialogTitle className="text-center text-xl">保存成功</DialogTitle><DialogDescription className="text-center">邮件服务配置已更新，即刻生效。</DialogDescription></DialogHeader>
          <div className="mt-6"><Button onClick={() => setShowSuccess(false)} className="w-full bg-slate-900 text-white h-11 rounded-xl">知道了</Button></div>
        </DialogContent>
      </Dialog>

      {/* --- Template Editor Modal --- */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? '编辑邮件模板' : '新建邮件模板'}</DialogTitle>
            <DialogDescription>使用 HTML 编写邮件内容，支持使用双大括号嵌入变量，如 `{"{{code}}"}`。</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">模板标识 (Slug)</label>
                <Input value={templateForm.slug} onChange={e => setTemplateForm({...templateForm, slug: e.target.value})} placeholder="例如：register_code" disabled={!!editingTemplate} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">模板名称</label>
                <Input value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} placeholder="例如：注册验证码通知" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">邮件主题 (Subject)</label>
              <Input value={templateForm.subject} onChange={e => setTemplateForm({...templateForm, subject: e.target.value})} placeholder="输入邮件标题" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">HTML 内容 (Content)</label>
              <textarea 
                className="w-full min-h-[300px] p-4 font-mono text-xs bg-slate-900 text-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                value={templateForm.content} 
                onChange={e => setTemplateForm({...templateForm, content: e.target.value})}
                placeholder="<html>...</html>"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">可用变量说明 (JSON Format)</label>
              <Input value={templateForm.vars} onChange={e => setTemplateForm({...templateForm, vars: e.target.value})} placeholder='{"code": "验证码"}' />
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-white pt-4 border-t">
            <Button variant="outline" onClick={() => setIsTemplateModalOpen(false)}>取消</Button>
            <Button onClick={handleSaveTemplate} loading={saving} className="bg-blue-600 text-white px-8">保存模板</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

