import { ValidationOptions, registerDecorator } from 'class-validator';

/** Data di nascita plausibile: formato YYYY-MM-DD, dal 1900 a oggi. */
export function IsBirthDate(options?: ValidationOptions) {
    return (object: object, propertyName: string) =>
        registerDecorator({
            name: 'isBirthDate',
            target: object.constructor,
            propertyName,
            options: { message: 'Data di nascita non valida', ...options },
            validator: {
                validate(v: unknown) {
                    // Solo la data, senza ora né fuso: "2009-01-01T00:00+14:00" sposterebbe età e categoria
                    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
                    const d = dateOnly(v);
                    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
                        && v >= '1900-01-01' && d.getTime() <= Date.now();
                },
            },
        });
}

/** "AAAA-MM-GG" → mezzanotte UTC di quel giorno (sempre lo stesso giorno, ovunque). */
export function dateOnly(v: string): Date {
    return new Date(`${v.slice(0, 10)}T00:00:00Z`);
}
