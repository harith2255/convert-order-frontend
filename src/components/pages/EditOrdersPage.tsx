import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Save, AlertCircle, RefreshCw, ChevronDown, ChevronRight, Box } from "lucide-react";
import { previewConvertedOrders, updateConvertedData, downloadOrderFile } from "../../services/orderApi";
import { Button } from "../Button";
import { toast } from "sonner";

// 🔥 Clean product name - remove form words and pack patterns
const FORM_WORDS = /\b(TABLETS?|TABS?|TAB|CAPSULES?|CAPS?|CAP|ORAL|OINTMENT|LOTION|POWDER)\b/gi;
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

  // Grouping State
  const [expandedDivisions, setExpandedDivisions] = useState<Record<string, boolean>>({});

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

        // Auto-expand all divisions initially? Or Start collapsed?
        // Let's start collapsed or expanded based on preference. 
        // User asked for dropdown like, implying collapsed or at least toggleable.
        // Usually starting expanded is friendlier for editing immediately.
        // Let's mimic previous behavior: start with all Expanded for visibility? 
        // Or collapsed? "when we click the + icon ... it show all products" implies they are hidden first.
        // I will start with them collapsed (empty object) or I can pre-fill true.
        // Let's start Collapsed to match "click to open" request behavior strictly.
        // Wait, if I start collapsed, the page looks empty. That might be bad UX.
        // User said: "minimise or hide ... easy for user add that when clicking it should be open"
        // I'll start with all COLLAPSED (false) so they see just divisions.
        setExpandedDivisions({}); 
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

  const toggleDivision = (division: string) => {
    setExpandedDivisions(prev => ({
        ...prev,
        [division]: !prev[division]
    }));
  };

  // Group Data Logic
  // We need to preserve the original index for editing
  const groupedData = React.useMemo(() => {
    const groups: Record<string, { row: any, originalIndex: number }[]> = {};
    
    data.forEach((row, index) => {
        // Try multiple fields for Division
        const div = row.DVN || row.Division || row.DIVISION || row.division || row.dvn || "Unassigned";
        if (!groups[div]) groups[div] = [];
        groups[div].push({ row, originalIndex: index });
    });

    return groups;
  }, [data]);

  const sortedDivisions = Object.keys(groupedData).sort();

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
            <thead className="bg-neutral-100 sticky top-0 z-10">
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
              {sortedDivisions.map(division => {
                  const isExpanded = expandedDivisions[division];
                  const groupRows = groupedData[division];
                  
                  return (
                    <React.Fragment key={division}>
                        {/* DIVISION HEADER */}
                         <tr 
                            className="bg-neutral-50 hover:bg-neutral-100 cursor-pointer transition-colors border-b border-neutral-200"
                            onClick={() => toggleDivision(division)}
                        >
                            <td colSpan={headers.length} className="p-2">
                                <div className="flex items-center gap-2 font-semibold text-neutral-800">
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    <Box className="w-4 h-4 text-blue-600" />
                                    {division} 
                                    <Badge variant="neutral" className="ml-2 text-xs">{groupRows.length} items</Badge>
                                </div>
                            </td>
                        </tr>

                        {/* ROWS */}
                        {isExpanded && groupRows.map(({ row, originalIndex }) => (
                            <tr key={originalIndex} className="hover:bg-neutral-50 animate-in fade-in slide-in-from-top-1 duration-200">
                                {headers.map((header) => (
                                    <td key={header} className="px-3 py-2">
                                    <input
                                        type="text"
                                        value={row[header] || ""}
                                        onChange={(e) => handleCellEdit(originalIndex, header, e.target.value)}
                                        className="w-full min-w-[80px] px-2 py-1.5 text-sm border border-neutral-200 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </React.Fragment>
                  );
              })}

              {data.length === 0 && (
                  <tr>
                      <td colSpan={headers.length} className="text-center p-8 text-neutral-500">
                          No data found
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION - Fixed Bottom */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 bg-white border-t border-neutral-200 px-4 py-3">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => {
                  setPage(p => Math.max(1, p - 1));
                  setExpandedDivisions({}); // Collapse all on page change
              }}
              disabled={page === 1}
              className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-neutral-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => {
                  setPage(p => Math.min(totalPages, p + 1));
                  setExpandedDivisions({}); // Collapse all on page change
              }}
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

// Simple Badge component inline or referenced if available. 
// I'll assume Badge exists as it was in ResultPage.
function Badge({ children, variant = "neutral", className = "" }: any) {
    const variants: any = {
        neutral: "bg-gray-100 text-gray-800",
        success: "bg-green-100 text-green-800",
        warning: "bg-yellow-100 text-yellow-800",
        error: "bg-red-100 text-red-800",
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
}
