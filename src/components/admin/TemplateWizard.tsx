import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { 
  Globe, 
  Package, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  Wand2,
  Box,
  Layers
} from 'lucide-react';

interface Module {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
}

interface IndustrySuite {
  id: string;
  name: string;
  description: string;
  modules: Module[];
}

interface TemplateWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onFinished?: () => void;
}

export const TemplateWizard: React.FC<TemplateWizardProps> = ({ isOpen, onClose, onFinished }) => {
  const [step, setStep] = useState(1);
  const [suites, setSuites] = useState<IndustrySuite[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSuites();
    }
  }, [isOpen]);

  const fetchSuites = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/system/templates');
      if (res.ok) {
        const data = await res.json();
        setSuites(data);
      }
    } catch (e) {
      console.error('Failed to fetch templates:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSuite = (suite: IndustrySuite) => {
    setSelectedSuiteId(suite.id);
    setSelectedModuleIds(new Set(suite.modules.map(m => m.id)));
    setStep(2);
  };

  const toggleModule = (moduleId: string, modules: Module[]) => {
    const nextIds = new Set(selectedModuleIds);
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return;

    if (nextIds.has(moduleId)) {
      // 取消勾选
      nextIds.delete(moduleId);
      // 同时取消所有依赖这个模块的模块
      const dependents = modules.filter(m => m.dependencies.includes(moduleId));
      dependents.forEach(d => nextIds.delete(d.id));
    } else {
      // 勾选
      nextIds.add(moduleId);
      // 同时勾选所有依赖
      const resolveDeps = (id: string) => {
        const m = modules.find(item => item.id === id);
        if (m?.dependencies) {
          m.dependencies.forEach(depId => {
            nextIds.add(depId);
            resolveDeps(depId);
          });
        }
      };
      resolveDeps(moduleId);
    }
    setSelectedModuleIds(nextIds);
  };

  const handleInit = async () => {
    setInitializing(true);
    try {
      const res = await fetch('/api/v1/system/init-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleIds: Array.from(selectedModuleIds) })
      });
      
      if (res.ok) {
        // 发布全局事件通知侧边栏刷新
        window.dispatchEvent(new CustomEvent('collections-updated'));
        onFinished?.();
        onClose();
      }
    } catch (e) {
      console.error('Initialization failed:', e);
    } finally {
      setInitializing(false);
    }
  };

  const currentSuite = suites.find(s => s.id === selectedSuiteId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex-1 overflow-y-auto p-8">
          <DialogHeader className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <Wand2 className="text-blue-500" size={24} />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white">初始化站点向导</DialogTitle>
                <DialogDescription className="text-slate-400 mt-1">
                  快速装配行业模板，三步开启您的业务管理系统
                </DialogDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-8 px-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    step === i ? 'bg-blue-600 text-white ring-4 ring-blue-900/40' : 
                    step > i ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {step > i ? <CheckCircle2 size={18} /> : i}
                  </div>
                  <span className={`text-sm font-medium ${step === i ? 'text-white' : 'text-slate-500'}`}>
                    {i === 1 ? '行业选择' : i === 2 ? '模块定制' : '预览确认'}
                  </span>
                  {i < 3 && <div className="w-12 h-px bg-slate-800" />}
                </div>
              ))}
            </div>
          </DialogHeader>

          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-blue-500" size={40} />
              <p className="text-slate-500 animate-pulse">正在加载预设套件...</p>
            </div>
          ) : (
            <>
              {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {suites.map(suite => (
                    <Card 
                      key={suite.id} 
                      className="group cursor-pointer hover:border-blue-600 transition-all border-slate-800 bg-slate-900/50 hover:bg-slate-900"
                      onClick={() => handleSelectSuite(suite)}
                    >
                      <CardHeader>
                        <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-blue-600/20 flex items-center justify-center mb-4 transition-colors">
                          {suite.id === 'b2b' ? <Globe className="text-blue-400" /> : 
                           suite.id === 'brand' ? <Box className="text-purple-400" /> : 
                           suite.id === 'blog' ? <FileText className="text-green-400" /> :
                           <Layers className="text-orange-400" />}
                        </div>
                        <CardTitle className="text-white group-hover:text-blue-400 transition-colors">{suite.name}</CardTitle>
                        <CardDescription className="text-slate-500 line-clamp-2">{suite.description}</CardDescription>
                        <div className="mt-3 text-[10px] text-slate-600">
                          包含 {suite.modules.length} 个模块
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}

              {step === 2 && currentSuite && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Layers size={18} className="text-blue-400" />
                      定制模块列表
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {currentSuite.modules.map(mod => {
                        const isLocked = currentSuite.modules.some(m => 
                          selectedModuleIds.has(m.id) && m.dependencies.includes(mod.id)
                        );
                        return (
                          <div 
                            key={mod.id}
                            className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
                              selectedModuleIds.has(mod.id) ? 'bg-blue-600/5 border-blue-600/50' : 'bg-slate-800/20 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <Checkbox 
                              checked={selectedModuleIds.has(mod.id)} 
                              onCheckedChange={() => !isLocked && toggleModule(mod.id, currentSuite.modules)}
                              disabled={isLocked}
                              className={isLocked ? 'opacity-50' : ''}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">{mod.name}</span>
                                {isLocked && (
                                  <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded leading-none border border-slate-700">
                                    被前置模块锁定
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-1">{mod.description}</p>
                              {mod.dependencies.length > 0 && (
                                <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-600">
                                  <span>依赖于:</span>
                                  {mod.dependencies.map(depId => (
                                    <span key={depId} className="underline">{currentSuite.modules.find(m => m.id === depId)?.name || depId}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && currentSuite && (
                <div className="space-y-8 text-center py-8 animate-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-600/30">
                    <CheckCircle2 size={40} className="text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">配置就绪！</h3>
                    <p className="text-slate-400">
                      系统将根据您的勾选生成 {selectedModuleIds.size} 个模块。
                      <br />
                      初始化过程将自动创建数据模型、管理菜单、并注入预置的公有 API 和通知策略。
                    </p>
                  </div>
                  
                  <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-xl p-4 text-left">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-3">生成清单预览</p>
                    <div className="space-y-2">
                       {Array.from(selectedModuleIds).map(id => {
                         const m = currentSuite.modules.find(item => item.id === id);
                         return (
                           <div key={id} className="flex items-center gap-2 text-sm text-slate-300">
                             <div className="w-1 h-1 bg-blue-500 rounded-full" />
                             {m?.name || id}
                           </div>
                         );
                       })}
                    </div>
                  </div>

                  <div className="max-w-md mx-auto bg-blue-950/50 border border-blue-900/50 rounded-xl p-3 text-left">
                    <p className="text-[11px] text-blue-400">
                      💡 询盘/留言模块已预配通知钩子和公有 API 提交策略。初始化完成后若需调整，请前往「业务集合管理」&gt;「配置」进行修改。
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="p-6 bg-slate-900/50 border-t border-slate-800 gap-3">
          {step > 1 && !initializing && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="border-slate-800 text-slate-400 hover:text-white">
              <ArrowLeft size={16} className="mr-2" />
              上一步
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose} disabled={initializing} className="border-slate-800 text-slate-500">
            取消
          </Button>
          {step < 3 ? (
            <Button 
              disabled={step === 1 && !selectedSuiteId} 
              onClick={() => setStep(step + 1)}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
            >
              继续
              <ArrowRight size={16} className="ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleInit}
              disabled={initializing}
              className="bg-green-600 hover:bg-green-700 text-white min-w-[140px]"
            >
              {initializing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在自动装配...
                </>
              ) : (
                '立刻生成站点'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
