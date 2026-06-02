import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AthleteAuthProvider } from './context/AthleteAuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import ScrollToTop from './components/layout/ScrollToTop';
import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import ResultsPage from './pages/ResultsPage';
import ContactsPage from './pages/ContactsPage';
import RegisterPage from './pages/RegisterPage';
import ParticipantsPage from './pages/ParticipantsPage';
import AdminPage from './pages/admin/AdminPage';
import LoginPage from './pages/LoginPage';
import OrganizerPage from './pages/OrganizerPage';
import AthleteLoginPage from './pages/AthleteLoginPage';
import AthleteRegisterPage from './pages/AthleteRegisterPage';
import AthleteDashboardPage from './pages/AthleteDashboardPage';

export default function App() {
    return (
        <AuthProvider>
            <AthleteAuthProvider>
                <BrowserRouter>
                    <ScrollToTop />
                    <div className="min-h-screen flex flex-col">
                    <Navbar />
                    <div className="flex-1 flex flex-col">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/events" element={<EventsPage />} />
                        <Route path="/events/:slug" element={<EventDetailPage />} />
                        <Route path="/results" element={<ResultsPage />} />
                        <Route path="/contacts" element={<ContactsPage />} />
                        <Route path="/events/:slug/register" element={<RegisterPage />} />
                        <Route path="/events/:slug/partecipanti" element={<ParticipantsPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/accedi" element={<AthleteLoginPage />} />
                        <Route path="/registrati" element={<AthleteRegisterPage />} />
                        <Route path="/profilo" element={<AthleteDashboardPage />} />
                        <Route path="/admin" element={
                            <ProtectedRoute>
                                <AdminPage />
                            </ProtectedRoute>
                        } />
                        <Route path="/organizer" element={<OrganizerPage />} />
                    </Routes>
                    </div>
                    <Footer />
                    </div>
                </BrowserRouter>
            </AthleteAuthProvider>
        </AuthProvider>
    );
}
