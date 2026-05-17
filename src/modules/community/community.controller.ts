import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommunityService } from './community.service';
import { ResponseUtil } from 'src/utils/responses';
import { Response } from 'express';
import { CommunityPostFilterDto, CreateCommunityPostCommentDto, CreatePostCommunityDto, UpdatePostCommunityDto } from './community.dto';
import { CurrentUser, CurrentUserType } from 'src/shared/decorators/user.decorator';
import { Agent } from 'src/shared/decorators/agent.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';


@ApiTags('Community Hub')
@ApiBearerAuth()
@UseGuards(AuthGuard) // Add appropriate guards for authentication and authorization
@Controller('community')
export class CommunityController {

    constructor(private readonly communityService: CommunityService) { }

    /**
     * Controller to create a new community hub
     * @param CreatePostCommunityDto - Data transfer object containing the details of the community hub to be created
     * @returns The created community hub
     */
    @Post('post')
    @ApiResponse({ status: 201, description: 'Community hub created successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiOperation({ summary: 'Post in the Community Hub', description: 'Create a new community hub.' })
    async createCommunity(
        @Res() res: Response,
        @Body() createPostCommunityDto: CreatePostCommunityDto,
        @CurrentUser() user: CurrentUserType,
        @Ip() ip: string,
        @Agent() agent: string
    ) {
        // Implementation for creating a new community hub goes here
        const result = await this.communityService.createPostCommunity(createPostCommunityDto, user, ip, agent);
        return ResponseUtil.success(result, res);
    }


    /**
     * Controller to update a community post
     * @param CreatePostCommunityDto - Data transfer object containing the details of the community post to be updated
     * @return The updated community post
     */
    @Patch('post/:postId')
    @ApiResponse({ status: 200, description: 'Community post updated successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiOperation({ summary: 'Update a Community Post', description: 'Update an existing community post.' })
    async updateCommunityPost(
        @Res() res: Response,
        @Body() updatePostCommunityDto: UpdatePostCommunityDto,
        @Param('postId') postId: string,
        @CurrentUser() user: CurrentUserType,
        @Ip() ip: string,
        @Agent() agent: string
    ) {
        // Implementation for updating a community post goes here
        const result = await this.communityService.updatePostCommunity(postId, updatePostCommunityDto, user, ip, agent);
        return ResponseUtil.success(result, res);
    }



    /**
     * Controller to delete a community post
     * @param postId - ID of the community post to be deleted
     * @return A success message indicating that the post has been deleted
     */
    @Delete('post/:postId/delete')
    @ApiResponse({ status: 200, description: 'Community post deleted successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiOperation({ summary: 'Delete a Community Post', description: 'Delete an existing community post.' })
    async deleteCommunityPost(
        @Res() res: Response,
        @Param('postId') postId: string,
        @Query() action: { isPermanent: boolean } = { isPermanent: false },
        @CurrentUser() user: CurrentUserType,
        @Ip() ip: string,
        @Agent() agent: string
    ) {
        // Implementation for deleting a community post goes here
        const result = await this.communityService.deletePostCommunity(postId, user, ip, agent, action);
        return ResponseUtil.success(result, res);
    }

    /**
     * Controller to restore a deleted community post
     * @param postId - ID of the community post to be restored
     * @return The restored community post
     * Note: This endpoint is optional and can be implemented if you want to allow restoring deleted posts. If not needed, it can be removed.
     */
    @Patch('post/:postId/restore')
    @ApiResponse({ status: 200, description: 'Community post restored successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiOperation({ summary: 'Restore a Community Post', description: 'Restore a previously deleted community post.' })
    async restoreCommunityPost(
        @Res() res: Response,
        @Param('postId') postId: string,
        @CurrentUser() user: CurrentUserType,
        @Ip() ip: string,
        @Agent() agent: string
    ) {
        // Implementation for restoring a deleted community post goes here
        const result = await this.communityService.restorePostCommunity(postId, user, ip, agent);
        return ResponseUtil.success(result, res);
    }


    /**
     * Controller to get all community posts (with optional filters for visibility, post type, etc.)
     * @return A list of community posts based on the applied filters
     * Note: This endpoint can be implemented to allow users to view community posts. It can include pagination and filtering options as needed.
     */
    @Get('posts')
    @ApiResponse({ status: 200, description: 'Community posts retrieved successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiOperation({ summary: 'Get Community Posts', description: 'Retrieve a list of community posts based on the applied filters.' })
    async getCommunityPosts(
        @Res() res: Response,
        @CurrentUser() user: CurrentUserType,
        @Query() filters: CommunityPostFilterDto
    ) {
        // Implementation for getting community posts goes here
        const result = await this.communityService.getPostCommunity(filters, user);
        return ResponseUtil.paginated(result.items, result.total, result.page, result.limit, res, result?.metadata);
    }

    /**
     * Controller to get a specific community post by ID
     * @param postId - ID of the community post to be retrieved
     * @return The requested community post
     */
    @Get('post/:postId')
    @ApiResponse({ status: 200, description: 'Community post retrieved successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiOperation({ summary: 'Get a Community Post', description: 'Retrieve a specific community post by ID.' })
    async getCommunityPostById(
        @Res() res: Response,
        @Param('postId') postId: string,
        @CurrentUser() user: CurrentUserType
    ) {
        // Implementation for getting a specific community post by ID goes here
        const result = await this.communityService.getPostCommunityById(postId, user);
        return ResponseUtil.success(result, res);
    }


    /**
     * Controller to get community posts created by the current user
     * @return A list of community posts created by the current user
     * Note: This endpoint can be implemented to allow users to view their own community posts. It can include pagination and filtering options as needed.
     */
    @Get('my-posts')
    @ApiResponse({ status: 200, description: 'Community posts retrieved successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiOperation({ summary: 'Get My Community Posts', description: 'Retrieve a list of community posts created by the current user.' })
    async getMyCommunityPosts(
        @Res() res: Response,
        @CurrentUser() user: CurrentUserType,
        @Query() filters: CommunityPostFilterDto
    ) {
        // Implementation for getting community posts created by the current user goes here
        const result = await this.communityService.getMyPostCommunity(filters, user);
        return ResponseUtil.paginated(result.items, result.total, result.page, result.limit, res,);
    }


    /**
     * Controller to leave a comment on a community post
     * @param postId - ID of the community post to comment on
     * @param comment - The comment text to be added to the post
     */
    @Post('post/:postId/comment')
    @ApiResponse({ status: 200, description: 'Comment added successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiOperation({ summary: 'Comment on a Community Post', description: 'Leave a comment on a specific community post.' })
    async commentOnCommunityPost(
        @Res() res: Response,
        @Param('postId') postId: string,
        @Body() comment: CreateCommunityPostCommentDto,
        @CurrentUser() user: CurrentUserType,
        @Ip() ip: string,
        @Agent() agent: string
    ) {
        // Implementation for leaving a comment on a community post goes here
        const result = await this.communityService.commentOnPostCommunity(postId, comment, user,);
        return ResponseUtil.success(result, res);
    }


    /**
     * Controller to delete a comment on a community post
     * @param commentId - ID of the comment to be deleted
     * @return The deleted comment
     */
    @Delete('comment/:commentId/delete')
    @ApiResponse({ status: 200, description: 'Comment deleted successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiOperation({ summary: 'Delete a Comment', description: 'Delete a specific comment from a community post.' })
    async deleteComment(
        @Res() res: Response,
        @Param('commentId') commentId: string,
        @CurrentUser() user: CurrentUserType,
        @Ip() ip: string,
        @Agent() agent: string
    ) {
        // Implementation for deleting a comment on a community post goes here
        const result = await this.communityService.deleteComment(commentId, user);
        return ResponseUtil.success(result, res);
    }


    /**
     * Controller to toggle acknowledgment of a community post (like/unlike)
     * @param postId - ID of the community post to be acknowledged or unacknowledged
     * @return The updated community post with the new acknowledgment status
     */
    @Post('post/:postId/acknowledge')
    @ApiResponse({ status: 200, description: 'Community post acknowledgment toggled successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiOperation({ summary: 'Toggle Acknowledgment of a Community Post', description: 'Acknowledge (like) or unacknowledge (unlike) a specific community post.' })
    async toggleAcknowledgeCommunityPost(
        @Res() res: Response,
        @Param('postId') postId: string,
        @CurrentUser() user: CurrentUserType,
        @Ip() ip: string,
        @Agent() agent: string
    ) {
        // Implementation for toggling acknowledgment of a community post goes here
        const result = await this.communityService.toggleAcknowledgePostCommunity(postId, user);
        return ResponseUtil.success(result, res);
    }

    /**
     * Controller to get the top authors in the community hub based on published post count
     * @return A list of top authors in the community hub based on published post count
     * Note: This endpoint can be implemented to allow users to see the most active contributors in the community hub.
     */
    @Get('community-activities')
    @ApiResponse({ status: 200, description: 'Top community authors retrieved successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiOperation({ summary: 'Get Top Community Authors', description: 'Retrieve a list of top authors in the community hub based on published post count.' })
    async getTopCommunityAuthors(
        @Res() res: Response,
        @CurrentUser() user: CurrentUserType,
    ) {
        // Implementation for getting top community authors goes here
        const result = await this.communityService.getTopCommunityAuthors(user);
        return ResponseUtil.success(result, res);
    }

}
