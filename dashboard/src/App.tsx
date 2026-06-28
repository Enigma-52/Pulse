import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Traces from "./pages/Traces";
import TraceDetail from "./pages/TraceDetail";
import Logs from "./pages/Logs";
import LogDetail from "./pages/LogDetail";
import Metrics from "./pages/Metrics";
import MetricDetail from "./pages/MetricDetail";
import Services from "./pages/Services";
import ServiceDetail from "./pages/ServiceDetail";
import Databases from "./pages/Databases";
import DatabaseDetail from "./pages/DatabaseDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/setup" element={<Setup />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="traces" element={<Traces />} />
              <Route path="traces/:id" element={<TraceDetail />} />
              <Route path="logs" element={<Logs />} />
              <Route path="logs/:id" element={<LogDetail />} />
              <Route path="services" element={<Services />} />
              <Route path="services/:id" element={<ServiceDetail />} />
              <Route path="databases" element={<Databases />} />
              <Route path="databases/:system" element={<DatabaseDetail />} />
              <Route path="metrics" element={<Metrics />} />
              <Route path="metrics/:id" element={<MetricDetail />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
