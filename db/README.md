# Postgres Notes

This schema is for the resume-grade backend version of Lookout. The current live demo can still run as a static React app, but these tables show the production-shaped data model behind the prototype.

Run locally with:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Recommended next backend step:

- Add a small API layer for QR tag lookup, reports, sightings, found reports, and notifications.
- Keep OTP mocked for the portfolio demo unless you want to pay for SMS.
- Enforce ownership on report updates and resolution in the API.
- Delete `sightings` and `gate_acknowledgments` when a report is resolved, matching the privacy behavior in the frontend.

