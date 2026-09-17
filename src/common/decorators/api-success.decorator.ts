import { applyDecorators, Type } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiResponseDto } from '../dto/api-response.dto';

export function ApiSuccessResponse<TModel extends Type<unknown>>(model: TModel, isArray = false) {
  return applyDecorators(
    ApiBearerAuth(),
    ApiExtraModels(ApiResponseDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            properties: {
              data: isArray
                ? { type: 'array', items: { $ref: getSchemaPath(model) } }
                : { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );
}
