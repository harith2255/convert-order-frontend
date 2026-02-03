import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  Upload,
  Search, // ✅ Import Search
  Trash2, // ✅ Import Trash2
} from "lucide-react";

import { Card } from "../Card";
import { Button } from "../Button";
import { StatCard } from "../StatCard";
import { Table } from "../Table";
import { Badge } from "../Badge";
import { Modal } from "../Modal"; // ✅ Import Modal
import api from "../../services/api";

interface AdminDashboardProps {}

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

export function AdminDashboard({ }: AdminDashboardProps) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [alerts, setAlerts] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const [exporting, setExporting] = useState(false);
  
  // ✅ Date Range Delete State
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false); // ✅ Modal State

  const [uploads, setUploads] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState(""); // ✅ Search State

  // ✅ NEW: Modal State
  // Modal logic replaced by direct navigation to ResultPage
  
  // Modal Filter State


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
  const handleUploadClick = (upload: any) => {
    if(!upload.id) return;
    navigate(`/result/${upload.id}`);
  };

  const loadUploads = async (pageNo = 1, search = searchTerm) => {
    const res = await api.get("/admin/master/audits", {
      params: { page: pageNo, limit: 10, search }, // ✅ Pass search param
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

    const p = res.data.pagination;
    setPagination({
      ...p,
      hasPrev: Number(p.page) > 1,
      hasNext: Number(p.page) < Number(p.totalPages)
    });
    setPage(pageNo);
  };

  // Export button
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

  // ✅ Handle Date Range Delete Trigger
  const handleDeleteTrigger = () => {
    if (!dateRange.start || !dateRange.end) {
      toast.error("Please select both start and end dates");
      return;
    }
    setShowDeleteModal(true); // Open Modal
  };

  // ✅ Confirm Delete Logic
  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await api.delete("/admin/dashboard/uploads/range", {
        data: {
          startDate: dateRange.start,
          endDate: dateRange.end
        }
      });

      if (res.data.success) {
        toast.success(res.data.message);
        loadUploads(1); // Refresh list
        loadDashboard(); // Refresh stats
        setDateRange({ start: "", end: "" }); // Reset
        setShowDeleteModal(false); // Close Modal
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete uploads");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadUploads(1);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadUploads(1, searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Customers" value={stats?.customers ?? 0} icon={Users} />
        <StatCard title="Total Products" value={stats?.products ?? 0} icon={Database} />
        <StatCard title="Total Schemes" value={stats?.schemes ?? 0} icon={Map} />
      </div>

      <Card>
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
          <div className="flex items-left justify-between gap-4">
             <h3 className="text-lg font-semibold">Recent Uploads</h3>
             
             {/* ✅ Date Range Delete Controls */}
             <div className="flex items-center gap-2 bg-red-50 p-2 rounded-lg border border-red-100">
                <input 
                  type="date" 
                  className="px-2 py-1 text-xs border rounded bg-white"
                  value={dateRange.start}
                  onChange={e => setDateRange({...dateRange, start: e.target.value})}
                />
                <span className="text-xs text-neutral-500">to</span>
                <input 
                  type="date" 
                  className="px-2 py-1 text-xs border rounded bg-white"
                  value={dateRange.end}
                  onChange={e => setDateRange({...dateRange, end: e.target.value})}
                />
                <Button 
                  size="sm" 
                  variant="danger" 
                  onClick={handleDeleteTrigger} // ✅ Trigger Modal
                  disabled={isDeleting}
                  className="bg-red-500 hover:bg-red-600 text-white border-none h-8 px-33"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
             </div>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search uploads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

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

      {/* ✅ Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Deletion"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} isLoading={isDeleting}>
              Delete Permanently
            </Button>
          </>
        }
      >
         <div className="space-y-4">
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3">
               <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
               <div>
                  <p className="font-semibold">Warning: Irreversible Action</p>
                  <p className="text-sm mt-1">
                     You are about to delete all uploads between <strong>{dateRange.start}</strong> and <strong>{dateRange.end}</strong>.
                  </p>
               </div>
            </div>
            <p className="text-neutral-600">
               This will permanently remove:
            </p>
            <ul className="list-disc list-inside text-sm text-neutral-600 ml-2 space-y-1">
               <li>Original uploaded files</li>
               <li>Extracted validation data</li>
               <li>Converted output files</li>
               <li>Scheme calculations associated with these uploads</li>
            </ul>
         </div>
      </Modal>


    </div>
  );
}
