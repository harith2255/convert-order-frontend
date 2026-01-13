/**
 * MAPPING PAGE - Column Mapping Interface
 * Compatible with production backend template structure
 */
import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
} from "lucide-react";
import { Card } from "../Card";
import { Button } from "../Button";
import { Dropdown } from "../Dropdown";
import { Badge } from "../Badge";
import { toast } from "sonner";
import api from "../../services/api";
import { useNavigate, useLocation } from "react-router-dom";

interface ExtractedField {
  id: string;
  fieldName: string;
  sampleValue: string;
  autoMapped: string;
  confidence: "high" | "medium" | "low";
}

interface ValidationError {
  field: string;
  message: string;
}

/* 🔒 CANONICAL REQUIRED COLUMNS - Match backend template */
const REQUIRED_COLUMNS = ["ITEMDESC", "ORDERQTY"];

/* ⚠️ Fields to ignore in mapping UI */
const IGNORE_FIELDS = ["sl no", "s.no", "sr no", "free", "amount", "value", "rate", "tax", "total"];

export function MappingPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [standardColumns, setStandardColumns] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());

  const [rows, setRows] = useState<any[]>([]);
const [rowErrors, setRowErrors] = useState<Record<number, string[]>>({});
const [showPreview, setShowPreview] = useState(true);

  
  const parsedResult = location.state?.parsedResult;

  /* ---------------- LOAD TEMPLATE COLUMNS ---------------- */
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const res = await api.get("/orders/template");
        
        // Backend returns UPPERCASE columns: CODE, CUSTOMER NAME, SAPCODE, etc.
        const columns = Array.isArray(res.data.columns) 
          ? res.data.columns 
          : ["CODE", "CUSTOMER NAME", "SAPCODE", "ITEMDESC", "ORDERQTY", "BOX PACK", "PACK", "DVN"];
        
        setStandardColumns([
          { value: "", label: "-- Do Not Map --" },
          ...columns.map((col: string) => ({
            value: col,
            label: col.charAt(0) + col.slice(1).toLowerCase(), // Display: "Code", "Customer name"
          })),
        ]);
      } catch (err) {
        console.error("Template load error:", err);
        toast.error("Failed to load training template");
        
        // Fallback to hardcoded template
        setStandardColumns([
          { value: "", label: "-- Do Not Map --" },
          { value: "CODE", label: "Code" },
          { value: "CUSTOMER NAME", label: "Customer Name" },
          { value: "SAPCODE", label: "SAP Code" },
          { value: "ITEMDESC", label: "Item Description" },
          { value: "ORDERQTY", label: "Order Quantity" },
          { value: "BOX PACK", label: "Box Pack" },
          { value: "PACK", label: "Pack" },
          { value: "DVN", label: "Division" },
        ]);
      }
    };

    loadTemplate();
  }, []);

  /* ---------------- INITIALIZE EXTRACTED FIELDS ---------------- */
  useEffect(() => {
    if (!parsedResult) {
      toast.error("No parsed data found. Please re-upload.");
      navigate("/upload");
      return;
    }

 if (Array.isArray(parsedResult.dataRows)) {
  const previewRows = parsedResult.dataRows.slice(0, 50);
  setRows(previewRows);

  // ✅ validate all rows once
  previewRows.forEach((row, index) => {
    validateRowWithData(index, row);
  });
}
   if (!parsedResult.uploadId) {
  toast.error("Upload session missing. Please re-upload file.");
  navigate("/upload");
  return;
}
setUploadId(parsedResult.uploadId);


    // Filter out ignored fields
    const filtered = (parsedResult.extractedFields || []).filter((f: ExtractedField) => {
      const fieldLower = f.fieldName.toLowerCase();
     return !IGNORE_FIELDS.some(
  ignored => fieldLower === ignored || fieldLower.startsWith(ignored + " ")
);

    });

    setExtractedFields(filtered);

    // Initialize mappings
    const initial: Record<string, string> = {};
    const locked = new Set<string>();

    filtered.forEach((f: ExtractedField) => {
      // Backend already provides autoMapped in UPPERCASE format
      initial[f.id] = f.autoMapped || "";
      
      // Lock high-confidence mappings
     if (f.confidence === "high" && f.autoMapped && REQUIRED_COLUMNS.includes(f.autoMapped)) {
  locked.add(f.id);
}

    });
    

    setMappings(initial);
    setLockedFields(locked);
    setLoading(false);
  }, [parsedResult, navigate]);

  /* ---------------- HELPER FUNCTIONS ---------------- */


