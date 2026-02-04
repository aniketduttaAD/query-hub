## QueryHub

QueryHub is a browser-based playground for working with **PostgreSQL**, **MongoDB**, and **MySQL**. It lets you manage connections, write and run queries, and inspect results and schema from a single, modern UI with enterprise-grade security and multi-tenancy support.

### Features

- **Multi-database support**: Connect to PostgreSQL, MongoDB, and MySQL databases
- **Default database configuration**: Configure default databases via environment variables, shown in sidebar on app open
- **One-click connection**: Connect to default databases with a single click
- **Custom credentials option**: Toggle to use your own credentials for default databases
- **User isolation**: Each user gets their own isolated database with complete data separation
- **Security protection**: SQL/NoSQL injection prevention for isolated sessions
- **Rate limiting**: Redis-backed rate limiting to prevent abuse (100+ concurrent users supported)
- **Daily cleanup**: Automatic database reset daily at 2:00 AM UTC
- **Secure credential storage**: Connection URLs encrypted in the browser using AES‑GCM
- **Monaco editor**: Syntax highlighting, autocomplete, and validation
- **Results viewer**: Toggle between table and JSON views with execution time and row counts
- **Schema explorer**: Browse databases, tables/collections, and columns/fields
- **Query history**: See and rerun recent queries with search and filtering
- **Export results**: Export query results as CSV or JSON files

### Setup

1. **Prerequisites**
   - Node.js 18+
   - `pnpm` installed globally (`npm install -g pnpm`)
   - Redis server running (for rate limiting and caching)
   - Optional: local or remote PostgreSQL / MongoDB / MySQL instances

2. **Install dependencies**

   ```bash
   cd mongodb-practice
   pnpm install
   ```

3. **Configure environment variables**

   Copy `.env.example` to `.env` and configure:

   ```bash
   cp .env.example .env
   ```

   **Required variables**:
   - `REDIS_URL` - Redis connection URL (default: `redis://localhost:6379`)
   - `DB_MONGODB_URL` - MongoDB connection URL (optional)
   - `DB_POSTGRESQL_URL` - PostgreSQL connection URL (optional)
   - `DB_MYSQL_URL` - MySQL connection URL (optional)

   **Optional variables**:
   - `DB_*_NAME` - Display names for default databases
   - `QUERY_TIMEOUT_MS` - Query timeout (default: 30000ms)
   - `QUERY_DEFAULT_LIMIT` - Result limit (default: 1000)
   - `RATE_LIMIT_QUERY_MAX` - Query rate limit (default: 100/min)
   - `RATE_LIMIT_CONNECTION_MAX` - Connection rate limit (default: 20/min)

4. **Start Redis** (if not already running)

   ```bash
   redis-server
   ```

5. **Run the app**

   ```bash
   pnpm dev
   ```

   This starts the Next.js app in development mode (default: `http://localhost:3000`).

### Usage

#### Default Databases (Recommended)

1. Configure default databases in `.env` file (see Setup step 3)
2. Open the app - default databases appear in the sidebar automatically
3. Click **Connect** on any default database
4. **Use default credentials** (checkbox checked): Isolated session with security restrictions
5. **Use custom credentials** (checkbox unchecked): Enter your own URL for full access