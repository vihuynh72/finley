import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import ClientForm from '@/pages/ClientForm';
import Landing from '@/pages/Landing';
import WorkspaceLayout from '@/components/finley/WorkspaceLayout';
import Overview from '@/pages/Overview';
import TopicPage from '@/pages/TopicPage';
import ScenariosPage from '@/pages/ScenariosPage';
import SourcesPage from '@/pages/SourcesPage';
import EvalsPage from '@/pages/EvalsPage';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Login is not enforced for now: pages are open, scans and the scenario agent still need a signed-in user. */}
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<WorkspaceLayout />}>
        <Route index element={<Overview />} />
        <Route path="scenarios" element={<ScenariosPage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="evals" element={<EvalsPage />} />
        <Route path=":slug" element={<TopicPage />} />
      </Route>
      <Route path="/app/clients/new" element={<div className="max-w-3xl mx-auto p-8"><ClientForm /></div>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App