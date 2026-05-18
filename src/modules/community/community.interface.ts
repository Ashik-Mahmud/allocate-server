export interface TPostComment {
    id: string,
    content: string,
    authorId: string,
    authorName: string,
    email: string,
    createdAt: string,
    isDeleted?: boolean,
}