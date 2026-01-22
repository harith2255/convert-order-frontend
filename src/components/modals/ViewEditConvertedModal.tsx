import React, { useState, useEffect } from "react";
import { Modal } from "../Modal";
import { previewConvertedOrders, updateConvertedData, downloadOrderFile } from "../../services/orderApi";
import { Download, Save, X, AlertCircle, CheckCircle } from "lucide-react";

interface ViewEditConvertedModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploadId: string;
  fileName?: string;
}

export function ViewEditConvertedModal({
  isOpen,
  onClose,
  uploadId,
  fileName
}: ViewEditConvertedModalProps) {
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
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
      const response = await previewConvertedOrders(uploadId, page, limit);
      
      if (response.success) {
        setData(response.data || []);
        setTotal(response.pagination?.total || 0);
        setTotalPages(response.pagination?.totalPages || 1);
        
        // Use headers from backend (final template format)
        if (response.headers && response.headers.length > 0) {
          setHeaders(response.headers);
        } else if (response.data && response.data.length > 0) {
          // Fallback to extracting from first row if headers not provided
          setHeaders(Object.keys(response.data[0]));
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load data");
      console.error("Error fetching converted orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCellEdit = (rowIndex: number, field: string, value: string) => {
    const updatedData = [...data];
    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      [field]: value
    };
    setData(updatedData);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      // If we're viewing a paginated subset, we need to get all data first
      // For now, we'll just save the current page
      const response = await updateConvertedData(uploadId, data);
      
      if (response.success) {
        setSuccessMessage("Data saved successfully!");
        setHasChanges(false);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save data");
      console.error("Error saving data:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadOrderFile(uploadId, fileName);
    } catch (err: any) {
      setError(err.message || "Failed to download file");
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
        onClick={handleSave}
        disabled={!hasChanges || saving}
        className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-neutral-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
      >
        <Save className="w-4 h-4" />
        <span className="hidden sm:inline">{saving ? "Saving..." : "Save Changes"}</span>
        <span className="sm:hidden">Save</span>
      </button>
      <button
        onClick={handleDownload}
        className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Download</span>
        <span className="sm:hidden">Download</span>
      </button>
      <button
        onClick={handleClose}
        className="px-3 sm:px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors text-sm"
      >
        Cancel
      </button>
    </>
  );

  return (
    <Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="View & Edit Converted Orders"
  size="full" // 👈 instead of xl
  className="max-w-screen-xl w-full mx-auto"
  footer={footer}
>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span className="flex-1 break-words">{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 text-green-700 text-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span className="flex-1 break-words">{successMessage}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="mt-2 text-neutral-600">Loading data...</p>
        </div>
      )}

      {/* Data Table */}
      {!loading && data.length > 0 && (
        <>
          <div className="mb-4 text-xs sm:text-sm text-neutral-600 flex flex-col sm:flex-row sm:items-center gap-1">
            <span>Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} rows</span>
            {hasChanges && <span className="text-orange-600 font-medium">(Unsaved changes)</span>}
          </div>

          <div className="overflow-x-auto border border-neutral-200 rounded-lg">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0">
                <tr>
                  {headers.map((header) => (
                    <th
                      key={header}
                      className="px-2 sm:px-3 py-2 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {data.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-neutral-50">
                    {headers.map((header) => (
                      <td key={header} className="px-2 sm:px-3 py-2">
                        <input
                          type="text"
                          value={row[header] || ""}
                          onChange={(e) => handleCellEdit(rowIndex, header, e.target.value)}
                          className="w-full min-w-[80px] px-2 py-1.5 sm:py-1 text-xs sm:text-sm border border-neutral-200 rounded focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </button>
              <span className="text-xs sm:text-sm text-neutral-600 font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          No converted data available
        </div>
      )}
    </Modal>
  );
}
