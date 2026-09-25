import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Client HTTP verso il gestionale WISE di FIDAL Servizi (ASP.NET Core).
//
// WISE non espone un'API pubblica: le pagine chiamano endpoint AJAX
// autenticati dal cookie di sessione ASP.NET Core Identity. Qui replichiamo
// quel flusso lato server: login con credenziali, cookie jar in memoria, e
// ri-login automatico quando la sessione scade.
//
// ATTENZIONE:
//  - WISE è servito in HTTP (non cifrato): credenziali e cookie viaggiano in
//    chiaro. Da confinare a rete interna / uso consapevole.
//  - L'automazione di un portale autenticato va concordata con FIDAL Servizi
//    (Termini di Servizio). Questo client è pensato per un accesso autorizzato.

interface WiseConfig {
    baseUrl: string;
    username?: string;
    password?: string;
    loginPath: string;
    userField: string;
    passField: string;
    staticCookie?: string;
}

/** Estrae il valore di getSetCookie() senza dipendere dai tipi DOM. */
function readSetCookies(res: Response): string[] {
    const h = res.headers as unknown as { getSetCookie?: () => string[] };
    return h.getSetCookie?.() ?? [];
}

@Injectable()
export class WiseClient {
    private readonly logger = new Logger(WiseClient.name);
    private readonly cfg: WiseConfig;
    private cookies = new Map<string, string>();
    private loggedIn = false;
    private loginInFlight: Promise<void> | null = null;

    constructor(config: ConfigService) {
        this.cfg = {
            baseUrl: (config.get<string>('WISE_BASE_URL') ?? '').replace(/\/$/, ''),
            username: config.get<string>('WISE_USERNAME'),
            password: config.get<string>('WISE_PASSWORD'),
            loginPath: config.get<string>('WISE_LOGIN_PATH') ?? '/Admin/Account/LogIn',
            userField: config.get<string>('WISE_USER_FIELD') ?? 'UserName',
            passField: config.get<string>('WISE_PASS_FIELD') ?? 'Password',
            staticCookie: config.get<string>('WISE_COOKIE') || undefined,
        };
    }

    /** True se abbiamo abbastanza config per contattare WISE. */
    get configured(): boolean {
        if (!this.cfg.baseUrl) return false;
        return !!this.cfg.staticCookie || (!!this.cfg.username && !!this.cfg.password);
    }

    private cookieHeader(): string {
        if (this.cookies.size === 0 && this.cfg.staticCookie) return this.cfg.staticCookie;
        return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }

    private storeSetCookies(res: Response) {
        for (const sc of readSetCookies(res)) {
            const pair = sc.split(';', 1)[0];
            const eq = pair.indexOf('=');
            if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
        }
    }

    private extractAntiforgeryToken(html: string): string | null {
        // L'input nascosto può avere gli attributi in ordine diverso.
        const after = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/i);
        if (after) return after[1];
        const before = html.match(/value="([^"]+)"[^>]*name="__RequestVerificationToken"/i);
        return before ? before[1] : null;
    }

    /** Esegue il login su WISE (form ASP.NET Core Identity con anti-forgery). */
    private async doLogin(): Promise<void> {
        if (!this.cfg.username || !this.cfg.password) {
            throw new ServiceUnavailableException('WISE: credenziali non configurate');
        }
        const loginUrl = this.cfg.baseUrl + this.cfg.loginPath;

        // 1) GET pagina login → cookie anti-forgery + token nascosto
        const getRes = await fetch(loginUrl, {
            headers: { Cookie: this.cookieHeader() },
            redirect: 'manual',
        });
        this.storeSetCookies(getRes);
        const token = this.extractAntiforgeryToken(await getRes.text());

        // 2) POST credenziali
        const body = new URLSearchParams();
        body.set(this.cfg.userField, this.cfg.username);
        body.set(this.cfg.passField, this.cfg.password);
        body.set('RememberMe', 'false');
        if (token) body.set('__RequestVerificationToken', token);

        const postRes = await fetch(loginUrl, {
            method: 'POST',
            headers: {
                Cookie: this.cookieHeader(),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
            redirect: 'manual',
        });
        this.storeSetCookies(postRes);

        // Successo: Identity imposta il cookie di autenticazione (spesso con 302).
        const authOk =
            this.cookies.has('.AspNetCore.Identity.Application') ||
            (postRes.status >= 300 && postRes.status < 400);
        if (!authOk) {
            throw new ServiceUnavailableException('WISE: login fallito (credenziali o form non validi)');
        }
        this.loggedIn = true;
        this.logger.log('WISE: login effettuato');
    }

    /** Login con de-duplica delle chiamate concorrenti. */
    private async ensureLogin(): Promise<void> {
        if (this.loggedIn) return;
        if (this.cfg.staticCookie && !this.cfg.username) return; // uso il cookie statico
        if (!this.loginInFlight) {
            this.loginInFlight = this.doLogin().finally(() => { this.loginInFlight = null; });
        }
        await this.loginInFlight;
    }

    /**
     * GET JSON da un endpoint WISE. Fa login se serve e riprova una volta
     * ri-autenticandosi se la sessione è scaduta (redirect al login / 401).
     */
    async getJson<T>(path: string, params: Record<string, string | number>): Promise<T> {
        if (!this.cfg.baseUrl) throw new ServiceUnavailableException('WISE non configurato (WISE_BASE_URL)');

        const call = async (): Promise<Response> => {
            const url = new URL(this.cfg.baseUrl + path);
            for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
            return fetch(url, {
                headers: {
                    Cookie: this.cookieHeader(),
                    Accept: 'application/json, text/javascript, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                redirect: 'manual',
            });
        };

        await this.ensureLogin();
        let res = await call();

        // Sessione scaduta: ASP.NET reindirizza al login (302) o risponde 401.
        if ((res.status === 302 || res.status === 401) && this.cfg.username) {
            this.loggedIn = false;
            await this.ensureLogin();
            res = await call();
        }

        this.storeSetCookies(res);
        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            throw new ServiceUnavailableException(`WISE ${path} → ${res.status}: ${text.slice(0, 200)}`);
        }
        return (await res.json()) as T;
    }
}
