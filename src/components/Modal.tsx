import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
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
    if (isOpen) document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = "unset");
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-3xl",
    xl: "max-w-6xl",
    full: "max-w-screen-xl",
  };

  return (
    <>
      {/* BACKDROP (ONLY THIS CLOSES MODAL) */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* MODAL WRAPPER — NO onClick */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-2 sm:px-4 overflow-hidden">

        {/* MODAL */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={`
            relative bg-white rounded-2xl shadow-2xl w-full
            ${sizes[size]}
            max-h-[90dvh]
            flex flex-col
          `}
        >
          {/* HEADER */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b bg-white">
            <h3 className="text-base sm:text-lg font-bold text-neutral-900">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-neutral-100 text-neutral-500"
            >
              ✕
            </button>
          </div>

          {/* BODY (THIS SCROLLS) */}
          <div className="flex-1 overflow-auto px-5 py-4">
            {children}
          </div>

          {/* FOOTER */}
          {footer && (
            <div className="sticky bottom-0 z-10 bg-white border-t px-5 py-4">
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                {footer}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


export { CustomModal as Modal };
