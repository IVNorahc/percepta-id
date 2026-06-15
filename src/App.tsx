import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import DashboardPage from './pages/DashboardPage'
import ScanPage from './pages/ScanPage'
import PersonnelPage from './pages/PersonnelPage'
import RapportsPage from './pages/RapportsPage'
import AlertesPage from './pages/AlertesPage'
import ParametresPage from './pages/ParametresPage'
import AdminPage from './pages/AdminPage'
import VerifierPage from './pages/VerifierPage'
import EmployesPage from './pages/EmployesPage'
import PointagePage from './pages/PointagePage'
import PresencePage from './pages/PresencePage'
import HistoriquePointagePage from './pages/HistoriquePointagePage'
import NotFoundPage from './pages/NotFoundPage'
import { useAuth } from './contexts/AuthContext'

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user?.email !== 'muhammadsamb@gmail.com') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/scan"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ScanPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/verifier"
        element={
          <ProtectedRoute>
            <AppLayout>
              <VerifierPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/employes"
        element={
          <ProtectedRoute>
            <AppLayout>
              <EmployesPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pointage"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PointagePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/presence"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PresencePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/historique-pointage"
        element={
          <ProtectedRoute>
            <AppLayout>
              <HistoriquePointagePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/personnel"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PersonnelPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rapports"
        element={
          <ProtectedRoute>
            <AppLayout>
              <RapportsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/alertes"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AlertesPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/parametres"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ParametresPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AppLayout>
                <AdminPage />
              </AppLayout>
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
