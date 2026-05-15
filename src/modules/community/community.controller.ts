import { Body, Controller, Delete, Ip, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommunityService } from './community.service';
import { ResponseUtil } from 'src/utils/responses';
import { Response } from 'express';
import { CreatePostCommunityDto, UpdatePostCommunityDto } from './community.dto';
import { CurrentUser, CurrentUserType } from 'src/shared/decorators/user.decorator';
import { Agent } from 'src/shared/decorators/agent.decorator';


@ApiTags('Community Hub')
@ApiBearerAuth()
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
        @CurrentUser() user: CurrentUserType,
        @Ip() ip: string,
        @Agent() agent: string
    ) {
        // Implementation for deleting a community post goes here
        const result = await this.communityService.deletePostCommunity(postId, user, ip, agent);
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


    


}
