# Database Migration Strategy

The LoanTrack application uses Prisma ORM for database modeling and migrations. Since the application is deployed on Hostinger MySQL (or similar cPanel-based environments), follow this strategy to safely apply schema changes.

## 1. Local Development

When you add new models or change existing fields in `prisma/schema.prisma`:

**Option A: Prototyping (Safe for local dev without strict migration history)**
```bash
npx prisma db push
```
This command syncs your Prisma schema directly with the database without generating migration files. It's excellent for rapid iteration but should **not** be used in production once the app is live with real data.

**Option B: Creating Official Migrations**
```bash
npx prisma migrate dev --name describe_your_change
```
This generates a SQL migration file in `prisma/migrations/` and applies it locally.

## 2. Production Deployment

When deploying to a production server (e.g., Hostinger) with live data:

1. **NEVER use `prisma db push` on a production database unless you are absolutely sure it will not cause data loss.**
2. Build the application and ensure `prisma/migrations` folder is included in your source control.
3. Run the migrations against the production database:
```bash
npx prisma migrate deploy
```
This command reads the migrations folder and applies only the pending SQL scripts. It is safe and designed for CI/CD or production environments.

## 3. Rollback Procedure

If a migration fails or introduces a critical bug:

1. Prisma does not have an automatic "down" migration command.
2. To rollback, you must manually run the `fix_reverse.sql` (if you kept a backup) or connect to the Hostinger database via phpMyAdmin and manually drop the new columns/tables.
3. **Always take a database dump before running `prisma migrate deploy` in production.**
   - In Hostinger, go to Databases -> phpMyAdmin -> Export.

## 4. Resolving Drift
If your database schema drifts from your Prisma schema (e.g., someone made manual changes in phpMyAdmin):
```bash
npx prisma db pull
```
This updates your `schema.prisma` to match the actual database state.
