/**
 * 系统钩子管理器 (Plugin Hook System)
 * 允许插件订阅系统关键生命周期事件并干预结果
 */
export type SystemHookType = 'pricing:calculate' | 'member:after_register' | 'order:before_create' | 'order:pricing';

export interface HookContext {
  db: any;
  tenantId: number;
  [key: string]: any;
}

export type HookHandler = (context: HookContext, data: any) => Promise<any>;

class HookManager {
  private handlers: Map<SystemHookType, HookHandler[]> = new Map();

  /**
   * 插件订阅钩子
   */
  public on(type: SystemHookType, handler: HookHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
    console.log(`🪝 [Hook] 插件已订阅事件: ${type}`);
  }

  /**
   * 系统触发钩子 (流水线模式: 每个处理器都能修改数据并传递给下一个)
   */
  public async emit(type: SystemHookType, context: HookContext, data: any): Promise<any> {
    const handlers = this.handlers.get(type) || [];
    let currentData = data;

    for (const handler of handlers) {
      currentData = await handler(context, currentData);
    }

    return currentData;
  }
  /**
   * 清理所有钩子 (主要用于测试环境)
   */
  public clear() {
    this.handlers.clear();
    console.log('🧹 [Hook] 所有钩子已清空');
  }
}

export const hookManager = new HookManager();
