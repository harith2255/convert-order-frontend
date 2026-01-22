import React, { useState, useEffect } from "react";
import { Modal } from "../Modal";
import { previewSchemeData, updateSchemeData, downloadSchemeFile } from "../../services/orderApi";
import { Download, Save, AlertCircle, CheckCircle } from "lucide-react";

interface ViewEditSchemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploadId: string;
  fileName?: string;
}

export function ViewEditSchemeModal({
  isOpen,
  onClose,
  uploadId,
  fileName
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
      updatedData[index] = {
        ...updatedData[index],
        [field]: value === '' ? 0 : numValue
      };
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

          <div className="overflow-x-auto border border-neutral-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-yellow-50 border-b border-neutral-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700 uppercase">Product Code</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700 uppercase">Product Name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700 uppercase">Order Qty</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700 uppercase">Free Qty</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700 uppercase">Scheme %</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700 uppercase">Division</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {data.map((scheme, index) => (
                  <tr key={index} className="hover:bg-yellow-50/50">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={scheme.productCode || ""}
                        readOnly
                        className="w-full px-2 py-1 bg-neutral-50 border border-neutral-200 rounded cursor-not-allowed"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={scheme.productName || ""}
                        readOnly
                        className="w-full px-2 py-1 bg-neutral-50 border border-neutral-200 rounded cursor-not-allowed"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={scheme.orderQty || 0}
                        onChange={(e) => handleEdit(index, 'orderQty', e.target.value)}
                        className="w-full px-2 py-1 border border-neutral-200 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={scheme.freeQty || 0}
                        onChange={(e) => handleEdit(index, 'freeQty', e.target.value)}
                        className="w-full px-2 py-1 border border-neutral-200 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={scheme.schemePercent || 0}
                        onChange={(e) => handleEdit(index, 'schemePercent', e.target.value)}
                        className="w-full px-2 py-1 border border-neutral-200 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={scheme.division || ""}
                        readOnly
                        className="w-full px-2 py-1 bg-neutral-50 border border-neutral-200 rounded cursor-not-allowed"
                      />
                    </td>
                  </tr>
                ))}
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
