import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { User } from '@prisma/client'

export type CurrentUserType = {
    id: string;
    email: string;
    role: string;
    org_id: string;
    plan_type?: string;
}

export const CurrentUser = createParamDecorator(
    (_: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest()
        return request.user as CurrentUserType 
    },
)