/**
 * MAPPING PAGE - FIXED VERSION
 * Fixes: Customer selection dropdown, candidate handling, proper code passing
 */
import React, { useEffect, useState, useRef } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Search,
  User,
  X,
  RefreshCw,
  AlertTriangle
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
  const [showCandidates, setShowCandidates] = useState(false);
  
  const autoCustomerLocked = useRef(false);

  /* ✅ MASTER PRODUCTS FOR MANUAL MAPPING */
  const [allProducts, setAllProducts] = useState<any[]>([]);

  /* ---------------- LOAD MASTER PRODUCTS ---------------- */
  useEffect(() => {
    api
      .get("/admin/products", { params: { limit: 5000 } })
      .then(res => setAllProducts(res.data?.data || []))
      .catch(() => setAllProducts([]));
  }, []);

  /* ---------------- CUSTOMER SEARCH (DEBOUNCED) ---------------- */
  useEffect(() => {
    if (autoCustomerLocked.current) return;
    if (!customerInput || customerInput.length < 2) {
      setCustomers([]);
      return;
    }

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

    // ✅ HANDLE CUSTOMER AUTO-FILL
    if (parsedResult.customer) {
      const { name, code, candidates, source } = parsedResult.customer;

      // Set input field
      if (name) {
        setCustomerInput(name);
      }

      // ✅ AUTO-SELECT IF UNIQUE MATCH
      if (source === 'AUTO_UNIQUE' && code) {
        setSelectedCustomer({
          customerCode: code,
          customerName: name,
          city: parsedResult.customer.city,
          state: parsedResult.customer.state
        });
        autoCustomerLocked.current = true;
        toast.success(`Auto-selected: ${name}`);
      }

      // ✅ SHOW CANDIDATES IF MULTIPLE MATCHES
      if (source === 'MANUAL_REQUIRED' && candidates?.length > 0) {
        setCustomers(candidates);
        setShowCandidates(true);
        toast.warning(`Multiple customers found for "${name}". Please select one.`);
      }

      // ⚠️ NOT FOUND IN MASTER
      if (source === 'NOT_FOUND') {
        toast.warning(`Customer "${name}" not found in master. Please search and select.`);
      }
    }

    // Validate rows
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

    // ✅ BLOCK IF UNMAPPED PRODUCTS
    const unmapped = rows.some(
      r => !r.matchedProduct && !r.manualProduct
    );

    if (unmapped) {
      toast.error("Please manually map all unmatched products");
      return;
    }

    try {
      setConverting(true);
      
      // ✅ PASS CUSTOMER CODE TO BACKEND
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

  /* ---------------- CUSTOMER SELECTION HANDLER ---------------- */
  const handleCustomerSelect = (customer: any) => {
    setSelectedCustomer(customer);
    setCustomerInput(customer.customerName);
    setCustomers([]);
    setShowCandidates(false);
    autoCustomerLocked.current = true;
    toast.success(`Selected: ${customer.customerName} (${customer.city || customer.state})`);
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
            {showCandidates && (
              <Badge variant="warning">Multiple matches - please select</Badge>
            )}
          </label>

          <div className="relative">
            <input
              value={customerInput}
              onChange={e => {
                autoCustomerLocked.current = false;
                setShowCandidates(false);
                setCustomerInput(e.target.value);
                setSelectedCustomer(null);
              }}
              placeholder="Search customer by name or code"
              className="w-full border rounded px-3 py-2 pr-10 text-sm"
              disabled={autoCustomerLocked.current && selectedCustomer}
            />

            {searching && (
              <RefreshCw className="absolute right-3 top-2.5 w-4 h-4 animate-spin opacity-60" />
            )}

            {selectedCustomer && autoCustomerLocked.current && (
              <button
                onClick={() => {
                  autoCustomerLocked.current = false;
                  setSelectedCustomer(null);
                  setCustomerInput("");
                }}
                className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ✅ DROPDOWN RESULTS */}
          {(customerInput && customers.length > 0 && !selectedCustomer) && (
            <div className="border rounded max-h-56 overflow-auto bg-white shadow-lg z-10">
              {customers.map(c => (
                <button
                  key={c._id || c.customerCode}
                  type="button"
                  onClick={() => handleCustomerSelect(c)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0"
                >
                  <div className="font-medium">{c.customerName}</div>
                  <div className="text-xs text-neutral-500">
                    Code: {c.customerCode}
                    {(c.city || c.state) && (
                      <span className="ml-2">• {c.city || c.state}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ✅ SELECTED CUSTOMER DISPLAY */}
          {selectedCustomer && (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded px-3 py-2 text-sm">
              <div>
                <div className="font-medium text-green-800">
                  {selectedCustomer.customerName}
                </div>
                <div className="text-xs text-green-700">
                  Code: {selectedCustomer.customerCode}
                  {(selectedCustomer.city || selectedCustomer.state) && (
                    <span className="ml-2">
                      • {selectedCustomer.city || selectedCustomer.state}
                    </span>
                  )}
                </div>
              </div>

              {!autoCustomerLocked.current && (
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerInput("");
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      <Alert variant="warning">
        <CheckCircle2 className="w-5 h-5 text-amber-600" />
        <AlertDescription className="text-sm">
          Product & customer data are taken from <strong>Admin Master</strong>.
          Products with schemes will be highlighted in yellow in the final Excel.
        </AlertDescription>
      </Alert>

      {/* ---------------- PRODUCT ROWS ---------------- */}
      <Card>
        <table className="min-w-full text-sm border">
          <thead className="bg-neutral-100">
            <tr>
              <th className="px-3 py-2 text-left">ITEMDESC</th>
              <th className="px-3 py-2 text-center">Qty</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-center">Action</th>
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
                      <div className="text-xs text-green-700 mt-1">
                        ✓ {row.matchedProduct.cleanedProductName}
                        <span className="ml-1 opacity-60">
                          ({row.matchedProduct.division})
                        </span>
                      </div>
                    )}

                    {/* MANUAL MAPPING DROPDOWN */}
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
                              SAPCODE: selected?.productCode,
                              DVN: selected?.division,
                              mappingSource: "MANUAL"
                            };
                            return next;
                          });
                        }}
                      >
                        <option value="">⚠ Select product from master</option>

                        {allProducts
                          .filter(p => {
                            const text = row.ITEMDESC?.toUpperCase() || "";
                            if (!p.baseName && !p.cleanedProductName) return false;

                            return (
                              (p.baseName && text.includes(p.baseName.toUpperCase())) ||
                              (p.cleanedProductName && text.includes(p.cleanedProductName.toUpperCase()))
                            );
                          })
                          .map(p => (
                            <option key={p._id} value={p._id}>
                              {p.cleanedProductName || p.productName} ({p.division})
                            </option>
                          ))
                        }
                      </select>
                    )}
                  </td>

                  <td className="px-3 py-2 text-center font-medium">
                    {row.ORDERQTY}
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
                      className="text-red-600 hover:text-red-700"
                      title="Remove row"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* ---------------- ACTION BUTTONS ---------------- */}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate("/upload")}>
          Back
        </Button>
        <Button 
          onClick={handleConvert} 
          isLoading={converting}
          disabled={!selectedCustomer}
        >
          Confirm & Convert <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}