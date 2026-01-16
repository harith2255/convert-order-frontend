import api from "./api";

export const getOrderResult = async (id: string) => {
  const { data } = await api.get(`/orders/${id}`);
  return data;
};

export const downloadOrderFile = async (id: string) => {
  try {
    console.log("🔽 Downloading file for ID:", id);

    const res = await api.get(`/orders/download/${id}`, {
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
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "converted-orders.xlsx";
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