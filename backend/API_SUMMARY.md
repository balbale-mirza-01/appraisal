# Backend API Summary Document

## Overview

This document provides a comprehensive summary of the backend APIs for the **Branch Evaluation System** (سامانه ارزیابی بازاریابی شعب). The backend is built using **Django REST Framework** and provides authentication, authorization, and full CRUD operations for managing branch evaluations, cycles, templates, and related entities.

---

## Technology Stack

- **Framework**: Django + Django REST Framework
- **Authentication**: JWT (Simple JWT) with HTTP-only cookies for refresh tokens
- **Database**: PostgreSQL (assumed from Django ORM usage)
- **API Style**: RESTful

---

## Base URL Structure

```
/api/auth/     - Authentication endpoints
/api/          - Appraisal/Evaluation endpoints
/admin/        - Django admin interface
```

---

## 1. Authentication APIs (`/api/auth/`)

### User Roles

The system defines four user roles:

- `evaluator` (ارزیاب) - Performs branch evaluations
- `region_supervisor` (سرپرست منطقه) - Supervises regions and reviews evaluations
- `marketing_manager` (مدیر بازاریابی) - Manages cycles, assignments, and reviews
- `admin` (مدیر سامانه) - Full system administration

### Endpoints

| Method | Endpoint                            | Description            | Auth Required            |
| ------ | ----------------------------------- | ---------------------- | ------------------------ |
| GET    | `/api/auth/csrf/`                   | Get CSRF token         | No                       |
| POST   | `/api/auth/login/`                  | User login             | No                       |
| POST   | `/api/auth/refresh/`                | Refresh access token   | No (uses refresh cookie) |
| POST   | `/api/auth/logout/`                 | User logout            | No (uses refresh cookie) |
| GET    | `/api/auth/me/`                     | Get current user info  | Yes                      |
| POST   | `/api/auth/change-password/`        | Change password        | Yes                      |
| POST   | `/api/auth/password-reset/request/` | Request password reset | No                       |
| POST   | `/api/auth/password-reset/confirm/` | Confirm password reset | No                       |

### Request/Response Examples

#### Login

**POST** `/api/auth/login/`

```json
{
  "username": "user@example.com",
  "password": "securepassword"
}
```

**Response**:

```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbG...",
  "user": {
    "id": 1,
    "username": "user@example.com",
    "email": "user@example.com",
    "employee_number": "12345",
    "first_name": "John",
    "last_name": "Doe",
    "display_name": "John Doe",
    "role": "evaluator"
  }
}
```

_Note: Refresh token is set as an HTTP-only cookie._

#### Get Current User

**GET** `/api/auth/me/`

```json
{
  "id": 1,
  "username": "user@example.com",
  "email": "user@example.com",
  "employee_number": "12345",
  "first_name": "John",
  "last_name": "Doe",
  "display_name": "John Doe",
  "role": "evaluator"
}
```

---

## 2. Appraisal/Evaluation APIs (`/api/`)

### 2.1 Health Check

| Method | Endpoint       | Description           |
| ------ | -------------- | --------------------- |
| GET    | `/api/health/` | Health check endpoint |

---

### 2.2 Regions (مناطق)

**ViewSet**: `RegionViewSet`  
**Permissions**: Authenticated users (filtered by role)

| Method | Endpoint             | Description             |
| ------ | -------------------- | ----------------------- |
| GET    | `/api/regions/`      | List all active regions |
| GET    | `/api/regions/{id}/` | Get region details      |

**Response Example**:

```json
{
  "id": 1,
  "code": "REG001",
  "name": "Tehran Region",
  "is_active": true
}
```

**Notes**:

- Region supervisors only see their assigned regions
- Evaluators only see regions with their assigned branches

---

### 2.3 Branches (شعب)

**ViewSet**: `BranchViewSet`  
**Permissions**: Authenticated users (filtered by role)  
**Filtering**: `?region={id}`  
**Search**: `name`, `code`, `manager_name`  
**Ordering**: `name`, `code`

