# Swagger Documentation Update
**Goal**: Ensure `api-docs` reflects the new preview endpoint.

## Changes

### 1. `routes/apiRoutes.js`
-   Added `@swagger` annotation for `GET /api/callback-preview/{sessionId}`.
-   Documented input parameters (`sessionId`) and response schema.

## Why?
-   Allows the user to interactively test the preview endpoint directly from the Swagger UI.
