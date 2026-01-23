import React, { useState, useEffect } from "react";
import { X, CheckCircle, Gift, Package } from "lucide-react";
import { toast } from "sonner";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* 
        FIXED HEIGHT CONTAINER 
        h-[800px] ensures it doesn't grow indefinitely. 
        flex-col allows the list to scroll while header/footer stay put.
      */}
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col h-[85vh] max-h-[800px] animate-in fade-in zoom-in-95 overflow-hidden">

        {/* --- HEADER (Fixed) --- */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Available Schemes</h2>
            <p className="text-sm text-gray-500">Select a scheme to apply benefits</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* --- PRODUCT CONTEXT & INPUTS (Fixed) --- */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex-shrink-0 space-y-4">
          {/* Product Header */}
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-gray-800 text-lg">{product.name}</h3>
              <div className="flex gap-2 text-sm text-gray-500 mt-1">
                <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-medium text-gray-700">Code: {product.sapCode}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Current Order</p>
              <p className="text-2xl font-bold text-blue-600">{totalQty}</p>
            </div>
          </div>

          {/* Calculator Inputs */}
          <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Box Qty
              </label>
              <Input
                type="number"
                min="0"
                value={boxQty || ''}
                onChange={(e) => setBoxQty(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Pack Size
              </label>
              <Input
                type="number"
                min="1"
                value={pack || ''}
                onChange={(e) => setPack(Number(e.target.value) || 1)}
                placeholder="1"
                className="w-full font-medium"
              />
            </div>
          </div>
        </div>

        {/* --- SCROLLABLE LIST AREA --- */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 space-y-4">
          
          {schemes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Package className="w-12 h-12 mb-2 opacity-20" />
              <p>No schemes available for this product</p>
            </div>
          )}

          {schemes.map((scheme, idx) => {
            const qualifies = totalQty >= scheme.minQty;
            const scaledFree = calculateScaledFree(scheme, totalQty);
            const nextTierQty = scheme.minQty; // Simple view: target is minQty
            
            // Progress Calculation
            // We cap progress at 100% for the bar, but logic handles overflow
            const progress = Math.min((totalQty / scheme.minQty) * 100, 100);
            const isSelected = selected === scheme;

            return (
              <div 
                key={idx}
                onClick={() => qualifies && setSelected(scheme)}
                className={`
                  relative group transition-all duration-200 ease-in-out
                  bg-white rounded-xl border-2 overflow-hidden
                  ${isSelected ? 'border-blue-600 shadow-lg ring-1 ring-blue-100' : 'border-gray-100 hover:border-blue-300 shadow-sm hover:shadow-md'}
                  ${!qualifies ? 'opacity-90 grayscale-[0.3]' : 'cursor-pointer'}
                `}
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg">
                        Buy {scheme.minQty} <span className="text-gray-400 mx-1">→</span> Get {scheme.freeQty} Free
                      </h4>
                      <p className="text-sm text-gray-500">Scheme Value: <span className="font-medium text-green-600">{scheme.percent}%</span></p>
                    </div>
                    
                    <div className="text-right">
                       {qualifies ? (
                         <div className="flex flex-col items-end">
                            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full mb-1">QUALIFIED</span>
                            {isSelected && <CheckCircle className="w-5 h-5 text-blue-600" />}
                         </div>
                       ) : (
                         <span className="text-sm font-medium text-gray-400">Get Free</span>
                       )}
                    </div>
                  </div>

                  {/* Progress Bar Section */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1 font-medium">
                      <span className={qualifies ? 'text-blue-700' : 'text-gray-600'}>
                        Current: {totalQty}
                      </span>
                      <span className="text-gray-900">
                        Target: {scheme.minQty}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${qualifies ? 'bg-blue-600' : 'bg-gray-400'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Action / Benefit Section */}
                  {qualifies ? (
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 flex justify-between items-center">
                       <div>
                          <p className="text-blue-900 font-semibold text-sm">Scheme Applied!</p>
                          <p className="text-blue-700 text-xs">You get {scaledFree} free units</p>
                       </div>
                       <Button 
                          size="sm" 
                          variant={isSelected ? "primary" : "secondary"}
                          onClick={(e) => { e.stopPropagation(); setSelected(scheme); }}
                          className={isSelected ? "bg-blue-600 hover:bg-blue-700" : ""}
                       >
                          {isSelected ? "Selected" : "Select"}
                       </Button>
                    </div>
                  ) : (
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors shadow-sm active:scale-[0.98]"
                      onClick={(e) => {
                         // Auto-fill logic could go here if we wanted to support "Click to Upgrade"
                         // primarily visual for now per user request
                         e.stopPropagation();
                         toast.info(`Add ${scheme.minQty - totalQty} more to qualify!`);
                      }}
                    >
                      Upgrade to {scheme.minQty} (+ FREE)
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* --- FOOTER (Fixed) --- */}
        <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 flex-shrink-0">
          <Button variant="ghost" onClick={onClose} className="text-gray-600 hover:bg-gray-100">
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!selected || totalQty < (selected?.minQty || 0)}
            onClick={handleApply}
            className="px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
          >
            Apply Selected Scheme
          </Button>
        </div>

      </div>
    </div>
  );
}
