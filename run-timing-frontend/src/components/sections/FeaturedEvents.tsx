import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import EventCard from '../ui/EventCard';
import { mockEvents } from '../../data/mockEvents';

export default function FeaturedEvents() {
    const featured = mockEvents.filter(e => e.isFeatured).slice(0, 3);
    const upcoming = mockEvents.filter(e => !e.isFeatured).slice(0, 3);

    return (
        <section className="py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-end justify-between mb-10">
                    <div>
                        <p className="text-brand-500 font-mono text-xs tracking-widest uppercase mb-2">In evidenza</p>
                        <h2 className="font-display font-800 text-4xl md:text-5xl text-white">
                            Gare in <span className="text-gradient">primo piano</span>
                        </h2>
                    </div>
                    <Link to="/events" className="hidden sm:flex items-center gap-2 text-gray-400 hover:text-brand-400 text-sm transition-colors group">
                        Vedi tutte <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-16">
                    <div className="lg:col-span-2"><EventCard event={featured[0]} featured /></div>
                    <div className="flex flex-col gap-5">
                        {featured.slice(1).map(event => <EventCard key={event.id} event={event} featured />)}
                    </div>
                </div>

                <div className="mb-6">
                    <p className="text-gray-500 font-mono text-xs tracking-widest uppercase mb-1">Prossimamente</p>
                    <h3 className="font-display font-700 text-2xl text-white">Altre gare</h3>
                </div>
                <div className="space-y-3">
                    {upcoming.map(event => <EventCard key={event.id} event={event} />)}
                </div>
                <div className="text-center mt-8">
                    <Link to="/events" className="inline-flex items-center gap-2 border border-white/10 hover:border-brand-500/40 text-gray-300 hover:text-white px-6 py-3 rounded-xl text-sm font-medium transition-all hover:bg-brand-500/5">
                        Esplora tutte le gare <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </section>
    );
}