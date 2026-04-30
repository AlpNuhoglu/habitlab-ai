import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssignmentService } from './assignment.service';
import { ExperimentAssignment } from './entities/experiment-assignment.entity';
import { Experiment } from './entities/experiment.entity';
import { ExperimentRepository } from './experiment.repository';
import { ExperimentsController } from './experiments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Experiment, ExperimentAssignment])],
  controllers: [ExperimentsController],
  providers: [ExperimentRepository, AssignmentService],
  exports: [AssignmentService, ExperimentRepository],
})
export class ExperimentsModule {}
