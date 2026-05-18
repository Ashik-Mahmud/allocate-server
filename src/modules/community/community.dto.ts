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
    allowComments: z.boolean().optional().default(true),
});

export const UpdatePostCommunitySchema = z.object({
    title: z.string().optional(),
    content: z.string().optional(),
    imageUrl: z.string().optional(),
    visibility: z.record(z.string(), z.boolean()).optional(),
    isPrivate: z.boolean().optional(),
    postType: z.nativeEnum(CommunityHubPostType).optional(),
    status: z.nativeEnum(CommunityHubStatus).optional(),
    allowComments: z.boolean().optional(),
});
export const CommunityPostFilterSchema = z.object({
    postType: z.enum(CommunityHubPostType).optional(),
    status: z.enum(CommunityHubStatus).optional(),
    authorId: z.string().optional(),
    orgId: z.string().optional(),
    isPrivate: z
        .preprocess((val) => String(val).toLowerCase(), // Force to lowercase string first
            z.enum(['true', 'false'])
        )
        .optional()
        .transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
    search: z.string().optional(),
    page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),

});

export const CreateCommunityPostCommentSchema = z.object({
    content: z.string().min(1, 'Comment content is required'),
});


export class UpdatePostCommunityDto extends createZodDto(
    UpdatePostCommunitySchema
) { }
export class CreatePostCommunityDto extends createZodDto(PostCommunitySchema) { }
export class CommunityPostFilterDto extends createZodDto(CommunityPostFilterSchema) { }
export class CreateCommunityPostCommentDto extends createZodDto(CreateCommunityPostCommentSchema) { }