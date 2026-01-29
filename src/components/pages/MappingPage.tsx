/**
 * MAPPING PAGE - OPTIMIZED LAYOUT VERSION
 * Improvements: 
 * - Reduced ITEMDESC column width
 * - Balanced column sizing
 * - Added proper spacing between cells
 * - Professional table layout
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
  Gift,
  Package,
  Database,
  ChevronDown,
  ChevronRight,
  Box,
  Check,
  Edit2
} from "lucide-react";
import { Card } from "../Card";
import { Button } from "../Button";
import { Badge } from "../Badge";
import { Alert, AlertDescription } from "../ui/alert";
import { toast } from "sonner";
import api from "../../services/api";
import { useNavigate, useLocation } from "react-router-dom";
import { Modal } from "../Modal";
import { SchemePopup } from "../modals/SchemePopup";

/**
 * 🧠 FRONTEND SCHEME ENGINE (Strict Mirror of Backend)
 */
const FrontendSchemeEngine = {
    generateVirtualSlabs: (explicitSlabs: any[], orderQty: number) => {
        const sorted = [...explicitSlabs].filter(s => s.minQty > 0).sort((a, b) => a.minQty - b.minQty);
        if (sorted.length === 0) return [];

        const base = sorted[0];
        const baseQty = base.minQty;
        const baseFree = base.freeQty;
        
        // Generate enough virtual slabs to cover the order + upsell room
        const maxTarget = Math.max(orderQty * 2, baseQty * 10);
        
        const allSlabs = [];
        let multiplier = 1;
        let currentQty = baseQty;

        while (currentQty <= maxTarget) {
            const explicit = sorted.find(s => s.minQty === currentQty);
            if (explicit) {
                allSlabs.push({ ...explicit, isVirtual: false });
            } else {
                allSlabs.push({
                    minQty: currentQty,
                    freeQty: multiplier * baseFree,
                    isVirtual: true,
                    schemeName: `Auto-Pattern (x${multiplier})`,
                    schemeId: base.schemeId || 'virtual'
                });
            }
            multiplier++;
            currentQty = baseQty * multiplier;
        }
        return allSlabs.sort((a, b) => a.minQty - b.minQty);
    },

    calculate: (orderQty: number, slabs: any[]) => {
        if (orderQty <= 0 || !slabs.length) return { freeQty: 0, appliedSlab: null };
        
        // Find largest slab <= orderQty
        const applicable = slabs.filter(s => s.minQty <= orderQty);
        if (applicable.length === 0) return { freeQty: 0, appliedSlab: null };

        const bestSlab = applicable[applicable.length - 1]; // Last one is largest
        return {
            freeQty: bestSlab.freeQty,
            appliedSlab: bestSlab
        };
    }
};