const updateCell = (rowIndex: number, column: string, value: string) => {
  setRows(prev => {
    const next = [...prev];
    const updatedRow = { ...next[rowIndex], [column]: value };
    next[rowIndex] = updatedRow;

    validateRowWithData(rowIndex, updatedRow); // ✅ validate immediately
    return next;
  });
};

const validateRowWithData = (rowIndex: number, row: any) => {
  const errors: string[] = [];

  if (!row.ITEMDESC || row.ITEMDESC.trim().length < 3) {
    errors.push("Invalid ITEMDESC");
  }

  if (!row.ORDERQTY || isNaN(Number(row.ORDERQTY)) || Number(row.ORDERQTY) <= 0) {
    errors.push("Invalid ORDERQTY");
  }

  setRowErrors(prev => ({
    ...prev,
    [rowIndex]: errors
  }));
};


  const toggleLock = (fieldId: string) => {
    setLockedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  /* ---------------- HANDLE MAPPING CHANGE ---------------- */
  const handleMappingChange = (fieldId: string, value: string) => {
    setMappings((prev) => ({ ...prev, [fieldId]: value }));
    setValidationErrors([]);
  };

  /* ---------------- VALIDATE MAPPINGS ---------------- */
  const validateMappings = (mappingsToValidate: Record<string, string>): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Get all non-empty, non-meta mappings
    const activeMappings = Object.entries(mappingsToValidate)
      .filter(([key, value]) => !key.startsWith("__meta_") && value && value.trim())
      .map(([key, value]) => ({
        fieldId: key,
        column: value.toUpperCase() // Normalize to uppercase for comparison
      }));

    /* Check 1: Required columns present */
    for (const required of REQUIRED_COLUMNS) {
      const found = activeMappings.some(m => m.column === required);
      if (!found) {
        errors.push({
          field: required,
          message: `Required column missing: ${required}`
        });
      }
    }

    /* Check 2: No duplicate mappings */
    const columns = activeMappings.map(m => m.column);
    const duplicates = columns.filter((col, idx) => columns.indexOf(col) !== idx);
    
    if (duplicates.length > 0) {
      const unique = [...new Set(duplicates)];
      errors.push({
        field: "duplicate",
        message: `Duplicate mappings: ${unique.join(", ")}`
      });
    }

    return errors;
  };
