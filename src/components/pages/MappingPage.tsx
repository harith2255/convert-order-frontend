/**
 * ORDER QUANTITY REVIEW PAGE
 * Pharma-safe, master-driven architecture
 */
import React, { useEffect, useState } from "react";
import { ArrowRight, AlertTriangle, CheckCircle2, Search, User, X, RefreshCw } from "lucide-react";
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

  useEffect(() => {
    // Skip if we just selected a customer manually
    if (selectedCustomer && selectedCustomer.customerName === customerInput) return;

    const timer = setTimeout(() => {
      setSearching(true);
      api.get("/admin/customers", {
        params: { 
          search: customerInput,
          limit: 100 // Fetch a larger set to be 'full' as requested
        }
      })
        .then(res => {
          const list =
            Array.isArray(res.data) ? res.data :
            Array.isArray(res.data.customers) ? res.data.customers :
            Array.isArray(res.data.data) ? res.data.data :
            [];

          setCustomers(list);
        })
        .catch(() => {
          setCustomers([]);
        })
        .finally(() => {
          setSearching(false);
        });
    }, 400);

    return () => clearTimeout(timer);
  }, [customerInput, selectedCustomer]);

  useEffect(() => {
    if (parsedResult?.customer) {
      setSelectedCustomer(parsedResult.customer);
      setCustomerInput(parsedResult.customer.name);
    }
  }, [parsedResult]);

  /* ---------------- INIT ---------------- */
  useEffect(() => {
    if (!parsedResult?.dataRows || !parsedResult.uploadId) {
      toast.error("Invalid upload session. Please re-upload.");
      navigate("/upload");
      return;
    }

    setRows(parsedResult.dataRows);
    setUploadId(parsedResult.uploadId);

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

  const updateQty = (index: number, value: string) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ORDERQTY: value };
      validateRow(index, next[index]);
      return next;
    });
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

      <Alert variant="warning">
        <CheckCircle2 className="w-5 h-5 text-amber-600" />
        <AlertDescription className="text-sm">
          Product, pack, division & customer data are taken from
          <strong> Admin Master</strong>.  
          You only need to verify order quantities.
        </AlertDescription>
      </Alert>
<Card className="overflow-visible relative">
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
        <User className="w-4 h-4 text-primary-600" />
        Customer Selection
      </label>
      {selectedCustomer ? (
        <Badge variant="success" className="animate-in fade-in zoom-in duration-300">
          ✓ Verified from Master
        </Badge>
      ) : (
        <Badge variant="warning" className="animate-in pulse duration-1000">
          Action Required: Map Customer
        </Badge>
      )}
    </div>

    <div className="relative group">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary-500 transition-colors">
        <Search className="w-4 h-4" />
      </div>
      <input
        value={customerInput}
        onChange={e => {
          setCustomerInput(e.target.value);
          setSelectedCustomer(null);
        }}
        placeholder="Type to search in Admin Master (e.g. Apollo, MedPlus...)"
        className={`w-full pl-10 pr-10 py-2.5 border rounded-xl transition-all focus:ring-2 focus:ring-primary-500/20 outline-none ${
          selectedCustomer ? "border-green-200 bg-green-50/30" : "border-neutral-200 focus:border-primary-500"
        }`}
      />
      {customerInput && (
        <button 
          onClick={() => {
            setCustomerInput("");
            setSelectedCustomer(null);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 rounded-full hover:bg-neutral-100 transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {customerInput && !selectedCustomer && (
        <div className="absolute z-50 left-0 right-0 top-[calc(100%+8px)] border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-xl max-h-[280px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-500">
              Suggestions from Master Data
            </span>
            {searching && (
              <RefreshCw className="w-3 h-3 text-primary-500 animate-spin" />
            )}
          </div>
          {Array.isArray(customers) && customers
            .map(c => (
              <div
                key={c.customerCode}
                className="px-4 py-3 cursor-pointer hover:bg-primary-50 border-b border-neutral-50 last:border-0 transition-colors group/item"
                onClick={() => {
                  setSelectedCustomer(c);
                  setCustomerInput(c.customerName);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-neutral-800 group-hover/item:text-primary-700">{c.customerName}</div>
                  <div className="text-[10px] font-mono px-1.5 py-0.5 bg-neutral-100 rounded group-hover/item:bg-primary-100 transition-colors">
                    {c.customerCode}
                  </div>
                </div>
                {c.address && (
                  <div className="text-xs text-neutral-500 truncate mt-0.5">{c.address}</div>
                )}
              </div>
            ))}
          {customers.filter(c => c.customerName?.toLowerCase().includes(customerInput.toLowerCase())).length === 0 && (
            <div className="p-8 text-center text-neutral-500 italic text-sm">
              No matching customers found in database
            </div>
          )}
        </div>
      )}
    </div>

    {selectedCustomer && (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg animate-in slide-in-from-left-2">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-green-800">Confirmed Mapping</div>
          <div className="text-sm text-green-700 font-medium">
            {selectedCustomer.customerName} <span className="opacity-60 text-[10px] font-mono">({selectedCustomer.customerCode})</span>
          </div>
        </div>
      </div>
    )}
  </div>
</Card>

      <Card>

        
        <table className="min-w-full text-sm border">
          <thead className="bg-neutral-100">
            <tr>
              <th className="px-3 py-2 text-left">ITEMDESC</th>
              <th className="px-3 py-2 text-left">ORDER QTY</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => {
              const hasError = rowErrors[i]?.length > 0;

              return (
                <tr key={i} className={hasError ? "bg-red-50" : ""}>
                  <td className="px-3 py-2">{row.ITEMDESC}</td>
                  <td className="px-3 py-2">
                    <input
                      value={row.ORDERQTY}
                      onChange={e => updateQty(i, e.target.value)}
                      className={`w-24 px-2 py-1 border rounded ${
                        hasError ? "border-red-500" : "border-gray-300"
                      }`}
                    />
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
