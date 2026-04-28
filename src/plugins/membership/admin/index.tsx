import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../../components/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/Tabs';
import { RefreshCcw, Plus, Trash2, Languages, Save } from 'lucide-react';
import { useToast } from '../../../components/ui/Toaster';

/**
 * MembershipManagement: 会员插件管理 UI 容器 (Step 8 - 多语言增强版)
 */
export const MembershipManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<any[]>([]);
  const [langs, setLangs] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [tiersRes, langsRes] = await Promise.all([
        fetch('/api/v1/plugins/proxy/membership/tiers'),
        fetch('/api/v1/settings/languages')
      ]);
      
      const [tData, lData] = await Promise.all([tiersRes.json(), langsRes.json()]);
      setTiers(tData.data || []);
      setLangs(lData.data || []);
    } catch (e) {
      toast({ title: "数据加载失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <RefreshCcw className="animate-spin text-blue-500 mb-2" />
      <p className="text-sm text-slate-400 font-mono">SYNCING I18N DATA...</p>
    </div>
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">会员等级体系</h1>
          <p className="text-slate-500 mt-1">管理多语种下的会员等级名、折扣率与调价引擎参数。</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 rounded-xl px-6">
          <Plus size={16} className="mr-2" />
          创建新等级
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* 左侧：等级列表 */}
        <Card className="lg:col-span-2 border-slate-200/60 shadow-xl shadow-slate-100/50 rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCcw size={18} className="text-blue-500" />
              实时资产分布
            </CardTitle>
            <CardDescription>当前系统已激活 {tiers.length} 个会员等级，均已注入 Pricing Hook。</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/30">
                <TableRow>
                  <TableHead className="px-6">基准名称</TableHead>
                  <TableHead>折扣率</TableHead>
                  <TableHead>多语言预览</TableHead>
                  <TableHead className="text-right px-6">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map(tier => (
                  <TableRow key={tier.id} className="hover:bg-blue-50/30 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="font-bold text-slate-800">{tier.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">TIER_ID: {tier.id}</div>
                    </TableCell>
                    <TableCell>
                       <Badge className="bg-orange-50 text-orange-700 border-orange-100 px-3 py-1 rounded-full">
                         {tier.discountRate}% OFF
                       </Badge>
                    </TableCell>
                    <TableCell>
                       <div className="flex gap-1">
                         {langs.map(l => (
                           <Badge key={l.code} variant="outline" className="text-[10px] py-0 h-5">
                             {l.code}
                           </Badge>
                         ))}
                       </div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                       <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">编辑</Button>
                       <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-500 hover:bg-red-50">删除</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 右侧：动态 I18n 编辑面板 (演示用) */}
        <Card className="border-slate-200/60 shadow-xl shadow-slate-100/50 rounded-2xl h-fit border-l-4 border-l-blue-500">
           <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Languages size={18} className="text-blue-500" />
                多语言动态录入
              </CardTitle>
              <CardDescription>
                检测到系统已开启 {langs.length} 种语言。请为各语种定义等级展示名。
              </CardDescription>
           </CardHeader>
           <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-slate-600 font-bold">基准名称 (Internal Title)</Label>
                <Input placeholder="例如: Gold Member" className="rounded-xl border-slate-200" />
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <Label className="text-blue-600 font-bold flex items-center gap-2">
                  <Save size={14} />
                  翻译矩阵 (Transaltion Matrix)
                </Label>
                
                <Tabs defaultValue={langs[0]?.code} className="w-full">
                  <TabsList className="bg-slate-100/50 p-1 rounded-xl w-full">
                    {langs.map(l => (
                      <TabsTrigger key={l.code} value={l.code} className="rounded-lg text-xs flex-1">
                        {l.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {langs.map(l => (
                    <TabsContent key={l.code} value={l.code} className="pt-4 space-y-3">
                       <div className="space-y-1.5">
                         <Label className="text-xs text-slate-500">在 {l.name} 下的展示名称</Label>
                         <Input placeholder={`${l.name} Display Name...`} className="rounded-xl bg-slate-50/50 border-slate-100" />
                       </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-6 font-bold shadow-lg shadow-slate-200">
                 同步至全域语种库
              </Button>
           </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MembershipManagement;
