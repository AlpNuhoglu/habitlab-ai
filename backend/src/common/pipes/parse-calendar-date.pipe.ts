import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

import { isCalendarDate } from '../validation/calendar-date';

@Injectable()
export class ParseCalendarDatePipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (!isCalendarDate(value)) {
      throw new BadRequestException('date must be a real date in YYYY-MM-DD format');
    }
    return value;
  }
}
