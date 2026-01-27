import React from "react";
import { PortalModal } from "../PortalModal";
import { Button } from "../Button";
import { Alert, AlertDescription } from "../ui/alert";
import { Gift } from "lucide-react";

interface SchemeSuggestion {
  rowIndex: number;
  itemDesc: string;
  productCode: string;
  currentQty: number;
  suggestedQty: number;
  freeQty: number;
  minQty: number;
}

interface SchemeOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: SchemeSuggestion[];
  onApply: (suggestion: SchemeSuggestion) => void;
  onSkip: () => void;
  onDone: () => void;
}

export function SchemeOpportunityModal({
  isOpen,
  onClose,
  suggestions,
  onApply,
  onSkip,
  onDone
}: SchemeOpportunityModalProps) {
  return (
    <PortalModal
      isOpen={isOpen}
      onClose={onClose}
      title="🎁 Scheme Opportunities Detected!"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onSkip}>
            Skip & Convert
          </Button>
          <Button variant="primary" onClick={onDone}>
            Done & Convert
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert variant="info">
          <AlertDescription>
            We found products where increasing the quantity slightly will unlock free goods.
          </AlertDescription>
        </Alert>

        {/* Scrollable List Container */}
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
          {suggestions.map((s, idx) => (
            <div
              key={idx}
              className="border p-3 rounded bg-amber-50 border-amber-200"
            >
              <div className="font-medium text-sm text-gray-800">
                {s.itemDesc}
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Code: {s.productCode}
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="text-sm">
                  Current: <strong>{s.currentQty}</strong>
                  <span className="mx-2 text-gray-400">→</span>
                  Target: <strong className="text-green-700">{s.suggestedQty}</strong>
                </div>
                <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Get {s.freeQty} Free
                </div>
              </div>

              <Button
                size="sm"
                className="w-full mt-3 bg-blue-500 text-white border border-blue-200"
                onClick={() => onApply(s)}
              >
                Upgrade to {s.suggestedQty} (+{s.freeQty} FREE)
              </Button>
            </div>
          ))}
        </div>
      </div>
    </PortalModal>
  );
}
