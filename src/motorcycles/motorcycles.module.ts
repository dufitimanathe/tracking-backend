import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { Motorcycle } from './entities/motorcycle.entity';
import { MotorcyclesController } from './motorcycles.controller';
import { MotorcyclesService } from './motorcycles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Motorcycle]), AuthGuardsModule],
  controllers: [MotorcyclesController],
  providers: [MotorcyclesService],
  exports: [MotorcyclesService],
})
export class MotorcyclesModule {}
