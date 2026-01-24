import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAdminDashboard } from "../../services/adminDashboardApi";
import { toast } from "sonner";

import {
  AlertTriangle,
  TrendingUp,
  Users,
  Database,
  Map,
  Activity,
  FileText,
  CheckCircle,
  Upload
} from "lucide-react";

import { Card } from "../Card";
import { Button } from "../Button";
import { StatCard } from "../StatCard";
import { Table } from "../Table";
import { Badge } from "../Badge";
import api, { getUploadResult } from "../../services/api";

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
}

interface DashboardStats {
  totalUsers: number;
  totalUploads: number;
  failedUploads: number;
  successRate: number;
  successfulConversions: number;
  customers: number;
  products: number;
  schemes: number;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [alerts, setAlerts] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const [exporting, setExporting] = useState(false);

  const [uploads, setUploads] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  // ✅ NEW: Modal State
  const [selectedUpload, setSelectedUpload] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoadingResult, setIsLoadingResult] = useState(false);

  // ✅ NEW - Update to new endpoints
  const loadDashboard = async () => {
    try {
      const res = await api.get("/admin/master/dashboard");
      
      setStats({
        totalUsers: res.data.users.total,
        totalUploads: res.data.uploads.total,
        failedUploads: res.data.uploads.failed,
        successRate: res.data.uploads.successRate,
        successfulConversions: res.data.uploads.completed,
        customers: res.data.masterData?.customers || 0,
        products: res.data.masterData?.products || 0,
        schemes: res.data.masterData?.schemes || 0,
      });

      setRecentActivity(res.data.recentActivity || []);
    } catch {
      toast.error("Failed to load admin dashboard");
    }
  };

  // ✅ Handle Row Click
  const handleUploadClick = async (upload: any) => {
    if(!upload.id) return;
    
    try {
      setIsLoadingResult(true);
      // Open modal immediately to show loading state if desired, or wait
      setShowModal(true); 
      const response = await getUploadResult(upload.id);
      
      if (response.success) {
        setSelectedUpload(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch result", error);
      toast.error("Could not load upload details.");
      setShowModal(false);
    } finally {
      setIsLoadingResult(false);
    }
  };

  const loadUploads = async (pageNo = 1) => {
    // Use the new OrderUpload endpoint
    const res = await api.get("/admin/master/audits", {
      params: { page: pageNo, limit: 10 },
    });

    setUploads(
      res.data.data.map((u: any) => ({
        id: u._id,
        file: u.fileName,
        user: u.user?.email || "Unknown",
        status: u.status,
        processed: u.processed || 0,
        failed: u.failed || 0,
        time: u.createdAt ? new Date(u.createdAt).toLocaleString() : "N/A",
      }))
    );

    // Pagination Fix
    const p = res.data.pagination;
    setPagination({
      ...p,
      hasPrev: p.page > 1,
      hasNext: p.page < p.totalPages
    });
    setPage(pageNo);
  };

  // Export button - update to new endpoint
  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await api.get("/admin/master/export", {
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `master_orders_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Export completed");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export master data");
    } finally {
      setExporting(false);
    }
  };

  // ✅ Load data on mount
  useEffect(() => {
    loadDashboard();
    loadUploads(1);
  }, []);

  useEffect(() => {
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const uploadColumns = [
    { 
      key: "file", 
      label: "File Name",
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" />
          <span className="font-medium text-blue-700 hover:underline">{value}</span>
        </div>
      )
    },
    { key: "user", label: "Uploaded By" },
    {
      key: "status",
      label: "Status",
      render: (value: string) => (
        <Badge
          variant={
            value === "CONVERTED"
              ? "success"
              : value === "FAILED"
              ? "error"
              : "info"
          }
        >
          {value}
        </Badge>
      ),
    },
    { key: "processed", label: "Processed" },
    { key: "failed", label: "Failed" },
    { key: "time", label: "Uploaded At" },
  ];

  const activityColumns = [
    { key: "user", label: "User" },
    { key: "action", label: "Action" },
    {
      key: "status",
      label: "Status",
      render: (value: string) => (
        <Badge variant={value === "Success" ? "success" : "error"}>
          {value}
        </Badge>
      ),
    },
    { key: "time", label: "Time" },
  ];


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">
            Admin Dashboard
          </h1>
          <p className="text-neutral-600 mt-1">
            System-wide overview and management
          </p>
        </div>
        <Badge variant="info">Live Data</Badge>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Users" value={stats?.totalUsers ?? 0} icon={Users} />
       <StatCard
          title="Total Uploads"
          value={stats?.totalUploads ?? 0}
          icon={FileText}
        />

        <StatCard
          title="Failed Uploads"
          value={stats?.failedUploads ?? 0}
          icon={AlertTriangle}
        />

        <StatCard
          title="Success Rate"
          value={`${stats?.successRate ?? 0}%`}
          icon={TrendingUp}
        />
        <StatCard
          title="Successful Conversions"
          value={stats?.successfulConversions ?? 0}
          icon={CheckCircle}
        />
      </div>

      {/* Master Data Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Customers" value={stats?.customers ?? 0} icon={Users} />
        <StatCard title="Total Products" value={stats?.products ?? 0} icon={Database} />
        <StatCard title="Total Schemes" value={stats?.schemes ?? 0} icon={Map} />
      </div>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Recent Uploads</h3>

        {uploads.length === 0 ? (
          <p className="text-sm text-neutral-500">No uploads yet</p>
        ) : (
          <Table 
            columns={uploadColumns} 
            data={uploads} 
            onRowClick={handleUploadClick} // ✅ Make clickable
          />
        )}

        <div className="flex justify-between items-center mt-4">
          <Button
            size="sm"
            variant="secondary"
            disabled={!pagination?.hasPrev}
            onClick={() => loadUploads(page - 1)}
          >
            Previous
          </Button>

          <span className="text-sm text-neutral-600">
            Page {pagination?.page} of {pagination?.totalPages}
          </span>

          <Button
            size="sm"
            variant="secondary"
            disabled={!pagination?.hasNext}
            onClick={() => loadUploads(page + 1)}
          >
            Next
          </Button>
        </div>
      </Card>

      {/* ✅ RESULT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg">
                {selectedUpload ? `Result: ${selectedUpload.fileName}` : "Loading..."}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 font-bold text-xl">✕</button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-auto bg-gray-50/50">
              {isLoadingResult || !selectedUpload ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <div className="text-xs text-blue-500 uppercase font-semibold mb-1">Processed</div>
                      <div className="text-2xl font-bold text-blue-700">{selectedUpload.stats.processed} <span className="text-sm font-normal text-blue-600">Items</span></div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                      <div className="text-xs text-green-500 uppercase font-semibold mb-1">Schemes Applied</div>
                      <div className="text-2xl font-bold text-green-700">{selectedUpload.stats.schemeCount}</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                      <div className="text-xs text-red-500 uppercase font-semibold mb-1">Failed</div>
                      <div className="text-2xl font-bold text-red-700">{selectedUpload.stats.failed} <span className="text-sm font-normal text-red-600">Items</span></div>
                    </div>
                  </div>

                  {/* Data Table */}
                  <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-100 uppercase text-xs font-semibold text-gray-600">
                        <tr>
                          <th className="px-4 py-3 border-b">Item Name (Input)</th>
                          <th className="px-4 py-3 border-b">Matched As</th>
                          <th className="px-4 py-3 border-b w-24">Qty</th>
                          <th className="px-4 py-3 border-b w-32">Free Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedUpload.result?.rows?.slice(0, 500).map((row: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="px-4 py-2 border-r text-gray-700">{row.ITEMDESC || row["Item Description"]}</td>
                            <td className="px-4 py-2 border-r font-medium text-gray-900">{row.MATCHED_PRODUCT || "-"}</td>
                            <td className="px-4 py-2 border-r text-center">{row.ORDERQTY || row.Qty}</td>
                            <td className={`px-4 py-2 text-center font-bold ${row.FREEQTY > 0 ? "text-green-600" : "text-gray-400"}`}>
                              {row.FREEQTY || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    <div className="p-3 bg-gray-50 border-t text-center text-xs text-gray-500">
                      Showing first 500 rows.
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
