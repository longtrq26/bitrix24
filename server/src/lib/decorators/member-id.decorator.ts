import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const MemberId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest();

    return request.memberId;
  },
);
