import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationManager } from '../inbox/service/notification-manager.service';
import { CommunityPostFilterDto, CreateCommunityPostCommentDto, CreatePostCommunityDto, UpdatePostCommunityDto } from './community.dto';
import { CurrentUserType } from 'src/shared/decorators/user.decorator';
import { CommunityHubPostType, CommunityHubStatus, NotificationType, Prisma, Role } from '@prisma/client';
import { SharedService } from 'src/shared/services/shared.service';
import { email } from 'zod';
import { checkCommunityTrial } from './community.util';

@Injectable()
export class CommunityService {


    constructor(
        private prisma: PrismaService,
        private notificationManager: NotificationManager,
        private sharedService: SharedService,
    ) { }

    // Service to Post a in the Community Hub
    async createPostCommunity(createPostCommunityDto: CreatePostCommunityDto, user: CurrentUserType, ip: string, agent: string) {
        // Implementation for creating a new community hub goes here
        const { title, content, imageUrl, visibility, isPrivate, postType, status } = createPostCommunityDto;

        const { isExpired, isFree } = await checkCommunityTrial(this.prisma, user.org_id!)
        if (isFree && isExpired) {
            throw new ForbiddenException('Your free trial for the Community Hub has expired. Please upgrade your plan to continue creating posts.');
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const post = await tx.communityHub.create({
                data: {
                    title,
                    content,
                    imageUrl,
                    visibility,
                    isPrivate,
                    postType,
                    status,
                    authorId: user.id,
                    authorName: user.name,
                    authorRole: user.role as Role,
                    org_id: user.org_id,
                }
            });


            return post;
        })

        // Log the creation of the new community post
        this.sharedService.logActivity(this.prisma, {
            action: 'CREATE_COMMUNITY_POST',
            details: `User ${user.name} created a new community post titled "${result.title}"`,
            userId: user.id,
            orgId: user.org_id || null,
            ipAddress: ip,
            userAgent: agent,
            metadata: {
                postId: result.id,
                postTitle: result.title,
                authorName: user.name,
                authorRole: user.role,
                authorId: user.id,
                orgId: user.org_id,
                isPrivate: result.isPrivate,
                postType: result.postType,
                status: result.status,
                entityType: 'COMMUNITY_HUB'
            }
        })


