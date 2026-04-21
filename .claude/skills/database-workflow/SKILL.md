---
name: database-workflow
description: Database migration and table creation workflow for Supabase. Use when generating tables, creating migrations, modifying schema, or adding indexes.
user-invocable: false
---

# Database Workflow

## Creating new tables

1. Generate a new migration: `npm run db:migration:new`
2. Add the data needed for the new tables in the new file
3. Confirm the SQL generated. Do not proceed automatically without an explicit confirmation.
4. Apply the migrations: `npm run db:migration:up`
5. Regenerate the types: `npm run db:types:generate`

## Table conventions

- Always include `created_at` and `updated_at` fields and add the trigger for `updated_at`.
- Most fields should be `NOT NULL` with appropriate defaults — only allow NULL when genuinely optional.
- The file `src/shared/lib/supabase/supabase.types.ts` is auto-generated. Never manually edit it.

## Index rules

- PostgreSQL does NOT automatically create indexes on foreign key referencing columns.
- Only add indexes that are actually needed for RLS policies or frequent queries.
- Do NOT automatically add indexes on all FK columns — they're only useful for JOINs, CASCADE operations, and application filtering.
- Focus on columns used in RLS conditions like `auth.uid() = user_id`.

## Database reset

- Always ask for confirmation before resetting the database. Run `npm run db:reset` to reset it.
