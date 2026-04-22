import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';

@Injectable()
export class DashboardService {
    constructor() { }

    // Organization overview can include metrics relevant to the entire organization
    async getOrganizationOverview(user: User) {
        // Fetch and return organization-level metrics and insights
        return {
            totalBookings: 120,
            upcomingBookings: 15,
            staffCount: 10,
            resourceUtilization: '75%',
        };
    }
    // Staff overview can include metrics relevant to their bookings and activities
    async getStaffOverview(user: User) {
        // Fetch and return staff-level metrics and insights
        return {
            upcomingBookings: 5,
            recentActivity: [
                { type: 'Booking', description: 'Booked Resource A for 2 hours' },
                { type: 'Booking', description: 'Cancelled Booking for Resource B' },
            ],
        };
    }
    // Admin overview can include system-wide metrics and insights
    async getAdminOverview(user: User) {
        // Fetch and return admin-level metrics and insights
        return {
            totalOrganizations: 50,
            totalUsers: 500,
            systemHealth: 'Good',
        };
    }
}
