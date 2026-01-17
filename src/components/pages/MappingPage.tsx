/**
 * ORDER QUANTITY REVIEW PAGE
 * Pharma-safe, master-driven architecture
 */
import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Search,
  User,
  X,
  RefreshCw
} from "lucide-react";
import { Card } from "../Card";
import { Button } from "../Button";
import { Badge } from "../Badge";
import { Alert, AlertDescription } from "../ui/alert";
import { toast } from "sonner";
import api from "../../services/api";
import { useNavigate, useLocation } from "react-router-dom";

export function MappingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const parsedResult = location.state?.parsedResult;

  const [rows, setRows] = useState<any[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<number, string[]>>({});
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const [customers, setCustomers] = useState<any[]>([]);
  const [customerInput, setCustomerInput] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searching, setSearching] = useState(false);
const autoCustomerLocked = React.useRef(false);

  /* ✅ MASTER PRODUCTS FOR MANUAL MAPPING */
  const [allProducts, setAllProducts] = useState<any[]>([]);

  /* ---------------- LOAD MASTER PRODUCTS ---------------- */
  useEffect(() => {
    api
      .get("/admin/products", { params: { limit: 5000 } })
      .then(res => setAllProducts(res.data?.data || []))
      .catch(() => setAllProducts([]));
  }, []);

  /* ---------------- CUSTOMER SEARCH ---------------- */
 useEffect(() => {
  // 🔒 Do NOT search if auto customer is locked
  if (autoCustomerLocked.current) return;

  if (!customerInput) return;

  const timer = setTimeout(() => {
    setSearching(true);
    api
      .get("/admin/customers", {
        params: { search: customerInput, limit: 100 }
      })
      .then(res => setCustomers(res.data?.data || []))
      .catch(() => setCustomers([]))
      .finally(() => setSearching(false));
  }, 400);

  return () => clearTimeout(timer);
}, [customerInput]);


  /* ---------------- INIT ---------------- */
