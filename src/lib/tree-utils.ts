/**
 * 通用树形结构构建工具
 */

export interface TreeOptions {
  idKey?: string;
  parentKey?: string;
  childrenKey?: string;
}

/**
 * 将扁平数组转换为嵌套树形结构
 * @param data 原始扁平数据数组
 * @param options 配置项 { idKey, parentKey, childrenKey }
 * @returns 嵌套的树形数组
 */
export function buildTree<T extends Record<string, any>>(
  data: T[],
  options: TreeOptions = {}
): (T & { children: any[]; level: number })[] {
  const {
    idKey = 'id',
    parentKey = 'parent_id',
    childrenKey = 'children'
  } = options;

  const tree: any[] = [];
  const map = new Map<string | number, any>();

  // 1. 建立 ID 映射表，并初始化扩展属性
  data.forEach((item) => {
    map.set(item[idKey], { ...item, [childrenKey]: [], level: 0 });
  });

  // 2. 核心构建循环 (O(n))
  data.forEach((item) => {
    const node = map.get(item[idKey]);
    const parentId = item[parentKey];

    // 如果有父节点，且父节点在 Map 中存在
    if (parentId !== null && parentId !== undefined && map.has(parentId)) {
      const parentNode = map.get(parentId);
      parentNode[childrenKey].push(node);
      
      // 这里的 level 逻辑需要后续通过一个简单的递归或拓扑层序遍历来精确计算，
      // 因为单次遍历无法保证父节点的 level 已确定。
    } else {
      // 根节点或“孤儿”节点（父节点 ID 找不到）
      tree.push(node);
    }
  });

  // 3. 递归计算 Level (可选，但为了前端展示更清晰)
  const setLevel = (nodes: any[], level: number) => {
    nodes.forEach(node => {
      node.level = level;
      if (node[childrenKey] && node[childrenKey].length > 0) {
        setLevel(node[childrenKey], level + 1);
      }
    });
  };
  setLevel(tree, 0);

  return tree;
}

/**
 * 树形结构平铺化函数 (带视觉缩进前缀)
 * 通常用于 Select 下拉列表的渲染展示
 */
export function flattenTreeWithPrefix<T extends Record<string, any>>(
  tree: any[],
  displayKey: string = 'name',
  prefix: string = '|- '
): (T & { displayLabel: string })[] {
  const result: any[] = [];

  const traverse = (nodes: any[]) => {
    nodes.forEach(node => {
      const indent = '　'.repeat(node.level); // 使用全角空格缩进
      result.push({
        ...node,
        displayLabel: node.level > 0 ? `${indent}${prefix}${node[displayKey]}` : node[displayKey]
      });
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    });
  };

  traverse(tree);
  return result;
}

/**
 * 获取指定节点及其所有后代的 ID 集合 (用于 UI 禁用逻辑)
 */
export function getAllDescendantIds(tree: any[], targetId: number | string): Set<number | string> {
  const ids = new Set<number | string>();
  
  const findAndCollect = (nodes: any[], active: boolean) => {
    nodes.forEach(node => {
      const isMatch = active || String(node.id) === String(targetId);
      if (isMatch) {
        ids.add(node.id);
      }
      if (node.children && node.children.length > 0) {
        findAndCollect(node.children, isMatch);
      }
    });
  };

  findAndCollect(tree, false);
  return ids;
}
