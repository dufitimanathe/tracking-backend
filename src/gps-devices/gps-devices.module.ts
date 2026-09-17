import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { GpsDevice } from './entities/gps-device.entity';
import { GpsDevicesController } from './gps-devices.controller';
import { GpsDevicesService } from './gps-devices.service';

@Module({
  imports: [TypeOrmModule.forFeature([GpsDevice, Motorcycle]), AuthGuardsModule],
  controllers: [GpsDevicesController],
  providers: [GpsDevicesService],
  exports: [GpsDevicesService],
})
export class GpsDevicesModule {}
