# Resources API - Complete Guide (Paginated & Searchable)

## Overview
The Resources API now provides a complete paginated, searchable, and filterable system for managing organization resources. All queries are validated using Zod schemas and follow RESTful conventions.

---

## API Endpoints

### 1. **List Resources (Paginated & Searchable)**
**Endpoint:** `GET /resources/list`  
**Auth:** Required (ClientGuard)  
**Description:** Fetch resources with pagination, search, and multiple filter options

#### Query Parameters:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (min: 1) |
| `limit` | number | 10 | Items per page (min: 1, max: 100) |
| `search` | string | - | Search by resource name or type (case-insensitive) |
| `type` | string | - | Filter by resource type (case-insensitive) |
| `is_available` | 'true'\|'false' | - | Filter by availability status |
| `is_active` | 'true'\|'false' | - | Filter by active status |
| `is_maintenance` | 'true'\|'false' | - | Filter by maintenance status |
| `sortBy` | 'name'\|'hourly_rate'\|'createdAt' | 'createdAt' | Field to sort by |
| `sortOrder` | 'asc'\|'desc' | 'desc' | Sort direction |

#### Request Examples:

**Basic pagination:**
```bash
curl -X GET "http://localhost:3000/resources/list?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Search by name:**
```bash
curl -X GET "http://localhost:3000/resources/list?search=conference%20room" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Filter by type:**
```bash
curl -X GET "http://localhost:3000/resources/list?type=meeting-room&is_available=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Complex filtering:**
```bash
curl -X GET "http://localhost:3000/resources/list?search=room&is_active=true&is_maintenance=false&sortBy=hourly_rate&sortOrder=asc" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Response Format:
```json
{
  "success": true,
  "data": [
    {
      "id": "resource-001",
      "org_id": "org-123",
      "name": "Conference Room A",
      "type": "meeting-room",
      "hourly_rate": 50,
      "is_available": true,
      "is_active": true,
      "is_maintenance": false,
      "metadata": {},
      "createdAt": "2026-04-20T10:00:00Z",
      "updatedAt": "2026-04-20T15:30:00Z",
      "_count": {
        "bookings": 3
      }
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  },
  "timestamp": "2026-04-20T16:45:22.123Z"
}
```

---

### 2. **Get All Resources (No Pagination)**
**Endpoint:** `GET /resources/all`  
**Auth:** Required (ClientGuard)  
**Description:** Fetch all active resources for the organization (without pagination)

#### Response Format:
```json
{
  "success": true,
  "data": [
    {
      "id": "resource-001",
      "org_id": "org-123",
      "name": "Conference Room A",
      "type": "meeting-room",
      "hourly_rate": 50,
      "is_available": true,
      "is_active": true,
      "is_maintenance": false,
      "metadata": {},
      "createdAt": "2026-04-20T10:00:00Z",
      "updatedAt": "2026-04-20T15:30:00Z",
      "_count": {
        "bookings": 3
      }
    }
  ],
  "timestamp": "2026-04-20T16:45:22.123Z"
}
```

---

### 3. **Get Resource by ID**
**Endpoint:** `GET /resources/:id`  
**Auth:** Required (ClientGuard)  
**Description:** Fetch a single resource by its ID

#### Response Format:
```json
{
  "success": true,
  "data": {
    "id": "resource-001",
    "org_id": "org-123",
    "name": "Conference Room A",
    "type": "meeting-room",
    "hourly_rate": 50,
    "is_available": true,
    "is_active": true,
    "is_maintenance": false,
    "metadata": {},
    "createdAt": "2026-04-20T10:00:00Z",
    "updatedAt": "2026-04-20T15:30:00Z",
    "organization": {
      "id": "org-123",
      "name": "My Organization"
    },
    "_count": {
      "bookings": 3
    }
  },
  "timestamp": "2026-04-20T16:45:22.123Z"
}
```

---

### 4. **Create Resource**
**Endpoint:** `POST /resources/create`  
**Auth:** Required (ClientGuard + SubscriptionGuard)  
**Subscription Plans:** FREE, PRO, ENTERPRISE  
**Description:** Create a new resource (subject to subscription limits)

