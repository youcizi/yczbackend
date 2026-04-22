import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { AdvancedJSONEditor } from '@/components/admin/AdvancedJSONEditor';

describe('AdvancedJSONEditor (v4.0) 嵌套级联审计', () => {

  it('1. 应能渲染复杂的嵌套结构 (Object-Array-Object)', () => {
    const complexData = {
      user: "antigravity",
      config: [
        { id: 1, active: true, children: ["sub1", "sub2"] }
      ]
    };
    const onChange = vi.fn();
    
    render(<AdvancedJSONEditor value={complexData} onChange={onChange} />);

    // 验证顶级 Key (匹配 displayValue)
    expect(screen.getByDisplayValue(/user/i)).toBeDefined();
    expect(screen.getByDisplayValue(/config/i)).toBeDefined();

    // 验证嵌套类型标识
    expect(screen.getAllByText(/Array/i)).toBeDefined();
    
    // 验证嵌套值
    expect(screen.getByDisplayValue('antigravity')).toBeDefined();
    expect(screen.getByDisplayValue('sub1')).toBeDefined();
  });

  it('2. 源码模式 (Source Mode) 支持直接粘贴与同步', async () => {
    const onChange = vi.fn();
    render(<AdvancedJSONEditor value={{}} onChange={onChange} />);

    // 切换到源码模式
    const sourceTab = screen.getByText(/源码模式/i);
    fireEvent.click(sourceTab);

    // 找到 textarea 并模拟输入
    const textarea = screen.getByPlaceholderText(/{"key": "value"}/i);
    const complexString = JSON.stringify({
      meta: { ver: "4.0" },
      tags: ["ai", "coding"]
    });
    
    fireEvent.change(textarea, { target: { value: complexString } });

    // 验证 onChange 被触发，且数据结构正确
    expect(onChange).toHaveBeenLastCalledWith({
      meta: { ver: "4.0" },
      tags: ["ai", "coding"]
    });
  });

  it('3. 源码模式下非法 JSON 应显示红框报错并拦截同步', async () => {
    const onChange = vi.fn();
    render(<AdvancedJSONEditor value={{}} onChange={onChange} />);
    
    fireEvent.click(screen.getByText(/源码模式/i));
    const textarea = screen.getByPlaceholderText(/{"key": "value"}/i);
    
    // 输入损坏的 JSON
    fireEvent.change(textarea, { target: { value: '{ "broken": ' } });

    // 验证显示了错误提示
    expect(screen.getByText(/JSON 格式错误/i)).toBeDefined();
    
    // 验证 onChange 没有因为损坏的 JSON 再次被调用
    // 初始可能因为设置空对象调用过一次，但最后的调用不应是损坏的数据
    if (onChange.mock.calls.length > 0) {
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[0]).not.toHaveProperty('broken');
    }
  });

  it('4. 可视化模式：递归添加属性、多维嵌套与键名 (Key) 重命名', async () => {
    const onChange = vi.fn();
    
    // 使用有状态的包装组件来模拟实际运行环境
    const Wrapper = () => {
      const [val, setVal] = React.useState<any>([]);
      return <AdvancedJSONEditor value={val} onChange={(newVal) => {
        setVal(newVal);
        onChange(newVal);
      }} />;
    };

    render(<Wrapper />);
    
    // 1. 在数组中添加一个元素
    const plusBtn = screen.getAllByRole('button').find(b => 
      b.querySelector('svg') && !b.textContent?.includes('模式') && !b.textContent?.includes('编辑')
    )!;
    fireEvent.click(plusBtn);
    
    // 预期 onChange 被调用，参数为 [""]
    expect(onChange).toHaveBeenCalledWith([""]);

    // 2. 模拟切换该元素类型为 Object
    const typeSelects = screen.getAllByRole('combobox');
    fireEvent.change(typeSelects[1], { target: { value: 'object' } });

    // 预期数组的第一个元素变成了对象 [{}]
    expect(onChange).toHaveBeenLastCalledWith([{}]);

    // 3. 在这个内层对象中添加一个属性
    const allPlusBtns = screen.getAllByRole('button').filter(b => 
       b.querySelector('svg') && !b.textContent?.includes('模式') && !b.textContent?.includes('编辑')
    );
    fireEvent.click(allPlusBtns[1]);

    // 预期结果：[{ "key_0": "" }]
    expect(onChange).toHaveBeenLastCalledWith([{ key_0: "" }]);
    
    // 4. 修改键名：将 key_0 修改为 user_id
    // 查找值为 key_0 的 input
    const keyInput = screen.getByDisplayValue('key_0');
    fireEvent.change(keyInput, { target: { value: 'user_id' } });
    fireEvent.blur(keyInput);

    // 预期结果：[{ "user_id": "" }]
    expect(onChange).toHaveBeenLastCalledWith([{ user_id: "" }]);
    
    // 验证 UI 展现了 user_id
    expect(screen.getByDisplayValue('user_id')).toBeDefined();
  });

  it('5. 架构安全性：所有交互按钮必须为 type="button"', () => {
    render(<AdvancedJSONEditor value={{ a: { b: 1 } }} onChange={() => {}} />);
    
    const allButtons = screen.getAllByRole('button');
    allButtons.forEach(btn => {
      // 排除 textarea 模式下的按钮（如果有）
      if (btn.closest('textarea')) return;
      expect(btn.getAttribute('type')).toBe('button');
    });
  });
});
