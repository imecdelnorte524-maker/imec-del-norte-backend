// src/common/guards/query-limit.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { memoryConfig } from '../../config/memory.config';

@Injectable()
export class QueryLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const limit = parseInt(request.query.limit);

    if (limit && limit > memoryConfig.limits.maxQueryLimit) {
      throw new BadRequestException(
        `Limit excede el máximo permitido (${memoryConfig.limits.maxQueryLimit})`,
      );
    }

    return true;
  }
}
