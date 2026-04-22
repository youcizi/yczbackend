import { describe, it, expect } from 'vitest';
import { buildTree, flattenTreeWithPrefix } from '@/lib/tree-utils';

describe('Tree Utilities 单元测试', () => {
  const mockData = [
    { id: 1, name: '电子产品', parent_id: null },
    { id: 2, name: '手机', parent_id: 1 },
    { id: 3, name: '笔记本', parent_id: 1 },
    { id: 4, name: 'iPhone', parent_id: 2 },
    { id: 5, name: '服装', parent_id: null },
    { id: 6, name: '男装', parent_id: 5 },
  ];

  it('场景 1: 标准嵌套构建 - 验证层级深度与子节点关联', () => {
    const tree = buildTree(mockData);
    
    expect(tree.length).toBe(2); // 根节点：电子产品, 服装
    
    const electronics = tree.find(n => n.id === 1);
    expect(electronics.children.length).toBe(2); // 手机, 笔记本
    expect(electronics.level).toBe(0);

    const phone = electronics.children.find(n => n.id === 2);
    expect(phone.children.length).toBe(1); // iPhone
    expect(phone.level).toBe(1);

    const iphone = phone.children[0];
    expect(iphone.name).toBe('iPhone');
    expect(iphone.level).toBe(2);
  });

  it('场景 2: 自定义字段名映射 - 适配不同数据库字段', () => {
    const customData = [
      { uuid: 'A', label: 'Root', pid: null },
      { uuid: 'B', label: 'Child', pid: 'A' },
    ];
    
    const tree = buildTree(customData, {
      idKey: 'uuid',
      parentKey: 'pid',
      childrenKey: 'items'
    });

    expect(tree[0].uuid).toBe('A');
    expect(tree[0].items[0].uuid).toBe('B');
  });

  it('场景 3: 孤儿节点处理 - 父节点 ID 不存在时应视为根节点', () => {
    const orphanData = [
      { id: 1, name: 'Root', parent_id: null },
      { id: 2, name: 'Orphan', parent_id: 999 }, // 999 不存在
    ];
    
    const tree = buildTree(orphanData);
    expect(tree.length).toBe(2); 
    expect(tree.map(n => n.id)).toContain(2);
  });

  it('场景 4: 树形平铺化 - 验证 Select 下拉展示标签生成', () => {
    const tree = buildTree(mockData);
    const flattened = flattenTreeWithPrefix(tree, 'name');

    // 格式应为：电子产品 -> 　|- 手机 -> 　　|- iPhone
    const iphoneEntry = flattened.find(n => n.id === 4);
    expect(iphoneEntry.displayLabel).toContain('|- iPhone');
    expect(iphoneEntry.displayLabel).toContain('　　'); // 两个全角格缩进
  });

  it('性能基准 - 500 条数据构建耗时应极小', () => {
    const largeData = Array.from({ length: 500 }, (_, i) => ({
      id: i + 1,
      name: `Node ${i + 1}`,
      parent_id: i === 0 ? null : Math.floor(i / 10) || 1
    }));

    const start = performance.now();
    const tree = buildTree(largeData);
    const end = performance.now();

    expect(tree.length).toBeGreaterThan(0);
    expect(end - start).toBeLessThan(50); // 预期 < 50ms (实际通常 < 5ms)
  });
});
