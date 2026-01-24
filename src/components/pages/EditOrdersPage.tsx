import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Save, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { previewConvertedOrders, updateConvertedData, downloadOrderFile } from "../../services/orderApi";
import { Button } from "../Button";
import { toast } from "sonner";

// 🔥 Clean product name - remove form words and pack patterns
const FORM_WORDS = /\b(TABLETS?|TABS?|TAB|CAPSULES?|CAPS?|CAP|SUSPENSION|ORAL|SYRUP|SYP|DROPS?|CREAM|GEL|SPRAY|OINTMENT|LOTION|POWDER)\b/gi;
const PACK_PATTERNS = [
  /\(\s*\d+\s*['`"]?\s*S\s*\)/gi,     // (30'S)
  /\b\d+\s*['`"]?\s*S\b/gi,           // 30'S
  /\bPACK\s*OF\s*\d+\b/gi,
  /\b\d+\s*,\s*S\b/gi,                // 10,S
];

function cleanProductText(raw: string = ""): string {
  let text = raw.toUpperCase();
  
  // Remove pack patterns
  PACK_PATTERNS.forEach(p => {
    text = text.replace(p, "");
  });
  
  // Remove form words
  text = text.replace(FORM_WORDS, "");
  
  // Normalize whitespace
  text = text.replace(/[-–]/g, " ").replace(/\s+/g, " ").trim();
  
  return text;
}

export function EditOrdersPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 100;

  useEffect(() => {
    if (id) fetchData();
  }, [id, page]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await previewConvertedOrders(id!, page, limit);
      
      if (response.success) {
        // 🔥 Clean ITEMDESC column for display
        const cleanedData = (response.data || []).map((row: any) => ({
          ...row,
          ITEMDESC: row.ITEMDESC ? cleanProductText(row.ITEMDESC) : row.ITEMDESC
        }));
        
        setData(cleanedData);
        setTotal(response.pagination?.total || 0);
        setTotalPages(response.pagination?.totalPages || 1);
        
        if (response.headers?.length > 0) {
          setHeaders(response.headers);
        } else if (response.data?.length > 0) {
          setHeaders(Object.keys(response.data[0]));
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load data");
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCellEdit = (rowIndex: number, field: string, value: string) => {
    const updatedData = [...data];
    updatedData[rowIndex] = { ...updatedData[rowIndex], [field]: value };
    setData(updatedData);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await updateConvertedData(id!, data);
      if (response.success) {
        toast.success("Changes saved successfully!");
        setHasChanges(false);
        
        // 🔥 Store updated scheme data in sessionStorage for ResultPage to read
        if (response.data?.schemeDetails) {
          sessionStorage.setItem(
            `schemeDetails_${id}`,
            JSON.stringify(response.data.schemeDetails)
          );
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadOrderFile(id!);
      toast.success("File downloaded!");
    } catch (err: any) {
      toast.error("Download failed");
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      if (confirm("You have unsaved changes. Discard them?")) {
        navigate(-1);
      }
    } else {
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-50">
      {/* HEADER - Fixed */}
      <div className="flex-shrink-0 bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-neutral-900">Edit Converted Orders</h1>
              <p className="text-sm text-neutral-500">
                {total} rows • Page {page} of {totalPages}
                {hasChanges && <span className="text-orange-600 ml-2">(Unsaved changes)</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleDownload}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="flex-shrink-0 mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* TABLE - Scrollable */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 sticky top-0">
              <tr>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-3 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider whitespace-nowrap border-b border-neutral-200"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-neutral-50">
                  {headers.map((header) => (
                    <td key={header} className="px-3 py-2">
                      <input
                        type="text"
                        value={row[header] || ""}
                        onChange={(e) => handleCellEdit(rowIndex, header, e.target.value)}
                        className="w-full min-w-[80px] px-2 py-1.5 text-sm border border-neutral-200 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION - Fixed Bottom */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 bg-white border-t border-neutral-200 px-4 py-3">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-neutral-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
