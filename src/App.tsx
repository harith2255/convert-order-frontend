import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Menu } from "lucide-react";
import { useState, useCallback, Suspense, lazy } from "react";

import { Sidebar } from "./components/Sidebar.tsx";
import { LoginPage } from "./components/pages/LoginPage.tsx";
import ProtectedRoute from "./components/ProtectedRoutes.tsx";

import { useAuth } from "./context/AuthContext.tsx";

// Lazy load page components for better performance (code splitting)
const UserDashboard = lazy(() => import("./components/pages/UserDashboard.tsx").then(m => ({ default: m.UserDashboard })));
const UploadPage = lazy(() => import("./components/pages/UploadPage.tsx").then(m => ({ default: m.UploadPage })));
const MappingPage = lazy(() => import("./components/pages/MappingPage.tsx").then(m => ({ default: m.MappingPage })));
const ResultPage = lazy(() => import("./components/pages/ResultPage.tsx").then(m => ({ default: m.ResultPage })));
const HistoryPage = lazy(() => import("./components/pages/HistoryPage.tsx").then(m => ({ default: m.HistoryPage })));
const AdminDashboard = lazy(() => import("./components/pages/AdminDashboard.tsx").then(m => ({ default: m.AdminDashboard })));
const UserAccessPage = lazy(() => import("./components/pages/UserAccessPage.tsx").then(m => ({ default: m.UserAccessPage })));
const MasterDataPage = lazy(() => import("./components/pages/MasterDataPage.tsx").then(m => ({ default: m.MasterDataPage })));
const EditOrdersPage = lazy(() => import("./components/pages/EditOrdersPage.tsx").then(m => ({ default: m.EditOrdersPage })));

export default function App() {
  const { user, loading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Memoize the mobile menu toggle to prevent Sidebar re-renders
  const handleMobileMenuToggle = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  /* ----------------------------
     NOT AUTHENTICATED
  ----------------------------- */
  if (!user) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </>
    );
  }

  /* ----------------------------
     AUTHENTICATED LAYOUT
  ----------------------------- */
  return (
    <div className="h-screen overflow-hidden bg-neutral-50">
      <Sidebar
        userRole={user.role}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuToggle={handleMobileMenuToggle}
      />

      {/* Main content area - scrollable */}
      <div className="lg:ml-64 h-screen flex flex-col bg-neutral-50 overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-20 bg-white border-b border-neutral-200  py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={handleMobileMenuToggle}
              className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-semibold text-neutral-900">
              OrderConvert
            </span>
            <div className="w-10" />
          </div>
        </div>

        {/* Page content - flex-1 with proper overflow */}
        <div className="flex-1 overflow-y-auto p-3">
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center h-full min-h-[50vh] space-y-4">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
                <p className="text-sm text-neutral-600">Loading...</p>
              </div>
            }
          >
            <Routes>
              {/* USER ROUTES */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    {user.role === "admin" ? (
                      <Navigate to="/admin" replace />
                    ) : (
                      <UserDashboard />
                    )}
                  </ProtectedRoute>
                }
              />

              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <UploadPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mapping"
                element={
                  <ProtectedRoute>
                    <MappingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/result/:id"
                element={
                  <ProtectedRoute>
                    <ResultPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/edit-orders/:id"
                element={
                  <ProtectedRoute>
                    <EditOrdersPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <HistoryPage />
                  </ProtectedRoute>
                }
              />

              {/* ADMIN ROUTES */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute role="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/user-access"
                element={
                  <ProtectedRoute role="admin">
                    <UserAccessPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/master-data"
                element={
                  <ProtectedRoute role="admin">
                    <MasterDataPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </div>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}
