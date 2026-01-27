import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string; // Explicitly added
}

export function PortalModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  className = "",
}: ModalProps) {
  useEffect(() => {
    console.log(`🔥 PORTAL MODAL RENDERED. isOpen: ${isOpen}`);
    if (isOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-3xl",
    xl: "max-w-6xl",
    full: "max-w-[95vw] lg:max-w-[calc(100vw-18rem)]",
  };

  // 🔥 Use Portal to render modal at document.body level
  return createPortal(
    <>
      {/* BACKDROP */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* MODAL WRAPPER */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        {/* MODAL */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={`
            relative bg-white rounded-2xl shadow-2xl w-full pointer-events-auto
            ${sizes[size]}
            max-h-[85vh]
            flex flex-col
            ${className}
          `}
        >
          {/* HEADER */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b bg-white rounded-t-2xl">
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
          <div className="flex-1 overflow-y-auto overflow-x-auto px-5 py-4 min-h-0">
            {children}
          </div>

          {/* FOOTER */}
          {footer && (
            <div className="flex-shrink-0 bg-white border-t px-5 py-4 rounded-b-2xl">
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                {footer}
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
