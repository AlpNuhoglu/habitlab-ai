import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardController } from './dashboard.controller';
import { Habit } from './entities/habit.entity';
import { HabitLog } from './entities/habit-log.entity';
import { HabitsController } from './habits.controller';
import { HabitsService } from './habits.service';
import { HabitLogRepository } from './repositories/habit-log.repository';
import { HabitRepository } from './repositories/habit.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Habit, HabitLog])],
  controllers: [HabitsController, DashboardController],
  providers: [HabitsService, HabitRepository, HabitLogRepository],
  exports: [HabitsService],
})
export class HabitsModule {}
