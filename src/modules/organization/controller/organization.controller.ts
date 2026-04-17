import { Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrganizationService } from '../services/organization.service';


@ApiTags('Organization')
@Controller('organization')
export class OrganizationController {

    constructor(private service: OrganizationService) {}

    /**
     * This controller will handle all organization related endpoints such as creating an organization, updating organization details, fetching organization information, etc.
     * @param organizationService - The service that will handle the business logic for organization related operations.
     * @param createOrganizationDto - The DTO that will be used to validate the data for creating an organization.
     * @return - A success response containing the organization information if the operation is successful.
     */

    @Post('create')
    async createOrganization() {
        // Logic to create an organization will go here
    }




}
