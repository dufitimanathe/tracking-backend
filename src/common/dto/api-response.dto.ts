import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorBody {
  @ApiProperty({ example: 'TRIP_INVALID_STATE' })
  code!: string;

  @ApiProperty({ example: 'Trip cannot be started from its current state.' })
  message!: string;

  @ApiPropertyOptional()
  details?: unknown;
}

export class ApiResponseDto<T = unknown> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiPropertyOptional()
  data?: T;

  @ApiPropertyOptional()
  meta?: Record<string, unknown>;

  @ApiPropertyOptional({ type: ApiErrorBody })
  error?: ApiErrorBody;
}

export class PaginationMeta {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
): ApiResponseDto<T> {
  return { success: true, data, meta };
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): ApiResponseDto<T[]> {
  return {
    success: true,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}
