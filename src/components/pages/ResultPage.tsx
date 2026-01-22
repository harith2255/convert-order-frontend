/**
 * RESULT PAGE - Display Conversion Results
 * Compatible with production backend template structure
 */
import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  XCircle,
  Download,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Edit,
} from "lucide-react";
import { Alert } from "../ui/alert";
import { Card } from "../Card";
import { Button } from "../Button";
import { Table } from "../Table";
import { Badge } from "../Badge";
import { getOrderResult, downloadOrderFile, previewConvertedOrders } from "../../services/orderApi";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SchemeSummaryCard } from "../../components/SchemeSummary.tsx";
import { SchemeSelectionModal } from "../../components/modals/SchemeModal.tsx";
import { ViewEditConvertedModal } from "../modals/ViewEditConvertedModal";
import { ViewEditSchemeModal } from "../modals/ViewEditSchemeModal";

interface ConversionData {
  successRows: number;
   schemeSummary?: {
    count: number;
    totalFreeQty: number;
  };
  fileName?: string; // Add fileName field
  schemeDetails?: any[];
  errors: Array<{
    rowNumber: number;
    field: string;
    error: string;
    originalValue?: string;
    suggestedFix?: string;
  }>;
  warnings: Array<{
    rowNumber: number;
    field: string;
    warning: string;
    originalValue?: string;
    newValue?: string | number;
  }>;
  processingTime: string | number;
  downloadUrls?: Array<{ type: string; url: string }>;
  status: string;
}