| Method | Endpoint              | Description              |
| ------ | --------------------- | ------------------------ |
| GET    | `/api/branches/`      | List all active branches |
| GET    | `/api/branches/{id}/` | Get branch details       |

**Response Example**:

```json
{
  "id": 1,
  "code": "BR001",
  "name": "Central Branch",
  "manager_name": "Ali Rezaei",
  "region": 1,
  "region_name": "Tehran Region"
}
```

---

### 2.4 Templates (الگوهای ارزیابی)

**ViewSet**: `TemplateViewSet`  
**Permissions**: Read-only for authenticated users

| Method | Endpoint                  | Description                   |
| ------ | ------------------------- | ----------------------------- |
| GET    | `/api/templates/`         | List all published templates  |
| GET    | `/api/templates/{id}/`    | Get template details          |
| GET    | `/api/templates/current/` | Get latest published template |

**Response Example**:

```json
{
  "id": 1,
  "name": "Standard Evaluation Template",
  "version": 2,
  "status": "published",
  "effective_date": "2024-01-01",
  "total_weight": "100.00",
  "sections": [
    {
      "id": 1,
      "title": "Customer Service",
      "icon": "service-icon",
      "order": 1,
      "weight": "40.00",
      "criteria": [
        {
          "id": 1,
          "text": "Staff greeting quality",
          "order": 1,
          "weight": "10.00",
          "is_required": true
        }
      ]
    }
  ]
}
```

---

### 2.5 Cycles (دوره‌های ارزیابی)

**ViewSet**: `CycleViewSet`  
**Permissions**:

- Read: All authenticated users (filtered by role)
- Create/Update/Delete: Marketing Manager or Admin only  
  **Filtering**: `?status={status}&template={id}`  
  **Search**: `title`  
  **Ordering**: `start_date`, `end_date`, `title`

| Method    | Endpoint            | Description            |
| --------- | ------------------- | ---------------------- |
| GET       | `/api/cycles/`      | List evaluation cycles |
| POST      | `/api/cycles/`      | Create new cycle       |
| GET       | `/api/cycles/{id}/` | Get cycle details      |
| PUT/PATCH | `/api/cycles/{id}/` | Update cycle           |
| DELETE    | `/api/cycles/{id}/` | Delete cycle           |

**Request Example (Create)**:

```json
{
  "title": "Q1 2024 Evaluation Cycle",
  "template": 1,
  "start_date": "2024-01-01",
  "end_date": "2024-03-31",
  "status": "active"
}
```

**Response Example**:

```json
{
  "id": 1,
  "title": "Q1 2024 Evaluation Cycle",
  "template": 1,
  "template_name": "Standard Evaluation Template",
  "start_date": "2024-01-01",
  "end_date": "2024-03-31",
  "status": "active"
}
```

---

### 2.6 Evaluators (ارزیابان)

**ViewSet**: `EvaluatorViewSet`  
**Permissions**: CanManageAssignments (Region Supervisor, Marketing Manager, Admin)  
**Search**: `username`, `first_name`, `last_name`, `employee_number`

| Method | Endpoint           | Description                |
| ------ | ------------------ | -------------------------- |
| GET    | `/api/evaluators/` | List all active evaluators |

---

### 2.7 Assignments (تخصیص‌های ارزیابی)

**ViewSet**: `AssignmentViewSet`  
**Permissions**:

- Read: All authenticated users (filtered by visibility rules)
- Create/Update/Delete: CanManageAssignments only  
  **Filtering**: `?cycle={id}&branch={id}&evaluator={id}&status={status}`  
  **Search**: `branch__name`, `branch__code`, `evaluator__first_name`, etc.  
  **Ordering**: `due_date`, `created_at`, `status`

| Method    | Endpoint                 | Description            |
| --------- | ------------------------ | ---------------------- |
| GET       | `/api/assignments/`      | List assignments       |
| POST      | `/api/assignments/`      | Create assignment      |
| GET       | `/api/assignments/{id}/` | Get assignment details |
| PUT/PATCH | `/api/assignments/{id}/` | Update assignment      |
| DELETE    | `/api/assignments/{id}/` | Delete assignment      |

