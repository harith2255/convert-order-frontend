import React, { useState, useEffect } from "react";
import { X, CheckCircle, Gift, Package } from "lucide-react";
import { Button } from "../Button";
import { Badge } from "../Badge";
import { Input } from "../Input";

interface SchemeOption {
  minQty: number;
  freeQty: number;
  percent: number;
}

interface SchemeSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (scheme: SchemeOption & { boxQty?: number; pack?: number; totalQty: number; calculatedFree: number }) => void;

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
  const [boxQty, setBoxQty] = useState<number>(0);
  const [pack, setPack] = useState<number>(product.orderedQty || 1);
  const [totalQty, setTotalQty] = useState<number>(product.orderedQty || 0);

  // Calculate total quantity from box and pack
  useEffect(() => {
    const calculated = boxQty * pack;
    setTotalQty(calculated || pack); // If no box qty, just use pack
  }, [boxQty, pack]);

  // Calculate scaled free quantity
  const calculateScaledFree = (scheme: SchemeOption, qty: number): number => {
    if (!scheme || qty < scheme.minQty) return 0;
    const multiplier = Math.floor(qty / scheme.minQty);
    return multiplier * scheme.freeQty;
  };

  const handleApply = () => {
    if (!selected) return;
    
    const calculatedFree = calculateScaledFree(selected, totalQty);
    
    onApply({
      ...selected,
      boxQty,
      pack,
      totalQty,
      calculatedFree
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">

        {/* HEADER */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
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
              Base Qty: {product.orderedQty}
            </Badge>
          </div>
        </div>

        {/* QUANTITY INPUTS */}
        <div className="p-4 bg-blue-50 border-b space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-900">Calculate Total Quantity</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Box Quantity
              </label>
              <Input
                type="number"
                min="0"
                value={boxQty || ''}
                onChange={(e) => setBoxQty(Number(e.target.value) || 0)}
                placeholder="Number of boxes"
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Pack Size (per box)
              </label>
              <Input
                type="number"
                min="1"
                value={pack || ''}
                onChange={(e) => setPack(Number(e.target.value) || 1)}
                placeholder="Items per box"
                className="w-full"
              />
            </div>
          </div>

          {/* Total Calculation */}
          <div className="pt-2 border-t border-blue-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-blue-900">Total Quantity:</span>
              <span className="text-xl font-bold text-blue-900">
                {boxQty > 0 ? `${boxQty} × ${pack} = ` : ''}{totalQty}
              </span>
            </div>
          </div>
        </div>

        {/* SCHEME OPTIONS */}
        <div className="p-4 space-y-3">
          <p className="text-sm font-semibold text-neutral-700 mb-2">Available Schemes</p>
          {schemes.map((scheme, idx) => {
            const qualifies = totalQty >= scheme.minQty;
            const scaledFree = calculateScaledFree(scheme, totalQty);
            const multiplier = Math.floor(totalQty / scheme.minQty);

            return (
              <label
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition
                  ${
                    selected === scheme
                      ? "border-yellow-500 bg-yellow-50"
                      : "border-neutral-200 hover:border-yellow-400"
                  }
                  ${!qualifies ? 'opacity-60' : ''}
                `}
              >
                <input
                  type="radio"
                  name="scheme"
                  className="mt-1"
                  checked={selected === scheme}
                  onChange={() => setSelected(scheme)}
                  disabled={!qualifies}
                />

                <div className="flex-1">
                  <p className="font-medium">
                    Buy {scheme.minQty} → Get {scheme.freeQty} Free
                  </p>
                  <p className="text-sm text-neutral-600">
                    Scheme Value: {scheme.percent}%
                  </p>

                  {qualifies && scaledFree > 0 && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm font-semibold text-green-800">
                        🎁 Your Benefit: {multiplier} × {scheme.freeQty} = <span className="text-lg">{scaledFree} FREE</span>
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        (Based on {totalQty} total quantity)
                      </p>
                    </div>
                  )}

                  {!qualifies && (
                    <p className="text-xs text-red-600 mt-1">
                      Need {scheme.minQty - totalQty} more to qualify
                    </p>
                  )}
                </div>

                {qualifies && (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                )}
              </label>
            );
          })}
          
          {schemes.length === 0 && (
            <p className="text-center text-neutral-500 py-4">
              No schemes available for this product
            </p>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-3 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant="warning"
            disabled={!selected || totalQty < (selected?.minQty || 0)}
            onClick={handleApply}
          >
            Apply Scheme
          </Button>
        </div>
      </div>
    </div>
  );
}
