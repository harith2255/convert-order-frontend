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
import { Modal } from "../Modal";

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
  
  /* 🎁 SCHEME SUGGESTIONS STATE */
  const [schemeSuggestions, setSchemeSuggestions] = useState<any[]>([]);
  const [showSchemeModal, setShowSchemeModal] = useState(false);

  // ... (useEffect load products - SAME)
  /* ---------------- LOAD MASTER PRODUCTS ---------------- */
  useEffect(() => {
    api
      .get("/admin/products", { params: { limit: 5000 } })
      .then(res => setAllProducts(res.data?.data || []))
      .catch(() => setAllProducts([]));
  }, []);

  // ... (customer search - SAME)
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
    // ... (same init logic)
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

      if (name) setCustomerInput(name);

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

      if (source === 'MANUAL_REQUIRED' && candidates?.length > 0) {
        setCustomers(candidates);
        setShowCandidates(true);
        toast.warning(`Multiple customers found for "${name}". Please select one.`);
      }

      if (source === 'NOT_FOUND') {
        toast.warning(`Customer "${name}" not found in master. Please search and select.`);
      }
    }

    parsedResult.dataRows.forEach((row: any, i: number) =>
      validateRow(i, row)
    );
  }, [parsedResult, navigate]);

  const handleCustomerSelect = (customer: any) => {
  setSelectedCustomer({
    customerCode: customer.customerCode,
    customerName: customer.customerName,
    city: customer.city,
    state: customer.state
  });

  setCustomerInput(customer.customerName);
  setCustomers([]);
  setShowCandidates(false);

  autoCustomerLocked.current = false;

  toast.success(`Selected customer: ${customer.customerName}`);
};

  /* ---------------- VALIDATION ---------------- */
  const validateRow = (index: number, row: any) => {
    const errors: string[] = [];
    if (!row.ORDERQTY || isNaN(Number(row.ORDERQTY)) || Number(row.ORDERQTY) <= 0) {
      errors.push("Invalid ORDERQTY");
    }
    setRowErrors(prev => ({ ...prev, [index]: errors }));
  };

  /* ---------------- ADD ROW ---------------- */
  const addRow = () => {
    setRows(prev => [
      ...prev,
      {
        ITEMDESC: "",
        ORDERQTY: "",
        manualProduct: null,
        isNew: true
      }
    ]);
  };

  const deleteRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  /* ---------------- HANDLE ROW CHANGE ---------------- */
  const handleRowChange = (index: number, field: string, value: any) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      
      if (field === 'ORDERQTY') {
         if (!value || isNaN(Number(value)) || Number(value) <= 0) {
             setRowErrors(errs => ({ ...errs, [index]: ["Invalid Qty"] }));
         } else {
             setRowErrors(errs => {
                 const newErrs = { ...errs };
                 delete newErrs[index];
                 return newErrs;
             });
         }
      }
      return next;
    });
  };

  /* ---------------- SCHEME CHECK LOGIC ---------------- */
  const checkForSchemes = async () => {
    try {
        const res = await api.post("/orders/check-schemes", { dataRows: rows });
        if (res.data?.suggestions?.length > 0) {
            setSchemeSuggestions(res.data.suggestions);
            setShowSchemeModal(true);
            return false; // Found suggestions, stop convert
        }
        return true; // No suggestions, proceed
    } catch (err) {
        // If check fails, just proceed silently or log it
        console.error("Scheme check failed", err);
        return true;
    }
  };

  const applySchemeSuggestion = (suggestion: any) => {
      handleRowChange(suggestion.rowIndex, "ORDERQTY", suggestion.suggestedQty);
      // Remove from list
      setSchemeSuggestions(prev => prev.filter(s => s.rowIndex !== suggestion.rowIndex));
      toast.success(`Updated quantity to ${suggestion.suggestedQty}!`);
  };

  /* ---------------- CONVERT ---------------- */
  const handleConvert = async (skipSchemeCheck = false) => {
    // Re-validate all
    const currentErrors: Record<number, string[]> = {};
    rows.forEach((row, i) => {
        if (!row.ORDERQTY || isNaN(Number(row.ORDERQTY)) || Number(row.ORDERQTY) <= 0) {
            currentErrors[i] = ["Invalid Qty"];
        }
    });

    if (Object.keys(currentErrors).length > 0) {
        setRowErrors(currentErrors);
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

    // 🎁 CHECK SCHEMES (unless skipped)
    if (!skipSchemeCheck) {
        const proceed = await checkForSchemes();
        if (!proceed) return;
    }

    try {
      setConverting(true);
      
      // ✅ PASS MODIFIED ROWS TO BACKEND
      const res = await api.post("/orders/convert", {
        uploadId,
        customerCode: selectedCustomer.customerCode,
        dataRows: rows // Send state to backend
      });

      toast.success("Order quantities processed successfully");
      navigate(`/result/${res.data.uploadId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  // ... (render logic) - Customer Selection, etc.

  /* ---------------- RENDER ---------------- */
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Review Order Quantities</h1>
        <Button onClick={addRow} variant="secondary">
          + Add Item
        </Button>
      </div>
      
      {/* ... CUSTOMER CARD ... */}
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
              <th className="px-3 py-2 text-left">ITEMDESC (Invoice)</th>
              <th className="px-3 py-2 text-left">Mapped Product (Master)</th>
              <th className="px-3 py-2 text-center w-24">Qty</th>
              <th className="px-3 py-2 text-center w-24">Status</th>
              <th className="px-3 py-2 text-center w-16">Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => {
              const hasError = rowErrors[i]?.length > 0;

              return (
                <tr key={i} className={hasError ? "bg-red-50" : ""}>
                  <td className="px-3 py-2">
                    <input 
                        className="w-full border rounded px-2 py-1"
                        value={row.ITEMDESC || ""}
                        onChange={(e) => handleRowChange(i, "ITEMDESC", e.target.value)}
                        placeholder="Item Description"
                    />
                  </td>

                  <td className="px-3 py-2">
                    {/* AUTO MATCH DISPLAY */}
                    {row.matchedProduct && (
                      <div className="text-xs text-green-700 font-medium mb-1 flex justify-between">
                      <span>
  ✓ {row.matchedProduct.productName}
  <span className="text-xs text-neutral-500 ml-1">
    ({row.matchedProduct.division})
  </span>
</span>


                        <button 
                            className="text-blue-600 underline text-xs"
                            onClick={() => {
                                // Enable manual override
                                handleRowChange(i, "matchedProduct", null);
                            }}
                        >
                            Change
                        </button>
                      </div>
                    )}

                    {/* MANUAL MAPPING DROPDOWN */}
                    {!row.matchedProduct && (
                      <select
                        className="w-full border rounded px-2 py-1 text-xs"
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
                            const text = (row.ITEMDESC || "").toUpperCase();
                            if ((text.length < 2) && !row.manualProduct) return true;

                            if (!p.baseName && !p.cleanedProductName) return false;

                            return (
                              (p.baseName && text.includes(p.baseName.toUpperCase())) ||
                              (p.cleanedProductName && text.includes(p.cleanedProductName.toUpperCase())) ||
                              (p.productName && p.productName.toUpperCase().includes(text))
                            );
                          })
                          .slice(0, 50)
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
                    <input 
                        type="number"
                        className="w-full border rounded px-2 py-1 text-center"
                        value={row.ORDERQTY || ""}
                        onChange={(e) => handleRowChange(i, "ORDERQTY", e.target.value)}
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
          onClick={() => handleConvert(false)} 
          isLoading={converting}
          disabled={!selectedCustomer}
        >
          Confirm & Convert <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>

       {/* 🎁 SCHEME SUGGESTION MODAL */}
       {showSchemeModal && (
        <Modal 
            isOpen={showSchemeModal} 
            onClose={() => {
                setShowSchemeModal(false);
                setSchemeSuggestions([]);
            }}
            title="🎁 Scheme Opportunities Detected!"
        >
            <div className="space-y-4">
                <Alert variant="info">
                    <AlertDescription>
                        We found products where increasing the quantity slightly will unlock free goods.
                    </AlertDescription>
                </Alert>

                <div className="max-h-96 overflow-auto space-y-3">
                    {schemeSuggestions.map((s, idx) => (
                        <div key={idx} className="border p-3 rounded bg-amber-50 border-amber-200">
                             <div className="font-medium text-sm text-gray-800">{s.itemDesc}</div>
                             <div className="text-xs text-gray-500 mb-2">Code: {s.productCode}</div>
                             
                             <div className="flex items-center justify-between mt-2">
                                <div className="text-sm">
                                    Current: <strong>{s.currentQty}</strong>
                                    <span className="mx-2 text-gray-400">→</span>
                                    Target: <strong className="text-green-700">{s.suggestedQty}</strong>
                                </div>
                                <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                    Get {s.freeQty} Free
                                </div>
                             </div>

                             <Button 
                                size="sm" 
                                className="w-full mt-3"
                                onClick={() => applySchemeSuggestion(s)}
                            >
                                Upgrade to {s.suggestedQty} (+{s.freeQty} FREE)
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button 
                        variant="secondary" 
                        onClick={() => {
                            setShowSchemeModal(false);
                            // Proceed with conversion using original values
                            handleConvert(true); 
                        }}
                    >
                        Skip & Convert
                    </Button>
                    <Button 
                        onClick={() => {
                            setShowSchemeModal(false);
                             // Proceed with conversion using UPDATED values (if any applied)
                             // If user applied strictly all, list is empty? 
                             // No, applying updates ROWS. 
                             // Just trigger convert again (with check to ensure we don't loop endlessly if suggestions persist? 
                             // No, if applied, qty changes. Next check won't find same suggestion.)
                            handleConvert(true); 
                        }}
                    >
                        Done & Convert
                    </Button>
                </div>
            </div>
        </Modal>
       )}

    </div>
  );
}