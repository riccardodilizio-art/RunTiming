// Riquadro anti-bot Turnstile (vedi lib/captcha.ts). Non mostra nulla se non configurato.
import { useEffect, useRef } from 'react';
import { CAPTCHA_ENABLED, SITE_KEY, captchaWidget, loadCaptchaScript, setCaptchaToken, setCaptchaWidget } from '../lib/captcha';

/** Riquadro "Verifica che sei una persona". Non mostra nulla se il captcha non è configurato. */
export function Captcha({ className = '' }: { className?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!CAPTCHA_ENABLED) return;
        let id: string | null = null;
        let cancelled = false;
        loadCaptchaScript().then(() => {
            if (cancelled || !ref.current || !window.turnstile) return;
            id = window.turnstile.render(ref.current, {
                sitekey: SITE_KEY,
                language: 'it',
                callback: (t: string) => setCaptchaToken(t),
                'expired-callback': () => setCaptchaToken(''),
                'error-callback': () => setCaptchaToken(''),
            });
            setCaptchaWidget(id);
        }).catch(() => undefined);
        return () => {
            cancelled = true;
            if (id) window.turnstile?.remove(id);
            if (captchaWidget() === id) setCaptchaWidget(null);
            setCaptchaToken('');
        };
    }, []);
    if (!CAPTCHA_ENABLED) return null;
    return <div ref={ref} className={className} />;
}
