
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StoreProvider } from "@/contexts/StoreContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import LoginForm from "@/components/auth/LoginForm";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Sales from "@/pages/Sales";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = () => {
  const { user } = useAuth();

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/reports" element={<div className="text-center py-20">Reports page coming soon...</div>} />
              <Route path="/users" element={<div className="text-center py-20">Users page coming soon...</div>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <StoreProvider>
              <AppLayout />
            </StoreProvider>
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
