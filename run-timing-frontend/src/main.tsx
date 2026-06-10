import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initFidalDataset } from './data/fidalDataset'

// Carica in memoria l'eventuale dataset FIDAL importato (IndexedDB) prima di
// montare l'app, così i lookup sincroni lo trovano già pronto.
initFidalDataset().finally(() => {
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <App />
        </StrictMode>,
    )
})