/**
 * MAPPING PAGE - OPTIMIZED LAYOUT VERSION
 * Improvements: 
 * - Reduced ITEMDESC column width
 * - Balanced column sizing
 * - Added proper spacing between cells
 * - Professional table layout
 */

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CheckCircle2,
  Search,
  FileText, // Added FileText
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
                    schemeId: base.schemeId || 'virtual',
                    schemePercent: base.schemePercent, // ✅ Propagate Scheme %
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


  /* ---------------- HELPERS ---------------- */
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

export function MappingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const parsedResult = location.state?.parsedResult; // Legacy support
  const multiFileResults = location.state?.results;  // New Multi-file support

  /* 📂 MULTI-FILE STATE */
  const [filesData, setFilesData] = useState<any[]>([]); // Metadata for each file

  // Unified State for ALL rows from ALL files
  const [rows, setRows] = useState<any[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<number, string[]>>({});
  const [uploadId, setUploadId] = useState<string | null>(null); // Use primary upload ID
  const [converting, setConverting] = useState(false);

  // Grouping State
  const [expandedDivisions, setExpandedDivisions] = useState<Record<string, boolean>>({});

  // Global Customer Search State (used when editing a specific file's customer)
  const [activeFileEdit, setActiveFileEdit] = useState<number | null>(null); // Index of file being edited
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerInput, setCustomerInput] = useState("");
  const [searching, setSearching] = useState(false);

  /* 📊 MASTER DATA COUNTS */
  const [counts, setCounts] = useState({ products: 0, customers: 0 });
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [activeSearchRow, setActiveSearchRow] = useState<number | null>(null);
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
    if (activeFileEdit === null) return;
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
  }, [customerInput, activeFileEdit]);

  /* ---------------- CLICK OUTSIDE ---------------- */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Logic for closing row search
      if (activeSearchRow !== null) {
        const target = e.target as HTMLElement;
        
        // Check if click is inside the portal dropdown
        if (target.closest('#portal-dropdown-container')) return;

        if (!target.closest(`#cell-search-${activeSearchRow}`)) {
          setActiveSearchRow(null);
        }
      }

      // Logic for closing customer search (if clicking outside the active edit area)
      if (activeFileEdit !== null) {
          const target = e.target as HTMLElement;
          if (!target.closest(`#file-customer-edit-${activeFileEdit}`)) {
              setActiveFileEdit(null);
          }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeSearchRow, activeFileEdit]);

  /* ---------------- HELPER: SANITIZE ROWS ---------------- */
  const sanitizeRows = (dataRows: any[], fileIndex: number) => {
      return dataRows.map((r: any) => {
        const qty = Number(r.ORDERQTY) || 0;
        const boxPack = Number(r["BOX PACK"] || r.matchedProduct?.boxPack) || 0;
        let pack = r.PACK;

        if (boxPack > 0 && qty > 0) {
          const rawPack = qty / boxPack;
          pack = Number.isInteger(rawPack) ? rawPack : Number(rawPack.toFixed(2));
        }
        return {
            ...r,
            PACK: pack,
            ORDERQTY: qty,
            searchQuery: r.ITEMDESC || "",
            _fileIndex: fileIndex // ✅ Tag row with source file
        };
      });
  };

  /* ---------------- INIT ---------------- */
  useEffect(() => {
    if (multiFileResults && multiFileResults.length > 0) {
        // Initialize Multi-file
        const allRows: any[] = [];
        const filesMetadata = multiFileResults.map((res: any, idx: number) => {
            const sanitized = sanitizeRows(res.dataRows, idx);
            allRows.push(...sanitized);

            // Initial Customer State
            let custState = {
                name: res.customer?.name || "",
                code: res.customer?.code || "",
                city: res.customer?.city,
                state: res.customer?.state,
                source: res.customer?.source,
                candidates: res.customer?.candidates || []
            };

            return {
                fileName: res.fileName,
                uploadId: res.uploadId,
                customer: custState
            };
        });

        setFilesData(filesMetadata);
        setRows(allRows);
        setUploadId(multiFileResults[0].uploadId); // Use first as primary

    } else if (parsedResult?.dataRows) {
        // Legacy Single File
        const sanitized = sanitizeRows(parsedResult.dataRows, 0);
        setFilesData([{
            fileName: location.state?.fileName || "Uploaded File",
            uploadId: parsedResult.uploadId,
            customer: parsedResult.customer
        }]);
        setRows(sanitized);
        setUploadId(parsedResult.uploadId);
    } else {
      toast.error("Invalid upload session. Please re-upload.");
      navigate("/upload");
    }
  }, [multiFileResults, parsedResult, navigate]);

  /* ---------------- CUSTOMER SELECTION ---------------- */
  const startEditingCustomer = (fileIndex: number) => {
      setActiveFileEdit(fileIndex);
      setCustomerInput(filesData[fileIndex].customer.name || "");
      setCustomers([]);
      // If we have candidates stored, maybe show them?
      // For simplicity, just let user search fresh or see input.
      if (filesData[fileIndex].customer.candidates?.length > 0) {
           setCustomers(filesData[fileIndex].customer.candidates.map((c: any) => c.customer || c));
      }
  };

  const handleCustomerSelect = (customer: any) => {
    if (activeFileEdit === null) return;

    const newCustomer = {
      code: customer.customerCode,
      name: customer.customerName,
      city: customer.city,
      state: customer.state,
      source: 'MANUAL',
      candidates: []
    };

    setFilesData(prev => {
        const next = [...prev];
        next[activeFileEdit] = { ...next[activeFileEdit], customer: newCustomer };
        return next;
    });

    toast.success(`Updated customer for ${filesData[activeFileEdit].fileName}`);
    setActiveFileEdit(null);
    setCustomers([]);
  };

  /* ---------------- VALIDATION ---------------- */
  const validateRow = (index: number, row: any) => {
    const errors: string[] = [];
    if (!row.ORDERQTY || isNaN(Number(row.ORDERQTY)) || Number(row.ORDERQTY) <= 0) {
      errors.push("Invalid ORDERQTY");
    }
    setRowErrors(prev => ({ ...prev, [index]: errors }));
  };

  // DROPDOWN POSITION STATE
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number, left: number, width: number } | null>(null);

  useEffect(() => {
     // Clear dropdown position when active row changes or becomes null
     if (activeSearchRow === null) {
         setDropdownPosition(null);
     }
  }, [activeSearchRow]);

  const updateDropdownPosition = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

      setDropdownPosition({
          top: rect.bottom + scrollTop,
          left: rect.left + scrollLeft,
          width: rect.width
      });
  };

  /* ---------------- ADD ROW ---------------- */
  const addRow = () => {
    // Determine which file to attribute new row to? Default to first file (0)
    setRows(prev => [
      ...prev,
      { ITEMDESC: "", searchQuery: "", ORDERQTY: "", manualProduct: null, isNew: true, _fileIndex: 0 }
    ]);
    toast.success("New item added");
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
          updatedRow.availableSchemes = undefined;
          updatedRow.schemeApplied = false;
      }

      if (field === 'ORDERQTY' || field === 'BOX PACK') {
        if (field === 'ORDERQTY') updatedRow.schemeApplied = false;
        
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

  /* ---------------- FETCH SCHEMES ---------------- */
  // Optimized to fetch schemes based on row's attributed customer
  useEffect(() => {
    const fetchAllSchemes = async () => {
        // Rows needing schemes (matched, but undefined schemes)
        const rowsToUpdate = rows.map((r, i) => ({ r, i }))
             .filter(({ r }) => r.matchedProduct && r.availableSchemes === undefined);

        if (rowsToUpdate.length === 0) return;
        
        const updates: Record<number, any[]> = {};

        await Promise.all(rowsToUpdate.map(async ({ r, i }) => {
            try {
                // Resolve customer for this row
                const fileIdx = r._fileIndex !== undefined ? r._fileIndex : 0;
                const fileCust = filesData[fileIdx]?.customer;
                
                if (!fileCust?.code) {
                    updates[i] = []; // No customer yet, can't fetch scheme
                    return;
                }

                const res = await api.get(`/orders/schemes/product/${r.matchedProduct.productCode}`, {
                    params: { customerCode: fileCust.code, division: r.matchedProduct.division }
                });
                updates[i] = res.data?.schemes || [];
            } catch (err) {
                 updates[i] = [];
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
    
    if (filesData.length > 0) {
        fetchAllSchemes();
    }
  }, [filesData, rows]);

  /* ---------------- CALCULATE SCHEME INFO ---------------- */
  const getSchemeInfo = (row: any) => {
      if (!row.availableSchemes || row.availableSchemes.length === 0) return null;
      
      const qty = Number(row.ORDERQTY) || 0;
      
      // 1. Get explicit slabs
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

  /* 📋 SHEET MANAGEMENT FUNCTIONS (unchanged logic works on unified rows) */
  const getProductSheet = (rowIndex: number) => {
    return sheets.find(sheet => sheet.productIndices.includes(rowIndex));
  };

  const toggleRowSelection = (rowIndex: number) => {
    console.log("Toggling row:", rowIndex);
    if (getProductSheet(rowIndex)) {
        console.log("Row already in sheet:", rowIndex);
        return;
    }
    const isSelected = selectedRows.includes(rowIndex);
    console.log("Currently selected?", isSelected);

    if (isSelected) {
        setSelectedRows(prev => prev.filter(i => i !== rowIndex));
    } else {
        setSelectedRows(prev => [...prev, rowIndex]);
    }
  };

  const createNewSheet = () => {
    console.log("Creating new sheet with rows:", selectedRows);
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
    
    console.log("New Sheet Object:", newSheet);

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
      // This function might need to be re-evaluated for multi-customer context
      // For now, it's not directly used in handleConvert, so leaving as is.
      const cleanRows = rows.map(r => ({ ...r, ORDERQTY: Number(r.ORDERQTY) || 0 }));
      const res = await api.post("/orders/check-schemes", {
        dataRows: cleanRows,
        customerCode: filesData[0]?.customer?.code // Using first file's customer for this check
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
  const handleConvert = async () => {
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

    // Check if ALL files have a customer selected
    const missingCustomer = filesData.some(f => !f.customer?.code);
    if (missingCustomer) {
      toast.error("Please select a customer for all files");
      return;
    }

    const unmapped = rows.some(r => !r.matchedProduct && !r.manualProduct);
    if (unmapped) {
      toast.error("Please manually map all unmatched products");
      return;
    }

    try {
      setConverting(true);

      const cleanRows = rows.map(r => {
        // 🔥 AUTO-APPLY: Always calculate scheme benefits based on quantity (Production Mode)
        const schemeInfo = getSchemeInfo(r);
        
        // Resolve customer for the row
        const fileIdx = r._fileIndex !== undefined ? r._fileIndex : 0;
        const rowCust = filesData[fileIdx].customer;

        return {
          ...r,
          ORDERQTY: Number(r.ORDERQTY) || 0,
          matchedProduct: r.matchedProduct ? { ...r.matchedProduct } : null,
          ITEMDESC: r.ITEMDESC,
          // 🔥 PASS STORED SCHEME VALUES TO BACKEND (Source of Truth)
          freeQty: schemeInfo?.active ? schemeInfo.active.totalFree : 0,
          schemePercent: schemeInfo?.active?.schemePercent || 0,
          // 🔥 PER-ROW CUSTOMER CONTEXT
          customerCode: rowCust.code,
          customerName: rowCust.name
        };
      });

      // We use the first file's customer as the "primary" for the API call
      // (though payload rows have overrides)
      const primaryCustomer = filesData[0].customer.code;

      const res = await api.post("/orders/convert", {
        uploadId,
        customerCode: primaryCustomer,
        dataRows: cleanRows,
        sheets: sheets.map(s => ({ name: s.name, productIndices: s.productIndices }))
      });

      toast.success("Order processed successfully");
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
    <div className="min-h-screen bg-slate-50 pb-20 ">
      <div className="w-full py-6 space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between">
           <div>
              <h1 className="text-2xl font-bold text-slate-900">Map Products</h1>
              <p className="text-slate-500 text-sm mt-1">
                 Processing {filesData.length} files • {rows.length} total rows
              </p>
           </div>
           
           <div className="flex gap-3">
              <Button variant="secondary" onClick={() => navigate('/upload')}>
                 Upload New
              </Button>
           </div>
        </div>

        {/* 📂 FILE & CUSTOMER CONFIGURATION GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filesData.map((file, idx) => (
                <Card key={idx} className={`p-4 border-l-4 ${idx % 2 === 0 ? 'border-l-blue-500' : 'border-l-purple-500'} shadow-sm`}>
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                             <FileText className="w-5 h-5 text-slate-400" />
                             <div className="font-semibold text-slate-800 truncate max-w-[150px]" title={file.fileName}>
                                 {file.fileName}
                             </div>
                        </div>
                        <Badge variant="neutral" className="text-xs">
                             {rows.filter(r => r._fileIndex === idx).length} Rows
                        </Badge>
                    </div>

                    {/* Customer Selection for this File */}
                    <div className="bg-slate-50 p-2 rounded border border-slate-100 relative" id={`file-customer-edit-${idx}`}>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                            Customer
                        </div>
                        
                        {activeFileEdit === idx ? (
                             <div className="relative">
                                 <Search className="absolute left-2 top-2 w-3 h-3 text-slate-400" />
                                 <input 
                                     autoFocus
                                     type="text"
                                     className="w-full pl-7 pr-2 py-1 text-sm border rounded shadow-sm focus:ring-2 focus:ring-blue-500"
                                     placeholder="Search Customer..."
                                     value={customerInput}
                                     onChange={(e) => setCustomerInput(e.target.value)}
                                 />
                                 {customers.length > 0 && (
                                     <div className="absolute top-full left-0 w-full mt-1 bg-white border rounded shadow-xl z-50 max-h-40 overflow-y-auto">
                                         {customers.map(c => (
                                             <button
                                                 key={c.customerCode || c._id}
                                                 className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b last:border-0"
                                                 onClick={() => handleCustomerSelect(c)}
                                             >
                                                 <div className="font-medium">{c.customerName}</div>
                                                 <div className="text-xs text-slate-400">{c.city || c.state}</div>
                                             </button>
                                         ))}
                                     </div>
                                 )}
                             </div>
                        ) : (
                             <div 
                                 onClick={() => startEditingCustomer(idx)}
                                 className="flex items-center justify-between cursor-pointer hover:bg-white transition-colors rounded px-1 py-0.5"
                             >
                                 {file.customer?.name ? (
                                     <div>
                                         <div className="font-medium text-sm text-slate-700">{file.customer.name}</div>
                                         <div className="text-xs text-slate-400">{file.customer.code} • {file.customer.city}</div>
                                     </div>
                                 ) : (
                                     <div className="text-red-500 text-sm font-medium flex items-center gap-1">
                                         <AlertTriangle className="w-3 h-3" /> Select Customer
                                     </div>
                                 )}
                                 <Edit2 className="w-3 h-3 text-slate-300" />
                             </div>
                        )}
                    </div>
                </Card>
            ))}
        </div>

        {/* 🛠️ SHEETS TOOLBAR (Legacy Support) */}
        <Card className="p-3 bg-white border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                     <CheckCircle2 className={`w-5 h-5 ${selectedRows.length > 0 ? 'text-green-500' : 'text-slate-300'}`} />
                     <span className="text-sm font-medium text-slate-600">
                         {selectedRows.length} selected
                     </span>
                 </div>
                 
                 {sheets.map(sheet => (
                     <Badge key={sheet.id} className={`${sheet.color.badge} ${sheet.color.text} flex items-center gap-1 cursor-pointer`}>
                         {sheet.name}
                         <X className="w-3 h-3 hover:text-red-500" onClick={() => removeSheet(sheet.id)} />
                     </Badge>
                 ))}
            </div>
            
            <div className="flex gap-2">
                 <Button size="sm" type="button" variant="secondary" onClick={createNewSheet} disabled={selectedRows.length === 0}>
                     <Package className="w-4 h-4 mr-1" /> Group into Sheet
                 </Button>
                 <Button size="sm" variant="secondary" onClick={addRow}>
                     + Add Manual Item
                 </Button>
            </div>
        </Card>

        {/* 📊 MAPPING TABLE */}
        <Card className="mt-6 border border-neutral-200 overflow-hidden shadow-sm bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 text-base uppercase tracking-wider">
                  <th className="px-3 py-3 w-[15%]">Invoice Item</th>
                  <th className="px-3 py-3 w-[25%]">Mapped Product</th>
                  <th className="px-3 py-3 w-[10%] text-center">Qty</th>
                  <th className="px-3 py-3 w-[8%] text-center">Box</th>
                  <th className="px-3 py-3 w-[6%] text-center">Pack</th>
                  <th className="px-3 py-3 w-[10%] text-center">Division</th>
                  <th className="px-3 py-3 w-[8%] text-center">Sheet</th>
                  <th className="px-3 py-3 w-[8%] text-center">Status</th>
                  <th className="px-3 py-3 w-[5%] text-center">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sortedDivisions.map(division => {
                  const isExpanded = expandedDivisions[division];
                  const groupRows = groupedData[division];

                  return (
                    <React.Fragment key={division}>
                      {/* DIVISION HEADER */}
                      <tr
                        onClick={() => toggleDivision(division)}
                        className="bg-blue-50/50 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <td colSpan={9} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-blue-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-blue-600" />
                            )}
                            <span className="font-semibold text-blue-900 text-sm">
                              {division}
                            </span>
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                              {groupRows.length}
                            </Badge>
                          </div>
                        </td>
                      </tr>

                      {/* ROWS */}
                      {isExpanded && groupRows.map(({ row, originalIndex: i }) => {
                        const hasError = rowErrors[i]?.length > 0;
                        const sheet = getProductSheet(i);
                        const fileIdx = row._fileIndex !== undefined ? row._fileIndex : 0;
                        const fileColor = fileIdx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'; // Subtle alternation?
                        
                        return (
                          <tr
                            key={i}
                            className={`
                              hover:bg-neutral-50 transition-colors
                              ${hasError ? "bg-red-50" : ""}
                              ${sheet ? sheet.color.bg : ""}
                            `}
                          >
                              {/* 1: INVOICE ITEM */}
                                <td className="px-3 py-2 align-middle text-base text-neutral-700 font-medium break-words">
                                    {row._rawText || row.ITEMDESC || "(No Name)"}
                                    {filesData.length > 1 && (
                                        <div className="text-[10px] text-neutral-400 font-normal mt-0.5">
                                            {filesData[fileIdx]?.fileName?.slice(0, 15)}...
                                        </div>
                                    )}
                                </td>

                                {/* 2: MAPPED PRODUCT */}
                                <td className="px-3 py-2 align-middle">
                                  <div className="flex flex-col gap-1">
                                    <div className="w-full" id={`cell-search-${i}`}>
                                      {!row.matchedProduct ? (
                                        <div className="relative">
                                          <div className="relative">
                                              <Search className="absolute left-2 top-2 w-4 h-4 text-neutral-400" />
                                              <input
                                                type="text"
                                                value={row.searchQuery ?? row.ITEMDESC ?? ""}
                                                onChange={(e) => {
                                                  handleRowChange(i, "searchQuery", e.target.value);
                                                }}
                                                placeholder="Search..."
                                                className="w-full text-base border rounded pl-8 pr-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                onFocus={(e) => {
                                                    setActiveSearchRow(i);
                                                    updateDropdownPosition(e.currentTarget.parentElement?.parentElement as HTMLElement);
                                                }}
                                                onClick={(e) => {
                                                    setActiveSearchRow(i);
                                                    updateDropdownPosition(e.currentTarget.parentElement?.parentElement as HTMLElement);
                                                }}
                                              />
                                          </div>
                                          
                                          {/* PORTAL DROPDOWN */}
                                          {activeSearchRow === i && (row.searchQuery?.length >= 2 || row.ITEMDESC?.length >= 2) && dropdownPosition && createPortal(
                                            <div 
                                                id="portal-dropdown-container"
                                                className="fixed z-[9999] bg-white border border-neutral-300 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                                                style={{
                                                    top: dropdownPosition.top - window.scrollY, // Adjust for fixed position (viewport relative)
                                                    left: dropdownPosition.left,
                                                    width: dropdownPosition.width
                                                }}
                                            >
                                              {allProducts
                                                .filter(p => {
                                                  // 🔍 SMART SEARCH:
                                                  // 2. Contains whole query
                                                  // 3. Strict Match: Product includes Query (e.g. "DOLO" -> "DOLO 650")
                                                  // 4. Token Match: Product includes the first word of Query (e.g. "DIAPRIDE 4MG" -> Match "DIAPRIDE")
                                                  
                                                  const q = row.searchQuery?.toUpperCase().trim() || "";
                                                  if (!q) return true;
                                                  
                                                  const pName = p.productName?.toUpperCase() || "";
                                                  
                                                  // Direct substring match
                                                  if (pName.includes(q)) return true;
                                                  
                                                  // Token fallback: Match first word (Brand)
                                                  // e.g. User types "DIAPRIDE 4MG", we match "DIAPRIDE"
                                                  const tokens = q.split(/[\s-]+/).filter((t : string) => t.length > 2);
                                                  if (tokens.length > 0) {
                                                      const firstToken = tokens[0]; // "DIAPRIDE"
                                                      return pName.includes(firstToken);
                                                  }
                                                  
                                                  return false;
                                                })
                                                .sort((a, b) => {
                                                    // 📊 SORT RELEVANCE
                                                    const q = row.searchQuery?.toUpperCase().trim() || "";
                                                    const aName = a.productName?.toUpperCase() || "";
                                                    const bName = b.productName?.toUpperCase() || "";
                                                    
                                                    // 1. Exact StartsWith gets priority
                                                    const aStarts = aName.startsWith(q);
                                                    const bStarts = bName.startsWith(q);
                                                    if (aStarts && !bStarts) return -1;
                                                    if (!aStarts && bStarts) return 1;
                                                    
                                                    // 2. Contains whole query
                                                    const aHas = aName.includes(q);
                                                    const bHas = bName.includes(q);
                                                    if (aHas && !bHas) return -1;
                                                    if (!aHas && bHas) return 1;
                                                    
                                                    return 0;
                                                })
                                                .slice(0, 20)
                                                .map(p => (
                                                  <button
                                                    key={p.productCode}
                                                    onClick={() => {
                                                      setRows(prev => {
                                                        const next = [...prev];
                                                        
                                                        // Map Basic Fields
                                                        if (!next[i].ITEMDESC || next[i].ITEMDESC.trim() === "") {
                                                            next[i].ITEMDESC = p.productName;
                                                        }

                                                        const boxPack = Number(p.boxPack) || 0;
                                                        const currentQty = Number(next[i].ORDERQTY) || 0;
                                                        let newPack = next[i].PACK; 
                                                        if (boxPack > 0 && currentQty > 0) {
                                                            const rawPack = currentQty / boxPack;
                                                            newPack = Number.isInteger(rawPack) ? rawPack : Number(rawPack.toFixed(2));
                                                        }

                                                        next[i] = {
                                                          ...next[i],
                                                          matchedProduct: p,
                                                          SAPCODE: p.productCode,
                                                          DVN: p.division,
                                                          mappingSource: "MANUAL",
                                                          availableSchemes: [],
                                                          "BOX PACK": boxPack > 0 ? boxPack : next[i]["BOX PACK"],
                                                          PACK: newPack
                                                        };

                                                        // Fetch Schemes using File Context
                                                        const rowFileIdx = next[i]._fileIndex || 0;
                                                        const rowCust = filesData[rowFileIdx]?.customer;

                                                        if (rowCust?.code) {
                                                          api.get(`/orders/schemes/product/${p.productCode}`, {
                                                            params: {
                                                              customerCode: rowCust.code,
                                                              division: p.division
                                                            }
                                                          }).then(res => {
                                                            if (res.data?.schemes?.length > 0) {
                                                              setRows(curr => {
                                                                const updated = [...curr];
                                                                if (updated[i]) {
                                                                    updated[i] = {
                                                                      ...updated[i],
                                                                      availableSchemes: res.data.schemes
                                                                    };
                                                                }
                                                                return updated;
                                                              });
                                                            }
                                                          });
                                                        }
                                                        return next;
                                                      });
                                                      setActiveSearchRow(null);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-0 border-neutral-100 block"
                                                  >
                                                    <div className="font-medium text-neutral-900">{formatProductDisplay(p)}</div>
                                                    <div className="text-xs text-neutral-500">{p.productCode}</div>
                                                  </button>
                                                ))}
                                            </div>,
                                            document.body
                                          )}
                                        </div>
                                      ) : null}
                                    </div>

                                    {row.matchedProduct && (
                                          <div 
                                            onClick={() => {
                                                handleRowChange(i, "matchedProduct", null);
                                                handleRowChange(i, "searchQuery", row.ITEMDESC);
                                            }}
                                            className="flex items-center justify-between px-2 py-1.5 bg-green-50 border border-green-200 rounded cursor-pointer hover:bg-green-100 group"
                                          >
                                            <div className="overflow-hidden">
                                                <div className="font-semibold text-black truncate text-base">
                                                  {formatProductDisplay(row.matchedProduct)}
                                                </div>
                                                <div className="text-[10px] text-black-700">
                                                  #{row.matchedProduct.productCode}
                                                </div>
                                            </div>
                                            <Edit2 className="w-3 h-3 text-green-600 opacity-0 group-hover:opacity-100" />
                                          </div>
                                        )}
  
                                    {/* SCHEME BADGES */}
                                    {row.matchedProduct && row.availableSchemes?.length > 0 && !row.schemeApplied && (
                                       (() => {
                                           const schemeInfo = getSchemeInfo(row);
                                           const { active, next, all } = schemeInfo || {};
                                           if (!active && !next && (!all || all.length === 0)) return null;

                                           return (
                                            <div className="mt-1 flex flex-wrap gap-2">
                                                {active && (
                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[14px] bg-green-50 text-green-700 border border-green-200 cursor-pointer"
                                                        onClick={() => {
                                                            // Only bump quantity if less than min, otherwise just apply
                                                            const current = Number(row.ORDERQTY) || 0;
                                                            if (current < active.minQty) {
                                                                handleRowChange(i, "ORDERQTY", active.minQty);
                                                            }
                                                            handleRowChange(i, "schemeApplied", true);
                                                        }}
                                                    >
                                                        <Gift className="w-4 h-4" />
                                                        <span>{active.minQty}+{active.totalFree} Free</span>
                                                    </div>
                                                )}
                                                
                                                {next && (
                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[14px] bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer"
                                                        onClick={() => {
                                                            handleRowChange(i, "ORDERQTY", next.minQty);
                                                            handleRowChange(i, "schemeApplied", true);
                                                        }}
                                                    >
                                                        <Zap className="w-4 h-4 text-blue-600 fill-blue-600" />
                                                        <span>
                                                            Add {next.minQty - (Number(row.ORDERQTY) || 0)} → {next.freeQty} Free
                                                        </span>
                                                    </div>
                                                )}
                                           </div>
                                          );
                                      })()
                                    )}
                                  </div>
                                </td>

                                {/* 3: QUANTITY */}
                                <td className="px-3 py-2 text-center align-middle">
                                  {(() => {
                                     const info = getSchemeInfo(row);
                                     if (info?.active && row.schemeApplied) {
                                         return (
                                             <div onClick={() => handleRowChange(i, "schemeApplied", false)} className="cursor-pointer bg-green-50 text-green-800 text-sm font-bold px-2 py-1 rounded border border-green-200">
                                                {row.ORDERQTY} + {info.active.totalFree}
                                             </div>
                                         );
                                     }
                                     return (
                                        <input
                                          type="number"
                                          className={`w-20 text-center text-base font-semibold px-1 py-1 border rounded ${hasError ? "border-red-500 bg-red-50" : "border-neutral-300"}`}
                                          value={row.ORDERQTY || ""}
                                          onChange={(e) => handleRowChange(i, "ORDERQTY", e.target.value)}
                                        />
                                     );
                                  })()}
                                </td>

                                {/* 4: BOX PACK */}
                                <td className="px-3 py-2 text-center align-middle">
                                    <div className="flex items-center justify-center gap-1">
                                      <input
                                        type="number"
                                        className="w-12 text-center text-sm px-1 py-1 border rounded bg-neutral-50"
                                        value={row["BOX PACK"] || row.matchedProduct?.boxPack || ""}
                                        onChange={(e) => handleRowChange(i, "BOX PACK", e.target.value)}
                                      />
                                      {Number(row["BOX PACK"] || row.matchedProduct?.boxPack) > 0 && (
                                          <button 
                                            onClick={() => {
                                                const bp = Number(row["BOX PACK"] || row.matchedProduct?.boxPack);
                                                const qty = Number(row.ORDERQTY) || 0;
                                                if(bp > 0 && qty > 0) {
                                                    const newQty = Math.ceil(qty / bp) * bp;
                                                    handleRowChange(i, "ORDERQTY", newQty);
                                                }
                                            }}
                                            className="text-neutral-400 hover:text-blue-600"
                                            title="Round Up"
                                          >
                                              <RefreshCw className="w-5 h-5 ml-4" />
                                          </button>
                                      )}
                                    </div>
                                </td>

                                {/* 5: PACK */}
                                <td className="px-3 py-2 text-center align-middle">
                                    <div className="text-sm font-medium text-neutral-600">
                                        {row.PACK || "-"}
                                    </div>
                                </td>

                                {/* 6: DIVISION */}
                                <td className="px-3 py-2 text-center align-middle text-sm text-neutral-600">
                                  {row.matchedProduct?.division || row.DVN || "-"}
                                </td>

                                {/* 7: SHEET */}
                                <td className="px-3 py-2 text-center align-middle">
                                  {sheet ? (
                                    <Badge className={`${sheet.color.badge} ${sheet.color.text} text-xs`}>
                                      {sheet.name}
                                    </Badge>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={selectedRows.includes(i)}
                                      onChange={() => toggleRowSelection(i)}
                                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                  )}
                                </td>

                                {/* 8: STATUS */}
                                <td className="px-3 py-2 text-center align-middle">
                                  {row.matchedProduct ? (
                                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      OK
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                      Map
                                    </div>
                                  )}
                                </td>

                                {/* 9: DELETE */}
                                <td className="px-3 py-2 text-center align-middle">
                                  <button
                                    onClick={() => deleteRow(i)}
                                    className="text-neutral-400 hover:text-red-500 transition-colors"
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
                    <td colSpan={9} className="text-center py-12 text-neutral-500">
                      <Package className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                      No products added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ACTIONS FOOTER */}
        <div className="flex justify-center pt-6 pb-12 gap-3">
             <Button 
                variant="secondary"
                onClick={handleUniversalRoundOff}
                className="bg-white hover:bg-neutral-50 border-blue-200 text-blue-700"
             >
                <RefreshCw className="w-4 h-4 mr-2" />
                Round Off All
             </Button>

          <Button
            onClick={() => handleConvert()}
            isLoading={converting}
            className="px-8 py-3 text-base shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
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
          handleConvert();
        }}
        onDone={() => {
          setShowSchemeModal(false);
          handleConvert();
        }}
      />
    </div>
  );
}