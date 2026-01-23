import { useState, useEffect } from "react";
import { toast } from "sonner";
import { masterDataApi } from "../../services/masterDataApi";
import { Button } from "../Button";
import { Card } from "../Card";
import { Input } from "../Input";
import { Trash2, Edit2, Plus, Eye } from "lucide-react";
import { CustomModal } from "../Modal";

interface Product {
  _id: string;
  productCode: string;
  productName: string;           // raw SAP
  cleanedProductName?: string;   // normalized
  baseName?: string;
  dosage?: string;
  variant?: string;
  division?: string;
}


export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Edit/Create state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    productCode: "",
    productName: "",
    division: "",
  });

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await masterDataApi.getProducts(search, page, limit);
      setProducts(res.data || []);
      setTotal(res.total || 0);
    } catch {
      toast.error("Failed to load products");
      setProducts([]);
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
    loadProducts();
  }, [page, search]);

  const handleCreate = () => {
    setEditingProduct(null);
    setFormData({ productCode: "", productName: "", division: "" });
    setIsModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      productCode: product.productCode,
      productName: product.productName,
      division: product.division || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.productName.trim() || !formData.productCode.trim()) {
        toast.error("Product code and name are required");
        return;
      }

      if (editingProduct) {
        await masterDataApi.updateProduct(editingProduct._id, {
          productName: formData.productName,
          division: formData.division,
        });
        toast.success("Product updated");
      } else {
        await masterDataApi.createProduct(formData);
        toast.success("Product created");
      }

      setIsModalOpen(false);
      loadProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Operation failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;

    try {
      await masterDataApi.deleteProduct(id);
      toast.success("Product deleted");
      loadProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Delete failed");
    }
  };

  return (
    <Card>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">Products ({total})</h3>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-1" />
          Add Product
        </Button>
      </div>

      <Input
        placeholder="Search product name or code"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Product Code</th>
              <th className="text-left p-2">Product Name</th>
              <th className="text-left p-2">Division</th>
              <th className="text-right p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center p-4">
                  Loading...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center p-4 text-neutral-500">
                  No products found
                </td>
              </tr>
            ) : (
              products.map((product) => (
                 <tr key={product._id} className="border-b hover:bg-neutral-50">
                  <td className="p-2">{product.productCode}</td>
                  <td className="p-2 font-medium">
                    {product.cleanedProductName || product.productName}
                  </td>
                  <td className="p-2">{product.division || "-"}</td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-blue-600 hover:text-blue-800 mr-2"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      className="text-red-600 hover:text-red-800"
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
        <Button size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </Button>
        <span className="px-3 py-2 text-sm">
          Page {page} of {Math.ceil(total / limit) || 1}
        </span>
        <Button
          size="sm"
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
        title={editingProduct ? "Edit Product" : "Add Product"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-700">
              Product Code <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.productCode}
              onChange={(e) =>
                setFormData({ ...formData, productCode: e.target.value })
              }
              placeholder="Enter product code"
              disabled={!!editingProduct}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-700">
              Product Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.productName}
              onChange={(e) =>
                setFormData({ ...formData, productName: e.target.value })
              }
              placeholder="Enter product name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-700">
              Division
            </label>
            <Input
              value={formData.division}
              onChange={(e) =>
                setFormData({ ...formData, division: e.target.value })
              }
              placeholder="Enter division (optional)"
            />
          </div>
        </div>
      </CustomModal>
    </Card>
  );
}