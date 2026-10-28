import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { siteName } from '../common/brand';

// Client minimale per PayPal Orders v2 (pagamenti con conto PayPal e con
// carta: le carte le gestisce PayPal, i loro dati non passano mai dal sito).
// Credenziali SOLO da variabili d'ambiente: PAYPAL_CLIENT_ID,
// PAYPAL_CLIENT_SECRET, PAYPAL_ENV=sandbox|live (default sandbox).

export interface PaypalOrderInput {
    registrationId: string;
    paymentRef: string;
    description: string;
    amount: number;
}

export interface PaypalCapture {
    status: string;
    customId?: string;
    amount?: number;
    currency?: string;
    captureId?: string;
}

@Injectable()
export class PaypalClient {
    private readonly log = new Logger(PaypalClient.name);
    private token?: { value: string; expires: number };

    get configured(): boolean {
        return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
    }

    private get base(): string {
        return process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    }

    private async accessToken(): Promise<string> {
        if (!this.configured) throw new ServiceUnavailableException('Pagamenti PayPal non configurati');
        if (this.token && this.token.expires > Date.now() + 60_000) return this.token.value;
        const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
        const res = await fetch(`${this.base}/v1/oauth2/token`, {
            method: 'POST',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'grant_type=client_credentials',
        });
        if (!res.ok) {
            this.log.error(`PayPal token ${res.status}: ${await res.text()}`);
            throw new ServiceUnavailableException('PayPal non raggiungibile, riprova tra poco');
        }
        const j = (await res.json()) as { access_token: string; expires_in: number };
        this.token = { value: j.access_token, expires: Date.now() + j.expires_in * 1000 };
        return j.access_token;
    }

    private async call<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
        const res = await fetch(`${this.base}${path}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${await this.accessToken()}`,
                'Content-Type': 'application/json',
                ...(idempotencyKey ? { 'PayPal-Request-Id': idempotencyKey } : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        if (!res.ok) {
            this.log.error(`PayPal ${path} ${res.status}: ${text}`);
            throw new ServiceUnavailableException('Pagamento non riuscito con PayPal');
        }
        return (text ? JSON.parse(text) : {}) as T;
    }

    /** Crea l'ordine: importo deciso dal server, non dal browser. */
    async createOrder(o: PaypalOrderInput): Promise<string> {
        const r = await this.call<{ id: string }>('/v2/checkout/orders', {
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: o.registrationId,
                custom_id: o.registrationId,
                invoice_id: o.paymentRef,
                description: o.description.slice(0, 127),
                amount: { currency_code: 'EUR', value: o.amount.toFixed(2) },
            }],
            application_context: { brand_name: siteName().slice(0, 127), shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' },
        }, `create-${o.paymentRef}-${o.amount.toFixed(2)}`);
        return r.id;
    }

    /** Incassa l'ordine approvato dall'atleta e restituisce cosa è stato davvero pagato. */
    async capture(orderId: string): Promise<PaypalCapture> {
        type R = {
            status: string;
            purchase_units?: { payments?: { captures?: { id: string; status: string; custom_id?: string; amount: { value: string; currency_code: string } }[] } }[];
        };
        const r = await this.call<R>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, undefined, `capture-${orderId}`);
        const c = r.purchase_units?.[0]?.payments?.captures?.[0];
        return {
            status: c?.status ?? r.status,
            customId: c?.custom_id,
            amount: c ? Number(c.amount.value) : undefined,
            currency: c?.amount.currency_code,
            captureId: c?.id,
        };
    }
}
