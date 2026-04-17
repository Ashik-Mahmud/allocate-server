import { SetMetadata } from '@nestjs/common';
import { User } from '@prisma/client';

export const Roles = (...requiredRoles: User['role'][]) => SetMetadata('roles', requiredRoles);