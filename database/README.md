# Database

SIVA MART uses PostgreSQL with the `siva_mart` database.

The backend currently creates and migrates the required tables during startup through `ensureDatabaseSchema()` in `backend/server.js`. Keep future SQL migrations and seed scripts in this folder, and move schema ownership here when migrations are introduced.

Connection settings are loaded from the project root `.env` file.
