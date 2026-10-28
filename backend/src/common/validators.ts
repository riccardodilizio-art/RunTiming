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
                    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return false;
                    const d = new Date(v.slice(0, 10) + 'T00:00:00Z');
                    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v.slice(0, 10)
                        && v.slice(0, 10) >= '1900-01-01' && d.getTime() <= Date.now();
                },
            },
        });
}