#### Request Body:
```json
{
  "name": "Conference Room A",
  "type": "meeting-room",
  "hourly_rate": 50,
  "is_available": true,
  "is_active": true,
  "is_maintenance": false,
  "metadata": {
    "capacity": 10,
    "floor": 3
  }
}
```

#### Response:
```json
{
  "success": true,
  "data": {
    "id": "resource-001",
    "org_id": "org-123",
    "name": "Conference Room A",
    "type": "meeting-room",
    "hourly_rate": 50,
    "is_available": true,
    "is_active": true,
    "is_maintenance": false,
    "metadata": {
      "capacity": 10,
      "floor": 3
    },
    "createdAt": "2026-04-20T16:45:22.123Z",
    "updatedAt": "2026-04-20T16:45:22.123Z"
  },
  "timestamp": "2026-04-20T16:45:22.123Z"
}
```

---

### 5. **Update Resource**
**Endpoint:** `PATCH /resources/update/:id`  
**Auth:** Required (ClientGuard + SubscriptionGuard)  
**Description:** Update an existing resource

#### Request Body (all optional):
```json
{
  "name": "Conference Room A Updated",
  "type": "meeting-room",
  "hourly_rate": 60,
  "is_available": false,
  "is_active": true,
  "is_maintenance": false,
  "metadata": {
    "capacity": 12
  }
}
```

---

### 6. **Delete Resource**
**Endpoint:** `PATCH /resources/delete/:id`  
**Auth:** Required (ClientGuard + SubscriptionGuard)  
**Description:** Soft delete a resource (cannot delete if upcoming bookings exist)

#### Response:
```json
{
  "success": true,
  "data": {
    "id": "resource-001",
    "org_id": "org-123",
    "name": "Conference Room A",
    "type": "meeting-room",
    "hourly_rate": 50,
    "is_available": true,
    "is_active": true,
    "is_maintenance": false,
    "metadata": {},
    "createdAt": "2026-04-20T16:45:22.123Z",
    "updatedAt": "2026-04-20T16:45:22.123Z",
    "deletedAt": "2026-04-20T17:00:00.000Z"
  },
  "timestamp": "2026-04-20T17:00:00.000Z"
}
```

---

## Subscription Plan Limits

Resources are subject to subscription plan limits enforced at creation time:

| Limit | FREE | PRO | ENTERPRISE |
|-------|------|-----|-----------|
| MAX_RESOURCES | 2 | 20 | 9999 |

**Error Response when limit reached:**
```json
{
  "success": false,
  "error": {
    "code": "Error",
    "message": "Your current plan is Free. You can create up to 2 resources. Please upgrade to increase this limit."
  },
  "timestamp": "2026-04-20T17:00:00.000Z"
}
```

---

## Features Implemented

### ✅ Pagination
- **Page-based navigation** with configurable page size
- **Limit validation** (1-100 items per page)
- **Total count and page calculations** included in response
- Default page size: 10, maximum: 100

### ✅ Search
- **Full-text search** across resource name and type
- **Case-insensitive matching** for better UX
- Combines with filters for advanced queries

### ✅ Filtering
- **is_available** - Filter by availability status
- **is_active** - Filter by active/inactive resources
- **is_maintenance** - Filter by maintenance status
- **type** - Filter by resource type
- All filters work independently and can be combined

### ✅ Sorting
- **Sort fields:** name, hourly_rate, createdAt
- **Sort direction:** ascending (asc) or descending (desc)
- Default: createdAt descending (newest first)

### ✅ Validation
- All query parameters validated using Zod schemas
- Type-safe DTOs with automatic coercion
- Clear error messages for invalid inputs

