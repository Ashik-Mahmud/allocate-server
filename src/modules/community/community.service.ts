import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationManager } from '../inbox/service/notification-manager.service';
import { CreatePostCommunityDto, UpdatePostCommunityDto } from './community.dto';
import { CurrentUserType } from 'src/shared/decorators/user.decorator';
import { CommunityHubPostType, CommunityHubStatus, NotificationType, Role } from '@prisma/client';
import { SharedService } from 'src/shared/services/shared.service';

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


    
}