useEffect(() => {
  if (!parsedResult?.dataRows || !parsedResult.uploadId) {
    toast.error("Invalid upload session. Please re-upload.");
    navigate("/upload");
    return;
  }

  setRows(parsedResult.dataRows);
  setUploadId(parsedResult.uploadId);

  // ✅ AUTO SET CUSTOMER (LOCKED)
// ✅ AUTO FILL CUSTOMER NAME (ALWAYS)
if (parsedResult.customer?.name && !autoCustomerLocked.current) {
  setCustomerInput(parsedResult.customer.name);

  // 🔒 Lock ONLY if master code exists
  if (parsedResult.customer.code) {
    setSelectedCustomer({
      customerCode: parsedResult.customer.code,
      customerName: parsedResult.customer.name,
      confidence: parsedResult.customer.confidence,
      source: parsedResult.customer.source
    });

    autoCustomerLocked.current = true; // lock only on master match
  }
}


  parsedResult.dataRows.forEach((row: any, i: number) =>
    validateRow(i, row)
  );
}, [parsedResult, navigate]);



  /* ---------------- VALIDATION ---------------- */
  const validateRow = (index: number, row: any) => {
    const errors: string[] = [];

    if (!row.ORDERQTY || isNaN(Number(row.ORDERQTY)) || Number(row.ORDERQTY) <= 0) {
      errors.push("Invalid ORDERQTY");
    }

    setRowErrors(prev => ({ ...prev, [index]: errors }));
  };

  const deleteRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  /* ---------------- CONVERT ---------------- */
  const handleConvert = async () => {
    if (Object.values(rowErrors).some(e => e.length > 0)) {
      toast.error("Fix quantity errors before continuing");
      return;
    }

    if (!selectedCustomer?.customerCode) {
      toast.error("Please select a customer from Admin Master");
      return;
    }

    /* ✅ BLOCK IF UNMAPPED */
    const unmapped = rows.some(
      r => !r.matchedProduct && !r.manualProduct
    );

    if (unmapped) {
      toast.error("Please manually map all unmatched products");
      return;
    }

    try {
      setConverting(true);
      const res = await api.post("/orders/convert", {
        uploadId,
        customerCode: selectedCustomer.customerCode
      });

      toast.success("Order quantities processed successfully");
      navigate(`/result/${res.data.uploadId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  /* ---------------- RENDER ---------------- */
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Review Order Quantities</h1>
{/* ---------------- CUSTOMER SELECTION ---------------- */}
<Card>
  <div className="space-y-2">
    <label className="text-sm font-medium flex items-center gap-2">
      <User className="w-4 h-4" />
      Select Customer (Admin Master)
    </label>

    <div className="relative">
      <input
        value={customerInput}
       onChange={e => {
  autoCustomerLocked.current = false; // 🔓 unlock
  setCustomerInput(e.target.value);
  setSelectedCustomer(null);
}}

      
        placeholder="Search customer by name or code"
        className="w-full border rounded px-3 py-2 pr-10 text-sm"
      />

      {searching && (
        <RefreshCw className="absolute right-3 top-2.5 w-4 h-4 animate-spin opacity-60" />
      )}
    </div>

    {/* DROPDOWN RESULTS */}
    {customerInput && customers.length > 0 && !selectedCustomer && (
      <div className="border rounded max-h-56 overflow-auto bg-white shadow-sm">
        {customers.map(c => (
          <button
            key={c._id}
            type="button"
            onClick={() => {
              setSelectedCustomer(c);
              setCustomerInput(c.customerName);
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100"
          >
            <div className="font-medium">{c.customerName}</div>
            <div className="text-xs opacity-60">
              {c.customerCode} • {c.city || c.state || ""}
            </div>
          </button>
        ))}
      </div>
    )}

    {/* SELECTED CUSTOMER */}
    {selectedCustomer && (
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded px-3 py-2 text-sm">
        <div>
          <div className="font-medium text-green-800">
            {selectedCustomer.customerName}
          </div>
          <div className="text-xs opacity-70">
            Code: {selectedCustomer.customerCode}
          </div>
        </div>

        <button
          onClick={() => {
            setSelectedCustomer(null);
            setCustomerInput("");
          }}
          className="text-red-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )}
  </div>
</Card>

      <Alert variant="warning">
        <CheckCircle2 className="w-5 h-5 text-amber-600" />
        <AlertDescription className="text-sm">
          Product & customer data are taken from <strong>Admin Master</strong>.
        </AlertDescription>
      </Alert>

      <Card>
        <table className="min-w-full text-sm border">
          <thead className="bg-neutral-100">
            <tr>
              <th className="px-3 py-2 text-left">ITEMDESC</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => {
              const hasError = rowErrors[i]?.length > 0;

              return (
                <tr key={i} className={hasError ? "bg-red-50" : ""}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.ITEMDESC}</div>

                    {/* AUTO MATCH */}
                    {row.matchedProduct && (
                      <div className="text-xs text-green-700">
                        → {row.matchedProduct.cleanedProductName}
                        <span className="ml-1 opacity-60">
                          ({row.matchedProduct.division})
                        </span>
                      </div>
                    )}

                    {/* MANUAL MAPPING */}
                    {!row.matchedProduct && (
                      <select
                        className="mt-1 w-full border rounded px-2 py-1 text-xs"
                        value={row.manualProduct?._id || ""}
                        onChange={e => {
                          const selected = allProducts.find(
                            p => p._id === e.target.value
                          );

                          setRows(prev => {
                            const next = [...prev];
                            next[i] = {
                              ...next[i],
                              manualProduct: selected,
                              mappingSource: "MANUAL"
                            };
                            return next;
                          });
                        }}
                      >
                        <option value="">
                          ⚠ Select product from master
                        </option>

  {allProducts
  .filter(p => {
    const text = row.ITEMDESC?.toUpperCase() || "";

    if (!p.baseName && !p.cleanedProductName) return false;

    if (p.baseName && text.includes(p.baseName.toUpperCase())) {
      return true;
    }

    if (
      p.cleanedProductName &&
      text.includes(p.cleanedProductName.toUpperCase())
    ) {
      return true;
    }

    return false;
  })
  .map(p => (
    <option key={p._id} value={p._id}>
      {p.cleanedProductName} ({p.division})
    </option>
))}


                      </select>
                    )}
                  </td>

                  <td className="text-center">
                    {hasError ? (
                      <Badge variant="warning">Invalid</Badge>
                    ) : (
                      <Badge variant="success">OK</Badge>
                    )}
                  </td>

                  <td className="text-center">
                    <button
                      onClick={() => deleteRow(i)}
                      className="text-red-600"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate("/upload")}>
          Back
        </Button>
        <Button onClick={handleConvert} isLoading={converting}>
          Confirm & Convert <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
