import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  timestamp: string;
  metadata?: { [key: string]: any };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class ResponseUtil {
  static success<T>(data: T, res?: Response, metadata: { [key: string]: any } = {}): ApiResponse<T> {
    const response = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      metadata,
    };

    if (res) {
      res.json(response);
    }

    return response;
  }

  static paginated<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    res?: Response,
    metadata: { [key: string]: any } = {},
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / limit);
    const response = {
      success: true,
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
      timestamp: new Date().toISOString(),
      metadata,
    };

    if (res) {
      res.json(response);
    }

    return response;
  }

  static error(message: string, statusCode: number = 500, res?: Response) {
    const response = {
      success: false,
      error: {
        code: 'Error',
        message,
      },
      timestamp: new Date().toISOString(),
    };

    if (res) {
      res.status(statusCode).json(response);
    }

    return response;
  }
}