import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CompanyProvider, useCompany } from "@/contexts/CompanyContext"; // Adicionado useCompany

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Users from "./pages/Users";
import Quarters from "./pages/Quarters";
import Objectives from "./pages/Objectives";
import KRCheckins from "./pages/KRCheckins";
import Profile from "./pages/Profile";
import Overview from "./pages/Overview";
import PerformanceHistory from "./pages/PerformanceHistory";
import Prototypes from "./pages/Prototypes";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import ForgotPassword from "./pages/ForgotPassword";
import ConfirmEmail from "./pages/ConfirmEmail";
import PendingApproval from "./pages/PendingApproval";

import Pricing from "./pages/Pricing";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import CheckoutCanceled from "./pages/CheckoutCanceled";


import { AppLayout } from "@/components/AppLayout";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const { selectedCompany } = useCompany();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Se o usuário não está ativo, redireciona para a página de espera
  // Permitimos acesso à página de pending-approval mesmo se inativo
  if (profile && !profile.is_active && location.pathname !== '/pending-approval') {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false, // Prevents data disappearing on window focus if auth is unstable
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
            <ErrorBoundary>
              <Routes>
                {/* Public Routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/confirm-email" element={<ConfirmEmail />} />

                {/* Pending Approval (Standalone) */}
                <Route path="/pending-approval" element={<ProtectedRoute><PendingApproval /></ProtectedRoute>} />

                {/* Checkout Result Routes (Standalone) */}
                <Route path="/checkout-success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
                <Route path="/checkout-canceled" element={<ProtectedRoute><CheckoutCanceled /></ProtectedRoute>} />

                {/* Protected Routes with Sidebar Layout */}
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/companies" element={<Companies />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/quarters" element={<Quarters />} />
                  <Route path="/objectives" element={<Objectives />} />
                  <Route path="/kr-checkins" element={<KRCheckins />} />
                  <Route path="/overview" element={<Overview />} />
                  <Route path="/performance-history" element={<PerformanceHistory />} />
                  <Route path="/prototypes" element={<Prototypes />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/pricing" element={<Pricing />} />
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
