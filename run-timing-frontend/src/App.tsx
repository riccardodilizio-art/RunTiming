import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';

function PlaceholderPage({ title }: { title: string }) {
    return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <p className="font-display font-700 text-4xl text-slate-700 mb-2">{title}</p>
                <p className="text-slate-400 text-sm">Pagina in costruzione</p>
            </div>
        </main>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <Navbar />
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/events/:slug" element={<EventDetailPage />} />
                <Route path="/results" element={<PlaceholderPage title="Classifiche" />} />
                <Route path="/athletes" element={<PlaceholderPage title="Atleti" />} />
                <Route path="/login" element={<PlaceholderPage title="Accedi" />} />
                <Route path="/register" element={<PlaceholderPage title="Registrati" />} />
                <Route path="/organizer" element={<PlaceholderPage title="Per Organizzatori" />} />
            </Routes>
            <Footer />
        </BrowserRouter>
    );
}