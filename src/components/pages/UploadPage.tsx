import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Upload, FileText, X, CheckCircle, AlertCircle, Search, User, Edit2, AlertTriangle, Plus, Trash2, Package, RefreshCw, Zap, Gift } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { toast } from 'sonner';
import api from "../../services/api";

import { useNavigate } from "react-router-dom";

/* ---------------- HELPERS ---------------- */
const formatProductDisplay = (p: any) => {
  if (!p) return "";
  let name = p.productName || [p.baseName, p.variant, p.dosage].filter(Boolean).join(" ");
  if (name.includes("GM 1MG")) {
    name = name.replace("GM 1MG", "1GM");
  }
  return name;
};

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

export function UploadPage() {
    const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const allowedExtensions = ['xlsx', 'xls', 'csv', 'pdf','txt','jpg','jpeg','png'];

  /* ============ MANUAL ENTRY STATE ============ */
  const [manualCustomer, setManualCustomer] = useState<any>(null);
  const [manualCustomerInput, setManualCustomerInput] = useState("");
  const [manualCustomerResults, setManualCustomerResults] = useState<any[]>([]);
  const [manualCustomerSearching, setManualCustomerSearching] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);

  const [manualRows, setManualRows] = useState<any[]>([]);
  const [converting, setConverting] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [activeManualSearchRow, setActiveManualSearchRow] = useState<number | null>(null);
  const [manualDropdownPos, setManualDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  /* ============ SHEET MANAGEMENT STATE ============ */
  const SHEET_COLORS = [
    { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', badge: 'bg-blue-100' },
    { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', badge: 'bg-green-100' },
    { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', badge: 'bg-purple-100' },
    { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', badge: 'bg-amber-100' },
    { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700', badge: 'bg-pink-100' },
  ];

  const [manualSheets, setManualSheets] = useState<{
    id: string;
    name: string;
    color: { bg: string; border: string; text: string; badge: string };
    productIndices: number[];
  }[]>([]);
  const [manualSelectedRows, setManualSelectedRows] = useState<number[]>([]);

  const getManualProductSheet = (rowIndex: number) => {
    return manualSheets.find(sheet => sheet.productIndices.includes(rowIndex));
  };

  const toggleManualRowSelection = (rowIndex: number) => {
    if (getManualProductSheet(rowIndex)) return;
    const isSelected = manualSelectedRows.includes(rowIndex);
    if (isSelected) {
      setManualSelectedRows(prev => prev.filter(i => i !== rowIndex));
    } else {
      setManualSelectedRows(prev => [...prev, rowIndex]);
    }
  };

  const createManualSheet = () => {
    if (manualSelectedRows.length === 0) {
      toast.error("Please select products first");
      return;
    }
    const sheetNumber = manualSheets.length + 1;
    const colorIndex = (manualSheets.length) % SHEET_COLORS.length;
    const newSheet = {
      id: `sheet-${Date.now()}`,
      name: `Sheet ${sheetNumber}`,
      color: SHEET_COLORS[colorIndex],
      productIndices: [...manualSelectedRows]
    };
    setManualSheets(prev => [...prev, newSheet]);
    setManualSelectedRows([]);
    toast.success(`Created ${newSheet.name} with ${manualSelectedRows.length} products`);
  };

  const removeManualSheet = (sheetId: string) => {
    setManualSheets(prev => prev.filter(s => s.id !== sheetId));
    toast.success("Sheet removed");
  };

  /* ============ FETCH ALL PRODUCTS ON MOUNT ============ */
  useEffect(() => {
    api.get("/admin/products", { params: { limit: 5000 } })
      .then(res => setAllProducts(res.data?.data || []))
      .catch(() => setAllProducts([]));
  }, []);

  /* ============ MANUAL CUSTOMER SEARCH (DEBOUNCED) ============ */
  useEffect(() => {
    if (!isEditingCustomer) return;
    if (!manualCustomerInput || manualCustomerInput.length < 2) {
      setManualCustomerResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setManualCustomerSearching(true);
      api.get("/admin/customers", { params: { search: manualCustomerInput, limit: 100 } })
        .then(res => setManualCustomerResults(res.data?.data || []))
        .catch(() => setManualCustomerResults([]))
        .finally(() => setManualCustomerSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [manualCustomerInput, isEditingCustomer]);

  /* ============ CLICK OUTSIDE, SCROLL & RESIZE HANDLERS (PRODUCTION) ============ */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isEditingCustomer && !target.closest('#manual-customer-edit')) {
        setIsEditingCustomer(false);
      }
      if (activeManualSearchRow !== null) {
        if (target.closest('#manual-portal-dropdown')) return;
        if (!target.closest(`#manual-cell-search-${activeManualSearchRow}`)) {
          setActiveManualSearchRow(null);
        }
      }
    };

    // Close dropdown on scroll or resize — but NOT when scrolling inside the dropdown itself
    const handleScrollOrResize = (e: Event) => {
      if (activeManualSearchRow === null) return;
      const target = e.target as HTMLElement;
      if (target?.closest?.('#manual-portal-dropdown')) return; // scrolling inside dropdown is OK
      setActiveManualSearchRow(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true); // true = capture phase catches nested scrolls
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isEditingCustomer, activeManualSearchRow]);

  useEffect(() => {
    if (activeManualSearchRow === null) setManualDropdownPos(null);
  }, [activeManualSearchRow]);

  const handleManualCustomerSelect = (customer: any) => {
    setManualCustomer({
      code: customer.customerCode,
      name: customer.customerName,
      city: customer.city,
      state: customer.state,
      source: 'MANUAL'
    });
    setIsEditingCustomer(false);
    setManualCustomerResults([]);
    toast.success(`Customer set: ${customer.customerName}`);
  };

  const addManualRow = () => {
    setManualRows(prev => [
      ...prev,
      { ITEMDESC: "", searchQuery: "", ORDERQTY: "", matchedProduct: null, "BOX PACK": "", PACK: "", isNew: true }
    ]);
  };

  const deleteManualRow = (index: number) => {
    setManualRows(prev => prev.filter((_, i) => i !== index));
  };

  /* ---------------- FETCH SCHEMES FOR MANUAL ROWS ---------------- */
  useEffect(() => {
    const fetchSchemes = async () => {
        const rowsToUpdate = manualRows.map((r, i) => ({ r, i }))
             .filter(({ r }) => r.matchedProduct && r.availableSchemes === undefined && manualCustomer?.code);

        if (rowsToUpdate.length === 0) return;
        
        const updates: Record<number, any[]> = {};

        await Promise.all(rowsToUpdate.map(async ({ r, i }) => {
            try {
                const res = await api.get(`/orders/schemes/product/${r.matchedProduct.productCode}`, {
                    params: { customerCode: manualCustomer.code, division: r.matchedProduct.division }
                });
                updates[i] = res.data?.schemes || [];
            } catch (err) {
                 updates[i] = [];
            }
        }));
        
        if (Object.keys(updates).length > 0) {
             setManualRows(prev => {
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
    
    fetchSchemes();
  }, [manualRows, manualCustomer]);

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
          next: nextSlab ? { ...nextSlab, freeQty: nextSlab.freeQty } : null, // Next slab's promised free qty
          all: allSlabs
      };
  };

  const handleManualRowChange = (index: number, field: string, value: any) => {
    setManualRows(prev => {
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
      return next;
    });
  };

  const selectManualProduct = (rowIndex: number, product: any) => {
    setManualRows(prev => {
      const next = [...prev];
      const boxPack = Number(product.boxPack) || 0;
      const currentQty = Number(next[rowIndex].ORDERQTY) || 0;
      let newPack = next[rowIndex].PACK;
      if (boxPack > 0 && currentQty > 0) {
        const rawPack = currentQty / boxPack;
        newPack = Number.isInteger(rawPack) ? rawPack : Number(rawPack.toFixed(2));
      }
      if (!next[rowIndex].ITEMDESC || next[rowIndex].ITEMDESC.trim() === "") {
        next[rowIndex].ITEMDESC = product.productName;
      }
      next[rowIndex] = {
        ...next[rowIndex],
        matchedProduct: product,
        SAPCODE: product.productCode,
        DVN: product.division,
        mappingSource: "MANUAL",
        "BOX PACK": boxPack > 0 ? boxPack : next[rowIndex]["BOX PACK"],
        PACK: newPack
      };
      return next;
    });
    setActiveManualSearchRow(null);
  };

  const updateManualDropdownPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setManualDropdownPos({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width
    });
  };

  /* ============ PROCESS ORDERS DIRECTLY (NO MAPPING PAGE) ============ */
  const handleProcessOrders = async () => {
    // Validate customer
    if (!manualCustomer?.code) {
      toast.error("Please select a customer first");
      return;
    }

    // Validate rows exist
    if (manualRows.length === 0) {
      toast.error("Please add at least one product row");
      return;
    }

    // Validate all products are mapped
    const unmapped = manualRows.some(r => !r.matchedProduct);
    if (unmapped) {
      toast.error("Please map all products before processing");
      return;
    }

    // Validate quantities
    const qtyErrors: number[] = [];
    manualRows.forEach((row, i) => {
      if (!row.ORDERQTY || isNaN(Number(row.ORDERQTY)) || Number(row.ORDERQTY) <= 0) {
        qtyErrors.push(i + 1);
      }
    });
    if (qtyErrors.length > 0) {
      toast.error(`Fix quantity errors in row(s): ${qtyErrors.join(", ")}`);
      return;
    }

    try {
      setConverting(true);

      const cleanRows = manualRows.map(r => {
        // Calculate scheme info for backend (Source of Truth)
        const schemeInfo = getSchemeInfo(r);
        
        return {
          ...r,
          ITEMDESC: r.ITEMDESC || r.matchedProduct?.productName || "",
          ORDERQTY: Number(r.ORDERQTY) || 0,
          matchedProduct: r.matchedProduct ? { ...r.matchedProduct } : null,
          SAPCODE: r.SAPCODE || r.matchedProduct?.productCode,
          DVN: r.DVN || r.matchedProduct?.division,
          "BOX PACK": r["BOX PACK"] || r.matchedProduct?.boxPack,
          PACK: r.PACK,
          mappingSource: r.mappingSource || "MANUAL",
          
          // 🔥 PASS STORED SCHEME VALUES TO BACKEND
          freeQty: schemeInfo?.active ? schemeInfo.active.totalFree : 0,
          schemePercent: schemeInfo?.active?.schemePercent || 0,
          
          customerCode: manualCustomer.code,
          customerName: manualCustomer.name
        };
      });

      // 1. Create initial record to get valid ObjectID
      const initRes = await api.post("/orders/manual-init", {
        customerCode: manualCustomer.code,
        customerName: manualCustomer.name,
        rows: cleanRows
      });
      
      const uploadId = initRes.data.uploadId;

      // 2. Convert using the valid ID
      const res = await api.post("/orders/convert", {
        uploadId,
        customerCode: manualCustomer.code,
        dataRows: cleanRows, // Send rows again to ensure latest state is used
        sheets: manualSheets.map(s => ({ name: s.name, productIndices: s.productIndices }))
      });

      toast.success("Order processed successfully!");
      navigate(`/result/${res.data.uploadId}`);
    } catch (err: any) {
      console.error("Processing failed:", err);
      toast.error(err.response?.data?.message || "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const isDuplicateFile = (newFile: File) => {
  return uploadedFiles.some(
    file => file.name === newFile.name && file.size === newFile.size
  );
};

  const handleDragLeave = () => {
    setIsDragging(false);
  };
async function uploadAndParse(
  files: File[],
  onProgress: (p: number) => void
) {
  const formData = new FormData();
  // Append all files with key "files" (matching backend)
  files.forEach(file => {
    formData.append("files", file);
  });

  onProgress(50);

  const res = await api.post("/orders/extract", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  onProgress(80);

  const result = res.data;

  if (!result) {
    throw new Error("Empty server response");
  }

  // Backend v2 return { success: true, results: [...] }
  if (result.results && Array.isArray(result.results)) {
     // Check if ALL failed?
     const allFailed = result.results.every((r: any) => r.status === 'FAILED' || r.status === 'ERROR');
     if (allFailed) {
        throw new Error("All uploaded files failed extraction.");
     }
  } else if (result.error) {
     throw new Error(result.error);
  }

  onProgress(100);

  return result;
}

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  setIsDragging(false);

  const files = Array.from(e.dataTransfer.files);
  const validFiles = validateFiles(files);

  setUploadedFiles(prev => [...prev, ...validFiles]);
};


const validateFiles = (files: File[]) => {
  const validFiles: File[] = [];
  const invalidFiles: string[] = [];

  files.forEach(file => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (!allowedExtensions.includes(ext || '')) {
      invalidFiles.push(file.name);
    } else if (!isDuplicateFile(file)) {
      validFiles.push(file);
    }
  });

  if (invalidFiles.length > 0) {
    alert(
      `Unsupported file types:\n${invalidFiles.join(
        ', '
      )}\n\nAllowed formats: Excel, CSV, PDF, Images (JPG/PNG)`
    );
  }

  return validFiles;
};

const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files) return;

  const files = Array.from(e.target.files);
  const validFiles = validateFiles(files);

  setUploadedFiles(prev => [...prev, ...validFiles]);
};


  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

const handleContinue = async () => {
  if (uploadedFiles.length === 0) {
    alert("Please upload at least one file.");
    return;
  }

  try {
    setIsUploading(true);
    setUploadProgress(20);

    setUploadProgress(40); // upload started

    const response = await uploadAndParse(uploadedFiles, setUploadProgress);

    // If response.results exists, it's the new format
    // Pass 'results' array to Mapping Page
    navigate("/mapping", {
      state: {
        results: response.results, 
        isMultiFile: true
      },
    });
  } catch (err: any) {
    const message =
      err?.response?.data?.message ||
      err?.message ||
      "Failed to upload and parse file.";

    alert(message);
    console.error("Upload/parse failed:", err);
  } finally {
    setIsUploading(false);
  }
};



  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 max-w-7xl mt-2">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Upload Order Files</h1>
        <p className="text-neutral-600 mt-1">Upload your order files to convert them to the standard Excel format</p>
      </div>

      {/* Upload Instructions */}
      <Alert variant="info">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <div className='p-2'>
          <AlertTitle className="mb-1">Supported File Formats</AlertTitle>
          <AlertDescription>
            Excel (.xlsx, .xls), CSV (.csv), PDF (.pdf), Text (.txt), and Images (.jpg, .png) are supported. Maximum file size: 10MB per file.
          </AlertDescription>
        </div>
      </Alert>

      {/* Upload Zone */}
      <Card>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-neutral-300 hover:border-primary-400 hover:bg-neutral-50'
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className={`p-4 rounded-full ${isDragging ? 'bg-primary-100' : 'bg-neutral-100'}`}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-primary-600' : 'text-neutral-600'}`} />
            </div>
            
            <div>
              <p className="text-lg font-medium text-neutral-900 mb-1">
                {isDragging ? 'Drop files here' : 'Drag & drop files here'}
              </p>
              <p className="text-neutral-600 text-sm">or</p>
            </div>

            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                accept=".xlsx,.xls,.csv,.pdf,.txt,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
              />
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                Browse Files
              </span>
            </label>

            {/* <p className="text-xs text-neutral-500">
              Support multiple file upload
            </p> */}
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Uploading files...</span>
              <span className="text-sm font-medium text-primary-600">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Uploaded Files ({uploadedFiles.length})
          </h3>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <FileText className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 truncate">{file.name}</p>
                    <p className="text-sm text-neutral-600">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success-600" />
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 text-neutral-400 hover:text-error-600 transition-colors"
                    disabled={isUploading}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-neutral-200">
           <Button
  variant="secondary"
  onClick={() => navigate("/")}
  disabled={isUploading}
>
  Cancel
</Button>

            <Button
              variant="primary"
              onClick={handleContinue}
              disabled={uploadedFiles.length === 0 || isUploading}
              isLoading={isUploading}
            >
              Continue to Mapping
            </Button>
          </div>
        </Card>
      )}
      {/* ============ OR DIVIDER ============ */}
      <div className="relative flex items-center py-4">
        <div className="flex-grow border-t border-neutral-300"></div>
        <span className="px-4 text-sm font-semibold text-neutral-500 bg-transparent">OR</span>
        <div className="flex-grow border-t border-neutral-300"></div>
      </div>

      {/* ============ MANUAL ENTRY SECTION (Exact MappingPage UI) ============ */}
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manual Entry</h1>
            <p className="text-slate-500 text-sm mt-1">
              {manualRows.length} total rows
            </p>
          </div>
        </div>

        {/* FILE & CUSTOMER CARD (matches MappingPage file card) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className={`p-4 border-l-4 border-l-blue-500 shadow-sm`}>
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                <div className="font-semibold text-slate-800 truncate max-w-[150px]" title="Manual Entry">
                  Manual Entry
                </div>
              </div>
              <Badge variant="neutral" className="text-xs">
                {manualRows.length} Rows
              </Badge>
            </div>

            {/* Customer Selection */}
            <div className="bg-slate-50 p-2 rounded border border-slate-100 relative" id="manual-customer-edit">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                Customer
              </div>

              {isEditingCustomer ? (
                <div className="relative">
                  <Search className="absolute left-2 top-2 w-3 h-3 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    className="w-full pl-7 pr-2 py-1 text-sm border rounded shadow-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Search Customer..."
                    value={manualCustomerInput}
                    onChange={(e) => setManualCustomerInput(e.target.value)}
                  />
                  {manualCustomerResults.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border rounded shadow-xl z-50 max-h-40 overflow-y-auto">
                      {manualCustomerResults.map(c => (
                        <button
                          key={c.customerCode || c._id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b last:border-0"
                          onClick={() => handleManualCustomerSelect(c)}
                        >
                          <div className="font-medium">{c.customerName}</div>
                          <div className="text-xs text-slate-400">{c.customerCode} • {c.city || c.state}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {manualCustomerSearching && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border rounded shadow-xl z-50 py-3 text-center text-sm text-slate-400">
                      Searching...
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => { setIsEditingCustomer(true); setManualCustomerInput(manualCustomer?.name || ""); }}
                  className="flex items-center justify-between cursor-pointer hover:bg-white transition-colors rounded px-1 py-0.5"
                >
                  {manualCustomer?.name ? (
                    <div>
                      <div className="font-medium text-sm text-slate-700">{manualCustomer.name}</div>
                      <div className="text-xs text-slate-400">{manualCustomer.code} • {manualCustomer.city}</div>
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
        </div>

        {/* TOOLBAR (matches MappingPage toolbar) */}
        <Card className="p-3 bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className={`w-5 h-5 ${manualSelectedRows.length > 0 ? 'text-green-500' : 'text-slate-300'}`} />
              <span className="text-sm font-medium text-slate-600">
                {manualSelectedRows.length} selected
              </span>
            </div>

            {manualSheets.map(sheet => (
              <Badge key={sheet.id} className={`${sheet.color.badge} ${sheet.color.text} flex items-center gap-1 cursor-pointer`}>
                {sheet.name}
                <X className="w-3 h-3 hover:text-red-500" onClick={() => removeManualSheet(sheet.id)} />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="button" variant="secondary" onClick={createManualSheet} disabled={manualSelectedRows.length === 0}>
              <Package className="w-4 h-4 mr-1" /> Group into Sheet
            </Button>
            <Button size="sm" variant="secondary" onClick={addManualRow}>
              + Add Manual Item
            </Button>
          </div>
        </Card>

        {/* MAPPING TABLE (exact MappingPage table structure) */}
        <Card className="border border-neutral-200 overflow-hidden shadow-sm bg-white">
          <div className="overflow-x-auto rounded-xl">
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
                {manualRows.map((row, i) => (
                  <tr key={i} className="hover:bg-neutral-50 transition-colors">
                    {/* 1: INVOICE ITEM */}
                    <td className="px-3 py-2 align-middle text-base text-neutral-700 font-medium break-words">
                      <input
                        type="text"
                        className="w-full text-base border-0 border-b border-transparent hover:border-neutral-300 focus:border-blue-500 bg-transparent px-0 py-1 focus:ring-0 focus:outline-none"
                        value={row.ITEMDESC || ""}
                        onChange={(e) => handleManualRowChange(i, "ITEMDESC", e.target.value)}
                        placeholder="Item description..."
                      />
                    </td>

                    {/* 2: MAPPED PRODUCT */}
                    <td className="px-3 py-2 align-middle">
                      <div className="flex flex-col gap-1">
                        <div className="w-full" id={`manual-cell-search-${i}`}>
                          {!row.matchedProduct ? (
                            <div className="relative">
                              <div className="relative">
                                <Search className="absolute left-2 top-2 w-4 h-4 text-neutral-400" />
                                <input
                                  type="text"
                                  value={row.searchQuery ?? ""}
                                  onChange={(e) => handleManualRowChange(i, "searchQuery", e.target.value)}
                                  placeholder="Search..."
                                  className="w-full text-base border rounded pl-8 pr-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  onFocus={(e) => {
                                    setActiveManualSearchRow(i);
                                    updateManualDropdownPosition(e.currentTarget);
                                  }}
                                  onClick={(e) => {
                                    setActiveManualSearchRow(i);
                                    updateManualDropdownPosition(e.currentTarget);
                                  }}
                                />
                              </div>

                              {/* PORTAL DROPDOWN */}
                              {activeManualSearchRow === i && (row.searchQuery?.length >= 2) && manualDropdownPos && createPortal(
                                <div
                                  id="manual-portal-dropdown"
                                  className="fixed z-[9999] bg-white border border-neutral-300 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                                  style={{
                                    top: manualDropdownPos.top - window.scrollY,
                                    left: manualDropdownPos.left,
                                    width: manualDropdownPos.width
                                  }}
                                >
                                  {allProducts
                                    .filter(p => {
                                      const q = row.searchQuery?.toUpperCase().trim() || "";
                                      if (!q) return true;
                                      const pName = p.productName?.toUpperCase() || "";
                                      if (pName.includes(q)) return true;
                                      const tokens = q.split(/[\s-]+/).filter((t: string) => t.length > 2);
                                      if (tokens.length > 0) {
                                        return pName.includes(tokens[0]);
                                      }
                                      return false;
                                    })
                                    .sort((a, b) => {
                                      const q = row.searchQuery?.toUpperCase().trim() || "";
                                      const aName = a.productName?.toUpperCase() || "";
                                      const bName = b.productName?.toUpperCase() || "";
                                      const aStarts = aName.startsWith(q);
                                      const bStarts = bName.startsWith(q);
                                      if (aStarts && !bStarts) return -1;
                                      if (!aStarts && bStarts) return 1;
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
                                        onClick={() => selectManualProduct(i, p)}
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
                              handleManualRowChange(i, "matchedProduct", null);
                              handleManualRowChange(i, "searchQuery", row.ITEMDESC);
                            }}
                            className="group"
                          >
                           <div className="flex items-center justify-between px-2 py-1.5 bg-green-50 border border-green-200 rounded cursor-pointer hover:bg-green-100 mb-1">
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
                                                 onClick={(e) => {
                                                     e.stopPropagation();
                                                     const current = Number(row.ORDERQTY) || 0;
                                                     if (current < active.minQty) {
                                                         handleManualRowChange(i, "ORDERQTY", active.minQty);
                                                     }
                                                     handleManualRowChange(i, "schemeApplied", true);
                                                 }}
                                             >
                                                 <Gift className="w-4 h-4" />
                                                 <span>{active.minQty}+{active.totalFree} Free</span>
                                             </div>
                                         )}
                                         
                                         {next && (
                                             <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[14px] bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer"
                                                 onClick={(e) => {
                                                     e.stopPropagation();
                                                     handleManualRowChange(i, "ORDERQTY", next.minQty);
                                                     handleManualRowChange(i, "schemeApplied", true);
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
                        )}
                      </div>
                    </td>

                    {/* 3: QTY */}
                    <td className="px-3 py-2 text-center align-middle">
                      {(() => {
                         const info = getSchemeInfo(row);
                         if (info?.active && row.schemeApplied) {
                             return (
                                 <div onClick={() => handleManualRowChange(i, "schemeApplied", false)} className="cursor-pointer bg-green-50 text-green-800 text-sm font-bold px-2 py-1 rounded border border-green-200">
                                    {row.ORDERQTY} + {info.active.totalFree}
                                 </div>
                             );
                         }
                         return (
                           <input
                            type="number"
                            className="w-20 text-center text-base font-semibold px-1 py-1 border rounded border-neutral-300"
                            value={row.ORDERQTY || ""}
                            onChange={(e) => handleManualRowChange(i, "ORDERQTY", e.target.value)}
                           />
                         );
                      })()}
                    </td>

                    {/* 4: BOX */}
                    <td className="px-3 py-2 text-center align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          className="w-12 text-center text-sm px-1 py-1 border rounded bg-neutral-50"
                          value={row["BOX PACK"] || row.matchedProduct?.boxPack || ""}
                          onChange={(e) => handleManualRowChange(i, "BOX PACK", e.target.value)}
                        />
                        {Number(row["BOX PACK"] || row.matchedProduct?.boxPack) > 0 && (
                          <button
                            onClick={() => {
                              const bp = Number(row["BOX PACK"] || row.matchedProduct?.boxPack);
                              const qty = Number(row.ORDERQTY) || 0;
                              if (bp > 0 && qty > 0) {
                                const newQty = Math.ceil(qty / bp) * bp;
                                handleManualRowChange(i, "ORDERQTY", newQty);
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
                      {(() => {
                        const sheet = getManualProductSheet(i);
                        return sheet ? (
                          <Badge className={`${sheet.color.badge} ${sheet.color.text} text-xs`}>
                            {sheet.name}
                          </Badge>
                        ) : (
                          <input
                            type="checkbox"
                            checked={manualSelectedRows.includes(i)}
                            onChange={() => toggleManualRowSelection(i)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        );
                      })()}
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

                    {/* 9: DEL */}
                    <td className="px-3 py-2 text-center align-middle">
                      <button
                        onClick={() => deleteManualRow(i)}
                        className="text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {manualRows.length === 0 && (
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

        {/* ACTIONS FOOTER (matches MappingPage centered footer) */}
        <div className="flex justify-center pt-6 pb-12 gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              let updatedCount = 0;
              setManualRows(prevRows => {
                return prevRows.map(row => {
                  const boxPack = Number(row["BOX PACK"] || row.matchedProduct?.boxPack || 0);
                  const currentQty = Number(row.ORDERQTY || 0);
                  if (boxPack > 0 && currentQty > 0) {
                    const remainder = currentQty % boxPack;
                    if (remainder !== 0) {
                      const newQty = Math.ceil(currentQty / boxPack) * boxPack;
                      updatedCount++;
                      const newPack = newQty / boxPack;
                      const finalPack = Number.isInteger(newPack) ? newPack : Number(newPack.toFixed(2));
                      return { ...row, ORDERQTY: newQty, PACK: finalPack };
                    }
                  }
                  return row;
                });
              });
              setTimeout(() => {
                if (updatedCount > 0) {
                  toast.success(`Rounded off ${updatedCount} products to nearest box pack`);
                } else {
                  toast.info("All products are already rounded");
                }
              }, 0);
            }}
            className="bg-white hover:bg-neutral-50 border-blue-200 text-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Round Off All
          </Button>

          <Button
            onClick={handleProcessOrders}
            disabled={converting}
            className="px-8 py-3 text-base shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60"
          >
            {converting ? (
              <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
            ) : (
              <><Zap className="w-5 h-5 mr-2" /> Process Orders</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
