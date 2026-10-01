import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

export interface BoundedIntOptions {
  min: number;
  max: number;
  default: number;
}

/**
 * Optional integer query parameter. Anything that is not a plain base-10
 * integer ≥ min is a 400 rather than a NaN or negative reaching SQL. Values
 * above max are clamped, not rejected — that is the long-standing contract of
 * the pagination params this guards.
 */
@Injectable()
export class ParseBoundedIntPipe implements PipeTransform<unknown, number> {
  constructor(private readonly options: BoundedIntOptions) {}

  transform(value: unknown): number {
    if (value === undefined || value === '') return this.options.default;

    if (typeof value !== 'string' || !/^-?\d+$/.test(value)) {
      throw new BadRequestException('Expected an integer');
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < this.options.min) {
      throw new BadRequestException(`Expected an integer ≥ ${this.options.min}`);
    }

    return Math.min(parsed, this.options.max);
  }
}
