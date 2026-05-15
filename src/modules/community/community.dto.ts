import { set, z } from 'zod';
import { createZodDto } from "nestjs-zod"
import { CommunityHubPostType, CommunityHubStatus } from '@prisma/client';

export const PostCommunitySchema = z.object({
    title: z.string().min(1, 'Title is required'),
    content: z.string().min(1, 'Content is required'),
    imageUrl: z.string().optional(),
    visibility: z.record(z.string(), z.boolean()).optional().default({ showToStaff: true, showToOrgAdmin: true, showToAdmin: true }),
    isPrivate: z.boolean().optional().default(false),
    postType: z.enum(CommunityHubPostType).optional().default(CommunityHubPostType.GENERAL_DISCUSSION),
    status: z.enum(CommunityHubStatus).optional().default(CommunityHubStatus.DRAFT),
});

export class UpdatePostCommunityDto extends createZodDto(
  PostCommunitySchema.partial()
) {}
export class CreatePostCommunityDto extends createZodDto(PostCommunitySchema) { }