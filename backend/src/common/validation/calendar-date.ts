import { registerDecorator, type ValidationOptions } from 'class-validator';

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * YYYY-MM-DD that names a day which exists. The shape check alone lets
 * `2026-02-30` through, which PostgreSQL then rejects as a 500 — and string
 * comparisons against "today" happily treat it as in range first.
 */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_SHAPE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function IsCalendarDate(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCalendarDate',
      target: object.constructor,
      propertyName,
      ...(options !== undefined ? { options } : {}),
      validator: {
        validate: isCalendarDate,
        defaultMessage() {
          return '$property must be a real date in YYYY-MM-DD format';
        },
      },
    });
  };
}
