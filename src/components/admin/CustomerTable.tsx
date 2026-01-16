import { useState, useEffect } from "react";
import { toast } from "sonner";
import { masterDataApi } from "../../services/masterDataApi";
import { Button } from "../Button";
import { Card } from "../Card";
import { Input } from "../Input";
import { Trash2, Edit2, Plus, Eye } from "lucide-react";
import { CustomModal } from "../Modal";

interface Customer {
  _id: string;
  customerCode: string;
  customerType?: string;
  customerName: string;
  address1?: string;
  address2?: string;
  address3?: string;
  city?: string;
  pinCode?: string;
  state?: string;
  contactPerson?: string;
  phoneNo1?: string;
  phoneNo2?: string;
  mobileNo?: string;
  drugLicNo?: string;
  drugLicFromDt?: string;
  drugLicToDt?: string;
  drugLicNo1?: string;
  drugLicFromDt1?: string;
  drugLicToDt1?: string;
  gstNo?: string;
  email?: string;
}

export function CustomerTable() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({
    customerCode: "",
    customerType: "",
    customerName: "",
    address1: "",
    address2: "",
    address3: "",
    city: "",
    pinCode: "",
    state: "",
    contactPerson: "",
    phoneNo1: "",
    phoneNo2: "",
    mobileNo: "",
    drugLicNo: "",
    drugLicFromDt: "",
    drugLicToDt: "",
    drugLicNo1: "",
    drugLicFromDt1: "",
    drugLicToDt1: "",
    gstNo: "",
    email: "",
  });

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const res = await masterDataApi.getCustomers(search, page, limit);
      setCustomers(res.data || []);
      setTotal(res.total || 0);
    } catch {
      toast.error("Failed to load customers");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    loadCustomers();
  }, [page, search]);

  const handleCreate = () => {
    setEditingCustomer(null);
    setViewMode(false);
    setFormData({
      customerCode: "",
      customerType: "",
      customerName: "",
      address1: "",
      address2: "",
      address3: "",
      city: "",
      pinCode: "",
      state: "",
      contactPerson: "",
      phoneNo1: "",
      phoneNo2: "",
      mobileNo: "",
      drugLicNo: "",
      drugLicFromDt: "",
      drugLicToDt: "",
      drugLicNo1: "",
      drugLicFromDt1: "",
      drugLicToDt1: "",
      gstNo: "",
      email: "",
    });
    setIsModalOpen(true);
  };

  const handleView = (customer: Customer) => {
    setEditingCustomer(customer);
    setViewMode(true);
    setFormData(customer);
    setIsModalOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setViewMode(false);
    setFormData(customer);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.customerCode?.trim() || !formData.customerName?.trim()) {
        toast.error("Customer code and name are required");
        return;
      }

      if (editingCustomer) {
        await masterDataApi.updateCustomer(editingCustomer._id, formData);
        toast.success("Customer updated");
      } else {
        await masterDataApi.createCustomer(formData);
        toast.success("Customer created");
      }

      setIsModalOpen(false);
      loadCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Operation failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this customer?")) return;

    try {
      await masterDataApi.deleteCustomer(id);
      toast.success("Customer deleted");
      loadCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Delete failed");
    }
  };

  return (
    <Card>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">Customers</h3>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-1" />
          Add Customer
        </Button>
      </div>

      <Input
        placeholder="Search customer name, code, city, or state"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Code</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">City</th>
              <th className="text-left p-2">State</th>
              <th className="text-right p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center p-4">
                  Loading...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-4 text-neutral-500">
                  No customers found
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer._id} className="border-b hover:bg-neutral-50">
                  <td className="p-2">{customer.customerCode}</td>
                  <td className="p-2">{customer.customerType || "-"}</td>
                  <td className="p-2">{customer.customerName}</td>
                  <td className="p-2">{customer.city || "-"}</td>
                  <td className="p-2">{customer.state || "-"}</td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => handleView(customer)}
                      className="text-green-600 hover:text-green-800 mr-2"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(customer)}
                      className="text-blue-600 hover:text-blue-800 mr-2"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(customer._id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </Button>
        <span className="px-3 py-2 text-sm">
          Page {page} of {Math.ceil(total / limit) || 1}
        </span>
        <Button
          disabled={page * limit >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>

      {/* Modal */}
      <CustomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={viewMode ? "Customer Details" : editingCustomer ? "Edit Customer" : "Add Customer"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {viewMode ? "Close" : "Cancel"}
            </Button>
            {!viewMode && <Button onClick={handleSave}>Save</Button>}
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {/* Basic Info */}
          <div className="md:col-span-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">
            Basic Information
          </div>

          <div className="space-y-0.5">
            <label className="block text-[11px] font-semibold text-neutral-600 ml-1">
              Customer Code <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.customerCode || ""}
              onChange={(e) =>
                setFormData({ ...formData, customerCode: e.target.value })
              }
              disabled={viewMode || !!editingCustomer}
              placeholder="e.g., C5001"
              className="bg-neutral-50 h-9 text-sm"
            />
          </div>

          <div className="space-y-0.5">
            <label className="block text-[11px] font-semibold text-neutral-600 ml-1">
              Customer Type
            </label>
            <Input
              value={formData.customerType || ""}
              onChange={(e) =>
                setFormData({ ...formData, customerType: e.target.value })
              }
              disabled={viewMode}
              placeholder="e.g., Stockiest"
              className="bg-neutral-50 h-9 text-sm"
            />
          </div>

          <div className="md:col-span-2 space-y-0.5">
            <label className="block text-[11px] font-semibold text-neutral-600 ml-1">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.customerName || ""}
              onChange={(e) =>
                setFormData({ ...formData, customerName: e.target.value })
              }
              disabled={viewMode}
              placeholder="Enter full customer name"
              className="bg-neutral-50 h-9 text-sm"
            />
          </div>

          {/* Address */}
          <div className="md:col-span-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mt-2 mb-0.5">
            Location & Contact
          </div>

          <div className="md:col-span-2 space-y-0.5">
            <label className="block text-[11px] font-semibold text-neutral-600 ml-1">
              Address
            </label>
            <div className="space-y-1.5">
              <Input
                value={formData.address1 || ""}
                onChange={(e) =>
                  setFormData({ ...formData, address1: e.target.value })
                }
                disabled={viewMode}
                placeholder="Line 1"
                className="bg-neutral-50 h-9 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={formData.address2 || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, address2: e.target.value })
                  }
                  disabled={viewMode}
                  placeholder="Line 2"
                  className="bg-neutral-50 h-9 text-sm"
                />
                <Input
                  value={formData.address3 || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, address3: e.target.value })
                  }
                  disabled={viewMode}
                  placeholder="Line 3"
                  className="bg-neutral-50 h-9 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-0.5">
            <label className="block text-[11px] font-semibold text-neutral-600 ml-1">City</label>
            <Input
              value={formData.city || ""}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
              disabled={viewMode}
              className="bg-neutral-50 h-9 text-sm"
            />
          </div>

          <div className="space-y-0.5">
            <label className="block text-[11px] font-semibold text-neutral-600 ml-1">State</label>
            <Input
              value={formData.state || ""}
              onChange={(e) =>
                setFormData({ ...formData, state: e.target.value })
              }
              disabled={viewMode}
              className="bg-neutral-50 h-9 text-sm"
            />
          </div>

          <div className="space-y-0.5">
            <label className="block text-[11px] font-semibold text-neutral-600 ml-1"> Pin Code</label>
            <Input
              value={formData.pinCode || ""}
              onChange={(e) =>
                setFormData({ ...formData, pinCode: e.target.value })
              }
              disabled={viewMode}
              className="bg-neutral-50 h-9 text-sm"
            />
          </div>

          <div className="space-y-0.5">
            <label className="block text-[11px] font-semibold text-neutral-600 ml-1">Email</label>
            <Input
              type="email"
              value={formData.email || ""}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              disabled={viewMode}
              className="bg-neutral-50 h-9 text-sm"
              placeholder="example@mail.com"
            />
          </div>

          <div className="space-y-0.5">
            <label className="block text-[11px] font-semibold text-neutral-600 ml-1">Phone</label>
            <Input
              value={formData.phoneNo1 || ""}
              onChange={(e) =>
                setFormData({ ...formData, phoneNo1: e.target.value })
              }
              disabled={viewMode}
              className="bg-neutral-50 h-9 text-sm"
            />
          </div>

          <div className="space-y-0.5">
            <label className="block text-[11px] font-semibold text-neutral-600 ml-1">Mobile</label>
            <Input
              value={formData.mobileNo || ""}
              onChange={(e) =>
                setFormData({ ...formData, mobileNo: e.target.value })
              }
              disabled={viewMode}
              className="bg-neutral-50 h-9 text-sm"
            />
          </div>

          {/* License Info */}
          <div className="md:col-span-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mt-2 mb-0.5">
            Legal & Licenses
          </div>

          <div className="space-y-0.5">
            <label className="block text-[11px] font-semibold text-neutral-600 ml-1"> Drug License 1</label>
            <Input
              value={formData.drugLicNo || ""}
              onChange={(e) =>
                setFormData({ ...formData, drugLicNo: e.target.value })
              }
              disabled={viewMode}
              placeholder="License Number"
              className="bg-neutral-50 h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <label className="block text-[9px] font-bold text-neutral-400 ml-1 uppercase leading-none">Valid From</label>
              <Input
                value={formData.drugLicFromDt || ""}
                onChange={(e) =>
                  setFormData({ ...formData, drugLicFromDt: e.target.value })
                }
                disabled={viewMode}
                placeholder="DD/MM/YYYY"
                className="bg-neutral-50 h-9 text-sm"
              />
            </div>
            <div className="space-y-0.5">
              <label className="block text-[9px] font-bold text-neutral-400 ml-1 uppercase leading-none">Valid To</label>
              <Input
                value={formData.drugLicToDt || ""}
                onChange={(e) =>
                  setFormData({ ...formData, drugLicToDt: e.target.value })
                }
                disabled={viewMode}
                placeholder="DD/MM/YYYY"
                className="bg-neutral-50 h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-0.5">
            <label className="block text-[11px] font-semibold text-neutral-600 ml-1">GST Number</label>
            <Input
              value={formData.gstNo || ""}
              onChange={(e) =>
                setFormData({ ...formData, gstNo: e.target.value })
              }
              disabled={viewMode}
              className="bg-neutral-50 h-9 text-sm"
            />
          </div>
        </div>
      </CustomModal>
    </Card>
  );
}