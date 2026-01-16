import React, { useEffect, useState } from 'react';
import { Upload, FileText, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../Card';
import { Button } from '../Button';
import { StatCard } from '../StatCard';
import { Table } from '../Table';
import { Badge } from '../Badge';
import api from '../../services/api';
import { toast } from 'sonner';

export function UserDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recentUploads, setRecentUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get("/user/dashboard");
      setStats(res.data.stats);
      setRecentUploads(res.data.recentUploads);
    } catch (err: any) {
      console.error('Dashboard error:', err);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { 
      key: 'fileName', 
      label: 'File Name',
      render: (value: string, row: any) => (
        <button
          onClick={() => navigate(`/result/${row.id}`)}
          className="text-primary-600 hover:text-primary-700 hover:underline text-left"
        >
          {value}
        </button>
      )
    },
    {
      key: 'createdAt',
      label: 'Upload Date',
      render: (value: any, row: any) => {
        const dateValue = value || row.uploadDate || row.createdAtText;
        if (!dateValue) return <span className="text-neutral-400">-</span>;
        
        // If it's the pre-formatted text from backend, use it
        if (typeof dateValue === 'string' && dateValue.includes(',')) {
          return dateValue;
        }

        const date = new Date(dateValue);
        return isNaN(date.getTime()) ? (
          <span className="text-neutral-400">Invalid Date</span>
        ) : (
          date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => {
        if (value === "CONVERTED") return <Badge variant="success">Success</Badge>;
        if (value === "FAILED") return <Badge variant="error">Failed</Badge>;
        return <Badge variant="neutral">{value || "Processing"}</Badge>;
      },
    },
    { 
      key: 'recordsProcessed', 
      label: 'Records',
      render: (value: any, row: any) => (
        <span>{value ?? row.processed ?? row.successCount ?? 0}</span>
      )
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-neutral-600">Loading dashboard...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-4 bg-error-50 border border-error-200 rounded-lg">
        <p className="text-error-700">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Dashboard</h1>
          <p className="text-neutral-600 mt-1">Welcome back! Here's your conversion overview</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/upload')}>
          <Upload className="w-4 h-4" />
          Upload Order
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Uploads"
          value={stats.totalUploads || 0}
          icon={FileText}
          color="primary"
        />
        <StatCard
          title="Successful"
          value={stats.successCount || 0}
          icon={CheckCircle}
          color="success"
        />
        <StatCard
          title="Failed"
          value={stats.failedCount || 0}
          icon={XCircle}
          color="error"
        />
        <StatCard
          title="Records Processed"
          value={stats.recordsProcessed || 0}
          icon={TrendingUp}
          color="success"
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center gap-3 p-4 border border-neutral-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all group"
          >
            <div className="p-2 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
              <Upload className="w-5 h-5 text-primary-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-neutral-900">New Upload</p>
              <p className="text-sm text-neutral-600">Upload order files</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/history')}
            className="flex items-center gap-3 p-4 border border-neutral-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all group"
          >
            <div className="p-2 bg-secondary-100 rounded-lg group-hover:bg-secondary-200 transition-colors">
              <FileText className="w-5 h-5 text-secondary-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-neutral-900">View History</p>
              <p className="text-sm text-neutral-600">Check past conversions</p>
            </div>
          </button>

          <button 
            onClick={() => {
              toast.info('Template download coming soon');
            }}
            className="flex items-center gap-3 p-4 border border-neutral-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all group"
          >
            <div className="p-2 bg-warning-100 rounded-lg group-hover:bg-warning-200 transition-colors">
              <FileText className="w-5 h-5 text-warning-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-neutral-900">Template</p>
              <p className="text-sm text-neutral-600">Download template</p>
            </div>
          </button>
        </div>
      </Card>

      {/* Recent Uploads Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900">Recent Uploads</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
            View All
          </Button>
        </div>
        {recentUploads.length > 0 ? (
          <Table columns={columns} data={recentUploads} />
        ) : (
          <div className="text-center py-8 text-neutral-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
            <p>No uploads yet</p>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => navigate('/upload')}
              className="mt-4"
            >
              Upload Your First File
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
