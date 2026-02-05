import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: "admin" | "user";
}

// Memoized to prevent unnecessary re-renders during navigation
const ProtectedRoute = React.memo(function ProtectedRoute({
  children,
  role,
}: ProtectedRouteProps) {
  const { user } = useAuth();

  /* ------------------------
     NOT LOGGED IN
  ------------------------- */
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  /* ------------------------
     ROLE CHECK
  ------------------------- */
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
});

export default ProtectedRoute;

