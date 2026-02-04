/**
 * RESULT PAGE - Display Conversion Results
 * Compatible with production backend template structure
 */
import React, { useEffect, useState } from "react";
import {
  XCircle,
  AlertTriangle,
  RefreshCw,
  Edit,
  FileSpreadsheet,
  CheckCircle,
} from "lucide-react";
import { Button } from "../Button";
import { Card } from "../Card";
import { Table } from "../Table";
import { Badge } from "../Badge";
import {
  getOrderResult,
  downloadOrderFile,
  previewConvertedOrders,
  generateDivisionReport,
  downloadFileFromUrl,
} from "../../services/orderApi";
import { useAuth } from "../../context/AuthContext";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SchemeSummaryCard } from "../../components/SchemeSummary.tsx";
import { SchemeSelectionModal } from "../../components/modals/SchemeModal.tsx";
import { ViewEditConvertedModal } from "../modals/ViewEditConvertedModal";
import { ViewEditSchemeModal } from "../modals/ViewEditSchemeModal";
import { conversionData } from "../../types";

// Sub-components
import { ConversionSummary } from "../../components/result-page/ConversionSummary";
import { DownloadActions } from "../../components/result-page/DownloadActions";
import { PreviewTable } from "../../components/result-page/PreviewTable";

export function ResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState<conversionData | null>(null);
  const [schemeModalOpen, setSchemeModalOpen] = useState(false);
  const [activeSchemeRow, setActiveSchemeRow] = useState<any>(null);

  // Division Filter State
  const [divisions, setDivisions] = useState<string[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>("");
  const [editingConverted, setEditingConverted] = useState(false);
  const [editingScheme, setEditingScheme] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);

  useEffect(() => {
    if (success && id) {
      previewConvertedOrders(id, 1, 10)
        .then((res) => {
          if (res.success) {
            setPreviewData(res.data || []);
            setPreviewHeaders(
              (res.headers || Object.keys(res.data?.[0] || {})).filter(
                (k: string) => !k.startsWith("_")
              )
            );
          }
        })
        .catch((err) => console.error("Preview fetch error", err));
    }
  }, [success, id]);

  // Extract Divisions when data loads
  useEffect(() => {
    let sourceRows = (data as any)?.convertedData?.rows;
    if (!sourceRows || sourceRows.length === 0) {
      sourceRows = previewData;
    }

    if (sourceRows && Array.isArray(sourceRows) && sourceRows.length > 0) {
      const uniqueDivs = new Set<string>();
      sourceRows.forEach((r: any) => {
        const dvn = r.DVN || r.Division || r.DIVISION || r.division || r.dvn;
        if (dvn && typeof dvn === "string") uniqueDivs.add(dvn);
      });
      setDivisions(Array.from(uniqueDivs).sort());
    }
  }, [data, previewData]);

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

        // 🔥 Check for cached scheme data
        let schemeDetails = res.schemeDetails || [];
        const cachedSchemeData = sessionStorage.getItem(`schemeDetails_${id}`);
        if (cachedSchemeData) {
          try {
            schemeDetails = JSON.parse(cachedSchemeData);
            sessionStorage.removeItem(`schemeDetails_${id}`);
          } catch (e) {
            console.warn("Failed to parse cached scheme data");
          }
        }

        const conversionData: conversionData = {
          successRows: res.recordsProcessed || 0,
          errors: Array.isArray(res.errors) ? res.errors : [],
          warnings: Array.isArray(res.warnings) ? res.warnings : [],
          processingTime: res.processingTime || "-",
          status: res.status || "UNKNOWN",
          schemeSummary: res.schemeSummary || null,
          fileName: res.fileName,
          schemeDetails: schemeDetails,
          downloadUrls: res.downloadUrls || [],
        };

        setData(conversionData);

        const isSuccess =
          res.status === "CONVERTED" ||
          ((res.recordsProcessed || 0) > 0 &&
            (!res.errors || res.errors.length === 0));

        setSuccess(isSuccess);

        if (isSuccess) {
          toast.success(
            `✅ ${conversionData.successRows} records converted successfully`
          );
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

  const handleDownload = async (type: string = "single") => {
    if (!id) return;

    try {
      setDownloadingType(type);
      const apiType =
        type === "sheets" || type === "main"
          ? (type as "sheets" | "main")
          : undefined;

      const prefix =
        type === "sheets" ? "Sheet Orders" : type === "main" ? "Main Order" : "";
      const name = prefix ? `${prefix} - ${data?.fileName}` : data?.fileName;

      await downloadOrderFile(id, name, apiType);
      toast.success(
        `${
          type === "sheets"
            ? "Sheet Orders"
            : type === "main"
            ? "Main Order"
            : "File"
        } downloaded successfully`
      );
    } catch (err: any) {
      console.error("Download error:", err);
      toast.error("Failed to download file");
    } finally {
      setDownloadingType(null);
    }
  };

  const handleDivisionDownload = async () => {
    if (!id) return;
    try {
      setDownloadingType("division");
      const res = await generateDivisionReport(id, selectedDivision);
      if (res.downloadUrl) {
        await downloadFileFromUrl(res.downloadUrl);
        toast.success("Division report downloaded");
      }
    } catch (err) {
      toast.error("Failed to generate division report");
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
    <div className="container mx-auto py-4 max-w-7xl space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" onClick={() => navigate("/upload")}>
          Back
        </Button>
        <h1 className="text-2xl font-bold text-neutral-800">
          Conversion Results
        </h1>
      </div>

      {/* SUMMARY & ACTIONS */}
      <Card>
        <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-0">
          <ConversionSummary
             success={success} 
             data={data}
             errorCount={errorRows.length}
           />

           {success && (
                <div className="flex items-center gap-4">
                     <DownloadActions
                        data={data}
                        downloadingType={downloadingType}
                        onDownload={handleDownload}
                        divisions={divisions}
                        selectedDivision={selectedDivision}
                        onDivisionChange={setSelectedDivision}
                        onDivisionDownload={handleDivisionDownload}
                     />
                    {/* Icon */}
                    <div className="flex-shrink-0 hidden sm:block">
                        <FileSpreadsheet className="w-16 h-16 text-green-600" />
                    </div>
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
      {success && (
        <PreviewTable
          previewData={previewData}
          previewHeaders={previewHeaders}
          schemeDetails={data.schemeDetails}
          id={id!}
          onViewFull={() => navigate(`/edit-orders/${id}`)}
        />
      )}

      {success && data.schemeDetails && data.schemeDetails.length > 0 && (
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <span className="text-yellow-600">🎁</span>
                Scheme Products ({data.schemeDetails.length})
              </h3>
              <span className="text-xs text-neutral-500">
                Auto-calculated from order quantities
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-yellow-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-neutral-700">
                      Product
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-neutral-700">
                      Order Qty
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-neutral-700">
                      Free Qty
                    </th>
                    <th className="px-3 py-2 text-center font-medium text-neutral-700 bg-green-50">
                      Total (Order+Free)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.schemeDetails.map((row, i) => {
                    const orderQty = row.orderQty || 0;
                    const freeQty = row.freeQty || 0;
                    return (
                      <tr key={i} className="hover:bg-yellow-50/50">
                        <td className="px-3 py-2">
                          <p className="font-medium">{row.productName}</p>
                          <p className="text-xs text-neutral-500">
                            {row.productCode}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-center">{orderQty}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 font-medium rounded">
                            +{freeQty}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center bg-green-50">
                          <span className="font-bold text-green-700">
                            {orderQty}+{freeQty}
                          </span>
                          <p className="text-xs text-neutral-500">
                            = {orderQty + freeQty} total
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 gap-4 sm:gap-0">
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

          <div className="flex gap-3 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={() => {
                if (user?.role === "admin") {
                  navigate("/admin");
                } else {
                  navigate("/history");
                }
              }}
              className="flex-1 sm:flex-auto"
            >
              View History
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate("/upload")}
              className="flex-1 sm:flex-auto"
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
          orderedQty: activeSchemeRow?.ORDERQTY,
        }}
        schemes={activeSchemeRow?._availableSchemes || []}
        onApply={(scheme) => {
          console.log("Selected scheme:", scheme);
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
          onSave={(updatedData) => {
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    schemeDetails: updatedData,
                  }
                : prev
            );
          }}
        />
      )}
    </div>
  );
}