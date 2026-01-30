import React, { useState } from "react";
import { Upload, Download, Database } from "lucide-react";
import { Card } from "../Card";
import { Button } from "../Button";
import { Badge } from "../Badge";
import { toast } from "sonner";
import { masterDataApi } from "../../services/masterDataApi";
import { CustomerTable } from "../admin/CustomerTable";
import { ProductManagement } from "../admin/ProductManagement";
import { SchemeTable } from "../admin/SchemeTable";

export function MasterDataPage() {

  const [dbFile, setDbFile] = useState<File | null>(null);
  const [loadingDb, setLoadingDb] = useState(false);
  const [exporting, setExporting] = useState(false);

  /* ===========================
     DATABASE OPERATIONS
  ============================ */
  const handleExport = async () => {
    try {
      setExporting(true);
      await masterDataApi.exportMasterData();
      toast.success("Master data exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const uploadDatabase = async () => {
    if (!dbFile) {
      toast.error("Please select a database file");
      return;
    }

    try {
      setLoadingDb(true);
      const res = await masterDataApi.uploadDatabase(dbFile);
      toast.success(res.data?.message || "Database updated successfully");
      setDbFile(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Database upload failed");
    } finally {
      setLoadingDb(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold">Master Data Management</h1>
        <p className="text-neutral-600">Admin-only customer & product master</p>
      </div>

      {/* INFO */}
      {/* <Card>
        <div className="flex gap-3">
          <Database className="w-5 h-5 text-primary-600" />
          <p className="text-sm">
            Used for validation and aggregation. Only ORDER QTY is updated during uploads.
          </p>
        </div>
      </Card> */}

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Database Management</h3>
          <Button
            variant="secondary"
            onClick={handleExport}
            isLoading={exporting}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Master Data
          </Button>
        </div>

        <div className="p-4 border border-dashed border-neutral-200 rounded-lg">
          <p className="text-sm text-neutral-600 mb-3">
            Bulk update database using a full master file. This will update both
            customers and products.
          </p>

          <input
            type="file"
            accept=".xlsx,.xls"
            id="dbFileInput"
            className="hidden"
            onChange={e => setDbFile(e.target.files?.[0] || null)}
          />

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => document.getElementById("dbFileInput")?.click()}
            >
              Select File
            </Button>

            {dbFile ? (
              <Badge variant="success">{dbFile.name}</Badge>
            ) : (
              <span className="text-sm text-neutral-500">No file selected</span>
            )}
          </div>

          <div className="flex justify-end mt-4">
            <Button
              onClick={uploadDatabase}
              isLoading={loadingDb}
              disabled={!dbFile}
              size="sm"
            >
              Bulk Upload database
            </Button>
          </div>
        </div>
      </Card>

      <CustomerTable />
      <ProductManagement />
      <SchemeTable />

    </div>
  );
}
