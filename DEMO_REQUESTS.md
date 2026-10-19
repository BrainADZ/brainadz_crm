# Live demo requests

The Demo Requests page is `/dashboard/demo-requests`. It shows website demo
leads, company/contact information, product, email delivery state, requirements,
campaign source and editable follow-up status/notes. The sidebar and route check
server access, and every list/update API request rechecks authorization.

Access requires an active, non-deleted employee with an active Live business-unit
assignment. Existing legacy Live memberships are resolved through the current
organization access service. Super admins, who are employees with access to all
business units, retain access. Marketing-only employees, clients and vendors are
denied. No permission migration is required.

## Website integration

- `POST /api/demo-requests/ingest` saves a lead idempotently by request UUID.
- `PATCH /api/demo-requests/ingest/:requestId` updates email delivery metadata.
- Both require `X-Website-Key`, matching backend `WEBSITE_INGESTION_KEY`.
- Keep that secret server-side and share it with the Live website API only.
- CRM stores no demo passwords. Only the website API emails newly created ERP
  credentials to the visitor.

For production, deploy this backend first, configure a strong matching shared
key in both backend services, and set the Live website API's `CRM_API_URL` to this
backend's public URL. Deploy the dashboard with the existing production
`VITE_API_URL`. Local `.env.local` uses `http://localhost:5002` to avoid the website
API on port 5000; restart local services after environment changes.

MongoDB creates the `demorequests` collection through the model. Use the project's
normal index deployment process for the unique `requestId` index if production
disables Mongoose automatic indexes.

Run `node --test tests/demoRequests.test.js` from `crm-backend` and `npm run build`
from `crm-dashboard`. Tests use database stubs and never write customer records.
