import { useParams } from 'react-router-dom';
import ManageRegistration from '../components/ManageRegistration';
import { USE_API } from '../lib/api';

/** Link personale dell'email di conferma: gestione dell'iscrizione senza account. */
export default function ManageRegistrationPage() {
    const { token = '' } = useParams();
    return (
        <main className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-lg mx-auto space-y-4">
                <h1 className="text-2xl font-bold text-slate-800">La tua iscrizione</h1>
                <p className="text-sm text-slate-500">Fino alla chiusura delle iscrizioni puoi cambiare gara, cedere il pettorale a un'altra persona o rinviare all'anno prossimo (se previsti dall'evento). Se non l'hai ancora pagata, puoi anche annullarla.</p>
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    {USE_API ? <ManageRegistration token={token} /> : <p className="text-sm text-slate-500">Disponibile solo sul sito online.</p>}
                </div>
            </div>
        </main>
    );
}
