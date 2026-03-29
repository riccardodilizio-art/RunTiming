import { X, Printer, Timer, Award } from 'lucide-react';
import type { Result, Event, Race } from '../../types';

interface Props {
    result: Result;
    event: Event;
    race: Race;
    catPosition?: number; // posizione nella propria categoria
    onClose: () => void;
}

function formatEventDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
    });
}

function positionLabel(pos: number): string {
    if (pos === 1) return '1° posto';
    if (pos === 2) return '2° posto';
    if (pos === 3) return '3° posto';
    return `${pos}° posto`;
}

export default function CertificateModal({ result, event, race, catPosition, onClose }: Props) {

    function handlePrint() {
        window.print();
    }

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden"
                onClick={onClose}
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Modal header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 print:hidden">
                        <h2 className="font-semibold text-slate-800 text-sm">Anteprima attestato</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-1.5 bg-ocean-600 hover:bg-ocean-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <Printer className="w-3.5 h-3.5" /> Stampa / PDF
                            </button>
                            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Certificate body */}
                    <div className="p-6" id="certificate-print">
                        <Certificate result={result} event={event} race={race} catPosition={catPosition} />
                    </div>
                </div>
            </div>

            {/* Print-only full page */}
            <style>{`
                @media print {
                    body > * { display: none !important; }
                    #certificate-print-root { display: block !important; }
                }
            `}</style>
            <div id="certificate-print-root" className="hidden print:block fixed inset-0 bg-white z-[9999] p-12">
                <Certificate result={result} event={event} race={race} catPosition={catPosition} />
            </div>
        </>
    );
}

function Certificate({ result, event, race, catPosition }: Omit<Props, 'onClose'>) {
    const isFinisher = result.status === 'finisher';

    return (
        <div
            className="relative border-2 border-ocean-200 rounded-xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 50%, #f0f7ff 100%)' }}
        >
            {/* Top accent */}
            <div className="h-2" style={{ background: 'linear-gradient(90deg, #0a3c6e, #0168c8, #37a4f8)' }} />

            <div className="px-8 py-7">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-ocean-600 rounded-lg flex items-center justify-center">
                            <Timer className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="font-display font-800 text-lg text-ocean-700 leading-none">RunTiming</p>
                            <p className="text-slate-400 text-xs">Cronometraggio ufficiale</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-xs">Data evento</p>
                        <p className="text-slate-700 text-xs font-medium">{formatEventDate(event.date)}</p>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-ocean-50 border-2 border-ocean-200 mb-3">
                        <Award className="w-7 h-7 text-ocean-600" />
                    </div>
                    <p className="text-slate-500 text-xs uppercase tracking-widest font-medium mb-1">
                        {isFinisher ? 'Attestato di partecipazione' : 'Attestato di iscrizione'}
                    </p>
                    <h1 className="font-display font-900 text-3xl text-slate-800">
                        {result.athleteName}
                    </h1>
                    {result.team && (
                        <p className="text-slate-500 text-sm mt-0.5">{result.team}</p>
                    )}
                </div>

                {/* Description */}
                <div className="text-center bg-white/80 rounded-xl border border-slate-200 px-6 py-4 mb-5">
                    <p className="text-slate-600 text-sm leading-relaxed">
                        {isFinisher
                            ? <>ha completato la gara <strong className="text-slate-800">{race.name}</strong></>
                            : <>si è iscritto alla gara <strong className="text-slate-800">{race.name}</strong></>
                        }{' '}
                        nell'ambito dell'evento <strong className="text-slate-800">{event.title}</strong>
                        {isFinisher && (
                            <> svoltosi il <strong className="text-slate-800">{formatEventDate(event.date)}</strong>
                            {' '}a <strong className="text-slate-800">{event.city}</strong></>
                        )}
                    </p>
                </div>

                {/* Stats */}
                {isFinisher && (
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="text-center bg-white border border-slate-200 rounded-xl py-3">
                            <p className="text-xs text-slate-400 mb-0.5">Posizione assoluta</p>
                            <p className="font-display font-800 text-2xl text-ocean-700">{positionLabel(result.position)}</p>
                        </div>
                        {catPosition !== undefined && (
                            <div className="text-center bg-white border border-slate-200 rounded-xl py-3">
                                <p className="text-xs text-slate-400 mb-0.5">Categoria {result.category}</p>
                                <p className="font-display font-800 text-2xl text-ocean-700">{positionLabel(catPosition)}</p>
                            </div>
                        )}
                        <div className="text-center bg-white border border-slate-200 rounded-xl py-3">
                            <p className="text-xs text-slate-400 mb-0.5">
                                {race.raceType === 'laps_timed' ? 'Giri completati' : 'Tempo ufficiale'}
                            </p>
                            <p className="font-display font-800 text-xl text-slate-800 font-mono">
                                {race.raceType === 'laps_timed'
                                    ? `${result.lapsCompleted} giri`
                                    : result.time}
                            </p>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <div>
                        <p className="text-slate-400 text-xs">Organizzatore</p>
                        <p className="text-slate-600 text-xs font-medium">{event.organizer}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-xs">Luogo</p>
                        <p className="text-slate-600 text-xs font-medium">{event.city} ({event.province})</p>
                    </div>
                </div>
            </div>

            {/* Bottom accent */}
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #0a3c6e, #0168c8, #37a4f8)' }} />
        </div>
    );
}
