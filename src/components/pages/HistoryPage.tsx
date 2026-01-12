import React, { useState, useEffect } from 'react';
import { Search, Download, Eye, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../Card';
import { Button } from '../Button';
import { Input } from '../Input';
import { Dropdown } from '../Dropdown';
import { Table } from '../Table';
import { Badge } from '../Badge';
import { Modal } from '../Modal';
import api from '../../services/api';
import { toast } from 'sonner';
import { downloadOrderFile } from '../../services/orderApi';

export function HistoryPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(fetchHistory, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter]);

  const fetchHistory = async () => {
    try {
      const res = await api.get("/orders/history", {
        params: {
          search: searchTerm,
          status: statusFilter === "all" ? "all" : statusFilter.toUpperCase(),
        },
      });
      setHistory(res.data.history);
    } catch {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (row: any) => {
    navigate(`/result/${row.id}`);
  };

  const handleViewLog = (row: any) => {
    setSelectedLog(row);
    setIsModalOpen(true);
  };

  const handleDownload = async (uploadId: string) => {
    if (!uploadId) return;

    try {
      setDownloading(uploadId);
      await downloadOrderFile(uploadId);
      toast.success("File downloaded successfully");
    } catch (err: any) {
      console.error("Download error:", err);
      toast.error("Failed to download file");
    } finally {
      setDownloading(null);
    }
  };

  const columns = [
    { 
      key: 'fileName', 
      label: 'File Name',
      render: (value: string, row: any) => (
        <button
          onClick={() => handleViewDetails(row)}
          className="text-primary-600 hover:text-primary-700 hover:underline text-left"
        >
          {value}
        </button>
      )
    },
    { 
      key: 'uploadDate', 
      label: 'Upload Date',
      render: (value: string) => new Date(value).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <Badge
          variant={
            value === "CONVERTED" ? "success" 
            : value === "FAILED" ? "error" 
            : "neutral"
          }
        >
          {value}
        </Badge>
      )
    },
    {
      key: 'recordsProcessed',
      label: 'Processed',
      render: (value: number, row: any) => (
        <span>{value} / {value + (row.recordsFailed ?? 0)}</span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleViewLog(row);
            }}
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </Button>
          {row.status === "CONVERTED" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(row.id);
              }}
              disabled={downloading === row.id}
              title="Download File"
            >
              {downloading === row.id ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      )
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-neutral-600">Loading order history…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Order History</h1>
        <p className="text-neutral-600 mt-1">View and manage your past file conversions</p>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <Input
                type="text"
                placeholder="Search by file name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Dropdown
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'converted', label: 'Converted' },
              { value: 'failed', label: 'Failed' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <p className="text-sm text-neutral-600 mb-1">Total Conversions</p>
          <p className="text-2xl font-semibold text-neutral-900">{history.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-neutral-600 mb-1">Successful</p>
          <p className="text-2xl font-semibold text-success-600">
            {history.filter(h => h.status === "CONVERTED").length}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-neutral-600 mb-1">Failed</p>
          <p className="text-2xl font-semibold text-error-600">
            {history.filter(h => h.status === "FAILED").length}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-neutral-600 mb-1">Total Records</p>
          <p className="text-2xl font-semibold text-neutral-900">
            {history.reduce((acc, h) => acc + (h.recordsProcessed || 0), 0)}
          </p>
        </Card>
      </div>

      {/* History Table */}
      <Card padding="none">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900">Conversion History</h3>
            <div className="text-sm text-neutral-600">
              {history.length} total conversion{history.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        {history.length > 0 ? (
          <>
            <Table columns={columns} data={history} />
            <div className="p-4 border-t border-neutral-200 bg-neutral-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-600">
                  Showing {history.length} conversion{history.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-neutral-500">
            <p>No conversions found</p>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => navigate('/upload')}
              className="mt-4"
            >
              Upload a File
            </Button>
          </div>
        )}
      </Card>

      {/* Log Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Conversion Details"
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-neutral-600 mb-1">File Name</p>
                <p className="font-medium text-neutral-900">{selectedLog.fileName}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-600 mb-1">Status</p>
                <Badge variant={selectedLog.status === "CONVERTED" ? "success" : "error"}>
                  {selectedLog.status === "CONVERTED" ? "Success" : "Failed"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-neutral-600 mb-1">Upload Date</p>
                <p className="font-medium text-neutral-900">
                  {new Date(selectedLog.uploadDate).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-600 mb-1">Processing Time</p>
                <p className="font-medium text-neutral-900">
                  {selectedLog.processingTime && selectedLog.processingTime !== '-' 
                    ? typeof selectedLog.processingTime === 'number'
                      ? `${(selectedLog.processingTime / 1000).toFixed(2)}s`
                      : selectedLog.processingTime
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-600 mb-1">Records Processed</p>
                <p className="font-medium text-neutral-900">{selectedLog.recordsProcessed}</p>
              </div>
              <div>
                <p className="text-sm text-neutral-600 mb-1">Records Failed</p>
                <p className="font-medium text-neutral-900">
                  {selectedLog.recordsFailed ?? 0}
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-neutral-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsModalOpen(false);
                  handleViewDetails(selectedLog);
                }}
                className="flex-1"
              >
                View Full Details
              </Button>
              {selectedLog.status === "CONVERTED" && (
                <Button
                  variant="primary"
                  onClick={() => handleDownload(selectedLog.id)}
                  disabled={downloading === selectedLog.id}
                  className="flex-1 inline-flex items-center justify-center gap-2"
                >
                  {downloading === selectedLog.id ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download File
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}