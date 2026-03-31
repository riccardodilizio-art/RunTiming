import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import type { Event } from '../../types';
import { categoryLabels } from '../../data/mockEvents';

// ─── Category colors ─────────────────────────────────────────────────────────

const markerHex: Record<string, string> = {
    running:   '#0ea5e9',
    cycling:   '#6366f1',
    triathlon: '#8b5cf6',
    swimming:  '#06b6d4',
    trail:     '#14b8a6',
    other:     '#64748b',
};

// ─── Custom div icon ─────────────────────────────────────────────────────────

function makeIcon(category: string) {
    const color = markerHex[category] ?? '#64748b';
    return L.divIcon({
        html: `<div style="
            width:36px;height:36px;
            background:${color};
            border:3px solid white;
            border-radius:50%;
            box-shadow:0 2px 10px rgba(0,0,0,0.25);
            display:flex;align-items:center;justify-content:center;
        "><div style="width:9px;height:9px;background:white;border-radius:50%;"></div></div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -22],
    });
}

// ─── Auto-fit bounds ─────────────────────────────────────────────────────────

function FitBounds({ events }: { events: Event[] }) {
    const map = useMap();
    useEffect(() => {
        if (!events.length) return;
        if (events.length === 1) {
            map.setView([events[0].lat, events[0].lng], 12);
            return;
        }
        const bounds = L.latLngBounds(events.map(e => [e.lat, e.lng]));
        map.fitBounds(bounds, { padding: [56, 56], maxZoom: 11 });
    }, [events, map]);
    return null;
}

// ─── Empty state overlay ─────────────────────────────────────────────────────

function EmptyOverlay() {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-[1000] pointer-events-none">
            <p className="text-slate-500 text-sm font-medium">Nessun evento corrisponde ai filtri selezionati.</p>
        </div>
    );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
    events: Event[];
}

export default function EventsMap({ events }: Props) {
    return (
        <div className="relative bg-white border border-slate-200 rounded-xl overflow-hidden"
             style={{ boxShadow: '2px 4px 6px 0 #eeeeee' }}>

            {events.length === 0 && <EmptyOverlay />}

            <MapContainer
                center={[42.5, 12.5]}
                zoom={6}
                style={{ height: '540px' }}
                scrollWheelZoom
                className="z-0"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds events={events} />

                {events.map(event => (
                    <Marker
                        key={event.id}
                        position={[event.lat, event.lng]}
                        icon={makeIcon(event.category)}
                    >
                        <Popup minWidth={220} maxWidth={260}>
                            <div style={{ fontFamily: 'DM Sans, sans-serif', padding: '2px' }}>
                                <img
                                    src={event.coverImage}
                                    alt={event.title}
                                    style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }}
                                />
                                <p style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b', marginBottom: '2px', lineHeight: 1.3 }}>
                                    {event.title}
                                </p>
                                <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                                    {new Date(event.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    {' · '}{event.city} ({event.province})
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '4px' }}>
                                        {categoryLabels[event.category]}
                                    </span>
                                    <Link
                                        to={`/events/${event.slug}`}
                                        style={{ fontSize: '12px', color: '#0168c8', fontWeight: 600, textDecoration: 'none' }}
                                    >
                                        Dettaglio →
                                    </Link>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* Legend */}
            <div className="absolute bottom-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-2 shadow-md">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Categorie</p>
                <div className="space-y-1">
                    {Object.entries(markerHex).map(([cat, color]) => (
                        <div key={cat} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-white"
                                 style={{ backgroundColor: color, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                            <span className="text-[10px] text-slate-600 capitalize">{categoryLabels[cat]}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Events count badge */}
            <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-1.5 shadow-md">
                <p className="text-xs text-slate-600 font-medium">
                    <span className="font-bold text-ocean-700">{events.length}</span>{' '}
                    {events.length === 1 ? 'evento' : 'eventi'}
                </p>
            </div>
        </div>
    );
}
