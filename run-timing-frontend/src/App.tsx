import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';

function PlaceholderPage({ title }: { title: string }) {
    return (
        <main className="min-h-screen flex items-center justify-center pt-16">
            <div className="text-center">
                <p className="font-display font-700 text-5xl text-white mb-3">{title}</p>
                <p className="text-gray-500">Pagina in costruzione</p>
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
                <Route path="/events" element={<PlaceholderPage title="Lista Gare" />} />
                <Route path="/events/:slug" element={<PlaceholderPage title="Dettaglio Gara" />} />
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