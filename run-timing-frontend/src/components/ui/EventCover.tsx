import { Image as ImageIcon } from 'lucide-react';

/** Copertina evento: rende l'immagine se presente, altrimenti un placeholder (mai src=""). */
export default function EventCover({
    src,
    alt,
    className = '',
}: {
    src?: string;
    alt: string;
    className?: string;
}) {
    if (src) {
        return <img src={src} alt={alt} className={className} />;
    }
    return (
        <div className={`${className} flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-50`}>
            <ImageIcon className="w-1/3 h-1/3 text-brand-300" />
        </div>
    );
}
