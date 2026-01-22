import React, { useState, useEffect } from 'react';
import { Search, Download, Eye, RefreshCw, FileText, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../Card';
import { Button } from '../Button';
import { Input } from '../Input';
import { Dropdown } from '../Dropdown';
import { Table } from '../Table';
import { Badge } from '../Badge';
import { CustomModal } from '../Modal';
import api from '../../services/api';
import { toast } from 'sonner';
import { downloadOrderFile } from '../../services/orderApi';
import { FileViewerModal } from '../modals/FileViewerModal';
import { ViewEditConvertedModal } from '../modals/ViewEditConvertedModal';
import { ViewEditSchemeModal } from '../modals/ViewEditSchemeModal';

export function HistoryPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{id: string, fileName?: string} | null>(null);
  const [editingConverted, setEditingConverted] = useState<{id: string, fileName?: string} | null>(null);
  const [editingScheme, setEditingScheme] = useState<{id: string, fileName?: string} | null>(null);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  // Debounced State
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [debouncedStatus, setDebouncedStatus] = useState(statusFilter);
  const [stats, setStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    records: 0
  });

  // Debounce search/filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchTerm);
      setDebouncedStatus(statusFilter);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter]);

  // Fetch when page or debounced params change
  useEffect(() => {
    fetchHistory();
  }, [page, debouncedSearch, debouncedStatus]);

  const fetchHistory = async () => {
    try {
      const res = await api.get("/orders/history", {
        params: {
          page,
          limit: 20,
          search: debouncedSearch,
          status: debouncedStatus === "all" ? "all" : debouncedStatus.toUpperCase(),
        },
      });

      // ✅ Correctly update history list
      setHistory(Array.isArray(res.data?.history) ? res.data.history : []);
      
      // Update pagination meta
      if (res.data?.pagination) {
        setPagination(res.data.pagination);
      }
      
      // ✅ Correctly update stats from backend global counts
      if (res.data?.stats) {
        setStats({
            total: res.data.stats.total || 0,
            successful: res.data.stats.successful || 0,
            failed: res.data.stats.failed || 0,
            records: res.data.stats.records || 0
        });
      }

    } catch (err) {
      console.error("History fetch failed:", err);
      toast.error("Failed to load history");
      setHistory([]);
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

  const handleDownload = async (uploadId: string, fileName?: string, type?: string) => {
    if (!uploadId) return;

    try {
      const loadingKey = type ? `${uploadId}-${type}` : uploadId;
      setDownloading(loadingKey);
      await downloadOrderFile(uploadId, fileName, type as any);
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
      key: 'createdAt', 
      label: 'Upload Date',
      render: (value: any, row: any) => {
        const dateValue = value || row.uploadDate || row.createdAtText;
        if (!dateValue) return <span className="text-neutral-400">N/A</span>;
        
        if (typeof dateValue === 'string' && dateValue.includes(',')) {
          return dateValue;
        }

        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return <span className="text-neutral-400 italic">Invalid Date</span>;
        
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
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
          {value || "PROCESSING"}
        </Badge>
      )
    },
    {
      key: 'recordsProcessed',
      label: 'Processed',
      render: (value: any, row: any) => {
        const processed = typeof value === 'number' ? value : (row.processed ?? row.recordsProcessed ?? row.successCount ?? 0);
        const failed = typeof row.recordsFailed === 'number' ? row.recordsFailed : (row.failedCount ?? 0);
        const total = processed + failed;
        
        if (total === 0 && !processed) return <span className="text-neutral-400">0 / 0</span>;
        
        return (
          <div className="flex flex-col">
            <span className="font-medium text-neutral-900">{processed} / {total}</span>
            {failed > 0 && <span className="text-[10px] text-red-500 font-medium">-{failed} errors</span>}
          </div>
        );
      }
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
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingFile({ id: row.id, fileName: row.fileName });
                }}
                title="View File"
              >
                <FileText className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingConverted({ id: row.id, fileName: row.fileName });
                }}
                title="Edit Converted Orders"
              >
                <Edit className="w-4 h-4 text-blue-600" />
              </Button>
              {row.schemeSummary?.count > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingScheme({ id: row.id, fileName: row.fileName });
                  }}
                  title="Edit Schemes"
                >
                  <Edit className="w-4 h-4 text-yellow-600" />
                </Button>
              )}
              
              {/* DOWNLOAD BUTTONS */}
              {row.downloadUrls && row.downloadUrls.length > 0 ? (
                // Multiple files or specific types
                row.downloadUrls.map((dl: any, idx: number) => {
                  const isSheets = dl.type === 'sheets';
                  const isMain = dl.type === 'main';
                  const loadingKey = `${row.id}-${dl.type}`;
                  
                  return (
                    <Button
                      key={idx}
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Correctly pass type
                        handleDownload(row.id, row.fileName, dl.type);
                      }}
                      disabled={downloading === loadingKey || downloading === row.id} // efficient disable
                      title={isSheets ? "Download Sheet Orders" : isMain ? "Download Main Order" : "Download File"}
                      className={isSheets ? "text-green-600" : isMain ? "text-blue-600" : ""}
                    >
                      {downloading === loadingKey ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {/* Optional: Add small label if space permits, or rely on tooltip/color */}
                      {isSheets && <span className="text-[10px] ml-1 font-bold">Sheets</span>}
                      {isMain && <span className="text-[10px] ml-1 font-bold">Main</span>}
                    </Button>
                  );
                })
              ) : (
                // Fallback Single Download
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(row.id, row.fileName);
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
            </>
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

      {/* Summary Stats - NOW DYNAMIC */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <p className="text-sm text-neutral-600 mb-1">Total Conversions</p>
          <p className="text-2xl font-semibold text-neutral-900">{stats.total}</p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-neutral-600 mb-1">Successful</p>
          <p className="text-2xl font-semibold text-success-600">
            {stats.successful}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-neutral-600 mb-1">Failed</p>
          <p className="text-2xl font-semibold text-error-600">
            {stats.failed}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-sm text-neutral-600 mb-1">Total Records</p>
          <p className="text-2xl font-semibold text-neutral-900">
            {stats.records}
          </p>
        </Card>
      </div>

      {/* History Table */}
      <Card padding="none">
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900">Conversion History</h3>
            <div className="text-sm text-neutral-600">
              {stats.total} total conversion{stats.total !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        {history.length > 0 ? (
          <>
            <Table columns={columns} data={history} />
            <div className="p-4 border-t border-neutral-200 bg-neutral-50">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-neutral-600">
                  Showing {history.length} results (Page {page} of {pagination?.totalPages || 1})
                </p>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!pagination?.hasPrev}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!pagination?.hasNext}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
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
      <CustomModal
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
                  {selectedLog.uploadDate ? new Date(selectedLog.uploadDate).toLocaleString() : '-'}
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
                  onClick={() => handleDownload(selectedLog.id, selectedLog.fileName)}
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
      </CustomModal>

      {/* File Viewer Modal */}
      {viewingFile && (
        <FileViewerModal
          isOpen={!!viewingFile}
          onClose={() => setViewingFile(null)}
          orderId={viewingFile.id}
          fileName={viewingFile.fileName}
        />
      )}

      {/* Edit Converted Orders Modal */}
      {editingConverted && (
        <ViewEditConvertedModal
          isOpen={!!editingConverted}
          onClose={() => {
            setEditingConverted(null);
            fetchHistory(); // Refresh history after editing
          }}
          uploadId={editingConverted.id}
          fileName={editingConverted.fileName}
        />
      )}

      {/* Edit Scheme Modal */}
      {editingScheme && (
        <ViewEditSchemeModal
          isOpen={!!editingScheme}
          onClose={() => {
            setEditingScheme(null);
            fetchHistory(); // Refresh history after editing
          }}
          uploadId={editingScheme.id}
          fileName={editingScheme.fileName}
        />
      )}
    </div>
  );
}
