import { Link } from 'react-router-dom';
import { Timer, Globe, Send, Share2 } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="bg-dark-800 border-t border-white/5 mt-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

                    <div className="col-span-1 md:col-span-2">
                        <Link to="/" className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                                <Timer className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-display font-800 text-xl tracking-wider">
                RACE<span className="text-gradient">HUB</span>
              </span>
                        </Link>
                        <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                            La piattaforma italiana per la gestione e il cronometraggio di eventi sportivi amatoriali e professionistici.
                        </p>
                        <div className="flex gap-4 mt-5">
                            {[Globe, Send, Share2].map((Icon, i) => (
                                <a key={i} href="#" className="text-gray-600 hover:text-brand-400 transition-colors">
                                    <Icon className="w-5 h-5" />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-display font-700 text-sm tracking-widest text-gray-300 uppercase mb-4">Piattaforma</h4>
                        <ul className="space-y-2.5">
                            {['Gare', 'Classifiche', 'Atleti', 'Organizzatori'].map(item => (
                                <li key={item}><a href="#" className="text-gray-500 hover:text-white text-sm transition-colors">{item}</a></li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-display font-700 text-sm tracking-widest text-gray-300 uppercase mb-4">Supporto</h4>
                        <ul className="space-y-2.5">
                            {['Come funziona', 'FAQ', 'Contatti', 'Privacy Policy'].map(item => (
                                <li key={item}><a href="#" className="text-gray-500 hover:text-white text-sm transition-colors">{item}</a></li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/5 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <p className="text-gray-600 text-xs">© 2025 RaceHub. Tutti i diritti riservati.</p>
                    <p className="text-gray-700 text-xs font-mono">v1.0.0-alpha</p>
                </div>
            </div>
        </footer>
    );
}