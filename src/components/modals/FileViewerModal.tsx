import React, { useEffect, useState } from 'react';
import { X, Download, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { CustomModal } from '../Modal';
import { Button } from '../Button';
import { Table } from '../Table';
import { Badge } from '../Badge';
import { toast } from 'sonner';
import api from '../../services/api';
import { downloadOrderFile } from '../../services/orderApi';

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  fileName?: string;
}

export function FileViewerModal({ isOpen, onClose, orderId, fileName }: FileViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchFileData();
    }
  }, [isOpen, orderId]);

  const fetchFileData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/orders/${orderId}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch file data:', err);
      toast.error('Failed to load file data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await downloadOrderFile(orderId, fileName);
      toast.success('File downloaded successfully');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  // Define columns for the converted data
  const columns = [
    { key: 'rowNumber', label: 'Row #' },
    { key: 'ITEMDESC', label: 'Product Description' },
    { key: 'SAPCODE', label: 'SAP Code' },
    { key: 'ORDERQTY', label: 'Quantity' },
    { key: 'DVN', label: 'Division' },
    { 
      key: 'matchStatus', 
      label: 'Status',
      render: (value: string) => {
        const variant = value === 'MATCHED' ? 'success' : value === 'MANUAL' ? 'warning' : 'neutral';
        return <Badge variant={variant}>{value || 'AUTO'}</Badge>;
      }
    },
  ];

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={fileName || 'Converted File'}
      size="xl"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-neutral-50 rounded-lg">
            <div>
              <p className="text-sm text-neutral-600">Total Rows</p>
              <p className="text-2xl font-semibold text-neutral-900">
                {data.convertedRows?.length || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-600">Success</p>
              <p className="text-2xl font-semibold text-success-600">
                {data.recordsProcessed || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-600">Warnings</p>
              <p className="text-2xl font-semibold text-warning-600">
                {data.warnings?.length || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-600">Errors</p>
              <p className="text-2xl font-semibold text-error-600">
                {data.errors?.length || 0}
              </p>
            </div>
          </div>

          {/* Converted Data Table */}
          {data.convertedRows && data.convertedRows.length > 0 ? (
            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-96">
                <Table columns={columns} data={data.convertedRows} />
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-500">
              <p>No converted data available</p>
            </div>
          )}

          {/* Scheme Summary (if available) */}
          {data.schemeSummary && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="font-semibold text-amber-900 mb-2">Scheme Summary</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-amber-700">Schemes Applied</p>
                  <p className="text-lg font-semibold text-amber-900">
                    {data.schemeSummary.count || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-amber-700">Total Free Qty</p>
                  <p className="text-lg font-semibold text-amber-900">
                    {data.schemeSummary.totalFreeQty || 0}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2"
            >
              {downloading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Excel
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-neutral-500">
          <p>No data available</p>
        </div>
      )}
    </CustomModal>
  );
}
