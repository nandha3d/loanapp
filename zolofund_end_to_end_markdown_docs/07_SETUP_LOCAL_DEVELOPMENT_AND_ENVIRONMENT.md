# Setup, Local Development and Environment Guide

## 1. Prerequisites

Install:

- Node.js 22.x recommended.
- npm 10.x or compatible package manager.
- MySQL 8.x.
- Git.

Check versions:

```bash
node -v
npm -v
mysql --version
```

---

## 2. Install Dependencies

From the project root:

```bash
npm install
```

---

## 3. Environment Variables

Create `.env` in the project root.

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/loantrack"
AUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
```

For NextAuth v5, `AUTH_SECRET` is important.

Generate a strong secret:

```bash
openssl rand -base64 32
```

On Windows PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object {Get-Random -Maximum 256}))
```

---

## 4. Create Database

Login to MySQL:

```bash
mysql -u root -p
```

Create database:

```sql
CREATE DATABASE zolofund CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 5. Prisma Commands

Generate Prisma client:

```bash
npm run db:generate
```

Push schema to database:

```bash
npm run db:push
```

Seed demo data:

```bash
npm run db:seed
```

Open Prisma Studio:

```bash
npm run db:studio
```

---

## 6. Start Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 7. Existing Seed Logins

Current seed creates:

| User | Password | Role |
|---|---|---|
| `admin` | `admin123` | admin |
| `karthik` | `agent123` | agent |

Recommended addition before full testing:

| User | Password | Role |
|---|---|---|
| `developer` | `dev123` | developer |
| `superadmin` | `super123` | superadmin |

---

## 8. Build and Quality Commands

Run lint:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

Validate Prisma schema:

```bash
npx prisma validate
```

Format Prisma schema:

```bash
npx prisma format
```

---

## 9. Database Reset During Development

Only use in local development:

```bash
npm run db:reset
```

Or:

```bash
npx prisma migrate reset
```

Then seed again:

```bash
npm run db:seed
```

---

## 10. Recommended Local Test Flow

After setup:

1. Login as admin.
2. Create a route.
3. Create an agent.
4. Create a customer.
5. Create a loan for the customer.
6. Login as agent.
7. Open collection page.
8. Submit a collection entry.
9. Login as admin.
10. Check dashboard, loan detail, reports and audit log.

---

## 11. Troubleshooting

### Issue: `Default tenant not found`

Run:

```bash
npm run db:seed
```

### Issue: Prisma client mismatch

Run:

```bash
npm run db:generate
```

### Issue: Build fails in settings page

Fix:

```ts
const session = await auth();
const userRole = (session?.user as any)?.role;
```

### Issue: Superadmin cannot login

Current seed does not create superadmin. Add superadmin/developer to `prisma/seed.ts`.

### Issue: Agent cannot open customers page

Current middleware blocks `/customers` for agents. Align middleware with target access matrix.
