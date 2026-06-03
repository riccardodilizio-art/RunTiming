import { Printer, X } from 'lucide-react';
import CertificateCanvas from './CertificateCanvas';
import type { CertificateTemplate, CertFieldKey } from '../../types';

export default function CertificatePrintModal({
    template,
    values,
    onClose,
}: {
    template: CertificateTemplate;
    values: Partial<Record<CertFieldKey, string>>;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-4 w-full max-w-4xl">
                <div className="flex items-center justify-between mb-3 print:hidden">
                    <h3 className="font-semibold text-slate-800">Attestato</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={() => window.print()}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors">
                            <Printer className="h-4 w-4" /> Stampa / Salva PDF
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="cert-print-area">
                    <CertificateCanvas template={template} values={values} />
                </div>
            </div>
        </div>
    );
}
