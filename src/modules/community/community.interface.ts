import { Role } from "@prisma/client";

export interface TPostComment {
    id: string,
    content: string,
    authorId: string,
    authorName: string,
    authorRole?: Role,
    postOwner?: string,
    email: string,
    createdAt: string,
    isDeleted?: boolean,
}