**Request Example (Create)**:

```json
{
  "cycle": 1,
  "branch": 5,
  "evaluator": 10,
  "due_date": "2024-03-15"
}
```

**Response Example**:

```json
{
  "id": 1,
  "cycle": 1,
  "cycle_title": "Q1 2024 Evaluation Cycle",
  "template_id": 1,
  "branch": 5,
  "branch_detail": {
    "id": 5,
    "code": "BR005",
    "name": "North Branch",
    "manager_name": "Sara Ahmadi",
    "region": 1,
    "region_name": "Tehran Region"
  },
  "evaluator": 10,
  "evaluator_detail": {
    "id": 10,
    "username": "evaluator@example.com",
    "display_name": "Reza Karimi",
    "role": "evaluator"
  },
  "assigned_by_detail": {
    "id": 2,
    "username": "manager@example.com",
    "display_name": "Manager Name",
    "role": "marketing_manager"
  },
  "due_date": "2024-03-15",
  "status": "assigned",
  "evaluation_id": null,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Status Flow**: `assigned` → `in_progress` → `submitted` → `approved` or `returned`

---

### 2.8 Evaluations (ارزیابی‌ها)

**ViewSet**: `EvaluationViewSet`  
**Permissions**:

- Read: All authenticated users (filtered by visibility rules)
- Create: Assigned evaluator only
- Update/Delete: Assigned evaluator (only in DRAFT or RETURNED status)
- Special actions: Role-based permissions  
  **Filtering**: `?status={status}&assignment__cycle={id}&assignment__branch={id}&assignment__branch__region={id}&assignment__evaluator={id}`  
  **Search**: `assignment__branch__name`, `assignment__branch__code`, etc.  
  **Ordering**: `evaluation_date`, `created_at`, `updated_at`, `total_score`, `status`

| Method    | Endpoint                                       | Description                             |
| --------- | ---------------------------------------------- | --------------------------------------- |
| GET       | `/api/evaluations/`                            | List evaluations                        |
| POST      | `/api/evaluations/`                            | Create evaluation                       |
| GET       | `/api/evaluations/{id}/`                       | Get evaluation details                  |
| PUT/PATCH | `/api/evaluations/{id}/`                       | Update evaluation                       |
| DELETE    | `/api/evaluations/{id}/`                       | Delete evaluation                       |
| POST      | `/api/evaluations/{id}/submit/`                | Submit evaluation                       |
| POST      | `/api/evaluations/{id}/approve/`               | Approve evaluation                      |
| POST      | `/api/evaluations/{id}/return_for_correction/` | Return for correction                   |
| POST      | `/api/evaluations/{id}/recalculate/`           | Recalculate scores (Admin/Manager only) |
| POST      | `/api/evaluations/{id}/reopen/`                | Reopen evaluation (Admin/Manager only)  |
| GET       | `/api/evaluations/{id}/export-xlsx/`           | Export individual evaluation to Excel   |

**Request Example (Create)**:

```json
{
  "assignment": 1,
  "evaluation_date": "2024-03-10",
  "strengths": "Excellent customer service",
  "improvements": "Need better documentation",
  "market_opportunities": "Potential partnership with XYZ Corp",
  "branch_needs": "Additional staff training required",
  "answers": [
    {
      "criterion": 1,
      "score": 4,
      "comment": "Good performance overall"
    }
  ],
  "opportunities": [
    {
      "organization_name": "XYZ Corporation",
      "employee_count": 500,
      "opportunity_types": ["banking", "loans"],
      "responsible_person": "John Doe",
      "status": "pending",
      "target_date": "2024-06-01",
      "notes": "Follow up next quarter"
    }
  ]
}
```

**Response Example**:

```json
{
  "id": 1,
  "assignment": 1,
  "assignment_detail": {...},
  "status": "draft",
  "evaluation_date": "2024-03-10",
  "strengths": "Excellent customer service",
  "improvements": "Need better documentation",
  "market_opportunities": "Potential partnership with XYZ Corp",
  "branch_needs": "Additional staff training required",
  "answers": [...],
  "opportunities": [...],
  "total_score": "85.50",
  "section_scores": {...},
  "classification": "excellent",
  "submitted_at": null,
  "reviewed_at": null,
  "reviewed_by": null,
  "review_comment": "",
  "created_at": "2024-03-10T14:00:00Z",
  "updated_at": "2024-03-10T14:00:00Z"
}
```

**Action Details**:

- **Submit** (`POST /submit/`): Moves evaluation from DRAFT/RETURNED to SUBMITTED
- **Approve** (`POST /approve/`): Manager/Supervisor approves evaluation
  ```json
  { "comment": "Great work!" }
  ```
- **Return for Correction** (`POST /return_for_correction/`): Sends back to evaluator
  ```json
  { "comment": "Please provide more details on section 3" }
  ```
- **Recalculate** (`POST /recalculate/`): Recalculates scores (Admin/Manager only)
- **Reopen** (`POST /reopen/`): Reopens approved evaluation (Admin/Manager only)
  ```json
  { "comment": "Reopening for additional review" }
  ```

---

### 2.9 Region Supervisor Assignments (تخصیص سرپرستان مناطق)

**ViewSet**: `RegionSupervisorAssignmentViewSet`  
**Permissions**: IsMarketingManagerOrAdmin only  
**Filtering**: `?region={id}&supervisor={id}&is_active={boolean}`

| Method    | Endpoint                        | Description                 |
| --------- | ------------------------------- | --------------------------- |
| GET       | `/api/region-supervisors/`      | List supervisor assignments |
| POST      | `/api/region-supervisors/`      | Create assignment           |
| GET       | `/api/region-supervisors/{id}/` | Get details                 |
| PUT/PATCH | `/api/region-supervisors/{id}/` | Update assignment           |
| DELETE    | `/api/region-supervisors/{id}/` | Delete assignment           |

**Response Example**:

```json
{
  "id": 1,
  "region": 1,
  "region_detail": {
    "id": 1,
    "code": "REG001",
    "name": "Tehran Region",
    "is_active": true
  },
  "supervisor": 5,
  "supervisor_detail": {
    "id": 5,
    "username": "supervisor@example.com",
    "display_name": "Ali Supervisor",
    "role": "region_supervisor"
  },
  "is_active": true
}
```

---

### 2.10 Dashboard (`/api/dashboard/`)

**View**: `DashboardView`  
**Permissions**: IsAuthenticated

| Method | Endpoint          | Description              |
| ------ | ----------------- | ------------------------ |
| GET    | `/api/dashboard/` | Get dashboard statistics |

**Response Example**:

```json
{
  "role": "evaluator",
  "assignment_counts": {...},
  "evaluation_counts": {...},
  "total_assignments": 15,
  "total_evaluations": 12,
  "average_score": 82.5,
  "due_soon": 3,
  "evaluator_summary": {
    "approved": 10,
    "returned": 2,
    "overdue": 1,
    "completion_rate": 66.7
  },
  "action_required": [...]
}
```

Dashboard data varies based on user role:

- **Evaluators**: See personal workload, completion rate, action items
- **Region Supervisors**: See regional statistics, evaluator workload
- **Marketing Managers**: See active cycles, overall statistics
- **Admins**: See system-wide statistics

---

### 2.11 Reports Export

**View**: `EvaluationReportExportView`  
**Permissions**: IsAuthenticated (filtered by visibility)

| Method | Endpoint                        | Description                       |
| ------ | ------------------------------- | --------------------------------- |
| GET    | `/api/reports/evaluations.xlsx` | Export evaluation report to Excel |

**Query Parameters**:

- `cycle`: Filter by cycle ID
- `region`: Filter by region ID
- `branch`: Filter by branch ID
- `status`: Filter by evaluation status

**Response**: Excel file download with multiple sheets:

- Summary (خلاصه)
- Regions (مناطق)
- Branches (شعب)
- Evaluators (ارزیابان)
- Section Scores (امتیاز بخش‌ها)
- Details (جزئیات)

---

## 3. Data Models

### Core Entities

1. **User** - Custom user model with roles
2. **Region** - Geographic regions
3. **Branch** - Bank branches belonging to regions
4. **RegionSupervisorAssignment** - Links supervisors to regions
5. **EvaluationTemplate** - Template with sections and criteria
6. **EvaluationSection** - Sections within a template
7. **EvaluationCriterion** - Individual criteria within sections
8. **EvaluationCycle** - Time-bound evaluation periods
9. **EvaluationAssignment** - Assigns evaluators to branches per cycle
10. **Evaluation** - Actual evaluation records
11. **EvaluationAnswer** - Answers to criteria
12. **Opportunity** - Market opportunities identified during evaluation
13. **AuditEvent** - Audit trail for evaluation actions

---

## 4. Permissions & Access Control

### Role-Based Access

| Feature                        | Evaluator | Region Supervisor | Marketing Manager | Admin |
| ------------------------------ | --------- | ----------------- | ----------------- | ----- |
| View own assignments           | ✓         | ✓                 | ✓                 | ✓     |
| Create evaluations             | ✓         | ✗                 | ✗                 | ✗     |
| Review regional evaluations    | ✗         | ✓                 | ✓                 | ✓     |
| Manage cycles                  | ✗         | ✗                 | ✓                 | ✓     |
| Manage assignments             | ✗         | ✓                 | ✓                 | ✓     |
| Manage supervisor assignments  | ✗         | ✗                 | ✓                 | ✓     |
| Recalculate/Reopen evaluations | ✗         | ✗                 | ✓                 | ✓     |
| System-wide statistics         | ✗         | ✗                 | ✓                 | ✓     |

### Visibility Rules

- **Evaluators**: See only their own assignments and evaluations
- **Region Supervisors**: See evaluations in their supervised regions
- **Managers/Admins**: See all evaluations

---

## 5. Error Handling

All endpoints return standard HTTP status codes:

- `200 OK` - Successful request
- `201 Created` - Resource created
- `204 No Content` - Successful deletion
- `400 Bad Request` - Validation errors
- `401 Unauthorized` - Authentication required/failed
- `403 Forbidden` - Permission denied
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

Error responses include descriptive messages in Persian (Farsi).

---

## 6. Rate Limiting

- **Authentication endpoints**: `AuthRateThrottle`
- **Password reset**: `PasswordResetRateThrottle`

---

## 7. Security Features

- JWT authentication with access/refresh token rotation
- HTTP-only cookies for refresh tokens
- CSRF protection
- Password validation
- Token blacklisting on logout/password change
- Audit logging for sensitive operations

---

## 8. Key Business Logic

### Evaluation Workflow

1. Admin/Manager creates a cycle with a published template
2. Assignments are created linking evaluators to branches
3. Evaluators create and submit evaluations
4. Supervisors/Managers review and approve or return for correction
5. Approved evaluations contribute to regional/national statistics

### Scoring System

- Criteria scored 1-5
- Weighted scores calculated per criterion
- Section scores aggregated
- Total score determines classification

### Classification Thresholds

(Defined in services.py)

- Based on total score percentage

---

## 9. File Exports

Two types of Excel exports available:

1. **Individual Evaluation** (`/api/evaluations/{id}/export-xlsx/`): Detailed single evaluation with all answers
2. **Bulk Report** (`/api/reports/evaluations.xlsx`): Aggregated report with filtering options

---

## 10. Audit Trail

All significant evaluation actions are logged in `AuditEvent`:

- Evaluation creation
- Submission
- Approval/Return
- Export actions
- Recalculation
- Reopening

---

_Document generated from source code analysis_
