# SIVA MART

## Project structure

- `frontend/` contains the browser application: HTML, CSS, and client-side JavaScript.
- `backend/` contains the Drogon C++ API migration and the existing Express compatibility server.
- `database/` contains database documentation and is the home for database migrations or SQL scripts.
- `.env` contains local PostgreSQL connection settings.

The existing Buyer/Seller/Admin shopping login page connects to the PostgreSQL `users` table in the `siva_mart` database. Users can create their own account from the frontend.

## Node compatibility server

```powershell
npm install express pg bcryptjs cors dotenv
```

Create a `.env` file in this folder:

```env
PORT=8080
PGHOST=localhost
PGPORT=5432
PGDATABASE=siva_mart
PGUSER=postgres
PGPASSWORD=your_postgres_password
```

The existing table must contain `id`, `full_name`, `email`, `role`, and `password_hash`. Passwords must be bcrypt hashes, never plain text.

## Drogon backend

The native backend is defined in `backend/CMakeLists.txt` and `backend/main.cpp`. Install Drogon with PostgreSQL support, then build it with:

```powershell
# From a vcpkg installation:
vcpkg install drogon[postgresql]:x64-windows
npm run build:native
npm run start:native
```

The Drogon server currently serves the frontend and provides `/api/health`. The remaining commerce routes still run through the compatibility server until each route is migrated to C++.

## Run

```powershell
npm start
```

Open http://localhost:8080. The backend serves the files from `frontend/` and exposes the API under `/api`. Test the database connection at http://localhost:8080/api/health.

If an older server is still occupying port 8080, run `npm run start:8081` and open http://localhost:8081 instead. If that port is also occupied by an older server, use the matching available server script (`start:8082` through `start:8085`) and open the matching localhost port.

The registration form sends `POST /api/register`. The backend normalizes the email, checks for duplicates, hashes the password with bcryptjs, and inserts the new user into the existing `users` table. Seller registration also requires a store name, which is saved to `sellers.store_name` and displayed in the seller dashboard after login. The login form sends `POST /api/login`, which checks the bcrypt password and selected Buyer/Seller/Admin role, then returns the account profile, including the seller store name when applicable.

## Test an account

1. Open the website and select `Create Account`.
2. Enter a new full name, email, password, confirmation, and account type.
3. Submit the form, then use the pre-filled login form.
4. Confirm the signed-in account name and type are shown. `Logout` clears the browser session.

To verify a registered account in PostgreSQL:

```sql
SELECT id, full_name, email, role, created_at
FROM users
WHERE LOWER(email) = LOWER('the-email-you-used@example.com');
```

The `password_hash` column should contain a bcrypt hash and is never returned by the API.
