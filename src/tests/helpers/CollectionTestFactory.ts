import { ModelField } from '../../lib/model-engine';
import { registry } from '../../lib/permission-registry';

/**
 * CollectionTestFactory
 * 旨在实现测试逻辑与数据模型的彻底解耦，支持 Schema 驱动的参数化测试
 */
export class CollectionTestFactory {
  constructor(
    private app: any,
    private env: any,
    private authCookie: string = ''
  ) {}

  /**
   * 生成合法数据载荷
   */
  generateValidPayload(fields: ModelField[]): Record<string, any> {
    const payload: Record<string, any> = {};
    for (const field of fields) {
      payload[field.name] = this.getValueForType(field, 'valid');
    }
    return payload;
  }

  /**
   * 生成针对特定字段的非法载荷 (用于压力测试与边界校验)
   */
  generateInvalidPayload(fields: ModelField[], targetFieldName: string, errorType: 'required' | 'type'): Record<string, any> {
    const payload = this.generateValidPayload(fields);
    const targetField = fields.find(f => f.name === targetFieldName);
    
    if (!targetField) throw new Error(`Field ${targetFieldName} not found in model`);

    if (errorType === 'required') {
      delete payload[targetFieldName];
    } else if (errorType === 'type') {
      payload[targetFieldName] = this.getValueForType(targetField, 'invalid');
    }
    
    return payload;
  }

  /**
   * [选项 B] 关联字段自愈逻辑 (懒加载模式)
   * 如果检测到关联字段，自动向目标集合注入 dummy 数据
   */
  async setupRelationDependency(field: ModelField): Promise<number> {
    if (field.type !== 'relation' || !field.relationConfig) return 0;
    
    const targetSlug = field.relationConfig.collectionSlug;
    
    // 1. 验证目标集合是否存在 (物理检查)
    const collRes = await this.app.fetch(new Request(`http://localhost/api/v1/entities/${targetSlug}`), this.env);
    if (collRes.status === 404) {
      throw new Error(`测试中断：关联的目标集合 [${targetSlug}] 尚未定义，请先初始化该集合。`);
    }

    // 2. 检查是否有存备数据，没有则注入一条 dummy
    const dataRes = await collRes.json();
    if (dataRes.data && dataRes.data.length > 0) {
      return dataRes.data[0].id;
    }

    // 3. 注入 Dummy 记录
    const dummyPayload = { name: `Dummy for ${field.name}`, title: `Dummy for ${field.name}` };
    const createRes = await this.app.fetch(new Request(`http://localhost/api/v1/entities/${targetSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.authCookie },
      body: JSON.stringify(dummyPayload)
    }), this.env);

    if (!createRes.ok) {
        throw new Error(`无法自动为关联字段 [${field.label}] 注入测试数据，请确保目标集合 [${targetSlug}] 已有存量数据或模型结构兼容。`);
    }

    const newRecord = await createRes.json();
    return newRecord.id;
  }

  async create(slug: string, payload: any) {
    return await this.app.fetch(new Request(`http://localhost/api/v1/entities/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.authCookie },
      body: JSON.stringify(payload)
    }), this.env);
  }

  async list(slug: string) {
    return await this.app.fetch(new Request(`http://localhost/api/v1/entities/${slug}`, {
      headers: { 'Cookie': this.authCookie }
    }), this.env);
  }

  async batchSave(slug: string, payload: any[]) {
    return await this.app.fetch(new Request(`http://localhost/api/v1/entities/${slug}/batch-save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.authCookie },
      body: JSON.stringify(payload)
    }), this.env);
  }

  async update(slug: string, id: number, payload: any) {
    return await this.app.fetch(new Request(`http://localhost/api/v1/entities/${slug}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': this.authCookie },
      body: JSON.stringify(payload)
    }), this.env);
  }

  async delete(slug: string, id: number, cascade: boolean = false) {
    const url = `http://localhost/api/v1/entities/${slug}/${id}${cascade ? '?cascade=true' : ''}`;
    return await this.app.fetch(new Request(url, {
      method: 'DELETE',
      headers: { 'Cookie': this.authCookie }
    }), this.env);
  }

  private getValueForType(field: ModelField, mode: 'valid' | 'invalid'): any {
    if (mode === 'valid') {
      const getSingleValue = () => {
        switch (field.type) {
          case 'text': return `AutoText_${Math.random().toString(36).slice(2, 7)}`;
          case 'number': return Math.floor(Math.random() * 1000);
          case 'richtext': return `<div class="content"><h2>V2.0 Test</h2><p>Timestamp: ${Date.now()}</p></div>`;
          case 'json': return { "v": "2.0" };
          case 'image': return 1;
          case 'relation': return 1; 
          default: return 'unsupported_type';
        }
      };
      return field.multiple ? [getSingleValue(), getSingleValue()] : getSingleValue();
    } else {
      switch (field.type) {
        case 'number': return 'not_a_number';
        case 'json': return '{ invalid }';
        default: return null;
      }
    }
  }

  static async setupPermissions(db: any, slug: string, registryInstance?: any, actions: string[] = ['view', 'edit', 'delete']) {
    const reg = registryInstance || registry;
    for (const action of actions) {
      const p = { 
        slug: `collection:${slug}:${action}`, 
        name: `${action}${slug}`, 
        permCategory: 'Collection' 
      };
      
      // 识别 db 类型并执行插入
      if (db.prepare) {
         await db.prepare("INSERT INTO permissions (slug, name, perm_category) VALUES (?, ?, ?)")
          .run(p.slug, p.name, p.permCategory);
      } else {
         // Drizzle 方式
         const { permissions } = await import('../../db/schema');
         await db.insert(permissions).values(p).onConflictDoNothing();
      }
      reg.register(p);
    }
  }
}
