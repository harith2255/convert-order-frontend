import React, { useState } from "react";
import { X, CheckCircle, Gift } from "lucide-react";
import { Button } from "../Button";
import { Badge } from "../Badge";

interface SchemeOption {
  minQty: number;
  freeQty: number;
  percent: number;
}

interface SchemeSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (scheme: SchemeOption) => void;

  product: {
    sapCode: string;
    name: string;
    orderedQty: number;
  };

  schemes: SchemeOption[];
}

export function SchemeSelectionModal({
  open,
  onClose,
  onApply,
  product,
  schemes
}: SchemeSelectionModalProps) {
  const [selected, setSelected] = useState<SchemeOption | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-xl animate-in fade-in zoom-in-95">

        {/* HEADER */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-yellow-600" />
            <h2 className="text-lg font-semibold">Apply Scheme</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PRODUCT INFO */}
        <div className="p-4 bg-yellow-50 border-b">
          <p className="text-sm text-neutral-600">Product</p>
          <p className="font-semibold">{product.name}</p>
          <div className="flex gap-2 mt-2">
            <Badge variant="neutral">SAP: {product.sapCode}</Badge>
            <Badge variant="warning">
              Ordered Qty: {product.orderedQty}
            </Badge>
          </div>
        </div>

        {/* SCHEME OPTIONS */}
        <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
          {schemes.map((scheme, idx) => {
            const qualifies = product.orderedQty >= scheme.minQty;

            return (
              <label
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition
                  ${
                    selected === scheme
                      ? "border-yellow-500 bg-yellow-50"
                      : "border-neutral-200 hover:border-yellow-400"
                  }
                `}
              >
                <input
                  type="radio"
                  name="scheme"
                  className="mt-1"
                  checked={selected === scheme}
                  onChange={() => setSelected(scheme)}
                />

                <div className="flex-1">
                  <p className="font-medium">
                    Buy {scheme.minQty} → Get {scheme.freeQty} Free
                  </p>
                  <p className="text-sm text-neutral-600">
                    Scheme Value: {scheme.percent}%
                  </p>

                  {!qualifies && (
                    <p className="text-xs text-red-600 mt-1">
                      Increase quantity by {scheme.minQty - product.orderedQty} to qualify
                    </p>
                  )}
                </div>

                {qualifies && (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-1" />
                )}
              </label>
            );
          })}
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-3 p-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant="warning"
            disabled={!selected}
            onClick={() => selected && onApply(selected)}
          >
            Apply Scheme
          </Button>
        </div>
      </div>
    </div>
  );
}
