import React, { useState, useEffect } from "react";
import { Modal } from "../Modal";
import { previewSchemeData, updateSchemeData, downloadSchemeFile } from "../../services/orderApi";
import { Download, Save, AlertCircle, CheckCircle } from "lucide-react";

interface ViewEditSchemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploadId: string;
  fileName?: string;
  onSave?: (updatedData: any[]) => void; // Callback after successful save
}

export function ViewEditSchemeModal({
  isOpen,
  onClose,
  uploadId,
  fileName,
  onSave
}: ViewEditSchemeModalProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;
  
  // 🔥 Store original scheme ratios for proportional recalculation
  // Format: { [index]: { baseOrderQty, baseFreeQty } }
  const [schemeRatios, setSchemeRatios] = useState<Record<number, { baseOrderQty: number; baseFreeQty: number }>>({});

  useEffect(() => {
    if (isOpen && uploadId) {
      fetchData();
    }
  }, [isOpen, uploadId, page]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await previewSchemeData(uploadId, page, limit);
      
      if (response.success && response.data) {
        setData(response.data);
        setTotal(response.pagination?.total || response.data.length);
        setTotalPages(response.pagination?.totalPages || 1);
        
        // 🔥 Calculate base ratios for each scheme (for proportional scaling)
        const ratios: Record<number, { baseOrderQty: number; baseFreeQty: number }> = {};
        response.data.forEach((scheme: any, index: number) => {
          if (scheme.orderQty > 0 && scheme.freeQty > 0) {
            ratios[index] = {
              baseOrderQty: scheme.orderQty,
              baseFreeQty: scheme.freeQty
            };
          }
        });
        setSchemeRatios(ratios);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load scheme data");
      console.error("Error fetching scheme data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (index: number, field: string, value: string) => {
    const updatedData = [...data];
    const numValue = Number(value);
    
    // Validate numeric fields
    if (field === 'orderQty' || field === 'freeQty' || field === 'schemePercent') {
      if (value !== '' && (isNaN(numValue) || numValue < 0)) {
        return; // Don't update if invalid
      }
      
      const finalValue = value === '' ? 0 : numValue;
      updatedData[index] = {
        ...updatedData[index],
        [field]: finalValue
      };
      
      // 🔥 PROPORTIONAL SCHEME SCALING
      // When orderQty changes, automatically recalculate freeQty
      // Example: 100+20 base → 200 order → 40 free (multiplier = 2)
      if (field === 'orderQty' && schemeRatios[index]) {
        const { baseOrderQty, baseFreeQty } = schemeRatios[index];
        
        if (baseOrderQty > 0 && baseFreeQty > 0) {
          // Calculate multiplier (how many times base order fits)
          const multiplier = Math.floor(finalValue / baseOrderQty);
          const newFreeQty = multiplier * baseFreeQty;
          
          updatedData[index].freeQty = newFreeQty;
          
          // Also update scheme percent
          if (finalValue > 0) {
            updatedData[index].schemePercent = Number(((newFreeQty / finalValue) * 100).toFixed(2));
          }
        }
      }
    } else {
      updatedData[index] = {
        ...updatedData[index],
        [field]: value
      };
    }
    
    setData(updatedData);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const response = await updateSchemeData(uploadId, data);
      
      if (response.success) {
        setSuccessMessage(`Saved successfully! ${response.data.schemesUpdated} schemes updated, Total Free Qty: ${response.data.totalFreeQty}`);
        setHasChanges(false);
        setTimeout(() => setSuccessMessage(null), 4000);
        
        // 🔥 Notify parent to refresh scheme data
        if (onSave) {
          onSave(data);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save scheme data");
      console.error("Error saving scheme data:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadSchemeFile(uploadId, fileName);
    } catch (err: any) {
      setError(err.message || "Failed to download scheme file");
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (confirm("You have unsaved changes. Are you sure you want to close?")) {
        setHasChanges(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  const footer = (
    <>
      <button
        onClick={handleClose}
        className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={handleDownload}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <Download className="w-4 h-4" />
        Download
      </button>
      <button
        onClick={handleSave}
        disabled={!hasChanges || saving}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-neutral-300 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <Save className="w-4 h-4" />
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="View & Edit Schemes"
      size="xl"
      footer={footer}
    >
      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="mt-2 text-neutral-600">Loading scheme data...</p>
        </div>
      )}

      {/* Data Table */}
      {!loading && data.length > 0 && (
        <>
          <div className="mb-4 text-sm text-neutral-600">
            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} schemes
            {hasChanges && <span className="ml-2 text-orange-600 font-medium">(Unsaved changes)</span>}
          </div>

          <div className="relative overflow-x-auto border rounded-lg">

            <table className="w-full text-sm">
              <thead className="bg-yellow-50 border-b border-neutral-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700 uppercase">Product</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 uppercase">Base Scheme</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 uppercase">Order Qty</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 uppercase">Free Qty</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-neutral-700 uppercase bg-green-50">Total (Order+Free)</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700 uppercase">Division</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {data.map((scheme, index) => {
                  const baseRatio = schemeRatios[index];
                  const orderQty = scheme.orderQty || 0;
                  const freeQty = scheme.freeQty || 0;
                  
                  return (
                    <tr key={index} className="hover:bg-yellow-50/50">
                      <td className="px-3 py-2">
                        <p className="font-medium text-sm">{scheme.productName || '-'}</p>
                        <p className="text-xs text-neutral-500">{scheme.productCode || '-'}</p>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {baseRatio ? (
                          <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                            {baseRatio.baseOrderQty}+{baseRatio.baseFreeQty}
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          value={orderQty}
                          onChange={(e) => handleEdit(index, 'orderQty', e.target.value)}
                          className="w-20 px-2 py-1 text-center border border-neutral-200 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 font-medium rounded">
                          +{freeQty}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center bg-green-50">
                        <span className="font-bold text-green-700 text-base">
                          {orderQty}+{freeQty}
                        </span>
                        <p className="text-xs text-neutral-500">= {orderQty + freeQty} total</p>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-neutral-600">{scheme.division || '-'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-neutral-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && data.length === 0 && (
        <div className="text-center py-12 text-neutral-500">
          No scheme data available
        </div>
      )}
    </Modal>
  );
}
