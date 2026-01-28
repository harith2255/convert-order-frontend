import api from "./api";

/* =====================================
   MASTER DATA API (PRODUCTION)
===================================== */

export interface CustomerData {
  customerCode: string;
  customerType?: string;
  customerName: string;
  address1?: string;
  address2?: string;
  address3?: string;
  city?: string;
  pinCode?: string;
  state?: string;
  contactPerson?: string;
  phoneNo1?: string;
  phoneNo2?: string;
  mobileNo?: string;
  drugLicNo?: string;
  drugLicFromDt?: string;
  drugLicToDt?: string;
  drugLicNo1?: string;
  drugLicFromDt1?: string;
  drugLicToDt1?: string;
  gstNo?: string;
  email?: string;
}

export interface ProductData {
  productCode: string;
  productName: string;
  division?: string;
}

export const masterDataApi = {
  /* =====================================
     MASTER DATABASE
  ===================================== */

  uploadDatabase(file: File) {
    const form = new FormData();
    form.append("file", file);

    return api.post("/admin/master/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  async exportMasterData() {
    try {
      const res = await api.get("/admin/master/export", {
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `master-data-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
      throw err;
    }
  },

  async getDivisions() {
    const res = await api.get<string[]>("/admin/master/divisions");
    return res.data;
  },

  /* =====================================
     CUSTOMERS
  ===================================== */

  async getCustomers(search = "", page = 1, limit = 10) {
    const res = await api.get("/admin/customers", {
      params: { search, page, limit },
    });

    // Support both { data: [...], total: 10 } and [...] formats
    const data = Array.isArray(res.data?.data) 
      ? res.data.data 
      : (Array.isArray(res.data) ? res.data : []);
      
    const total = res.data?.total !== undefined ? res.data.total : data.length;

    return {
      data,
      total,
      page: res.data?.page || page,
      limit: res.data?.limit || limit,
    };
  },

  createCustomer(payload: Partial<CustomerData>) {
    return api.post("/admin/customers", payload);
  },

  updateCustomer(id: string, payload: Partial<CustomerData>) {
    return api.put(`/admin/customers/${id}`, payload);
  },

  deleteCustomer(id: string) {
    return api.delete(`/admin/customers/${id}`);
  },

  uploadCustomers(file: File) {
    const form = new FormData();
    form.append("file", file);
    return api.post("/admin/customers/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  async exportCustomers() {
    try {
      const res = await api.get("/admin/customers/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `customers-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed", err);
      throw err;
    }
  },

  /* =====================================
     PRODUCTS
  ===================================== */

  async getProducts(search = "", page = 1, limit = 10) {
    const res = await api.get("/admin/products", {
      params: { search, page, limit },
    });

    // Support both { data: [...], total: 10 } and [...] formats
    const data = Array.isArray(res.data?.data) 
      ? res.data.data 
      : (Array.isArray(res.data) ? res.data : []);

    const total = res.data?.total !== undefined ? res.data.total : data.length;

    return {
      data,
      total,
      page: res.data?.page || page,
      limit: res.data?.limit || limit,
    };
  },

  createProduct(payload: ProductData) {
    return api.post("/admin/products", payload);
  },

  updateProduct(
    id: string,
    payload: {
      productName?: string;
      division?: string;
    }
  ) {
    return api.put(`/admin/products/${id}`, payload);
  },

  deleteProduct(id: string) {
    return api.delete(`/admin/products/${id}`);
  },

  transferProduct(payload: { productCode: string; newDivision: string }) {
    return api.patch("/admin/products/transfer", payload);
  },

  uploadProducts(file: File) {
    const form = new FormData();
    form.append("file", file);
    return api.post("/admin/products/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  async exportProducts() {
    try {
      const res = await api.get("/admin/products/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `products-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed", err);
      throw err;
    }
  },

  /* =====================================
     SCHEMES
  ===================================== */

  async getSchemes(search = "", page = 1, limit = 10) {
    const res = await api.get("/admin/schemes", {
      params: { search, page, limit },
    });

    const data = Array.isArray(res.data?.data)
      ? res.data.data
      : [];

    const total = res.data?.total ?? data.length;

    return {
      data,
      total,
      page: res.data?.page || page,
      limit: res.data?.limit || limit,
    };
  },

  createScheme(payload: any) {
    return api.post("/admin/schemes", payload);
  },

  updateScheme(id: string, payload: any) {
    return api.put(`/admin/schemes/${id}`, payload);
  },

  deleteScheme(id: string) {
    return api.delete(`/admin/schemes/${id}`);
  },


  uploadSchemes(file: File) {
    const form = new FormData();
    form.append("file", file);
    return api.post("/admin/schemes/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  async exportSchemes() {
    try {
      const res = await api.get("/admin/schemes/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `schemes-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed", err);
      throw err;
    }
  },
};
