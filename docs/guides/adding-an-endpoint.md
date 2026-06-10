# Adding an Endpoint

## Steps

1. Define request/response contract and validation schema.
2. Register endpoint in the module route file with auth/limit middleware.
3. Implement controller boundary logic (parse, validate, response shape).
4. Implement or reuse service use case.
5. Reuse domain and repository layers instead of duplicating logic.
6. Update module OpenAPI schema and verify `/openapi.json` output.
7. Update relevant docs.
8. Run `npm run lint`.
9. Run `npm run test`.
