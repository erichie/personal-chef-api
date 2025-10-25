# PostgreSQL Setup Guide

This guide will help you set up PostgreSQL locally for development.

## macOS Installation

### Using Homebrew (Recommended)

1. **Install PostgreSQL 16:**

   ```bash
   brew install postgresql@16
   ```

2. **Add PostgreSQL to your PATH:**

   ```bash
   echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

3. **Start PostgreSQL service:**

   ```bash
   brew services start postgresql@16
   ```

4. **Verify installation:**
   ```bash
   psql --version
   ```

### Create Development Database

1. **Create the database:**

   ```bash
   createdb personal_chef_dev
   ```

2. **Verify database creation:**
   ```bash
   psql -l | grep personal_chef_dev
   ```

### Connection String Format

Update your `.env.local` file with your connection string:

```
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/personal_chef_dev"
```

**Default username:** Your macOS username (run `whoami` to find it)

**With password (if set):**

```
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/personal_chef_dev"
```

### Common Commands

**Start PostgreSQL:**

```bash
brew services start postgresql@16
```

**Stop PostgreSQL:**

```bash
brew services stop postgresql@16
```

**Restart PostgreSQL:**

```bash
brew services restart postgresql@16
```

**Check status:**

```bash
brew services list | grep postgresql
```

**Access PostgreSQL shell:**

```bash
psql personal_chef_dev
```

**Drop database (if needed):**

```bash
dropdb personal_chef_dev
```

## Troubleshooting

### Port Already in Use

If port 5432 is already in use:

1. Check what's using the port:

   ```bash
   lsof -i :5432
   ```

2. Stop the conflicting service or change PostgreSQL port in `postgresql.conf`

### Connection Refused

1. Ensure PostgreSQL is running:

   ```bash
   brew services list | grep postgresql
   ```

2. Check PostgreSQL logs:
   ```bash
   tail -f /opt/homebrew/var/log/postgresql@16.log
   ```

### Permission Denied

If you get permission errors, you may need to create a password:

```bash
psql postgres
ALTER USER your_username WITH PASSWORD 'your_password';
\q
```

Then update your `DATABASE_URL` with the password.

## Next Steps

After setting up PostgreSQL:

1. Update `DATABASE_URL` in `.env.local`
2. Run Prisma migrations: `npx prisma migrate dev`
3. Generate Prisma Client: `npx prisma generate`

## Alternative: Using Docker

If you prefer Docker:

```bash
docker run --name personal-chef-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=personal_chef_dev \
  -p 5432:5432 \
  -d postgres:16
```

Connection string for Docker:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/personal_chef_dev"
```
