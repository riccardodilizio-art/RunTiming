import { Search, ClipboardList, Timer, Trophy } from 'lucide-react';

const steps = [
    { icon: Search, number: '01', title: 'Trova la tua gara', description: 'Cerca tra centinaia di eventi per sport, distanza, luogo e data. Filtra in base alle tue preferenze.' },
    { icon: ClipboardList, number: '02', title: 'Iscriviti online', description: 'Completa l\'iscrizione in pochi minuti. Pagamento sicuro e conferma immediata via email.' },
    { icon: Timer, number: '03', title: 'Gareggia', description: 'Il giorno della gara il nostro sistema di cronometraggio rileva automaticamente il tuo tempo.' },
    { icon: Trophy, number: '04', title: 'Consulta i risultati', description: 'Visualizza la classifica live durante l\'evento e condividi i tuoi risultati.' },
];

export default function HowItWorks() {
    return (
        <section className="py-20 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.02]"
                 style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #f97316 0, #f97316 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-14">
                    <p className="text-brand-500 font-mono text-xs tracking-widest uppercase mb-2">Come funziona</p>
                    <h2 className="font-display font-800 text-4xl md:text-5xl text-white">Da zero al <span className="text-gradient">traguardo</span></h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {steps.map((step, i) => (
                        <div key={i} className="relative group">
                            {i < steps.length - 1 && (
                                <div className="hidden lg:block absolute top-9 left-[calc(50%+32px)] right-[-50%] h-px bg-gradient-to-r from-brand-500/40 to-transparent z-0" />
                            )}
                            <div className="relative z-10 bg-dark-700 border border-white/5 group-hover:border-brand-500/20 rounded-2xl p-6 transition-all duration-200 group-hover:bg-dark-600">
                                <div className="font-display font-900 text-6xl text-white/5 absolute top-4 right-4 leading-none select-none">{step.number}</div>
                                <div className="w-14 h-14 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                                    <step.icon className="w-6 h-6 text-brand-400" />
                                </div>
                                <h3 className="font-display font-700 text-lg text-white mb-2">{step.title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}