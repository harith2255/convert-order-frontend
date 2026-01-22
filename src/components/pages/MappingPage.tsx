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
  AlertTriangle,
  Zap,
  Gift
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
  
  /* 📋 MULTI-SHEET ORGANIZATION STATE */
  const [sheets, setSheets] = useState<{
    id: string;
    name: string;
    color: { bg: string; border: string; text: string; badge: string };
    productIndices: number[];
  }[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  
  const SHEET_COLORS = [
    { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', badge: 'bg-blue-100' },
    { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', badge: 'bg-green-100' },
    { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', badge: 'bg-purple-100' },
    { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', badge: 'bg-amber-100' },
    { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700', badge: 'bg-pink-100' },
  ];

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
        autoCustomerLocked.current = false;
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

  /* 📋 SHEET MANAGEMENT FUNCTIONS */
  
  // Get which sheet a product belongs to
  const getProductSheet = (rowIndex: number) => {
    return sheets.find(sheet => sheet.productIndices.includes(rowIndex));
  };

  // Toggle row selection
  const toggleRowSelection = (rowIndex: number) => {
    // Can't select if already in a sheet
    if (getProductSheet(rowIndex)) return;
    
    setSelectedRows(prev => 
      prev.includes(rowIndex)
        ? prev.filter(i => i !== rowIndex)
        : [...prev, rowIndex]
    );
  };

  // Create new sheet with selected products
  const createNewSheet = () => {
    if (selectedRows.length === 0) {
      toast.error("Please select products first");
      return;
    }

    const sheetNumber = sheets.length + 1;
    const colorIndex = (sheets.length) % SHEET_COLORS.length;
    
    const newSheet = {
      id: `sheet-${Date.now()}`,
      name: `Sheet ${sheetNumber}`,
      color: SHEET_COLORS[colorIndex],
      productIndices: [...selectedRows]
    };

    setSheets(prev => [...prev, newSheet]);
    setSelectedRows([]); // Clear selection
    toast.success(`Created ${newSheet.name} with ${selectedRows.length} products`);
  };

  //Remove sheet and free its products
  const removeSheet = (sheetId: string) => {
    setSheets(prev => prev.filter(s => s.id !== sheetId));
    toast.success("Sheet removed");
  };

  /* ---------------- SCHEME CHECK LOGIC ---------------- */
  const checkForSchemes = async () => {
    try {
        // Ensure strictly numeric types for backend
        const cleanRows = rows.map(r => ({
            ...r,
            ORDERQTY: Number(r.ORDERQTY) || 0
        }));

        const res = await api.post("/orders/check-schemes", { 
            dataRows: cleanRows,
            customerCode: selectedCustomer?.customerCode 
        });
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
      setConverting(true);
      
      // ✅ PASS MODIFIED ROWS TO BACKEND (Ensure numeric types)
      const cleanRows = rows.map(r => ({
          ...r,
          ORDERQTY: Number(r.ORDERQTY) || 0,
          // If manually mapped, ensure matchedProduct is fully populated or at least id present
          matchedProduct: r.matchedProduct ? { ...r.matchedProduct } : null
      }));

      const res = await api.post("/orders/convert", {
        uploadId,
        customerCode: selectedCustomer.customerCode,
        dataRows: cleanRows, // Send state to backend
        sheets: sheets.map(s => ({
          name: s.name,
          productIndices: s.productIndices
        }))
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
    <div className="max-w-7xl mx-auto p-6 space-y-6">
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

      {/* 📋 SHEETS TOOLBAR */}
      {rows.length > 0 && (
        <Card>
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-neutral-700">
                {selectedRows.length > 0 ? (
                  <>✓ {selectedRows.length} product{selectedRows.length > 1 ? 's' : ''} selected</>
                ) : (
                  <>Select products to organize into sheets</>
                )}
              </span>
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={selectedRows.length === 0}
              onClick={createNewSheet}
              className="inline-flex items-center gap-2"
            >
              📋 Create Separate Sheet
            </Button>
          </div>

          {/* Sheets Panel */}
          {sheets.length > 0 && (
            <div className="p-3 bg-neutral-50 border-b">
              <p className="text-xs font-semibold text-neutral-600 mb-2">Created Sheets:</p>
              <div className="flex flex-wrap gap-2">
                {sheets.map(sheet => (
                  <div
                    key={sheet.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${sheet.color.border} ${sheet.color.bg}`}
                  >
                    <span className={`text-sm font-medium ${sheet.color.text}`}>
                      📋 {sheet.name}
                    </span>
                    <span className="text-xs text-neutral-600">
                      ({sheet.productIndices.length} products)
                    </span>
                    <button
                      onClick={() => removeSheet(sheet.id)}
                      className={`ml-1 ${sheet.color.text} hover:opacity-70`}
                      title="Remove sheet"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ---------------- PRODUCT ROWS ---------------- */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-neutral-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-neutral-700 border-b-2 border-neutral-200" style={{ minWidth: '280px' }}>
                  ITEMDESC (Invoice)
                </th>
                <th className="px-4 py-3 text-center font-semibold text-neutral-700 border-b-2 border-neutral-200" style={{ minWidth: '120px' }}>
                  Qty
                </th>
                <th className="px-4 py-3 text-center font-semibold text-neutral-700 border-b-2 border-neutral-200" style={{ minWidth: '100px' }}>
                  Box Pack
                </th>
                <th className="px-4 py-3 text-center font-semibold text-neutral-700 border-b-2 border-neutral-200" style={{ minWidth: '100px' }}>
                  Pack
                </th>
                <th className="px-4 py-3 text-center font-semibold text-neutral-700 border-b-2 border-neutral-200" style={{ minWidth: '100px' }}>
                  Division
                </th>
                <th className="px-4 py-3 text-center font-semibold text-neutral-700 border-b-2 border-neutral-200" style={{ minWidth: '120px' }}>
                  📋 Sheet
                </th>
                <th className="px-4 py-3 text-center font-semibold text-neutral-700 border-b-2 border-neutral-200" style={{ minWidth: '80px' }}>
                  Status
                </th>
                <th className="px-4 py-3 text-center font-semibold text-neutral-700 border-b-2 border-neutral-200" style={{ minWidth: '60px' }}>
                  Del
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, i) => {
                const hasError = rowErrors[i]?.length > 0;

                return (
                  <tr key={i} className={`border-b border-neutral-100 ${hasError ? "bg-red-50" : "hover:bg-neutral-50"}`}>
                    {/* PRODUCT NAME CELL */}
                    <td className="px-4 py-3 align-top" style={{ minWidth: '280px' }}>
                      <div className="space-y-2">
                        {/* Input field */}
                        {!row.matchedProduct && (
                          <div className="relative">
                            <input
                              className="w-full border border-neutral-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              value={row.ITEMDESC || ""}
                              onChange={(e) => {
                                handleRowChange(i, "ITEMDESC", e.target.value);
                                handleRowChange(i, "matchedProduct", null);
                              }}
                              placeholder="Type product name"
                            />

                            {/* AUTOCOMPLETE DROPDOWN */}
                            {row.ITEMDESC?.length >= 2 && (
                              <div className="absolute z-20 w-full mt-1 bg-white border border-neutral-300 rounded shadow-lg max-h-48 overflow-auto">
                                {allProducts
                                  .filter(p => {
                                    const normalize = (s = "") =>
                                      s
                                        .toUpperCase()
                                        .replace(/MG|ML|MCG/g, "")
                                        .replace(/[^A-Z0-9]/g, " ")
                                        .replace(/\s+/g, " ")
                                        .trim();

                                    const inv = normalize(row.ITEMDESC);
                                    const prod = normalize(p.productName);
                                    const base = normalize(p.baseName || "");

                                    if (!inv) return false;
                                    if (prod.startsWith(inv)) return true;
                                    if (base && inv.startsWith(base)) return true;

                                    return false;
                                  })
                                  .slice(0, 10)
                                  .map(p => (
                                    <button
                                      key={p._id}
                                      type="button"
                                      onClick={() => {
                                        setRows(prev => {
                                          const next = [...prev];
                                          next[i] = {
                                            ...next[i],
                                            ITEMDESC: p.productName,
                                            matchedProduct: p,
                                            SAPCODE: p.productCode,
                                            DVN: p.division,
                                            mappingSource: "MANUAL",
                                            availableSchemes: []
                                          };
                                          
                                          if (selectedCustomer?.customerCode) {
                                            api.get(`/orders/schemes/product/${p.productCode}`, {
                                              params: { 
                                                customerCode: selectedCustomer.customerCode,
                                                division: p.division 
                                              }
                                            }).then(res => {
                                              if (res.data?.schemes?.length > 0) {
                                                setRows(curr => {
                                                  const updated = [...curr];
                                                  updated[i] = { ...updated[i], availableSchemes: res.data.schemes };
                                                  return updated;
                                                });
                                                toast.success(`⚡ ${res.data.schemes.length} schemes found for ${p.productName}`);
                                              }
                                            });
                                          }
                                          
                                          return next;
                                        });
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0 transition-colors"
                                    >
                                      <div className="font-medium text-neutral-800">{p.productName}</div>
                                      <div className="text-xs text-neutral-500">
                                        {p.productCode} • {p.division}
                                      </div>
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* SELECTED PRODUCT DISPLAY */}
                        {row.matchedProduct && (
                          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-600 flex-shrink-0">✓</span>
                                  <span className="text-sm font-medium text-green-800 break-words">
                                    {row.ITEMDESC}
                                  </span>
                                </div>
                                <span className="text-xs text-green-600 ml-6">
                                  (mapped)
                                </span>
                              </div>
                              <button
                                className="text-blue-600 hover:text-blue-700 text-xs font-medium underline whitespace-nowrap flex-shrink-0"
                                onClick={() => {
                                  handleRowChange(i, "matchedProduct", null);
                                }}
                              >
                                Change
                              </button>
                            </div>
                          </div>
                        )}

                        {/* SCHEME BADGES */}
                        {row.matchedProduct && row.availableSchemes?.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {row.availableSchemes.map((s: any, idx: number) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  handleRowChange(i, "ORDERQTY", s.minQty);
                                  toast.success(`Applied scheme: Buy ${s.minQty} get ${s.freeQty} free`);
                                }}
                                className="flex items-center gap-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-2.5 py-1.5 rounded border border-amber-300 transition-colors"
                                title={`Click to set quantity to ${s.minQty}`}
                              >
                                <Gift className="w-3 h-3" />
                                <span className="font-medium">
                                  {s.minQty} + {s.freeQty}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* QUANTITY COLUMN */}
                    <td className="px-4 py-3 text-center align-top" style={{ minWidth: '120px' }}>
                      <input 
                        type="number"
                        className="w-full max-w-[100px] mx-auto border border-neutral-300 rounded px-3 py-2 text-center font-semibold text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={row.ORDERQTY || ""}
                        onChange={(e) => handleRowChange(i, "ORDERQTY", e.target.value)}
                        placeholder="0"
                      />
                    </td>

                    {/* BOX PACK COLUMN */}
                    <td className="px-4 py-3 text-center align-top" style={{ minWidth: '100px' }}>
                      <input
                        type="number"
                        min="0"
                        className="w-full max-w-[80px] mx-auto border border-neutral-300 rounded px-2 py-2 text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={row["BOX PACK"] || row.matchedProduct?.boxPack || 0}
                        onChange={(e) => handleRowChange(i, "BOX PACK", e.target.value)}
                        placeholder="0"
                      />
                    </td>

                    {/* PACK COLUMN */}
                    <td className="px-4 py-3 text-center align-top" style={{ minWidth: '100px' }}>
                      <input
                        type="number"
                        min="0"
                        className="w-full max-w-[80px] mx-auto border border-neutral-300 rounded px-2 py-2 text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={row.PACK || 0}
                        onChange={(e) => handleRowChange(i, "PACK", e.target.value)}
                        placeholder="0"
                      />
                    </td>

                    {/* DIVISION COLUMN */}
                    <td className="px-4 py-3 text-center align-top" style={{ minWidth: '100px' }}>
                      <input
                        type="text"
                        className="w-full max-w-[90px] mx-auto border border-neutral-300 rounded px-2 py-2 text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={row.DVN || row.matchedProduct?.division || ""}
                        onChange={(e) => handleRowChange(i, "DVN", e.target.value)}
                        placeholder="DIV"
                      />
                    </td>

                    {/* SHEET COLUMN */}
                    <td className="px-4 py-3 text-center align-top" style={{ minWidth: '120px' }}>
                      {(() => {
                        const sheet = getProductSheet(i);
                        if (sheet) {
                          return (
                            <span className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium ${sheet.color.badge} ${sheet.color.text}`}>
                              📋 {sheet.name}
                            </span>
                          );
                        } else {
                          return (
                            <label className="flex items-center justify-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedRows.includes(i)}
                                onChange={() => toggleRowSelection(i)}
                                className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </label>
                          );
                        }
                      })()}
                    </td>

                    {/* STATUS COLUMN */}
                    <td className="px-4 py-3 text-center align-top" style={{ minWidth: '80px' }}>
                      {hasError ? (
                        <Badge variant="warning">Invalid</Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </td>

                    {/* DELETE COLUMN */}
                    <td className="px-4 py-3 text-center align-top" style={{ minWidth: '60px' }}>
                      <button
                        onClick={() => deleteRow(i)}
                        className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
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
        </div>

        {/* ACTIONS */}
        <div className="p-4 bg-neutral-50 border-t">
          <div className="flex justify-between items-center">
            <Button
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              ← Back
            </Button>

            <div className="flex gap-3">
              <Button 
          onClick={() => handleConvert(false)} 
          isLoading={converting}
          disabled={!selectedCustomer}
        >
          <ArrowRight className="w-4 h-4 mr-1" />
          {converting ? "Converting..." : "Convert to Excel"}
        </Button>
            </div>
          </div>
        </div>
      </Card>

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