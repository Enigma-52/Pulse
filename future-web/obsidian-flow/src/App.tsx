import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Traces from "./pages/Traces";
import TraceDetail from "./pages/TraceDetail";
import Logs from "./pages/Logs";
import LogDetail from "./pages/LogDetail";
import Metrics from "./pages/Metrics";
import MetricDetail from "./pages/MetricDetail";
import ServiceDetail from "./pages/ServiceDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="traces" element={<Traces />} />
            <Route path="traces/:id" element={<TraceDetail />} />
            <Route path="logs" element={<Logs />} />
            <Route path="logs/:id" element={<LogDetail />} />
            <Route path="metrics" element={<Metrics />} />
            <Route path="metrics/:id" element={<MetricDetail />} />
            <Route path="services/:id" element={<ServiceDetail />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
