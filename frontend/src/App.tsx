import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/layout/AppLayout';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from './components/ui/toaster';
import DashboardPage from './pages/Dashboard';
import AnalysisViewPage from './pages/AnalysisView';
import ServiceDetailPage from './pages/ServiceDetail';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="services" element={<ServiceDetailPage />} />
            <Route path="analysis" element={<AnalysisViewPage />} />
          </Route>
        </Routes>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
