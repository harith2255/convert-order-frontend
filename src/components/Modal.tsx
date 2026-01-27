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
}

export function CustomModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  className = "",
}: ModalProps & { className?: string }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl", // Reduced from 3xl to 2xl to look less "full screen"
    xl: "max-w-4xl", // Reduced from 6xl
    full: "max-w-full m-4",
  };

  // Style for the backdrop
  const backdropStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    backdropFilter: "blur(4px)",
    zIndex: 9998,
  };

  // Style for the scrollable wrapper
  const wrapperStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    overflowY: "auto", // Enables page-level scrolling for the modal
    display: "flex",
    padding: "1rem", // minimal padding
  };

  // Style for the modal box itself
  const modalStyle: React.CSSProperties = {
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    width: "100%",
    // Apply max-width based on prop (handling specific pixel values for native feel)
    maxWidth: size === 'sm' ? '400px' : size === 'lg' ? '600px' : size === 'xl' ? '900px' : '500px', 
    margin: "auto", // Magic flex centering that acts as 'min-height safe'
    position: "relative",
    display: "flex",
    flexDirection: "column",
  };

  return createPortal(
    <>
      <div style={backdropStyle} onClick={onClose} />
      <div style={wrapperStyle}>
        <div 
          onClick={(e) => e.stopPropagation()} 
          style={modalStyle}
          className={className} 
        >
          {/* HEADER */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-neutral-100">
            <h3 className="text-lg font-bold text-neutral-900 leading-6">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* BODY */}
          <div className="p-6">
            {children}
          </div>

          {/* FOOTER */}
          {footer && (
            <div className="flex-shrink-0 bg-neutral-50 border-t border-neutral-100 px-6 py-4 rounded-b-xl">
              <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
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


export { CustomModal as Modal };

