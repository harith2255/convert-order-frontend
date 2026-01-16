import { useState, useEffect } from "react";
import { toast } from "sonner";
import { masterDataApi } from "../../services/masterDataApi";
import { Button } from "../Button";
import { Card } from "../Card";
import { Input } from "../Input";
import { Trash2, Edit2, Plus, Eye } from "lucide-react";
import { CustomModal } from "../Modal";

interface Scheme {
  _id: string;
  schemeCode: string;
  schemeName: string;
  description?: string;
  validFrom?: string;
  validTo?: string;
  isActive?: boolean;
}

export function SchemeTable() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editingScheme, setEditingScheme] = useState<Scheme | null>(null);
  const [formData, setFormData] = useState<Partial<Scheme>>({
    schemeCode: "",
    schemeName: "",
    description: "",
    validFrom: "",
    validTo: "",
    isActive: true
  });

  const loadSchemes = async () => {
    try {
      setLoading(true);
      const res = await masterDataApi.getSchemes(search, page, limit);
      setSchemes(res.data || []);
      setTotal(res.total || 0);
    } catch {
      toast.error("Failed to load schemes");
      setSchemes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchemes();
  }, [page, search]);

  const openCreate = () => {
    setEditingScheme(null);
    setViewMode(false);
    setFormData({
      schemeCode: "",
      schemeName: "",
      description: "",
      validFrom: "",
      validTo: "",
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
      if (!formData.schemeCode?.trim() || !formData.schemeName?.trim()) {
        toast.error("Scheme code and name are required");
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
      toast.error(err.response?.data?.error || "Operation failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this scheme?")) return;

    try {
      await masterDataApi.deleteScheme(id);
      toast.success("Scheme deleted");
      loadSchemes();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <Card>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">Schemes</h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add Scheme
        </Button>
      </div>

      <Input
        placeholder="Search scheme code or name"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Code</th>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Active</th>
              <th className="text-right p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center p-4">Loading…</td></tr>
            ) : schemes.length === 0 ? (
              <tr><td colSpan={4} className="text-center p-4 text-neutral-500">No schemes found</td></tr>
            ) : (
              schemes.map(s => (
                <tr key={s._id} className="border-b hover:bg-neutral-50">
                  <td className="p-2">{s.schemeCode}</td>
                  <td className="p-2">{s.schemeName}</td>
                  <td className="p-2">
                    {s.isActive ? "Yes" : "No"}
                  </td>
                  <td className="p-2 text-right">
                    <button onClick={() => openView(s)} className="text-green-600 mr-2">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(s)} className="text-blue-600 mr-2">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(s._id)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <CustomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={viewMode ? "Scheme Details" : editingScheme ? "Edit Scheme" : "Add Scheme"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {viewMode ? "Close" : "Cancel"}
            </Button>
            {!viewMode && <Button onClick={handleSave}>Save</Button>}
          </>
        }
      >
        <div className="space-y-3">
          <Input
            value={formData.schemeCode || ""}
            onChange={e => setFormData({ ...formData, schemeCode: e.target.value })}
            disabled={viewMode || !!editingScheme}
            placeholder="Scheme Code"
          />
          <Input
            value={formData.schemeName || ""}
            onChange={e => setFormData({ ...formData, schemeName: e.target.value })}
            disabled={viewMode}
            placeholder="Scheme Name"
          />
          <Input
            value={formData.description || ""}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            disabled={viewMode}
            placeholder="Description"
          />
          <Input
            value={formData.validFrom || ""}
            onChange={e => setFormData({ ...formData, validFrom: e.target.value })}
            disabled={viewMode}
            placeholder="Valid From (DD/MM/YYYY)"
          />
          <Input
            value={formData.validTo || ""}
            onChange={e => setFormData({ ...formData, validTo: e.target.value })}
            disabled={viewMode}
            placeholder="Valid To (DD/MM/YYYY)"
          />
        </div>
      </CustomModal>
    </Card>
  );
}
