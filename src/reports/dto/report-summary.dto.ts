import { ApiProperty } from '@nestjs/swagger';

export class ReportSummaryDto {
  @ApiProperty()
  totalTrips!: number;

  @ApiProperty()
  completedTrips!: number;

  @ApiProperty()
  cancelledTrips!: number;

  @ApiProperty()
  totalRevenue!: string;

  @ApiProperty()
  totalDistanceKm!: string;

  @ApiProperty()
  openIncidents!: number;

  @ApiProperty()
  averageTripDistanceKm!: string;
}
