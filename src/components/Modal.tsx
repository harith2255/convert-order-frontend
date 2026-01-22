import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function CustomModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-3xl",
    xl: "max-w-6xl",
  };

  return (
    <>
      {/* BACKDROP */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* MODAL CONTAINER */}
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center px-3 py-4 sm:p-6 overflow-y-auto">
        {/* MODAL */}
        <div
          className={`
            relative bg-white rounded-2xl shadow-2xl w-full
            ${sizes[size]}
            max-h-[95dvh] flex flex-col
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER (STICKY) */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b bg-white">
            <h3 className="text-base sm:text-lg font-bold text-neutral-900">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-neutral-100 text-neutral-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* BODY (SCROLLABLE) */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {children}
          </div>

          {/* FOOTER (STICKY) */}
          {footer && (
            <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-3 px-5 py-4 border-t bg-white">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export { CustomModal as Modal };