const deleteRow = (rowIndex: number) => {
  setRows(prev => prev.filter((_, i) => i !== rowIndex));

  setRowErrors(prev => {
    const next: Record<number, string[]> = {};
    Object.entries(prev).forEach(([key, value]) => {
      const idx = Number(key);
      if (idx < rowIndex) next[idx] = value;
      if (idx > rowIndex) next[idx - 1] = value;
    });
    return next;
  });
};

  /* ---------------- CONVERT ---------------- */
  const handleConvert = async () => {

    const invalidRows = Object.values(rowErrors).some(e => e.length > 0);
if (invalidRows) {
  toast.error("Fix row errors before converting");
  return;
}

    if (!uploadId) {
      toast.error("Invalid upload session. Please re-upload the file.");
      navigate("/upload");
      return;
    }

    // Step 1: Build repaired mappings
    const repairedMappings: Record<string, string> = { ...mappings };

    // Try to auto-map missing required columns
    REQUIRED_COLUMNS.forEach((required) => {
      const exists = Object.values(repairedMappings).some(
        (v) => v.toUpperCase() === required
      );

      if (!exists) {
        const candidate = extractedFields.find(
          (f) => f.autoMapped.toUpperCase() === required
        );

        if (candidate) {
          repairedMappings[candidate.id] = required;
          toast.info(`Auto-mapped ${candidate.fieldName} → ${required}`);
        }
      }
    });

    // Step 2: Validate
    const errors = validateMappings(repairedMappings);

    if (errors.length > 0) {
      setValidationErrors(errors);
      errors.forEach((e) => toast.error(e.message));
      return;
    }

    // Step 3: Update UI with repaired mappings
    setMappings(repairedMappings);

    // Step 4: Build clean mappings for backend (remove meta fields, empty values)
    const cleanMappings: Record<string, string> = {};
    Object.entries(repairedMappings).forEach(([key, value]) => {
      if (!key.startsWith("__meta_") && value?.trim()) {
        // Send uppercase column names to backend
        cleanMappings[key] = value.toUpperCase();
      }
    });

    // Step 5: Send to backend
    try {
      setConverting(true);

      const res = await api.post("/orders/convert", {
        uploadId,
         mappings: cleanMappings,
          editedRows: rows, 
       
      });

      toast.success(`✅ ${res.data.recordsProcessed} records converted successfully`);
      
      // Navigate to result page
      navigate(`/result/${res.data.uploadId}`);
      
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Conversion failed";
      toast.error(errorMessage);
      
      // Show detailed errors if available
      if (err.response?.data?.errors) {
        const errorList = err.response.data.errors.slice(0, 3);
        errorList.forEach((e: any) => {
          toast.error(`Row ${e.rowNumber}: ${e.error}`);
        });
      }
    } finally {
      setConverting(false);
    }
  };

  /* ---------------- RESET STATE ---------------- */
  const resetState = () => {
    setUploadId(null);
    sessionStorage.removeItem("uploadId");
    setExtractedFields([]);
    setMappings({});
    setValidationErrors([]);
    setLockedFields(new Set());
  };

  /* ---------------- LOADING STATE ---------------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-neutral-600">Loading mapping data…</p>
      </div>
    );
  }

  /* ---------------- STATS ---------------- */
  const highConfidence = extractedFields.filter((f) => f.confidence === "high").length;
  const mediumConfidence = extractedFields.filter((f) => f.confidence === "medium").length;
  const lowConfidence = extractedFields.filter((f) => f.confidence === "low").length;

  const mappedCount = Object.values(mappings).filter(v => v && v.trim()).length;
  const requiredMapped = REQUIRED_COLUMNS.filter(req => 
    Object.values(mappings).some(v => v.toUpperCase() === req)
  ).length;
