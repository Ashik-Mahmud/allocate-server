import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationManager } from '../inbox/service/notification-manager.service';
import { CommunityPostFilterDto, CreatePostCommunityDto, UpdatePostCommunityDto } from './community.dto';
import { CurrentUserType } from 'src/shared/decorators/user.decorator';
import { CommunityHubPostType, CommunityHubStatus, NotificationType, Prisma, Role } from '@prisma/client';
import { SharedService } from 'src/shared/services/shared.service';
import { email } from 'zod';

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

            // Log the creation of the new community post
            this.sharedService.logActivity(tx, {
                action: 'CREATE_COMMUNITY_POST',
                details: `User ${user.name} created a new community post titled "${post.title}"`,
                userId: user.id,
                orgId: user.org_id,
                ipAddress: ip,
                userAgent: agent,
                metadata: {
                    postId: post.id,
                    postTitle: post.title,
                    authorName: user.name,
                    authorRole: user.role,
                    authorId: user.id,
                    orgId: user.org_id,
                    isPrivate: post.isPrivate,
                    postType: post.postType,
                    status: post.status,
                    entityType: 'COMMUNITY_HUB'
                }
            })

            return post;
        })



        // Send notification about the new community post
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
        return result;
    }

    // Service to update a community post
    async updatePostCommunity(postId: string, updatePostCommunityDto: UpdatePostCommunityDto, user: CurrentUserType, ip: string, agent: string) {
        // Implementation for updating a community post goes here
        const { title, content, imageUrl, visibility, isPrivate, postType, status, ...rest } = updatePostCommunityDto;
        const result = await this.prisma.$transaction(async (tx) => {

            const oldPost = await tx.communityHub.findUnique({ where: { id: postId } });

            if (!oldPost) {
                throw new Error('Post not found');
            }

            if (oldPost?.authorId !== user.id && user.role !== Role.ADMIN) {
                throw new ForbiddenException('You do not have permission to update this post');
            }


            const post = await tx.communityHub.update({
                where: { id: postId },
                data: {
                    title,
                    content,
                    imageUrl,
                    visibility,
                    isPrivate,
                    postType,
                    status,
                    updatedAt: new Date(),
                    ...rest
                }
            });
            // Log the update of the community post
            this.sharedService.logActivity(tx, {
                action: 'UPDATE_COMMUNITY_POST',
                details: `User ${user.name} updated a community post titled "${post.title}"`,
                userId: user.id,
                orgId: user.org_id,
                ipAddress: ip,
                userAgent: agent,
                metadata: {
                    postId: post.id,
                    postTitle: post.title,
                    authorName: user.name,
                    authorRole: user.role,
                    authorId: user.id,
                    orgId: user.org_id,
                    isPrivate: post.isPrivate,
                    postType: post.postType,
                    status: post.status,
                    entityType: 'COMMUNITY_HUB'
                }
            })

            if (oldPost?.status === CommunityHubStatus.DRAFT && post.status === CommunityHubStatus.PUBLISHED || status === CommunityHubStatus.PUBLISHED) {
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


        return result;
    }


    // Service to delete a community post
    async deletePostCommunity(postId: string, user: CurrentUserType, ip: string, agent: string) {
        // Implementation for deleting a community post goes here
        const result = await this.prisma.$transaction(async (tx) => {
            const post = await tx.communityHub.findUnique({ where: { id: postId } });
            if (!post) {
                throw new Error('Post not found');
            }

            if (post?.authorId !== user.id && user.role !== Role.ADMIN) {
                throw new ForbiddenException('You do not have permission to delete this post');
            }

            await tx.communityHub.update({ where: { id: postId }, data: { deletedAt: new Date(), status: CommunityHubStatus.ARCHIVED } });
            // Log the deletion of the community post
            this.sharedService.logActivity(tx, {
                action: 'DELETE_COMMUNITY_POST',
                details: `User ${user.name} deleted a community post titled "${post.title}"`,
                userId: user.id,
                orgId: user.org_id,
                ipAddress: ip,
                userAgent: agent,
                metadata: {
                    postId: post.id,
                    postTitle: post.title,
                    authorName: user.name,
                    authorRole: user.role,
                    authorId: user.id,
                    orgId: user.org_id,
                    isPrivate: post.isPrivate,
                    postType: post.postType,
                    status: post.status,
                    entityType: 'COMMUNITY_HUB'
                }
            })
            return { message: 'Post deleted successfully' };
        });
        return result;
    }


    // Service to restore a deleted community post (if needed in the future)
    async restorePostCommunity(postId: string, user: CurrentUserType, ip: string, agent: string) {
        // Implementation for restoring a deleted community post goes here
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


    // Service to get community posts with filters and pagination
    async getPostCommunity(filters: CommunityPostFilterDto, user: CurrentUserType) {
        // Implementation for getting community posts goes here
        const { postType, status, authorId, orgId, isPrivate, search, page = 1, limit = 10, visibility } = filters;
        const { showToStaff, showToOrgAdmin, showToAdmin } = visibility

        const where: Prisma.CommunityHubWhereInput = {
            deletedAt: null,
            org_id: user.org_id,
            ...(postType && { postType }),


            ...(authorId === user.id
                ? (status ? { status } : {})
                : { status: CommunityHubStatus.PUBLISHED, isPrivate: false }
            ),

            ...(authorId !== user.id && {
                AND: [
                    {
                        OR: [
                            ...(user.role === Role.STAFF ? [{ visibility: { path: ['showToStaff'], equals: true } }] : []),
                            ...(user.role === Role.ORG_ADMIN ? [{ visibility: { path: ['showToOrgAdmin'], equals: true } }] : []),
                            ...(user.role === Role.ADMIN ? [{ visibility: { path: ['showToAdmin'], equals: true } }] : []),
                        ]
                    }
                ]
            }),

            ...(authorId && { authorId }),
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
    async commentOnPostCommunity(postId: string, comment: string, user: CurrentUserType) {
        // Implementation for leaving a comment on a community post goes here
        const post = await this.prisma.communityHub.findUnique({ where: { id: postId } });
        if (!post) {
            throw new NotFoundException('Post not found');
        }
        const newCommentData = {
            id: crypto.randomUUID(), // Better than Date.now()
            content: comment,
            authorName: user.name,
            authorId: user.id,
            email: user.email,
            createdAt: new Date().toISOString()
        };
        const newComment = await this.prisma.communityHub.update({
            where: { id: postId },
            data: {
                comments: {
                    push: newCommentData
                }
            },
        });
        return newComment;
    }

    // Service to delete a comment on a community post
    async deleteComment(commentId: string, user: CurrentUserType) {

        const post = await this.prisma.communityHub.findFirst({
            where: {
                comments: {
                    path: [],
                    array_contains: [{ id: commentId }]
                }
            }
        });

        if (!post) {
            throw new NotFoundException('Comment not found');
        }


        const currentComments = (post.comments as any[]) || [];


        const commentToDelete = currentComments.find(c => c.id === commentId);
        if (!commentToDelete) throw new NotFoundException('Comment not found in list');

        if (commentToDelete.authorId !== user.id && user.role !== Role.ADMIN) {
            throw new ForbiddenException('You cannot delete this comment');
        }

        const updatedComments = currentComments.filter(c => c.id !== commentId);


        return await this.prisma.communityHub.update({
            where: { id: post.id },
            data: {
                comments: updatedComments
            }
        });
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