export function ResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [downloadingType, setDownloadingType] = useState<string | null>(null); // Track which button is downloading
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState<ConversionData | null>(null);
  const [schemeModalOpen, setSchemeModalOpen] = useState(false);
  const [activeSchemeRow, setActiveSchemeRow] = useState<any>(null);
  const [editingConverted, setEditingConverted] = useState(false);
  const [editingScheme, setEditingScheme] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);

  useEffect(() => {
     if (success && id) {
        previewConvertedOrders(id, 1, 10).then(res => {
            if (res.success) {
                setPreviewData(res.data || []);
                setPreviewHeaders(res.headers || Object.keys(res.data?.[0] || {}));
            }
        }).catch(err => console.error("Preview fetch error", err));
     }
  }, [success, id]);

  useEffect(() => {
    if (!id) {
      toast.error("No conversion ID provided");
      navigate("/history");
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const res = await getOrderResult(id);
        if (!mounted) return;

        const conversionData: ConversionData = {
          successRows: res.recordsProcessed || 0,
          errors: Array.isArray(res.errors) ? res.errors : [],
          warnings: Array.isArray(res.warnings) ? res.warnings : [],
          processingTime: res.processingTime || "-",
          status: res.status || "UNKNOWN",
          schemeSummary: res.schemeSummary || null,
          fileName: res.fileName, 
          schemeDetails: res.schemeDetails || [],
          downloadUrls: res.downloadUrls || [] // Capture download URLs
        };

        setData(conversionData);
        // ... rest of effect
        const isSuccess =
          res.status === "CONVERTED" ||
          ((res.recordsProcessed || 0) > 0 && (!res.errors || res.errors.length === 0));

        setSuccess(isSuccess);

        if (isSuccess) {
          toast.success(`✅ ${conversionData.successRows} records converted successfully`);
        } else {
          toast.error("Conversion completed with errors");
        }
      } catch (err: any) {
        console.error("Result fetch error:", err);
        toast.error("Failed to load conversion result");
        navigate("/history");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id, navigate]);

  const handleDownload = async (type: string = 'single') => {
    if (!id) return;

    try {
      setDownloadingType(type);
      // Map 'single', 'sheets', 'main' to API types if needed, currently they match
      const apiType = (type === 'sheets' || type === 'main') ? type as 'sheets' | 'main' : undefined;
      
      const prefix = type === 'sheets' ? 'Sheet Orders' : type === 'main' ? 'Main Order' : '';
      const name = prefix ? `${prefix} - ${data?.fileName}` : data?.fileName;

      await downloadOrderFile(id, name, apiType);
      toast.success(`${type === 'sheets' ? 'Sheet Orders' : type === 'main' ? 'Main Order' : 'File'} downloaded successfully`);
    } catch (err: any) {
      console.error("Download error:", err);
      toast.error("Failed to download file");
    } finally {
      setDownloadingType(null);
    }
  };
  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
    );
  }

  if (!data) return null;

  const warningRows = data.warnings || [];
  const errorRows = data.errors || [];

  const warningColumns = [
    { key: "rowNumber", label: "Row" },
    { key: "field", label: "Field" },
    { key: "warning", label: "Issue" },
    { key: "originalValue", label: "Original" },
    { key: "newValue", label: "New Value" },
  ];

  const errorColumns = [
    { key: "rowNumber", label: "Row" },
    { key: "field", label: "Field" },
    { key: "error", label: "Error" },
    { key: "suggestedFix", label: "Suggestion" },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      <div className="flex items-center gap-3 mb-6">
           <Button variant="ghost" onClick={() => navigate("/upload")}>Back</Button>
           <h1 className="text-2xl font-bold text-neutral-800">Conversion Results</h1>
      </div>

      <Card>
        <div className="p-6 flex items-start justify-between">
           <div className="flex items-center gap-4">
               {success ? (
                  <div className="bg-green-100 p-3 rounded-full">
                     <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
               ) : (
                  <div className="bg-red-100 p-3 rounded-full">
                     <XCircle className="w-8 h-8 text-red-600" />
                  </div>
               )}
               <div>
                  <h2 className="text-xl font-bold">
                     {success ? "Conversion Successful" : "Conversion Failed"}
                  </h2>
                  <div className="flex gap-4 mt-1 text-sm text-neutral-600">
                      <span>Processed: <strong>{data.successRows + errorRows.length}</strong> rows</span>
                      <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3"/> {data.processingTime}</span>
                  </div>
               </div>
           </div>

           <div className="flex flex-col items-end gap-4">


            {success && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="secondary"
                  onClick={() => setEditingConverted(true)}
                  className="inline-flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit Orders
                </Button>
                {data.schemeSummary && data.schemeSummary.count > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() => setEditingScheme(true)}
                    className="inline-flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Schemes
                  </Button>
                )}
                
                {/* DYNAMIC DOWNLOAD BUTTONS */}
                {data.downloadUrls && data.downloadUrls.length > 0 ? (
                  data.downloadUrls.map((dl, idx) => (
                    <Button
                      key={idx}
                      variant="primary"
                      onClick={() => handleDownload(dl.type)}
                      disabled={!!downloadingType}
                      className="inline-flex items-center gap-2"
                    >
                      {downloadingType === dl.type ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          {dl.type === 'sheets' ? 'Download Sheet Orders' : 
                           dl.type === 'main' ? 'Download Main Order' : 'Download Excel File'}
                        </>
                      )}
                    </Button>
                  ))
                ) : (
                  // Fallback for backward compatibility
                  <Button
                    variant="primary"
                    onClick={() => handleDownload('single')}
                    disabled={!!downloadingType}
                    className="inline-flex items-center gap-2"
                  >
                    {downloadingType ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download Excel File
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          {success && (
            <div className="flex-shrink-0">
              <FileSpreadsheet className="w-16 h-16 text-green-600" />
            </div>
          )}
        </div>
      </Card>

      {success && data.schemeSummary && data.schemeSummary.count > 0 && (
          <div className="mb-6">
            <SchemeSummaryCard
                orderId={id!}
                schemeSummary={data.schemeSummary}
                fileName={data.fileName} 
            />
          </div>
      )}

      {/* PREVIEW CARD */}
            {success && previewData.length > 0 && (
                <Card>
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                             <FileSpreadsheet className="w-5 h-5 text-green-600" />
                             Converted File Preview
                        </h3>
                        <div className="text-xs text-gray-500">Showing first 10 rows</div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-700 font-medium">
                                <tr>
                                    {previewHeaders.map(h => (
                                        <th key={h} className="px-4 py-3 border-b border-r border-gray-200 last:border-r-0 whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {previewData.map((row, i) => {
                                    // Highlights row if it appears in schemeDetails (matching by SAPCODE)
                                    // This is more robust than checking sanitized row fields
                                    const isSchemeRow = data.schemeDetails?.some(
                                        s => s.productCode === row["SAPCODE"]
                                    );
                                    
                                    return (
                                    <tr key={i} className={isSchemeRow ? "bg-yellow-100 hover:bg-yellow-200" : "hover:bg-gray-50"}>
                                        {previewHeaders.map(h => (
                                            <td key={h} className="px-4 py-2 border-r border-gray-100 last:border-r-0 whitespace-nowrap relative group">
                                                {row[h]}
                                                {h === "ORDERQTY" && row._upsell && (
                                                    <div className="absolute top-1 right-1 cursor-help group/icon">
                                                        {/* <span className="text-lg" title={row._upsell.message}>💡</span> */}
                                                        {/* Simple Tooltip */}
                                                        <div className="absolute z-10 hidden group-hover/icon:block bg-black text-white text-xs px-2 py-1 rounded -top-8 left-1/2 -translate-x-1/2 w-48 text-center shadow-lg">
                                                            {/* {row._upsell.message} */}
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-3 border-t border-gray-200 bg-gray-50 text-center">
                        <button 
                            onClick={() => setEditingConverted(true)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                            View Full File & Edit
                        </button>
                    </div>
                </Card>
            )}

{success && data.schemeDetails && data.schemeDetails.length > 0 && (
  <Card>
    <div className="p-4">
      <h3 className="font-semibold mb-3">Schemed Products</h3>

      <div className="space-y-2">
        {data.schemeDetails.map((row, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 border rounded hover:bg-yellow-50"
          >
            <div>
              <p className="font-medium">{row.productName}</p>
              <p className="text-sm text-neutral-600">
                Qty: {row.orderQty} | Free: {row.freeQty}
              </p>
            </div>

           <div className="flex gap-2">
  {/* VIEW SCHEMES */}
  <Button
    variant="secondary"
    size="sm"
    onClick={() => {
      setActiveSchemeRow({
        SAPCODE: row.productCode,
        ITEMDESC: row.productName,
        ORDERQTY: row.orderQty,
        _availableSchemes: row.availableSchemes || [],
        viewOnly: true
      });
      setSchemeModalOpen(true);
    }}
  >
    View Schemes
  </Button>

  {/* APPLY / CONVERT */}
  <Button
    variant="primary"
    size="sm"
    onClick={() => {
      setActiveSchemeRow({
        SAPCODE: row.productCode,
        ITEMDESC: row.productName,
        ORDERQTY: row.orderQty,
        _availableSchemes: row.availableSchemes || [],
        viewOnly: false
      });
      setSchemeModalOpen(true);
    }}
  >
    Convert Order
  </Button>
</div>

          </div>
        ))}
      </div>
    </div>
  </Card>
)}

      {/* TEMPLATE INFO */}
      {success && (
        <Card>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 mb-1">
                  Template Format
                </p>
                <p className="text-sm text-blue-800">
                  Your file has been converted to the pharmaceutical training template with columns: 
                  <strong> CODE | CUSTOMER NAME | SAPCODE | ITEMDESC | ORDERQTY | BOX PACK | PACK | DVN</strong>
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* WARNINGS TABLE */}
      {warningRows.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h3 className="text-lg font-semibold">Warnings</h3>
            <Badge variant="warning">{warningRows.length}</Badge>
          </div>
          <p className="text-sm text-neutral-600 mb-4">
            These records were processed but required automatic corrections:
          </p>
          <div className="overflow-x-auto">
            <Table columns={warningColumns} data={warningRows} />
          </div>
        </Card>
      )}

      {/* ERRORS TABLE */}
      {errorRows.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold">Errors</h3>
            <Badge variant="error">{errorRows.length}</Badge>
          </div>
          <p className="text-sm text-neutral-600 mb-4">
            These records could not be processed and need to be fixed:
          </p>
          <div className="overflow-x-auto">
            <Table columns={errorColumns} data={errorRows} />
          </div>
        </Card>
      )}

      {/* ACTION BUTTONS */}
      <Card>
        <div className="flex justify-between items-center">
          <div className="text-sm text-neutral-600">
            {success ? (
              <>
                <CheckCircle className="w-4 h-4 inline text-green-600 mr-1" />
                Your pharmaceutical order file is ready
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 inline text-red-600 mr-1" />
                Fix errors in source file and upload again
              </>
            )}
          </div>

          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              onClick={() => navigate("/history")}
            >
              View History
            </Button>
            <Button 
              variant="primary" 
              onClick={() => navigate("/upload")}
            >
              {success ? "Upload Another File" : "Try Again"}
            </Button>
          </div>
        </div>
      </Card>
      <SchemeSelectionModal
  open={schemeModalOpen}
  onClose={() => setSchemeModalOpen(false)}
  product={{
    sapCode: activeSchemeRow?.SAPCODE,
    name: activeSchemeRow?.ITEMDESC,
    orderedQty: activeSchemeRow?.ORDERQTY
  }}
  schemes={activeSchemeRow?._availableSchemes || []}
  onApply={(scheme) => {
    console.log("Selected scheme:", scheme);
    // 👉 call backend /apply-scheme here
    setSchemeModalOpen(false);
  }}
/>

      {/* Edit Converted Orders Modal */}
      {editingConverted && id && (
        <ViewEditConvertedModal
          isOpen={editingConverted}
          onClose={() => setEditingConverted(false)}
          uploadId={id}
          fileName={data?.fileName}
        />
      )}

      {/* Edit Scheme Modal */}
      {editingScheme && id && (
        <ViewEditSchemeModal
          isOpen={editingScheme}
          onClose={() => setEditingScheme(false)}
          uploadId={id}
          fileName={data?.fileName}
        />
      )}

    </div>
  );
}