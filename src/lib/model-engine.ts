/**
 * 动态模型引擎核心逻辑库 (无依赖纯函数)
 * 旨在实现零侵入白盒测试，支持在任何 JS 环境运行
 */

export interface FieldConfig {
  options?: Array<{ key: string; value: string }>;
  target_slug?: string;
  display_field?: string;
}

export interface ModelField {
  name: string;
  type: 'text' | 'textarea' | 'number' | 'richtext' | 'image' | 'media' | 'json' | 'relation' | 'multi_image' | 'multi_file' | 'radio' | 'select' | 'multi_select' | 'checkbox' | 'relation_single' | 'relation_multi';
  label: string;
  placeholder?: string;
  defaultValue?: any;
  required?: boolean;
  multiple?: boolean; 
  isListDisplay?: boolean;
  relationConfig?: {
    collectionSlug: string; 
    displayField: string;   
  };
  isMedia?: boolean; 
  jsonSchema?: any;   
}

export interface ModelMetadata {
  name: string;
  slug: string;
  fieldsJson: ModelField[];
}

/**
 * 1. 字段标识符校验 (Identifier Validation)
 * 规则：仅限字母数字下划线，且不能以数字开头，防止 JS/SQL 注入或解析异常
 */
export function validateFieldIdentifier(name: string): { valid: boolean; error?: string } {
  if (!name) return { valid: false, error: '字段名不能为空' };
  
  const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  if (!identifierRegex.test(name)) {
    return { 
      valid: false, 
      error: '字段标识符不合法：必须以字母或下划线开头，且仅包含字母、数字及下划线' 
    };
  }
  
  return { valid: true };
}

/**
 * 2. 模型定义完整性校验
 */
export function validateModelDefinition(def: ModelMetadata): { valid: boolean; error?: string } {
  if (!def.name || !def.slug) {
    return { valid: false, error: '模型名称和 Slug 不能为空' };
  }

  if (def.fieldsJson.length === 0) {
    return { valid: false, error: '模型必须至少包含一个字段定义' };
  }

  // 检查字段重名
  const fieldNames = new Set<string>();
  for (const field of def.fieldsJson) {
    const identCheck = validateFieldIdentifier(field.name);
    if (!identCheck.valid) return identCheck;

    if (fieldNames.has(field.name)) {
      return { valid: false, error: `字段 Key [${field.name}] 重复` };
    }
    fieldNames.add(field.name);
  }

  return { valid: true };
}

/**
 * 3. 实体数据合法性校验
 * @param data 待录入的实体数据
 * @param fields 模型定义的字段集
 */
export function validateEntityData(data: Record<string, any>, fields: ModelField[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of fields) {
    let value = data[field.name];

    // 必填项检查
    if (field.required && (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0))) {
      errors.push(`字段 [${field.label}] 是必填项`);
      continue;
    }

    // 类型与格式检查 (针对已填写的字段)
    if (value !== undefined && value !== null) {
      
      // 1. 处理多项 (Multiple) 逻辑封装
      const values = field.multiple ? (Array.isArray(value) ? value : [value]) : [value];

      for (const val of values) {
        if (field.type === 'number' && isNaN(Number(val))) {
          errors.push(`字段 [${field.label}] 中的值 [${val}] 必须是一个数字`);
        }
        
        if (field.type === 'json') {
          try {
            if (typeof val === 'string') {
              JSON.parse(val);
            } else if (typeof val !== 'object') {
              errors.push(`字段 [${field.label}] 必须是一个 JSON 对象或数组`);
            }
          } catch (e) {
            errors.push(`字段 [${field.label}] 包含非法的 JSON 字符串`);
          }
        }

        if (field.type === 'relation' || field.type === 'image' || field.type === 'media') {
          // 统一校验关联 ID 格式
          if (val !== null && val !== undefined && val !== '' && isNaN(Number(val)) && typeof val !== 'string') {
            errors.push(`字段 [${field.label}] 包含无效的 ID 引用`);
          }
        }
      }

      // 2. 针对多图/多选的整体判定
      if (field.multiple && !Array.isArray(value)) {
        // 如果声明了 multiple 但传入单值，在此版本标记为警告或自动包装 (此处仅校验)
      }
    }
  }

  return { 
    valid: errors.length === 0, 
    errors 
  };
}
