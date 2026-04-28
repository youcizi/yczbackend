import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";
import { Button } from "./Button";
import { AlertTriangle, Info } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  isLoading?: boolean;
}

/**
 * 通用确认对话框
 * 用于替换原生的 window.confirm
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
  confirmText = "确定操作",
  cancelText = "取消",
  variant = "default",
  isLoading = false,
}) => {
  const handleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    onConfirm();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl shadow-2xl border-none p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-3 mb-2">
            {variant === "destructive" ? (
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-red-500" size={20} />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Info className="text-blue-500" size={20} />
              </div>
            )}
            <DialogTitle className="text-xl font-bold tracking-tight text-slate-800">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-500 leading-relaxed pt-1">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="p-6 bg-slate-50/50 flex flex-col-reverse sm:flex-row gap-2 mt-2">
          <Button
            variant="ghost"
            onClick={handleCancel}
            disabled={isLoading}
            className="sm:flex-1 rounded-xl text-slate-500 hover:bg-slate-100"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isLoading}
            className={variant === "destructive" ? "sm:flex-1 rounded-xl bg-red-600 hover:bg-red-700 shadow-lg shadow-red-100" : "sm:flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-200"}
          >
            {isLoading ? "正在处理..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
