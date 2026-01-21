import React, { useEffect, useState } from "react";
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
const [stats, setStats] = useState<DashboardStats | null>(null);

  const [alerts, setAlerts] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

const [exporting, setExporting] = useState(false);

const [uploads, setUploads] = useState<any[]>([]);
const [page, setPage] = useState(1);
const [pagination, setPagination] = useState<any>(null);



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

const loadUploads = async (pageNo = 1) => {
  const res = await api.get("/admin/master/audits", {
    params: { page: pageNo, limit: 10 },
  });

  setUploads(
    res.data.data.map((u: any) => ({
      file: u.fileName,
      user: u.user.email,
      status: u.status,
      processed: u.stats?.matched || 0,
      failed: u.stats?.unmatched || 0,
      time: new Date(u.uploadDate).toLocaleString(),
    }))
  );

  setPagination(res.data.pagination);
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
  { key: "file", label: "File Name" },
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
    <div className="space-y-4 sm:space-y-6 min-h-screen bg-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">
            Admin Dashboard
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 mt-1">
            System-wide overview and management
          </p>
        </div>
        <Badge variant="info">Live Data</Badge>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
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
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <StatCard
          title="Successful Conversions"
          value={stats?.successfulConversions ?? 0}
          icon={CheckCircle}
        />
        <StatCard title="Total Customers" value={stats?.customers ?? 0} icon={Users} />
        <StatCard title="Total Products" value={stats?.products ?? 0} icon={Database} />
      </div>

      {/* Schemes */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:gap-6">
        <StatCard title="Total Schemes" value={stats?.schemes ?? 0} icon={Map} />
      </div>



      {/* Alerts */}
      {/* <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">System Alerts</h3>
          <Badge variant="error">
            {alerts.filter(a => a.type === "error").length} Critical
          </Badge>
        </div>

        <div className="space-y-3">
          {alerts.length === 0 && (
            <p className="text-sm text-neutral-500">No alerts 🎉</p>
          )}

          {alerts.map(alert => (
            <div
              key={alert._id}
              className={`p-4 border rounded-lg ${
                alert.type === "error"
                  ? "bg-error-50 border-error-200"
                  : alert.type === "warning"
                  ? "bg-warning-50 border-warning-200"
                  : "bg-primary-50 border-primary-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 mt-1" />
                <div className="flex-1">
                  <p className="font-medium">{alert.message}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-sm text-neutral-600">{alert.time}</span>
                    <Badge variant="neutral">{alert.count} affected</Badge>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card> */}

      {/* Quick Access */}
     
       
{/* 
        <div onClick={() => onNavigate("master-data")} className="cursor-pointer">
          <Card>
            <Database className="w-6 h-6 text-secondary-600" />
            <p className="font-semibold mt-2">Master Data</p>
          </Card>
        </div> */}

       
      

      {/* Activity */}
      {/* <Card>
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <Table columns={activityColumns} data={recentActivity} />
      </Card> */}
<Card>
  <h3 className="text-base sm:text-lg font-semibold mb-4">Recent Uploads</h3>

  {uploads.length === 0 ? (
    <p className="text-sm text-neutral-500">No uploads yet</p>
  ) : (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden">
          <Table columns={uploadColumns} data={uploads} />
        </div>
      </div>
    </div>
  )}

  <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4">
    <Button
      size="sm"
      variant="secondary"
      disabled={!pagination?.hasPrev}
      onClick={() => loadUploads(page - 1)}
      className="w-full sm:w-auto"
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
      className="w-full sm:w-auto"
    >
      Next
    </Button>
  </div>
</Card>


    </div>
  );
}
