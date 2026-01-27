import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "../Button";
import { Alert, AlertDescription } from "../ui/alert";
import { X } from "lucide-react";

interface SchemeSuggestion {
  rowIndex: number;
  itemDesc: string;
  productCode: string;
  currentQty: number;
  suggestedQty: number;
  freeQty: number;
  minQty: number;
}

interface SchemePopupProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: SchemeSuggestion[];
  onApply: (suggestion: SchemeSuggestion) => void;
  onSkip: () => void;
  onDone: () => void;
}

export function SchemePopup({
  isOpen,
  onClose,
  suggestions,
  onApply,
  onSkip,
  onDone
}: SchemePopupProps) {
  
  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose} // Click outside to close
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()} // Prevent close on click inside
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
           <h3 className="text-lg font-bold text-gray-900">🎁 Scheme Opportunities</h3>
           <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
             <X className="w-5 h-5 text-gray-500" />
           </button>
        </div>

        {/* BODY (Scrollable) */}
        <div style={{ overflowY: 'auto', padding: '16px' }}>
          <Alert variant="info" className="mb-4">
            <AlertDescription>
              Increase quantities to unlock free goods!
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
             {suggestions.map((s, idx) => (
                <div key={idx} className="border p-3 rounded bg-amber-50 border-amber-200">
                    <div className="font-medium text-sm text-gray-800">{s.itemDesc}</div>
                    <div className="text-xs text-gray-500 mb-2">Code: {s.productCode}</div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="text-sm">
                          Current: <strong>{s.currentQty}</strong>
                          {" → "}
                          Target: <strong className="text-green-700">{s.suggestedQty}</strong>
                      </div>
                      <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Get {s.freeQty} Free
                      </div>
                    </div>

                    <Button 
                      size="sm" 
                      className="w-full mt-3 bg-blue-500 text-white"
                      onClick={() => onApply(s)}
                    >
                      Upgrade (+{s.freeQty} FREE)
                    </Button>
                </div>
             ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
           <Button variant="secondary" onClick={onSkip}>Skip & Convert</Button>
           <Button variant="primary" onClick={onDone}>Done & Convert</Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
