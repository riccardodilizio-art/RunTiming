import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AthleteAuthProvider } from './context/AthleteAuthContext';
import { SocietyAuthProvider } from './context/SocietyAuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import ScrollToTop from './components/layout/ScrollToTop';
import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import ResultsPage from './pages/ResultsPage';
import ContactsPage from './pages/ContactsPage';
import PaymentPage from './pages/PaymentPage';
import RegisterPage from './pages/RegisterPage';
import ParticipantsPage from './pages/ParticipantsPage';
import AdminPage from './pages/admin/AdminPage';
import LoginPage from './pages/LoginPage';
import OrganizerPage from './pages/OrganizerPage';
import AthleteLoginPage from './pages/AthleteLoginPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordResetPages';
import AthleteRegisterPage from './pages/AthleteRegisterPage';
import AthleteDashboardPage from './pages/AthleteDashboardPage';
import SocietyRegisterPage from './pages/society/SocietyRegisterPage';
import SocietyLoginPage from './pages/society/SocietyLoginPage';
import SocietyDashboardPage from './pages/society/SocietyDashboardPage';

// Le aree "back-office" hanno un proprio menu: nascondiamo header/footer pubblici
// per evitare il doppio menu.
function isBackOffice(pathname: string): boolean {
    // Dashboard autenticate con menu proprio (no header pubblico). Esclude le
    // pagine di registrazione/accesso società, che restano pubbliche.
    return pathname.startsWith('/admin') || pathname === '/societa' || pathname === '/profilo';
}

function Shell() {
    const { pathname } = useLocation();
    const chrome = !isBackOffice(pathname);
    return (
        <div className="min-h-screen flex flex-col">
            {chrome && <Navbar />}
            <div className="flex-1 flex flex-col">
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/events" element={<EventsPage />} />
                    <Route path="/events/:slug" element={<EventDetailPage />} />
                    <Route path="/results" element={<ResultsPage />} />
                    <Route path="/contacts" element={<ContactsPage />} />
                    <Route path="/events/:slug/register" element={<RegisterPage />} />
                    <Route path="/events/:slug/partecipanti" element={<ParticipantsPage />} />
                    <Route path="/pagamento/:ref" element={<PaymentPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/accedi" element={<AthleteLoginPage />} />
                    <Route path="/password-dimenticata" element={<ForgotPasswordPage />} />
                    <Route path="/reimposta-password" element={<ResetPasswordPage />} />
                    <Route path="/registrati" element={<AthleteRegisterPage />} />
                    <Route path="/profilo" element={<AthleteDashboardPage />} />
                    <Route path="/admin" element={
                        <ProtectedRoute>
                            <AdminPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/organizer" element={<OrganizerPage />} />
                    <Route path="/societa/registrati" element={<SocietyRegisterPage />} />
                    <Route path="/societa/accedi" element={<SocietyLoginPage />} />
                    <Route path="/societa" element={<SocietyDashboardPage />} />
                </Routes>
            </div>
            {chrome && <Footer />}
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <AthleteAuthProvider>
                <SocietyAuthProvider>
                <BrowserRouter>
                    <ScrollToTop />
                    <Shell />
                </BrowserRouter>
                </SocietyAuthProvider>
            </AthleteAuthProvider>
        </AuthProvider>
    );
}