        // Send notification about the new community post
        if (result.status === CommunityHubStatus.PUBLISHED) {
            this.notificationManager.createNotification({
                type: NotificationType.CREATE_COMMUNITY_POST,
                title: 'New Community Post Created',
                message: `A new post titled "${result?.title}" has been ${result?.isPrivate ? 'private' : 'public'} in the Community Hub. `,
                userId: user.id,
                orgId: user.org_id,
                metadata: {
                    postId: result?.id,
                    postTitle: result?.title,
                    authorName: user.name,
                    authorRole: user.role,
                    authorId: user.id,
                    orgId: user.org_id,
                    isPrivate: result?.isPrivate,
                    postType: result?.postType,
                    status: result?.status,
                    visibility: result?.visibility,
                }
            }).catch((error) => {
                console.error(`Failed to create notification for new community post "${result?.title}":`, error);
            });
        }
        return result;
    }

    // Service to update a community post
    async updatePostCommunity(postId: string, updatePostCommunityDto: UpdatePostCommunityDto, user: CurrentUserType, ip: string, agent: string) {
        // Implementation for updating a community post goes here
        const data = updatePostCommunityDto;

        const { isExpired, isFree } = await checkCommunityTrial(this.prisma, user.org_id!)
        if (isFree && isExpired) {
            throw new ForbiddenException('Your free trial for the Community Hub has expired. Please upgrade your plan to continue updating posts.');
        }

        const result = await this.prisma.$transaction(async (tx) => {

            const oldPost = await tx.communityHub?.findUnique({ where: { id: postId } });

            if (!oldPost) {
                throw new Error('Post not found');
            }

            if (oldPost?.authorId !== user.id && user.role !== Role.ADMIN) {
                throw new ForbiddenException('You do not have permission to update this post');
            }

            const post = await tx.communityHub.update({
                where: { id: postId },
                data: {
                    ...data,
                    updatedAt: new Date(),

                }
            });
            const isAdmin = user?.role === Role.ADMIN;
            const becamePublished = (oldPost?.status === CommunityHubStatus.DRAFT && post.status === CommunityHubStatus.PUBLISHED) ||
                (data?.status === CommunityHubStatus.PUBLISHED);

            if (!isAdmin && becamePublished) {
                this.notificationManager.createNotification({
                    type: NotificationType.PUBLISHED_COMMUNITY_POST,
                    title: 'Post Published!',
                    message: `The post titled "${post.title}" has been published in the Community Hub.`,
                    userId: user.id,
                    orgId: user.org_id,
                    metadata: { postId: post.id }
                });
            }

            return post;
        });
        // Log the update of the community post
        this.sharedService.logActivity(this.prisma, {
            action: 'UPDATE_COMMUNITY_POST',
            details: `User ${user.name} updated a community post titled "${result.title}"`,
            userId: user.id,
            orgId: user.org_id,
            ipAddress: ip,
            userAgent: agent,
            metadata: {
                postId: result.id,
                postTitle: result.title,
                authorName: user.name,
                authorRole: user.role,
                authorId: user.id,
                orgId: user.org_id,
                isPrivate: result.isPrivate,
                postType: result.postType,
                status: result.status,
                entityType: 'COMMUNITY_HUB'
            }
        })

        return result;
    }


    // Service to delete a community post
    async deletePostCommunity(postId: string, user: CurrentUserType, ip: string, agent: string, action: { isPermanent: boolean | string } = { isPermanent: false }) {


        // Implementation for deleting a community post goes here
        // Check if the user's trial has expired before allowing deletion
        const { isExpired, isFree } = await checkCommunityTrial(this.prisma, user.org_id!)
        if (isFree && isExpired) {
            throw new ForbiddenException('Your free trial for the Community Hub has expired. Please upgrade your plan to continue deleting posts.');
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const post = await tx.communityHub.findUnique({ where: { id: postId } });
            if (!post) {
                throw new Error('Post not found');
            }

            if (post?.authorId !== user.id && user.role !== Role.ADMIN) {
                throw new ForbiddenException('You do not have permission to delete this post');
            }

            if (action.isPermanent && action?.isPermanent === 'true') {
                await tx.communityHub.delete({ where: { id: postId } });
                return { message: 'Post deleted permanently' };
            } else {
                await tx.communityHub.update({ where: { id: postId }, data: { deletedAt: new Date(), status: CommunityHubStatus.ARCHIVED } });
            }



            // Log the deletion of the community post
            if (user?.role !== Role.ADMIN) {
                this.sharedService.logActivity(tx, {
                    action: 'DELETE_COMMUNITY_POST',
                    details: `User ${user.name} deleted a community post titled "${post.title}"`,
                    userId: user.id,
                    orgId: user.org_id || null,
                    ipAddress: ip,
                    userAgent: agent,
                    metadata: {
                        postId: post.id,
                        postTitle: post.title,
                        authorName: user.name,
                        authorRole: user.role,
                        authorId: user.id,
                        orgId: user.org_id || null,
                        isPrivate: post.isPrivate,
                        postType: post.postType,
                        status: post.status,
                        entityType: 'COMMUNITY_HUB'
                    }
                })
            }
            return { message: 'Post deleted successfully' };
        });
        return result;
    }


    // Service to restore a deleted community post (if needed in the future)
    async restorePostCommunity(postId: string, user: CurrentUserType, ip: string, agent: string) {
        // Implementation for restoring a deleted community post goes here
        const { isExpired, isFree } = await checkCommunityTrial(this.prisma, user.org_id!)
        if (isFree && isExpired) {
            throw new ForbiddenException('Your free trial for the Community Hub has expired. Please upgrade your plan to continue restoring posts.');
        }
        const result = await this.prisma.communityHub.update({ where: { id: postId }, data: { deletedAt: null, status: CommunityHubStatus.DRAFT } });
        // Log the restoration of the community post
        this.sharedService.logActivity(this.prisma, {
            action: 'RESTORE_COMMUNITY_POST',
            details: `User ${user.name} restored a community post titled "${result.title}"`,
            userId: user.id,
            orgId: user.org_id,
            ipAddress: ip,
            userAgent: agent,
            metadata: {
                postId: result.id,
                postTitle: result.title,
                authorName: user.name,
                authorRole: user.role,
                authorId: user.id,
                orgId: user.org_id,
                isPrivate: result.isPrivate,
                postType: result.postType,
                status: result.status,
                entityType: 'COMMUNITY_HUB'
            }
        });
        return result;
    }


    async getPostCommunity(filters: CommunityPostFilterDto, user: CurrentUserType) {
        const { postType, authorId, search, page = 1, limit = 10 } = filters;


        const baseConditions: Prisma.CommunityHubWhereInput[] = [
            { deletedAt: null },
            { status: CommunityHubStatus.PUBLISHED },
            { isPrivate: false },
        ];


        let roleVisibilityCondition: Prisma.CommunityHubWhereInput;

        if (user.role === Role.ADMIN) {
            // System Admin — no org_id, sees all posts flagged showToAdmin across all orgs
            roleVisibilityCondition = {
                visibility: {
                    path: ['showToAdmin'],
                    equals: true,
                },
            };
        } else if (user.role === Role.ORG_ADMIN) {
            roleVisibilityCondition = {
                AND: [

                    {
                        OR: [
                            { org_id: user.org_id },
                            { org_id: null },
                        ],
                    },
                    {
                        visibility: {
                            path: ['showToOrgAdmin'],
                            equals: true,
                        },
                    },
                ],
            };
        } else if (user.role === Role.STAFF) {
            roleVisibilityCondition = {
                AND: [
                    {
                        OR: [
                            { org_id: user.org_id },
                            { org_id: null },
                        ],
                    },
                    {
                        visibility: {
                            path: ['showToStaff'],
                            equals: true,
                        },
                    },
                ],
            };
        } else {
            // Unknown / unhandled role → return nothing
            roleVisibilityCondition = { id: { equals: '__no_match__' } };
        }


        const optionalConditions: Prisma.CommunityHubWhereInput[] = [];

        if (postType) {
            optionalConditions.push({ postType });
        }

        if (authorId) {
            optionalConditions.push({ authorId });
        }

        if (search) {
            optionalConditions.push({
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { content: { contains: search, mode: 'insensitive' } },
                ],
            });
        }


        // Check if the user's trial has expired before allowing deletion
        const { isExpired, isFree } = await checkCommunityTrial(this.prisma, user.org_id!)
        if (isFree && isExpired) {
            optionalConditions.push({ authorRole: Role.ADMIN })
        }

        const where: Prisma.CommunityHubWhereInput = {
            AND: [
                ...baseConditions,
                roleVisibilityCondition,
                ...optionalConditions,
            ],
        };

        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const [posts, total] = await this.prisma.$transaction([
            this.prisma.communityHub.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    author: { select: { id: true, name: true, photo: true } },
                },
            }),
            this.prisma.communityHub.count({ where }),
        ]);



        return {
            items: posts,
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit)),
            metadata: {}
        };
    }

    // Get top 3/4 authors based on published post count in the org, always including ORG_ADMIN
    async getTopCommunityAuthors(user: CurrentUserType) {
        const orgId = user.org_id;

        const { isExpired, isFree, trialEndDate } = await checkCommunityTrial(this.prisma, user.org_id!)
        if (isFree && isExpired) {
            return {
                authors: [],
                acknowledgedPosts: [],
                metadata: {},
                isFree,
                isExpired: true,
            }
        }

        // ── Step 1: Aggregate published post counts per author within the org ──
        const authorCounts = await this.prisma.communityHub.groupBy({
            by: ['authorId'],
            where: {
                org_id: orgId,
                deletedAt: null,
                status: CommunityHubStatus.PUBLISHED,
                isPrivate: false,
            },
            _count: {
                id: true,
            },
            orderBy: {
                _count: {
                    id: 'desc',
                },
            },
            take: 3,
        });

        // Collect the top 3 author IDs
        const topAuthorIds = authorCounts.map((a) => a.authorId);

        // ── Step 2: Always fetch the ORG_ADMIN of this org ──
        const orgAdmin = await this.prisma.user.findFirst({
            where: {
                org_id: orgId,
                role: Role.ORG_ADMIN,
            },
            select: {
                id: true,
                name: true,
                photo: true,
                role: true,
            },
        });

        // ── Step 3: Determine if ORG_ADMIN needs to be appended ──
        // If ORG_ADMIN is already in the top 3 we don't duplicate them
        const orgAdminAlreadyIncluded = orgAdmin
            ? topAuthorIds.includes(orgAdmin.id)
            : true;

        // IDs to fetch user details for (top 3 + org admin if not already included)
        const authorIdsToFetch = orgAdminAlreadyIncluded
            ? topAuthorIds
            : [...topAuthorIds, orgAdmin!.id];

        // ── Step 4: Fetch full user details for all resolved author IDs ──
        const cleanUserIds = authorIdsToFetch.filter(Boolean) as string[];
        const authors = await this.prisma.user.findMany({
            where: {
                id: { in: cleanUserIds },
            },
            select: {
                id: true,
                name: true,
                photo: true,
                role: true,
            },
        });

        // ── Step 5: Build a postCount lookup map from the aggregation ──
        const countMap = new Map<string, number>(
            (authorCounts as any)?.map((a) => [a.authorId, a._count.id])
        );

        // ── Step 6: Shape the response ──
        // Top 3 authors sorted by post count descending, then ORG_ADMIN appended last if not included
        const topAuthors = authors
            .filter((a) => topAuthorIds.includes(a.id))
            .sort((a, b) => (countMap.get(b.id) ?? 0) - (countMap.get(a.id) ?? 0))
            .map((a) => ({
                id: a.id,
                name: a.name,
                photo: a.photo,
                role: a.role,
                postCount: countMap.get(a.id) ?? 0,
            }));

        // Append ORG_ADMIN at the end if they weren't in the top 3
        if (!orgAdminAlreadyIncluded && orgAdmin) {
            topAuthors.push({
                id: orgAdmin.id,
                name: orgAdmin.name,
                photo: orgAdmin.photo,
                role: orgAdmin.role,
                postCount: countMap.get(orgAdmin.id) ?? 0,
            });
        }

        const allActivePosts = await this.prisma.communityHub.findMany({
            where: {
                org_id: orgId,
                deletedAt: null,
                status: CommunityHubStatus.PUBLISHED,
                isPrivate: false,
            },

            select: {
                id: true,
                title: true,
                postType: true,
                status: true,
                createdAt: true,
                acknowledgments: true,
                comments: true,
                authorName: true,
                authorRole: true,
            }
        });


        const acknowledgedPosts = allActivePosts
            .sort((a, b) => {
                const aCount = Array.isArray(a.acknowledgments) ? a.acknowledgments.length : 0;
                const bCount = Array.isArray(b.acknowledgments) ? b.acknowledgments.length : 0;

                return bCount - aCount;
            })
            .slice(0, 3);
        return {
            authors: topAuthors,
            acknowledgedPosts,
            trialEndDate: trialEndDate,
            meta: {
                total: topAuthors.length,         // 3 or 4
                orgId,
                note: !orgAdminAlreadyIncluded
                    ? 'ORG_ADMIN appended outside top 3'
                    : 'ORG_ADMIN included within top 3',
            },
        };
    }

    // Service to get a specific community post by ID

    async getPostCommunityById(postId: string, user: CurrentUserType) {
        // Implementation for getting a specific community post by ID goes here
        const post = await this.prisma.communityHub.findUnique({
            where: { id: postId },
            include: {
                author: { select: { id: true, name: true, photo: true } }
            }
        });
        if (!post || post.deletedAt) {
            throw new Error('Post not found');
        }
        if (post.isPrivate && user.role !== Role.ADMIN) {
            throw new ForbiddenException('You do not have permission to view this post');
        }

        // Apply visibility rules based on user role and post visibility settings
        const visibility = post.visibility as any;
        let canViewPost = false;

        if (user.role === Role.ADMIN) {
            // System Admin: Can view if showToAdmin is true
            canViewPost = user?.id === post.authorId ? true : visibility?.showToAdmin === true;
        } else if (user.role === Role.STAFF) {
            // Staff: Can view if showToStaff is true
            canViewPost = user?.id === post.authorId ? true : visibility?.showToStaff === true;
        } else if (user.role === Role.ORG_ADMIN) {
            // Organization Admin: Can view if showToOrgAdmin is true
            // BUT: Cannot view staff-level posts (where author is STAFF)
            canViewPost = user?.id === post.authorId ? true : visibility?.showToOrgAdmin === true;
        }

        if (!canViewPost) {
            throw new ForbiddenException('You do not have permission to view this post');
        }

        return post;
    }


    // Service to get community posts created by the current user with filters and pagination
    async getMyPostCommunity(filters: CommunityPostFilterDto, user: CurrentUserType) {
        // Implementation for getting community posts created by the current user goes here
        const { postType, status, isPrivate, search, page = 1, limit = 10 } = filters;
        const where: Prisma.CommunityHubWhereInput = {
            // deletedAt: null,
            org_id: user.org_id,
            authorId: user.id,
            ...(postType && { postType }),
            ...(status && { status }),
            ...(isPrivate !== undefined && { isPrivate }),
            ...(search && {
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { content: { contains: search, mode: 'insensitive' } },
                ]
            }),
        };
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const [posts, total] = await this.prisma.$transaction([
            this.prisma.communityHub.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    author: { select: { id: true, name: true, photo: true } }
                }
            }),
            this.prisma.communityHub.count({ where }),
        ]);
        return {
            items: posts,
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit)),
        };
    }


    // Service to leave a comment on a community post
    async commentOnPostCommunity(postId: string, comment: CreateCommunityPostCommentDto, user: CurrentUserType) {
        // Implementation for leaving a comment on a community post goes here

        const { isExpired, isFree } = await checkCommunityTrial(this.prisma, user.org_id!)
        if (isFree && isExpired) {
            throw new ForbiddenException('Your free trial for the Community Hub has expired. Please upgrade your plan to continue commenting on posts.');
        }
        const post = await this.prisma.communityHub.findUnique({ where: { id: postId } });
        if (!post) {
            throw new NotFoundException('Post not found');
        }
        const newCommentData = {
            id: crypto.randomUUID(), // Better than Date.now()
            content: comment.content,
            authorName: user.name,
            authorId: user.id,
            email: user.email,
            createdAt: new Date().toISOString()
        };
        const currentComments = Array.isArray(post.comments) ? post.comments : [];

        const updatedPost = await this.prisma.communityHub.update({
            where: { id: postId },
            data: {
                comments: [...currentComments, newCommentData]
            },
        });

        return newCommentData;
    }

    // Service to delete a comment on a community post
    async deleteComment(commentId: string, user: CurrentUserType) {


        const posts = await this.prisma.$queryRaw<any[]>`
    SELECT * FROM "community_hub" 
    WHERE "comments" @> ${JSON.stringify([{ id: commentId }])}::jsonb
    LIMIT 1;
`;
        const post = posts[0];

        if (!post) {
            throw new NotFoundException('Comment not found');
        }


        const currentComments = (post.comments as any[]) || [];


        const commentToDelete = currentComments.find(c => c.id === commentId);
        if (!commentToDelete) {
            throw new NotFoundException('Comment not found in list');
        }

        if (commentToDelete.authorId !== user.id && user.role !== Role.ADMIN) {
            throw new ForbiddenException('You do not have permission to delete this comment');
        }


        const updatedComments = currentComments.filter(c => c.id !== commentId);


        await this.prisma.communityHub.update({
            where: { id: post.id },
            data: {
                comments: updatedComments
            }
        });

        return {
            success: true,
            message: 'Comment deleted successfully'
        };
    }

    // Service to toggleAcknowledgePostCommunity a community post (if needed in the future)
    async toggleAcknowledgePostCommunity(postId: string, user: CurrentUserType) {
        const post = await this.prisma.communityHub.findUnique({ where: { id: postId } });
        if (!post) throw new NotFoundException('Post not found');

        const acknowledgments = (post.acknowledgments as string[]) || [];


        const userIndex = acknowledgments.indexOf(user.id);
        let updatedAcknowledgments;

        if (userIndex > -1) {
            updatedAcknowledgments = acknowledgments.filter(id => id !== user.id);
        } else {
            updatedAcknowledgments = [...acknowledgments, user.id];
        }

        return await this.prisma.communityHub.update({
            where: { id: postId },
            data: {
                acknowledgments: updatedAcknowledgments
            }
        });
    }

}
