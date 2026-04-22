import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  onValueChange?: (value: string) => void;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, onValueChange, onChange, ...props }, ref) => {
    const handleValueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onChange) onChange(e);
      if (onValueChange) onValueChange(e.target.value);
    };

    // 核心修复逻辑：预处理子节点，只提取有效项，过滤包装容器
    const getOptions = (nodes: React.ReactNode): React.ReactNode[] => {
      const options: React.ReactNode[] = [];
      React.Children.forEach(nodes, (child) => {
        if (!React.isValidElement(child)) return;
        
        // 如果是 Item 或原生的 option，直接添加
        if (child.type === SelectItem || child.type === 'option') {
          options.push(child);
        } 
        // 如果是 Content 容器，递归提取其内部的选项
        else if (child.type === SelectContent || (child.type as any).displayName === 'SelectContent') {
          options.push(...getOptions(child.props.children));
        }
        // 忽略 Trigger, Value 等非 option 类型
      });
      return options;
    };

    return (
      <div className="relative inline-block w-full">
        <select
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-[6px] text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
            className
          )}
          ref={ref}
          onChange={handleValueChange}
          {...props}
        >
          {getOptions(children)}
        </select>
        <ChevronDown className="absolute right-3 top-3 h-4 w-4 opacity-50 pointer-events-none" />
      </div>
    )
  }
)
Select.displayName = "Select"

// 这些组件仅作为 API 占位符使用，不参与实际 DOM 渲染
const SelectTrigger = ({ children }: any) => <>{children}</>
SelectTrigger.displayName = 'SelectTrigger'

const SelectValue = ({ placeholder }: any) => <>{placeholder}</>
SelectValue.displayName = 'SelectValue'

const SelectContent = ({ children }: any) => <>{children}</>
SelectContent.displayName = 'SelectContent'

const SelectItem = ({ children, value }: any) => (
  <option value={value}>{children}</option>
)
SelectItem.displayName = 'SelectItem'

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
