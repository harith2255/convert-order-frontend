import api from "./api";

export const getOrderResult = async (id: string) => {
  const { data } = await api.get(`/orders/${id}`);
  return data;
};

// Helper to get clean filename base
const getBaseName = (fileName: string) => {
  return fileName?.split('.').slice(0, -1).join('.') || fileName || "file";
};

export const downloadOrderFile = async (id: string, originalFileName?: string, type?: 'sheets' | 'main') => {
  try {
    console.log(`🔽 Downloading file for ID: ${id} ${type ? `(Type: ${type})` : ''}`);

    const endpoint = type 
      ? `/orders/download/${id}/${type}` 
      : `/orders/download/${id}`;

    const res = await api.get(endpoint, {
      responseType: "blob",
    });

    // Check if we got an error JSON instead of a file
    const contentType = res.headers["content-type"];
    if (contentType?.includes("application/json")) {
      const text = await res.data.text();
      const errorData = JSON.parse(text);
      throw new Error(errorData.message || "Download failed");
    }

    // Create and trigger download
    const blob = new Blob([res.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    
    // Construct filename
    const name = originalFileName 
      ? `${getBaseName(originalFileName)}_converted.xlsx`
      : `converted_order_${id}.xlsx`;

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    console.log("✅ Download completed");
  } catch (error: any) {
    console.error("❌ Download error:", error);
    
    if (error.response?.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.message || "Download failed");
      } catch (parseError) {
        throw error;
      }
    }
    
    throw error;
  }
};

export const downloadSchemeFile = async (id: string, originalFileName?: string) => {
  const res = await api.get(`/orders/${id}/scheme-file`, {
    responseType: "blob"
  });

  const blob = new Blob([res.data], {
    type:
      res.headers["content-type"] ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  // Construct filename
  const name = originalFileName 
    ? `${getBaseName(originalFileName)}_scheme_summary.xlsx`
    : `scheme-summary-${id}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

// Preview converted orders
export const previewConvertedOrders = async (id: string, page = 1, limit = 50) => {
  const { data } = await api.get(`/orders/preview/${id}`, {
    params: { page, limit }
  });
  return data;
};

// Preview scheme data
export const previewSchemeData = async (id: string, page = 1, limit = 50) => {
  const { data } = await api.get(`/orders/preview-scheme/${id}`, {
    params: { page, limit }
  });
  return data;
};

// Update converted order data
export const updateConvertedData = async (id: string, rows: any[]) => {
  const { data } = await api.put(`/orders/converted-data/${id}`, { rows });
  return data;
};

// Update scheme data
export const updateSchemeData = async (id: string, schemeDetails: any[]) => {
  const { data } = await api.put(`/orders/scheme-data/${id}`, { schemeDetails });
  return data;
};

// Generate Division Report
export const generateDivisionReport = async (uploadId: string, division?: string) => {
  const { data } = await api.post("/orders/convert/division-report", { uploadId, division });
  return data;
};

// Helper to download file from URL (Blob)
export const downloadFileFromUrl = async (url: string) => {
  // Remove /api prefix if present because axios baseURL already includes it
  const cleanUrl = url.replace(/^\/api/, "");
  const res = await api.get(cleanUrl, { responseType: "blob" });
  
  const blob = new Blob([res.data], {
    type: res.headers["content-type"] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const filename = url.split('/').pop() || "download.xlsx";
  
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};