export function MappingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const parsedResult = location.state?.parsedResult;

  const [rows, setRows] = useState<any[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<number, string[]>>({});
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  // Grouping State
  const [expandedDivisions, setExpandedDivisions] = useState<Record<string, boolean>>({});

  const [customers, setCustomers] = useState<any[]>([]);
  const [customerInput, setCustomerInput] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const autoCustomerLocked = useRef(false);

  /* 📊 MASTER DATA COUNTS */
  const [counts, setCounts] = useState({ products: 0, customers: 0 });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [activeEditRow, setActiveEditRow] = useState<number | null>(null);

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

  const formatProductDisplay = (p: any) => {
    if (!p) return "";
    let name = p.productName || [p.baseName, p.variant, p.dosage].filter(Boolean).join(" ");
    
    // Fix specific DB data quality issues
    // 1. "GM 1MG" -> "1GM" (e.g. DOLO- GM 1MG -> DOLO- 1GM)
    if (name.includes("GM 1MG")) {
      name = name.replace("GM 1MG", "1GM");
    }
    
    return name;
  };

  const SHEET_COLORS = [
    { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', badge: 'bg-blue-100' },
    { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', badge: 'bg-green-100' },
    { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', badge: 'bg-purple-100' },
    { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', badge: 'bg-amber-100' },
    { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700', badge: 'bg-pink-100' },
  ];

  /* ---------------- LOAD MASTER PRODUCTS & COUNTS ---------------- */
  useEffect(() => {
    setLoadingCounts(true);
    const fetchCounts = async () => {
      try {
        const [prodRes, custRes] = await Promise.all([
          api.get("/admin/products", { params: { limit: 1 } }),
          api.get("/admin/customers", { params: { limit: 1 } })
        ]);
        setCounts({
          products: prodRes.data?.total || 0,
          customers: custRes.data?.total || 0
        });
      } catch (err) {
        console.error("Failed to fetch counts", err);
      } finally {
        setLoadingCounts(false);
      }
    };

    fetchCounts();

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
        .get("/admin/customers", { params: { search: customerInput, limit: 100 } })
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

    const sanitizedRows = parsedResult.dataRows.map((r: any) => {
      const qty = Number(r.ORDERQTY) || 0;
      const boxPack = Number(r["BOX PACK"] || r.matchedProduct?.boxPack) || 0;
      let pack = r.PACK;

      if (boxPack > 0 && qty > 0) {
        const rawPack = qty / boxPack;
        pack = Number.isInteger(rawPack) ? rawPack : Number(rawPack.toFixed(2));
      }

      return { ...r, PACK: pack, ORDERQTY: qty };
    });

    setRows(sanitizedRows);
    setUploadId(parsedResult.uploadId);

    if (parsedResult.customer) {
      const { name, code, candidates, source } = parsedResult.customer;

      if (name) setCustomerInput(name);

      if ((source === 'EXACT' || source === 'FUZZY_AUTO') && code) {
        setSelectedCustomer({
          customerCode: code,
          customerName: name,
          city: parsedResult.customer.city,
          state: parsedResult.customer.state
        });
        autoCustomerLocked.current = true;
        toast.success(`Auto-selected customer: ${name}`);
      }

      if (source === 'MANUAL_REQUIRED' && candidates?.length > 0) {
        setCustomers(candidates.map((c: any) => c.customer || c));
        setShowCandidates(true);
        toast.warning(`Multiple customers found for "${name}". Please select one.`);
      }

      if (source === 'NONE' || source === 'NOT_FOUND') {
        toast.warning(`Customer "${name}" not found in master. Please search and select.`);
      }
    }

    setExpandedDivisions({});

    parsedResult.dataRows.forEach((row: any, i: number) => validateRow(i, row));
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
      { ITEMDESC: "", ORDERQTY: "", manualProduct: null, isNew: true }
    ]);
  };

  const deleteRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  /* ---------------- HANDLE ROW CHANGE ---------------- */
  const handleRowChange = (index: number, field: string, value: any) => {
    setRows(prev => {
      const next = [...prev];
      let updatedRow = { ...next[index], [field]: value };

      if (field === 'matchedProduct') {
          updatedRow.availableSchemes = undefined; // Reset schemes so fetcher triggers
          updatedRow.schemeApplied = false;
      }

      if (field === 'ORDERQTY' || field === 'BOX PACK') {
        if (field === 'ORDERQTY') updatedRow.schemeApplied = false; // Reset scheme status on manual edit
        
        const qty = Number(field === 'ORDERQTY' ? value : updatedRow.ORDERQTY) || 0;
        const boxPack = Number(field === 'BOX PACK' ? value : (updatedRow["BOX PACK"] || updatedRow.matchedProduct?.boxPack)) || 0;

        if (boxPack > 0) {
          const rawPack = qty / boxPack;
          updatedRow.PACK = Number.isInteger(rawPack) ? rawPack : Number(rawPack.toFixed(2));
        }
      }

      next[index] = updatedRow;

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

  /* ---------------- FETCH SCHEMES FOR ROWS ---------------- */
  useEffect(() => {
    if (!selectedCustomer?.customerCode || rows.length === 0) return;

    const fetchAllSchemes = async () => {
        // Only fetch for rows that have a matched product but Schemes are UNDEFINED (not fetched yet)
        const rowsToUpdate = rows.map((r, i) => ({ r, i }))
             .filter(({ r }) => r.matchedProduct && r.availableSchemes === undefined);

        if (rowsToUpdate.length === 0) return;
        
        // We do this individually to avoid a massive batch payload if many different products
        const updates: Record<number, any[]> = {};

        await Promise.all(rowsToUpdate.map(async ({ r, i }) => {
            try {
                const res = await api.get(`/orders/schemes/product/${r.matchedProduct.productCode}`, {
                    params: { customerCode: selectedCustomer.customerCode, division: r.matchedProduct.division }
                });
                // Always set result, even if empty array, to prevent re-fetching
                updates[i] = res.data?.schemes || [];
            } catch (err) {
                 updates[i] = []; // Set empty on error to prevent retry loop
            }
        }));
        
        if (Object.keys(updates).length > 0) {
             setRows(prev => {
                 const next = [...prev];
                 Object.entries(updates).forEach(([index, schemes]) => {
                     const idx = Number(index);
                     if (next[idx]) {
                         next[idx] = { ...next[idx], availableSchemes: schemes };
                     }
                 });
                 return next;
             });
        }
    };
    
    fetchAllSchemes();
  }, [selectedCustomer?.customerCode, rows]); // Depend on rows to catch manual mapping changes

  /* ---------------- CALCULATE SCHEME INFO ---------------- */
  const getSchemeInfo = (row: any) => {
      if (!row.availableSchemes || row.availableSchemes.length === 0) return null;
      
      const qty = Number(row.ORDERQTY) || 0;
      
      // 1. Get explicit slabs
      // For now, assume first scheme is the relevant one (as per backend logic found)
      // or flatten all slabs from all schemes? 
      // The backend returns a list of schemes. We usually pick the best one.
      // Let's use the first one available for simplicity or strict match.
      const scheme = row.availableSchemes[0]; 
      if (!scheme || !scheme.slabs) return null;

      // 2. Generate Virtual Slabs using Engine
      const allSlabs = FrontendSchemeEngine.generateVirtualSlabs(scheme.slabs, qty);
      
      // 3. Find Active Slab (Benefit already achieved)
      const execution = FrontendSchemeEngine.calculate(qty, allSlabs);
      const activeSlab = execution.appliedSlab;
      
      // 4. Find Next Slab (Upsell)
      // Find the first slab strictly greater than current qty
      const nextSlab = allSlabs.find(s => s.minQty > qty);
      
      return { 
          active: activeSlab ? { ...activeSlab, totalFree: execution.freeQty } : null,
          next: nextSlab,
          all: allSlabs 
      };
  };

  /* 📋 SHEET MANAGEMENT FUNCTIONS */
  const getProductSheet = (rowIndex: number) => {
    return sheets.find(sheet => sheet.productIndices.includes(rowIndex));
  };

  const toggleRowSelection = (rowIndex: number) => {
    if (getProductSheet(rowIndex)) return;
    setSelectedRows(prev =>
      prev.includes(rowIndex) ? prev.filter(i => i !== rowIndex) : [...prev, rowIndex]
    );
  };

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
    setSelectedRows([]);
    toast.success(`Created ${newSheet.name} with ${selectedRows.length} products`);
  };

  const removeSheet = (sheetId: string) => {
    setSheets(prev => prev.filter(s => s.id !== sheetId));
    toast.success("Sheet removed");
  };

  const toggleDivision = (division: string) => {
    setExpandedDivisions(prev => ({ ...prev, [division]: !prev[division] }));
  };

  /* ---------------- SCHEME CHECK LOGIC ---------------- */
  const checkForSchemes = async () => {
    try {
      const cleanRows = rows.map(r => ({ ...r, ORDERQTY: Number(r.ORDERQTY) || 0 }));
      const res = await api.post("/orders/check-schemes", {
        dataRows: cleanRows,
        customerCode: selectedCustomer?.customerCode
      });

      if (res.data?.suggestions?.length > 0) {
        setSchemeSuggestions(res.data.suggestions);
        setShowSchemeModal(true);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Scheme check failed", err);
      return true;
    }
  };

  const applySchemeSuggestion = (suggestion: any) => {
    handleRowChange(suggestion.rowIndex, "ORDERQTY", suggestion.suggestedQty);
    setSchemeSuggestions(prev => prev.filter(s => s.rowIndex !== suggestion.rowIndex));
    toast.success(`Updated quantity to ${suggestion.suggestedQty}!`);
  };

  /* ---------------- CONVERT ---------------- */
  const handleConvert = async (skipSchemeCheck = false) => {
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

    const unmapped = rows.some(r => !r.matchedProduct && !r.manualProduct);
    if (unmapped) {
      toast.error("Please manually map all unmatched products");
      return;
    }

    // if (!skipSchemeCheck) {
    //   const proceed = await checkForSchemes();
    //   if (!proceed) return;
    // }

    try {
      setConverting(true);

      const cleanRows = rows.map(r => {
        const schemeInfo = r.schemeApplied ? getSchemeInfo(r) : null;
        return {
          ...r,
          ORDERQTY: Number(r.ORDERQTY) || 0,
          matchedProduct: r.matchedProduct ? { ...r.matchedProduct } : null,
          ITEMDESC: r.matchedProduct ? formatProductDisplay(r.matchedProduct) : r.ITEMDESC,
          // 🔥 PASS STORED SCHEME VALUES TO BACKEND (Source of Truth)
          freeQty: schemeInfo?.active ? schemeInfo.active.totalFree : 0,
          schemePercent: schemeInfo?.active?.schemePercent || 0
        };
      });

      const res = await api.post("/orders/convert", {
        uploadId,
        customerCode: selectedCustomer.customerCode,
        dataRows: cleanRows,
        sheets: sheets.map(s => ({ name: s.name, productIndices: s.productIndices }))
      });

      toast.success("Order quantities processed successfully");
      navigate(`/result/${res.data.uploadId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  // Group Data Logic
  const groupedData = React.useMemo(() => {
    const groups: Record<string, any[]> = {};
    rows.forEach((row, index) => {
      const div = row.DVN || row.Division || row.DIVISION || row.division || row.dvn || row.matchedProduct?.division || "Unassigned";
      if (!groups[div]) groups[div] = [];
      groups[div].push({ row, originalIndex: index });
    });
    return groups;
  }, [rows]);

  const sortedDivisions = Object.keys(groupedData).sort();

  /* ---------------- RENDER ---------------- */
  // UNIVERSAL ROUND OFF
  const handleUniversalRoundOff = () => {
    let updatedCount = 0;
    setRows(prevRows => {
      return prevRows.map(row => {
        const boxPack = Number(row["BOX PACK"] || row.matchedProduct?.boxPack || 0);
        const currentQty = Number(row.ORDERQTY || 0);
        
        if (boxPack > 0 && currentQty > 0) {
          const remainder = currentQty % boxPack;
          if (remainder !== 0) {
            const newQty = Math.ceil(currentQty / boxPack) * boxPack;
            updatedCount++;
            
            // Calculate new PACK
            const newPack = newQty / boxPack;
            const finalPack = Number.isInteger(newPack) ? newPack : Number(newPack.toFixed(2));

            return { ...row, ORDERQTY: newQty, PACK: finalPack };
          }
        }
        return row;
      });
    });

    if (updatedCount > 0) {
      toast.success(`Rounded off ${updatedCount} products to nearest box pack`);
    } else {
      toast.info("All products are already rounded");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-blue-50/30 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-600">
              Map Products
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-neutral-500 font-medium">
                {rows.length} Items
              </span>
              <span className="w-1 h-1 bg-neutral-300 rounded-full"></span>
              <span className="text-sm text-neutral-400">
                {rows.filter(r => r.matchedProduct).length} Mapped
              </span>
            </div>
          </div>
          
          <Button onClick={addRow} variant="secondary" size="sm" className="gap-2">
            <Package className="w-4 h-4" />
            + Add Item
          </Button>
        </div>

        {/* Customer Selection Card */}
        <Card className="p-6 border-2 border-blue-100 bg-white shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-semibold text-neutral-900">
                  Select Customer (Admin Master)
                </h2>
              </div>
              {showCandidates && (
                <Badge variant="warning" className="gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Multiple matches - please select
                </Badge>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={customerInput}
                onChange={(e) => {
                  autoCustomerLocked.current = false;
                  setShowCandidates(false);
                  setCustomerInput(e.target.value);
                  setSelectedCustomer(null);
                }}
                placeholder="Search customer by name or code"
                className="w-full border rounded px-3 py-2 pr-10 text-base"
                disabled={autoCustomerLocked.current && selectedCustomer}
              />
              {searching && (
                <RefreshCw className="absolute right-3 top-2.5 w-4 h-4 text-neutral-400 animate-spin" />
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
              <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto shadow-sm">
                {customers.map(c => (
                  <button
                    key={c.customerCode}
                    onClick={() => handleCustomerSelect(c)}
                    className="w-full text-left px-3 py-2 text-base hover:bg-blue-50 border-b last:border-b-0"
                  >
                    <div className="font-medium text-neutral-900">{c.customerName}</div>
                    <div className="text-base text-neutral-500 mt-0.5">
                      Code: {c.customerCode}
                      {(c.city || c.state) && (
                        <span> • {c.city || c.state}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedCustomer && (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <div className="font-medium text-green-900">{selectedCustomer.customerName}</div>
                  <div className="text-base text-green-700 mt-0.5">
                    Code: {selectedCustomer.customerCode}
                    {(selectedCustomer.city || selectedCustomer.state) && (
                      <span> • {selectedCustomer.city || selectedCustomer.state}</span>
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

        {/* Info Alert */}
        <Alert className="border-blue-200 bg-blue-50">
          <Database className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-base text-blue-900">
            Product & customer data are taken from Admin Master. Products with schemes will be highlighted in yellow in the final Excel.
          </AlertDescription>
        </Alert>

        {/* Sheets Toolbar */}
        {rows.length > 0 && (
          <Card className="p-4 border-purple-100 bg-gradient-to-r from-purple-50/50 to-pink-50/50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-base">
                {selectedRows.length > 0 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-neutral-700">
                      ✓ {selectedRows.length} product{selectedRows.length > 1 ? 's' : ''} selected
                    </span>
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 text-neutral-500" />
                    <span className="text-neutral-600">Select products to organize into sheets</span>
                  </>
                )}
              </div>
              <Button
                onClick={createNewSheet}
                disabled={selectedRows.length === 0}
                size="sm"
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <Gift className="w-4 h-4" />
                📋 Create Separate Sheet
              </Button>
            </div>

            {sheets.length > 0 && (
              <div className="mt-4 pt-4 border-t border-purple-200">
                <div className="text-base font-medium text-neutral-600 mb-2">Created Sheets:</div>
                <div className="flex flex-wrap gap-2">
                  {sheets.map(sheet => (
                    <div
                      key={sheet.id}
                      className={`px-3 py-1.5 rounded-full text-base font-medium ${sheet.color.bg} ${sheet.color.text} ${sheet.color.border} border flex items-center gap-2`}
                    >
                      📋 {sheet.name} ({sheet.productIndices.length} products)
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

        {/* Product Table - OPTIMIZED LAYOUT */}
        <Card className="overflow-hidden border-2 border-neutral-200 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-neutral-800 to-neutral-700 text-black">
                  <th className="text-left px-3 py-3 text-base font-semibold uppercase tracking-wide w-[20%]">
                    Invoice Item
                  </th>
                  <th className="text-left px-3 py-3 text-base font-semibold uppercase tracking-wide w-[25%]">
                    Mapped Product
                  </th>
                  <th className="text-center px-3 py-3 text-base font-semibold uppercase tracking-wide w-[8%]">
                    Qty
                  </th>
                  <th className="text-center px-3 py-3 text-base font-semibold uppercase tracking-wide w-[8%]">
                    Box Pack
                  </th>
                  <th className="text-center px-3 py-3 text-base font-semibold uppercase tracking-wide w-[8%]">
                    Pack
                  </th>
                  <th className="text-center px-3 py-3 text-base font-semibold uppercase tracking-wide w-[10%]">
                    Division
                  </th>
                  <th className="text-center px-3 py-3 text-base font-semibold uppercase tracking-wide w-[10%]">
                     Sheet
                  </th>
                  <th className="text-center px-3 py-3 text-base font-semibold uppercase tracking-wide w-[8%]">
                    Status
                  </th>
                  <th className="text-center px-3 py-3 text-base font-semibold uppercase tracking-wide w-[3%]">
                    Del
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDivisions.map(division => {
                  const isExpanded = expandedDivisions[division];
                  const groupRows = groupedData[division];

                  return (
                    <React.Fragment key={division}>
                      {/* DIVISION HEADER */}
                      <tr
                        onClick={() => toggleDivision(division)}
                        className="bg-gradient-to-r from-blue-100 to-blue-50 hover:from-blue-200 hover:to-blue-100 cursor-pointer border-y-2 border-blue-300 transition-colors"
                      >
                        <td colSpan={9} className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-blue-700" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-blue-700" />
                            )}
                            <span className="font-bold text-blue-900 text-base uppercase tracking-wide">
                              {division}
                            </span>
                            <Badge className="bg-blue-200 text-blue-800 text-base">
                              {groupRows.length} items
                            </Badge>
                          </div>
                        </td>
                      </tr>

                      {/* ROWS */}
                      {isExpanded && groupRows.map(({ row, originalIndex: i }) => {
                        const hasError = rowErrors[i]?.length > 0;
                        const sheet = getProductSheet(i);

                        return (
                          <tr
                            key={i}
                            className={`
                              border-b border-neutral-200 hover:bg-neutral-50 transition-colors
                              ${hasError ? "bg-red-50" : ""}
                              ${sheet ? sheet.color.bg : ""}
                            `}
                          >
                                {/* NEW COLUMN 1: INVOICE ITEM */}
                                <td className="px-3 py-1 align-top text-base font-medium text-neutral-800 break-words">
                                    {row.ITEMDESC || "(No Name)"}
                                </td>

                                {/* NEW COLUMN 2: MAPPED PRODUCT (Search & Result) */}
                                <td className="px-3 py-1 align-top">
                                  <div className="flex flex-col gap-1">
                                    {/* Edit Mode / Search */}
                                    <div className="w-full">
                                      {!row.matchedProduct ? (
                                        <div className="relative">
                                          <input
                                            type="text"
                                            value={row.ITEMDESC || ""} // Initialize search with invoice text if trying to map manually
                                            onChange={(e) => {
                                              // We might want to separate search term from row.ITEMDESC if we want to preserve original
                                              // But typically manual mapping replaces the "search key". 
                                              // For now, let's keep it bound to ITEMDESC or a temp search field?
                                              // The previous code bound it to ITEMDESC. Let's stick to that to avoid breaking logic, 
                                              // although it modifies the invoice item text effectively.
                                              handleRowChange(i, "ITEMDESC", e.target.value);
                                              handleRowChange(i, "matchedProduct", null);
                                            }}
                                            placeholder="Search master product..."
                                            className="w-full text-base border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                          />
                                          {/* AUTOCOMPLETE DROPDOWN */}
                                          {row.ITEMDESC?.length >= 2 && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-300 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                              {allProducts
                                                .filter(p => {
                                                  const normalizeTokens = (text = "") =>
                                                    text.toUpperCase().replace(/[^A-Z0-9]/g, " ").split(/\s+/).filter(Boolean);
                                                  const invTokens = normalizeTokens(row.ITEMDESC);
                                                  const prodTokens = normalizeTokens(p.productName);
                                                  const baseTokens = normalizeTokens(p.baseName || "");

                                                  if (invTokens.length === 0) return false;

                                                  const matchForward = invTokens.every(t => prodTokens.includes(t));
                                                  const matchBackward = prodTokens.length > 0 && prodTokens.every(t => invTokens.includes(t));
                                                  const matchBase = baseTokens.length > 0 && invTokens.every(t => baseTokens.includes(t));
                                                  const matchBrand = invTokens.some(t => t.length >= 3 && isNaN(Number(t)) && prodTokens.includes(t));

                                                  return matchForward || matchBackward || matchBase || matchBrand;
                                                })
                                                .sort((a, b) => 0)
                                                .slice(0, 50)
                                                .map(p => (
                                                  <button
                                                    key={p.productCode}
                                                    onClick={() => {
                                                      setRows(prev => {
                                                        const next = [...prev];
                                                        next[i] = {
                                                          ...next[i],
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
                                                                updated[i] = {
                                                                  ...updated[i],
                                                                  availableSchemes: res.data.schemes
                                                                };
                                                                return updated;
                                                              });
                                                            }
                                                          });
                                                        }

                                                        return next;
                                                      });
                                                    }}
                                                    className="w-full text-left px-3 py-1.5 text-base hover:bg-blue-50 border-b border-neutral-100 last:border-b-0 transition-colors group/item"
                                                  >
                                                    <div className="font-medium text-neutral-900 group-hover/item:text-blue-700">
                                                      {formatProductDisplay(p)}
                                                    </div>
                                                    <div className="text-neutral-500 mt-0.5">
                                                      {p.productCode} • {p.division}
                                                    </div>
                                                  </button>
                                                ))}
                                            </div>
                                          )}
                                        </div>
                                      ) : null}
                                    </div>

                                    {/* Mapped Product Info */}
                                    {row.matchedProduct && (
                                          <div className="w-full">
                                            <div 
                                              onClick={() => handleRowChange(i, "matchedProduct", null)}
                                              className="flex items-center justify-between gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded shadow-sm group/mapped cursor-pointer hover:bg-green-100 transition-colors"
                                              title="Click to change product"
                                            >
                                              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                                <div className="font-bold text-green-900 truncate text-base">
                                                  {formatProductDisplay(row.matchedProduct)}
                                                </div>
                                                <div className="text-green-700 text-base opacity-80 whitespace-nowrap">
                                                  #{row.matchedProduct.productCode}
                                                </div>
                                              </div>
                                              <Edit2 className="w-4 h-4 text-green-600 opacity-0 group-hover/mapped:opacity-100 transition-opacity ml-1" />
                                            </div>
                                          </div>
                                        )}
  
                                    {/* SCHEME BADGES - Minimal Gift Box Style */}
                                    {row.matchedProduct && row.availableSchemes?.length > 0 && !row.schemeApplied && (
  
                                       (() => {
                                           const schemeInfo = getSchemeInfo(row);
                                           const { active, next, all } = schemeInfo || {};
                                           
                                           // Fallback for when no active/next but schemes exist
                                           if (!active && !next && (!all || all.length === 0)) return null;

                                           return (
                                            <div className="mt-1 flex flex-col gap-0.5 w-full relative group/scheme">
                                                
                                                {/* ACTIVE SCHEME (Eligible) - Minimal Pill */}
                                                {active && (
                                                    <div className="flex items-center justify-between px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            // Toggle apply - FIX: Set Qty to Billed (minQty) not Total (min+free)
                                                            // Backend adds Free Qty automatically
                                                            const finalQty = active.minQty;
                                                            handleRowChange(i, "ORDERQTY", finalQty);
                                                            handleRowChange(i, "schemeApplied", true);
                                                            toast.success(`Applied: ${finalQty} + ${active.totalFree} Free`);
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-1.5">
                                                            <Gift className="w-3 h-3 text-amber-600" />
                                                            <span>{active.minQty}+{active.totalFree} Free</span>
                                                        </div>
                                                        <div className="bg-amber-200 text-amber-800 text-[9px] px-1 rounded font-bold"></div>
                                                    </div>
                                                )}

                                                {/* UPSELL (Next) - Minimal Pill */}
                                                {next && (
                                                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                                                         onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleRowChange(i, "ORDERQTY", next.minQty);
                                                              toast.info(`Updated to ${next.minQty}`);
                                                         }}
                                                         title={`Add ${next.minQty - (Number(row.ORDERQTY)||0)} to get ${next.minQty} + ${next.freeQty} Free`}
                                                    >
                                                         <Zap className="w-3 h-3 text-blue-500 fill-blue-500" />
                                                         <span className="truncate">
                                                            Add {next.minQty - (Number(row.ORDERQTY)||0)} → <span className="font-bold">{next.freeQty} Free</span>
                                                         </span>
                                                    </div>
                                                )}
                                                
                                                {/* GENERIC OFFER BADGE (If logic missed active/next but schemes exist) */}
                                                {!active && !next && (all?.length ?? 0) > 0 && (
                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
                                                        <Gift className="w-3 h-3 text-neutral-400" />
                                                        <span>{all?.length} Offers</span>
                                                    </div>
                                                )}
                                                
                                                {/* HOVER DROPDOWN (Compact) */}
                                                <div className="absolute z-50 left-0 top-full mt-0.5 w-56 bg-white rounded shadow-xl border border-neutral-200 hidden group-hover/scheme:block p-1">
                                                    <div className="text-[10px] font-bold text-neutral-400 mb-1 px-1 uppercase tracking-wider">Schemes</div>
                                                    <div className="space-y-0.5 max-h-40 overflow-y-auto">
                                                        {all?.map((s: any, idx: number) => {
                                                              const isActive = active?.minQty === s.minQty;
                                                              const isNext = next?.minQty === s.minQty;
                                                              return (
                                                                  <button
                                                                      key={idx}
                                                                      onClick={(e) => {
                                                                          e.stopPropagation(); 
                                                                          handleRowChange(i, "ORDERQTY", s.minQty);
                                                                      }}
                                                                      className={`w-full text-left px-2 py-1 rounded-[4px] text-[10px] flex items-center justify-between transition-colors ${
                                                                          isActive ? 'bg-amber-50 text-amber-900 font-semibold' : 
                                                                          isNext ? 'bg-blue-50 text-blue-800' : 
                                                                          'hover:bg-neutral-50 text-neutral-600'
                                                                      }`}
                                                                  >
                                                                      <span>{s.schemeName || "Slab"} ({s.minQty}+{s.freeQty})</span>
                                                                      {isActive && <Check className="w-3 h-3 text-amber-600" />}
                                                                      {isNext && <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded">Next</span>}
                                                                  </button>
                                                              );
                                                         })}
                                                    </div>
                                               </div>
                                           </div>
                                          );
                                      })()

                                )}
                              </div>
                            </td>

                            {/* QUANTITY COLUMN - INCREASED WIDTH */}
                            <td className="px-3 py-1 text-center">
                              {(() => {
                                 const info = getSchemeInfo(row);
                                 // Show "50 + 10" text ONLY if scheme is APPLIED and not currently editing
                                 if (info?.active && row.schemeApplied && activeEditRow !== i) {
                                     return (
                                         <div 
                                          onClick={() => setActiveEditRow(i)}
                                          className="w-full text-center text-base font-bold text-green-700 bg-green-50 px-2 py-1 border-2 border-green-200 rounded cursor-text flex items-center justify-center gap-1 h-[34px]"
                                          title="Click to edit quantity"
                                        >
                                           {row.ORDERQTY} <span className="text-xs text-green-500">+</span> {info.active.totalFree}
                                        </div>
                                     );
                                 }

                                 // Otherwise show Input
                                 return (
                                    <input
                                      type="number"
                                      autoFocus={activeEditRow === i}
                                      onBlur={() => setActiveEditRow(null)}
                                      onKeyDown={(e) => {
                                          if(e.key === 'Enter') setActiveEditRow(null);
                                      }}
                                      className={`w-full text-center text-base font-semibold px-2 py-1 border-2 rounded transition-all h-[34px] ${
                                        hasError
                                          ? "border-red-500 bg-red-50 text-red-700"
                                          : (row["BOX PACK"] > 0 && Number(row.ORDERQTY) % Number(row["BOX PACK"]) === 0)
                                          ? "border-green-300 bg-green-50 text-green-800"
                                          : "border-neutral-200 bg-white"
                                      }`}
                                      value={row.ORDERQTY || ""}
                                      onChange={(e) => handleRowChange(i, "ORDERQTY", e.target.value)}
                                      placeholder="0"
                                    />
                                 );
                              })()}
                            </td>

                            {/* BOX PACK COLUMN - INCREASED WIDTH */}
                            <td className="px-3 py-1 text-center">
                              <div className="relative">
                                <input
                                  type="number"
                                  className="w-full text-center text-base px-2 py-1 border rounded bg-neutral-50"
                                  value={row["BOX PACK"] || row.matchedProduct?.boxPack || ""}
                                  onChange={(e) => handleRowChange(i, "BOX PACK", e.target.value)}
                                />
                                {Number(row["BOX PACK"] || row.matchedProduct?.boxPack) > 1 && (
                                  <button
                                    onClick={() => {
                                      const boxPack = Number(row["BOX PACK"] || row.matchedProduct?.boxPack || 0);
                                      const currentQty = Number(row.ORDERQTY || 0);
                                      if (boxPack > 0 && currentQty > 0) {
                                        const remainder = currentQty % boxPack;
                                        const newQty = remainder === 0 ? currentQty : Math.ceil(currentQty / boxPack) * boxPack;
                                        if (newQty !== currentQty) {
                                          handleRowChange(i, "ORDERQTY", newQty);
                                          toast.success(`Rounded to ${newQty}`);
                                        } else {
                                          toast.info("Already rounded");
                                        }
                                      }
                                    }}
                                    className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 text-neutral-300 hover:text-blue-600 transition-colors"
                                    title="Click to Round Up"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* PACK COLUMN - INCREASED WIDTH */}
                            <td className="px-3 py-1 text-center">
                              <input
                                type="text"
                                className="w-full text-center text-base font-medium px-2 py-1 border rounded bg-blue-50 text-blue-800"
                                value={row.PACK || ""}
                                onChange={(e) => handleRowChange(i, "PACK", e.target.value)}
                              />
                            </td>

                            {/* DIVISION COLUMN */}
                            <td className="px-3 py-1 text-center">
                              <div className="text-base font-medium text-neutral-700">
                                {row.matchedProduct?.division || row.DVN || "-"}
                              </div>
                            </td>

                            {/* SHEET COLUMN */}
                            <td className="px-3 py-1 text-center">
                              {sheet ? (
                                <Badge className={`${sheet.color.badge} ${sheet.color.text} text-base`}>
                                  {sheet.name}
                                </Badge>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={selectedRows.includes(i)}
                                  onChange={() => toggleRowSelection(i)}
                                  className="w-4 h-4 cursor-pointer"
                                />
                              )}
                            </td>

                            {/* STATUS COLUMN */}
                            <td className="px-3 py-1 text-center">
                              {row.matchedProduct ? (
                                <Badge className="bg-green-100 text-green-700 text-base font-semibold">
                                  <Check className="w-3 h-3 mr-1" />
                                  OK
                                </Badge>
                              ) : (
                                <Badge variant="warning" className="text-base">
                                  Map
                                </Badge>
                              )}
                            </td>

                            {/* DELETE BUTTON */}
                            <td className="px-3 py-1 text-center">
                              <button
                                onClick={() => deleteRow(i)}
                                className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                                title="Delete row"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-neutral-500">
                      <Package className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                      No products added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-center pt-6 gap-3">
             <Button 
                variant="secondary"
                onClick={handleUniversalRoundOff}
                className="bg-white hover:bg-neutral-50 border-blue-200 text-blue-700 hover:text-blue-800 shadow-md"
                title="Round off all quantities to nearest box pack"
             >
                <RefreshCw className="w-5 h-5 mr-2" />
                Round Off
             </Button>

          <Button
            onClick={() => handleConvert()}
            isLoading={converting}
            className="px-8 py-3 text-base shadow-lg hover:shadow-xl transition-all"
          >
            <Zap className="w-5 h-5 mr-2" />
            Process Orders
          </Button>
        </div>
      </div>

      {/* SCHEME POPUP */}
      <SchemePopup
        isOpen={showSchemeModal}
        onClose={() => setShowSchemeModal(false)}
        suggestions={schemeSuggestions}
        onApply={applySchemeSuggestion}
        onSkip={() => {
          setShowSchemeModal(false);
          handleConvert(true);
        }}
        onDone={() => {
          setShowSchemeModal(false);
          handleConvert(true);
        }}
      />
    </div>
  );
}