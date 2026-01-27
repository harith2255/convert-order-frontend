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
} from "lucide-react";

import { Card } from "../Card";
import { Button } from "../Button";
import { StatCard } from "../StatCard";
import { Table } from "../Table";
import { Badge } from "../Badge";
import api from "../../services/api";

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

  const loadUploads = async (pageNo = 1) => {
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


    </div>
  );
}