### ✅ Security
- Organization isolation (users only see their org's resources)
- Subscription guard enforcement
- Soft deletes (deletedAt field prevents hard deletion)
- Soft-deleted resources automatically excluded from queries

### ✅ Performance
- Database count optimization for pagination
- Selective field selection to reduce payload
- Indexed queries on org_id for fast lookups

---

## Advanced Usage Examples

### Frontend Implementation (React/TypeScript)

```typescript
interface ListResourcesParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  is_available?: 'true' | 'false';
  is_active?: 'true' | 'false';
  is_maintenance?: 'true' | 'false';
  sortBy?: 'name' | 'hourly_rate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

async function listResources(params: ListResourcesParams) {
  const queryString = new URLSearchParams(
    params as Record<string, string>
  ).toString();
  
  const response = await fetch(`/resources/list?${queryString}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
}

// Usage
const resources = await listResources({
  page: 1,
  limit: 10,
  search: 'meeting',
  is_available: 'true',
  sortBy: 'name',
  sortOrder: 'asc'
});
```

### Dynamic Search with Debounce

```typescript
import { useState, useCallback } from 'react';
import debounce from 'lodash/debounce';

function ResourcesSearch() {
  const [resources, setResources] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const search = useCallback(
    debounce(async (searchTerm: string) => {
      const data = await listResources({
        page: 1,
        limit: 10,
        search: searchTerm
      });
      setResources(data.data);
      setTotal(data.pagination.total);
      setPage(1);
    }, 500),
    []
  );

  return (
    <div>
      <input 
        onChange={(e) => search(e.target.value)}
        placeholder="Search resources..."
      />
      <ResourcesList items={resources} total={total} />
    </div>
  );
}
```

---

## Error Handling

### Common Errors

**Invalid pagination:**
```json
{
  "success": false,
  "error": {
    "code": "Error",
    "message": "Page must be at least 1"
  }
}
```

**Resource not found:**
```json
{
  "success": false,
  "error": {
    "code": "Error",
    "message": "Resource not found in your organization"
  },
  "status": 404
}
```

**Unauthorized:**
```json
{
  "success": false,
  "error": {
    "code": "Error",
    "message": "User not authenticated"
  },
  "status": 401
}
```

---

## Best Practices

1. **Always use pagination** - Don't fetch all resources at once; use page/limit for scalability
2. **Combine filters** - Use search + type + availability for specific queries
3. **Cache responses** - Cache paginated lists to reduce API calls
4. **Handle soft deletes** - Deleted resources won't appear in queries automatically
5. **Validate input** - Frontend should validate params before sending
6. **Use appropriate limits** - Start with limit=10 and adjust based on UI needs
7. **Sort by createdAt for consistency** - Default sort ensures stable pagination

---

## Implementation Details

### Query DTO Validation (Zod)
```typescript
export const ListResourcesQuerySchema = z.object({
  page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),
  search: z.string().optional(),
  type: z.string().optional(),
  is_available: z.enum(['true', 'false']).optional().transform(...),
  is_active: z.enum(['true', 'false']).optional().transform(...),
  is_maintenance: z.enum(['true', 'false']).optional().transform(...),
  sortBy: z.enum(['name', 'hourly_rate', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
```

### Service Layer Logic
- Builds Prisma query with OR conditions for search
- Applies individual filters conditionally
- Calculates pagination offsets and limits
- Returns items + metadata for frontend pagination

### Controller Layer
- Accepts validated DTOs through NestJS validation pipes
- Calls service with query parameters
- Returns paginated response using ResponseUtil helper

---

## Troubleshooting

**Q: Why are some resources not appearing in search?**
- Deleted resources are automatically filtered out
- Check `is_active` and `is_available` flags

**Q: How do I get total count for infinite scroll?**
- Use pagination response metadata; `total` field has total count

**Q: Can I sort by custom fields?**
- Currently supports: name, hourly_rate, createdAt
- Extend `sortBy` enum in DTO to add more fields

---

## Future Enhancements

- [ ] Advanced search with AND/OR operators
- [ ] Export resources to CSV/Excel
- [ ] Bulk operations (update/delete multiple)
- [ ] Resource templates
- [ ] Analytics (most booked, hourly rates, etc.)
- [ ] Resource availability calendar view
