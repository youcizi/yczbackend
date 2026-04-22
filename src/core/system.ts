/**
 * 基础插件抽象类
 */
export abstract class BasePlugin {
  abstract name: string;
  abstract init(): Promise<void>;
  abstract exec(params: any): Promise<any>;
}

/**
 * 事件钩子管理系统
 * 支持简单的链式反应和异步回调
 */
export class HookManager {
  private hooks: Map<string, Array<(data: any) => Promise<void>>> = new Map();

  /**
   * 注册钩子
   * @param eventName 事件名称
   * @param callback 回调函数
   */
  on(eventName: string, callback: (data: any) => Promise<void>) {
    if (!this.hooks.has(eventName)) {
      this.hooks.set(eventName, []);
    }
    this.hooks.get(eventName)?.push(callback);
    console.log(`✅ [Hook] 已注册钩子: ${eventName}`);
  }

  /**
   * 触发钩子
   * @param eventName 事件名称
   * @param data 传递的数据
   */
  async emit(eventName: string, data: any) {
    const callbacks = this.hooks.get(eventName);
    if (callbacks) {
      console.log(`🚀 [Hook] 正在触发 ${eventName}，共 ${callbacks.length} 个监听器`);
      // 串行执行各钩子，确保异步链条完整
      for (const cb of callbacks) {
        await cb(data);
      }
    }
  }
}
