/**
 * SCHEME TABLE - FIXED VERSION
 * Fixes: Data display, search functionality, proper field mapping
 */
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { masterDataApi } from "../../services/masterDataApi";
import { Button } from "../Button";
import { Card } from "../Card";
import { Input } from "../Input";
import { Trash2, Edit2, Plus, Eye, RefreshCw } from "lucide-react";
import { CustomModal } from "../Modal";

interface Scheme {
  _id: string;
  productCode: string;
  productName: string;
  division: string;
  minQty: number;
  freeQty: number;
  schemePercent: number;
  isActive?: boolean;
}

interface SchemeTableProps {
  refreshTrigger?: number;
}

export function SchemeTable({ refreshTrigger }: SchemeTableProps) {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paginating, setPaginating] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editingScheme, setEditingScheme] = useState<Scheme | null>(null);
  const [formData, setFormData] = useState<Partial<Scheme>>({
    productCode: "",
    productName: "",
    division: "",
    minQty: 0,
    freeQty: 0,
    schemePercent: 0,
    isActive: true
  });

  const loadSchemes = async () => {
    try {
      if (!loading) {
        setPaginating(true);
      }
      const res = await masterDataApi.getSchemes(search, page, limit);
      
      console.log("Schemes API Response:", res); // Debug log
      
      // ✅ HANDLE DIFFERENT RESPONSE STRUCTURES
      const schemeData = res.data?.data || res.data || [];
      const schemeTotal = res.data?.total || res.total || 0;
      
      setSchemes(Array.isArray(schemeData) ? schemeData : []);
      setTotal(schemeTotal);
      
      console.log(`Loaded ${schemeData.length} schemes`);
    } catch (err) {
      console.error("Scheme load error:", err);
      toast.error("Failed to load schemes");
      setSchemes([]);
    } finally {
      setLoading(false);
      setPaginating(false);
    }
  };

  useEffect(() => {
    loadSchemes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page, search, refreshTrigger]);

  const openCreate = () => {
    setEditingScheme(null);
    setViewMode(false);
    setFormData({
      productCode: "",
      productName: "",
      division: "",
      minQty: 0,
      freeQty: 0,
      schemePercent: 0,
      isActive: true
    });
    setIsModalOpen(true);
  };

  const openView = (scheme: Scheme) => {
    setEditingScheme(scheme);
    setViewMode(true);
    setFormData(scheme);
    setIsModalOpen(true);
  };

  const openEdit = (scheme: Scheme) => {
    setEditingScheme(scheme);
    setViewMode(false);
    setFormData(scheme);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.productCode?.trim() || !formData.productName?.trim()) {
        toast.error("Product code and name are required");
        return;
      }

      if (editingScheme) {
        await masterDataApi.updateScheme(editingScheme._id, formData);
        toast.success("Scheme updated");
      } else {
        await masterDataApi.createScheme(formData);
        toast.success("Scheme created");
      }

      setIsModalOpen(false);
      loadSchemes();
    } catch (err: any) {
      console.error("Scheme save error:", err);
      toast.error(err.response?.data?.error || "Operation failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this scheme?")) return;

    try {
      await masterDataApi.deleteScheme(id);
      toast.success("Scheme deleted");
      loadSchemes();
    } catch (err) {
      console.error("Scheme delete error:", err);
      toast.error("Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-neutral-50 z-50 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
        <div className="text-center">
          <p className="text-lg font-medium text-neutral-700">Loading schemes</p>
          <p className="text-sm text-neutral-500 mt-1">Please wait...</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <Card>
      {paginating && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
            <p className="text-sm font-medium text-neutral-700">Loading page {page}...</p>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">
          Schemes ({total})
        </h3>
        <div className="flex gap-2">
            <input
                type="file"
                accept=".xlsx,.xls,.csv"
                id="schemeFileInput"
                className="hidden"
                onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                        const loadingToast = toast.loading("Uploading schemes...");
                        await masterDataApi.uploadSchemes(file);
                        toast.dismiss(loadingToast);
                        toast.success("Schemes uploaded successfully");
                        loadSchemes();
                    } catch (err: any) {
                        toast.error(err.response?.data?.error || "Upload failed");
                    }
                }}
            />
            <Button size="sm" variant="secondary" onClick={() => document.getElementById("schemeFileInput")?.click()}>
                Import
            </Button>
            <Button size="sm" variant="secondary" onClick={async () => {
                const toastId = toast.loading("Exporting...");
                try {
                    await masterDataApi.exportSchemes();
                    toast.dismiss(toastId);
                    toast.success("Export started");
                } catch {
                     toast.dismiss(toastId);
                     toast.error("Export failed");
                }
            }}>
                Export
            </Button>
            <Button size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" /> Add Scheme
            </Button>
        </div>
      </div>

      <Input
        placeholder="Search product code or name"
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setPage(1); // Reset to first page on search
        }}
        className="mb-3"
      />

      <div className={`overflow-x-auto ${paginating ? 'opacity-50 pointer-events-none' : ''}`}>
        <table className="w-full text-sm">
          <thead className="bg-neutral-100">
            <tr className="border-b">
              <th className="text-left p-2">Product Code</th>
              <th className="text-left p-2">Product Name</th>
              <th className="text-left p-2">Division</th>
              <th className="text-center p-2">Min Qty</th>
              <th className="text-center p-2">Free Qty</th>
              <th className="text-center p-2">Scheme %</th>
              <th className="text-center p-2">Active</th>
              <th className="text-right p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schemes.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center p-8 text-neutral-500">
                  {search ? "No schemes found matching your search" : "No schemes configured yet"}
                </td>
              </tr>
            ) : (
              schemes.map(s => (
                <tr key={s._id} className="border-b hover:bg-neutral-50">
                  <td className="p-2 font-mono text-xs">{s.productCode}</td>
                  <td className="p-2">{s.productName}</td>
                  <td className="p-2">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                      {s.division}
                    </span>
                  </td>
                  <td className="p-2 text-center">{s.minQty || 0}</td>
                  <td className="p-2 text-center">{s.freeQty || 0}</td>
                  <td className="p-2 text-center">
                    {s.schemePercent ? `${s.schemePercent}%` : "-"}
                  </td>
                  <td className="p-2 text-center">
                    {s.isActive ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-red-600">✗</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => openView(s)} 
                        className="text-blue-600 hover:text-blue-700"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => openEdit(s)} 
                        className="text-green-600 hover:text-green-700"
                        title="Edit scheme"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(s._id)} 
                        className="text-red-600 hover:text-red-700"
                        title="Delete scheme"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <p className="text-sm text-neutral-600">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} schemes
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || paginating}
            >
              Previous
            </Button>
            <Button
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || paginating}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ✅ MODAL */}
      <CustomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          viewMode 
            ? "Scheme Details" 
            : editingScheme 
            ? "Edit Scheme" 
            : "Add Scheme"
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {viewMode ? "Close" : "Cancel"}
            </Button>
            {!viewMode && (
              <Button onClick={handleSave}>
                {editingScheme ? "Update" : "Create"}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Product Code</label>
            <Input
              value={formData.productCode || ""}
              onChange={e => setFormData({ ...formData, productCode: e.target.value })}
              disabled={viewMode}
              placeholder="SAP Product Code"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Product Name</label>
            <Input
              value={formData.productName || ""}
              onChange={e => setFormData({ ...formData, productName: e.target.value })}
              disabled={viewMode}
              placeholder="Product Name"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Division</label>
            <Input
              value={formData.division || ""}
              onChange={e => setFormData({ ...formData, division: e.target.value })}
              disabled={viewMode}
              placeholder="e.g., CAR1, GTF1"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Min Qty</label>
              <Input
                type="number"
                value={formData.minQty || 0}
                onChange={e => setFormData({ ...formData, minQty: Number(e.target.value) })}
                disabled={viewMode}
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Free Qty</label>
              <Input
                type="number"
                value={formData.freeQty || 0}
                onChange={e => setFormData({ ...formData, freeQty: Number(e.target.value) })}
                disabled={viewMode}
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Scheme %</label>
              <Input
                type="number"
                value={formData.schemePercent || 0}
                onChange={e => setFormData({ ...formData, schemePercent: Number(e.target.value) })}
                disabled={viewMode}
                placeholder="0"
              />
            </div>
          </div>

          {!viewMode && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive !== false}
                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4"
              />
              <label className="text-sm">Active</label>
            </div>
          )}
        </div>
      </CustomModal>
    </Card>
  );
}