import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Riporta la finestra in cima a ogni cambio di route.
 * Senza questo, navigando da una pagina scrollata in basso si resterebbe
 * nella stessa posizione verticale sulla pagina nuova.
 */
export default function ScrollToTop() {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
}