const isMetaField = (fieldId: string) => {
  return fieldId.startsWith("__meta_");
};

  /* ---------------- RENDER ---------------- */
  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* PAGE HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Column Mapping</h1>
        <p className="text-neutral-600 mt-1">
          Map your file columns to the pharmaceutical training template
        </p>
      </div>

      {/* VALIDATION ERRORS */}
      {validationErrors.length > 0 && (
        <Card>
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-900 mb-2">
                  Validation Errors
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>{error.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* MAPPING STATUS */}
      <Card>
        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium mb-2 text-blue-900">Mapping Status</p>
            <div className="flex flex-wrap gap-4 text-sm text-blue-800">
              <div>
                <span className="font-medium">{mappedCount}</span> of {extractedFields.length} fields mapped
              </div>
              <div>
                <span className="font-medium">{requiredMapped}</span> of {REQUIRED_COLUMNS.length} required columns mapped
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* BUSINESS RULES */}
      <Card>
        <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-2 text-amber-900">
              Template Requirements
            </p>
            <ul className="list-disc list-inside space-y-1 text-amber-800">
              <li><strong>Required:</strong> ITEMDESC (Item Description), ORDERQTY (Order Quantity)</li>
              <li><strong>Optional:</strong> CODE, CUSTOMER NAME, SAPCODE, BOX PACK, PACK, DVN</li>
              <li>High-confidence mappings are locked by default (click 🔒 to unlock)</li>
              <li>Empty columns will be filled with defaults (0 for numbers, blank for text)</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* MAPPING GRID */}
      <Card>
        {/* HEADER */}
        <div className="grid grid-cols-12 gap-4 pb-3 border-b text-sm font-medium text-neutral-600">
          <div className="col-span-3">Extracted Field</div>
          <div className="col-span-3">Sample Value</div>
          <div className="col-span-1 text-center">Confidence</div>
          <div className="col-span-4">Map To Template</div>
          <div className="col-span-1 text-center">Lock</div>
        </div>

        {/* ROWS */}
        <div className="space-y-3 mt-4">
          {extractedFields.map((field) => {
            const meta = isMetaField(field.id);
            const isLocked = lockedFields.has(field.id);
            const isMapped = mappings[field.id] && mappings[field.id].trim();

            return (
              <div
                key={field.id}
                className={`grid grid-cols-12 gap-4 items-center p-3 rounded-lg border transition-all ${
                  isLocked 
                    ? "bg-gray-50 border-gray-300" 
                    : isMapped
                    ? "bg-green-50 border-green-200"
                    : "bg-white border-gray-200"
                }`}
              >
                {/* Field Name */}
                <div className="col-span-3">
                  <div className="font-medium text-neutral-900">
                    {field.fieldName}
                  </div>
                  {meta && (
                    <span className="text-xs text-blue-600">(From Header)</span>
                  )}
                </div>

                {/* Sample Value */}
                <div className="col-span-3 text-sm text-neutral-600 truncate" title={field.sampleValue}>
                  {field.sampleValue || "(empty)"}
                </div>

                {/* Confidence Badge */}
                <div className="col-span-1 text-center">
                  <Badge
                    variant={
                      field.confidence === "high"
                        ? "success"
                        : field.confidence === "medium"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    {field.confidence}
                  </Badge>
                </div>

                {/* Dropdown */}
                <div className="col-span-4">
                  <Dropdown
                    options={standardColumns}
                    value={mappings[field.id] || ""}
                    disabled={meta || isLocked}
                    onChange={(e) =>
                      handleMappingChange(field.id, e.target.value)
                    }
                  />
                </div>

                {/* Lock Button */}
                <div className="col-span-1 flex justify-center">
                  {!meta && (
                    <button
                      onClick={() => toggleLock(field.id)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title={isLocked ? "Unlock to edit" : "Lock mapping"}
                    >
                      {isLocked ? (
                        <Lock className="w-4 h-4 text-gray-600" />
                      ) : (
                        <Unlock className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* SUMMARY FOOTER */}
        <div className="mt-6 pt-6 border-t flex justify-between items-center">
          <div className="flex gap-3">
            <Badge variant="success">{highConfidence} High</Badge>
            <Badge variant="warning">{mediumConfidence} Medium</Badge>
            <Badge variant="neutral">{lowConfidence} Low</Badge>
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                resetState();
                navigate("/upload");
              }}
            >
              Back to Upload
            </Button>
            <Button
              onClick={handleConvert}
             
            >
              {converting ? (
                <>Converting...</>
              ) : (
                <>
                  Convert to Excel
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
      <Card>
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-semibold text-neutral-900">
      Row Preview (Editable)
    </h2>
    <Button
      variant="secondary"
      onClick={() => setShowPreview(v => !v)}
    >
      {showPreview ? "Hide Preview" : "Show Preview"}
    </Button>
  </div>

  {showPreview && (
    <div className="overflow-auto border rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-100">
          <tr>
            {["SAPCODE", "ITEMDESC", "ORDERQTY", "DVN"].map(col => (
              <th
                key={col}
                className="px-3 py-2 text-left font-medium text-neutral-700"
              >
                {col}
              </th>
            ))}
           <th className="px-3 py-2 text-center">Actions</th>

          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => {
            const errors = rowErrors[rowIndex] || [];
            const hasError = errors.length > 0;

            return (
              <tr
                key={rowIndex}
                className={hasError ? "bg-red-50" : "hover:bg-neutral-50"}
              >
                {["SAPCODE", "ITEMDESC", "ORDERQTY", "DVN"].map(col => (
                  <td key={col} className="px-3 py-1">
                    <input
                      value={row[col] ?? ""}
                      onChange={(e) =>
                        updateCell(rowIndex, col, e.target.value)
                      }
                      className={`w-full px-2 py-1 border rounded ${
                        hasError ? "border-red-400" : "border-neutral-300"
                      }`}
                    />
                  </td>
                ))}

             <td className="px-3 py-1 flex items-center justify-center gap-2">
  {hasError ? (
    <Badge variant="warning">Invalid</Badge>
  ) : (
    <Badge variant="success">OK</Badge>
  )}

  <button
    onClick={() => deleteRow(rowIndex)}
    className="text-red-600 hover:text-red-800"
    title="Delete row"
  >
    🗑️
  </button>
</td>

              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  )}
</Card>
    </div>
  );
}