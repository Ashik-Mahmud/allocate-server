import { z } from "zod";
import { createZodDto } from "nestjs-zod"
import { SaleInquiryStatus } from "@prisma/client";

// Create Sales Inquiry DTO
export const CreateSalesInquirySchema = z.object({
    name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name is too long"),

    business_email: z
        .string()
        .email("Invalid email address")
        .refine((email) => {
            const blockedDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];
            const domain = email.split("@")[1];
            return !blockedDomains.includes(domain);
        }, "Please use your corporate email address"),

    message: z
        .string()
        .min(10, "Message must be at least 10 characters")
        .max(2000, "Message limit exceeded"),

    team_size: z
        .string()
        .refine((size) => {
            const validSizes = ["1-10", "11-50", "51-100", "100+"];
            return validSizes.includes(size);
        }, "Invalid team size. Valid options are: 1-10, 11-50, 51-100, 100+")
        .optional()
        .nullable(),

    country: z
        .string()
        .min(2, "Invalid country name")
        .optional()
        .nullable(),

    phone: z
        .string()
        .optional()
        .nullable(),

    org_id: z
        .string()
        .cuid("Invalid organization ID")
        .optional()
        .nullable(),
});

export class CreateSalesInquiryDto extends createZodDto(CreateSalesInquirySchema) { };

// Update Sales Inquiry DTO (for status and other updates)
export const UpdateSalesInquirySchema = z.object({
    name: z.string().min(2).max(100).optional(),
    message: z.string().min(10).max(2000).optional(),
    phone: z.string().optional().nullable(),
    team_size: z.string().refine((size) => {
        const validSizes = ["1-10", "11-50", "51-100", "100+"];
        return validSizes.includes(size);
    }, "Invalid team size. Valid options are: 1-10, 11-50, 51-100, 100+").optional().nullable(),
    country: z.string().min(2).optional().nullable(),
    status: z.enum([SaleInquiryStatus.PENDING, SaleInquiryStatus.CONTACTED, SaleInquiryStatus.CLOSED, SaleInquiryStatus.CONVERTED]).optional(),
});

export class UpdateSalesInquiryDto extends createZodDto(UpdateSalesInquirySchema) { };

// Query filters DTO
export const SalesInquiryFiltersSchema = z.object({
    status: z.enum([SaleInquiryStatus.PENDING, SaleInquiryStatus.CONTACTED, SaleInquiryStatus.CLOSED, SaleInquiryStatus.CONVERTED]).optional(),
    org_id: z.string().cuid().optional(),
    country: z.string().optional(),
    search: z.string().optional(),
    sortBy: z.enum(["createdAt", "name", "status"]).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().positive().max(100).optional().default(10),
});

export class SalesInquiryFiltersDto extends createZodDto(SalesInquiryFiltersSchema) { };

// Stats filter for grouping
export const SalesInquiryStatsFiltersSchema = z.object({
    org_id: z.string().cuid().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
});

export class SalesInquiryStatsFiltersDto extends createZodDto(SalesInquiryStatsFiltersSchema) { };

// Original SalesInquirySchema for backward compatibility
export const SalesInquirySchema = CreateSalesInquirySchema;

export class SalesInquiryDto extends createZodDto(SalesInquirySchema) { }