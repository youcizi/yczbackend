import { describe, it, expect } from 'vitest';
import { validateFieldIdentifier, validateEntityData } from '@/lib/model-engine';

describe('模型引擎：字段标识符白盒测试 (validateFieldIdentifier)', () => {
  const testCases = [
    // [输入, 是否合法, 备注]
    ['title', true, '标准纯字母'],
    ['user_name', true, '带下划线'],
    ['_internal', true, '下划线开头'],
    ['price123', true, '字母开头带数字'],
    ['123name', false, '数字开头（不合法）'],
    ['user-name', false, '带中横线（不合法）'],
    ['@id', false, '带特殊符号'],
    ['', false, '空字符串'],
    [' ', false, '空格'],
  ] as const;

  it.each(testCases)('输入 [%s] 应返回 valid: %s (%s)', (input, expected, note) => {
    const result = validateFieldIdentifier(input);
    expect(result.valid).toBe(expected);
  });
});

describe('模型引擎：数据完整性深度测试 (validateEntityData)', () => {
  const mockFields = [
    { name: 'title', type: 'text', label: '标题', required: true },
    { name: 'price', type: 'number', label: '价格', required: false },
    { name: 'config', type: 'json', label: '配置项', required: false }
  ] as const;

  it('漏填必填项应拦截', () => {
    const data = { price: 100 };
    const result = validateEntityData(data, mockFields as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('字段 [标题] 是必填项');
  });

  it('数字类型校验', () => {
    const data = { title: 'Test', price: 'not-a-number' };
    const result = validateEntityData(data, mockFields as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('字段 [价格] 中的值 [not-a-number] 必须是一个数字');
  });

  it('JSON 格式校验', () => {
    const data = { title: 'Test', config: '{ invalid json }' };
    const result = validateEntityData(data, mockFields as any);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('字段 [配置项] 包含非法的 JSON 字符串');
  });

  it('合法数据应通过', () => {
    const data = { title: 'Valid Name', price: 99.9, config: '{"key": "value"}' };
    const result = validateEntityData(data, mockFields as any);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});
