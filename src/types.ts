export interface conversionData {
  successRows: number;
  schemeSummary?: {
    count: number;
    totalFreeQty: number;
  };
  fileName?: string;
  convertedData?: {
    headers: string[];
    rows: any[];
  };
  schemeDetails?: any[];
  errors: Array<{
    rowNumber: number;
    field: string;
    error: string;
    originalValue?: string;
    suggestedFix?: string;
  }>;
  warnings: Array<{
    rowNumber: number;
    field: string;
    warning: string;
    originalValue?: string;
    newValue?: string | number;
  }>;
  processingTime: string | number;
  downloadUrls?: Array<{ type: string; url: string }>;
  status: string;
}
