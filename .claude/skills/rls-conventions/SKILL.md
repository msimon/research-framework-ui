---
name: rls-conventions
description: Row-level security best practices for Supabase. Use when generating, reviewing, or debugging RLS policies, access control, or permission checks.
user-invocable: false
---

# RLS Performance Best Practices

Reference: https://github.com/orgs/supabase/discussions/14576

1. **Index columns used in RLS** that are not primary keys or unique already.
   For `auth.uid() = user_id`, add:
   ```sql
   create index userid on test_table using btree (user_id) tablespace pg_default;
   ```
   Improvement seen over 100x on large tables.

2. **Wrap RLS functions in `select` statements** to enable initPlan caching.
   Instead of:
   ```sql
   is_admin() or auth.uid() = user_id
   ```
   Use:
   ```sql
   (select is_admin()) OR (select auth.uid()) = user_id
   ```
   Works for `auth.uid()`, `auth.jwt()`, and security definer functions.
   WARNING: Only do this if the result does not change based on row data.

3. **Do not rely on RLS for filtering — only for security.**
   Instead of:
   ```js
   .from('table').select()  // relying on RLS to filter
   ```
   Add an explicit filter:
   ```js
   .from('table').select().eq('user_id', userId)
   ```

4. **Use security definer functions** to query other tables and bypass their RLS.
   Instead of:
   ```sql
   exists (select 1 from roles_table where auth.uid() = user_id and role = 'good_role')
   ```
   Create a security definer function `has_role()` and use:
   ```sql
   (select has_role())
   ```
   - Wrap in `select` per rule 2 if the value is fixed per request.
   - Functions used in RLS can be called from the API — secure them in an alternate schema if results would be a security leak.
   - If the function takes row data as input, test performance (you can't wrap it per rule 2).

5. **Optimize join queries — compare row columns to fixed join data.**
   This:
   ```sql
   auth.uid() in (select user_id from team_user where team_user.team_id = table.team_id)
   ```
   Is much slower than:
   ```sql
   team_id in (select team_id from team_user where user_id = auth.uid())
   ```
   Consider a security definer function:
   ```sql
   team_id in (select user_teams())
   ```
   If the `in` list exceeds 10K items, extra analysis is needed. See: https://github.com/GaryAustin1/RLS-Performance/tree/main/tests/Supabase-Docs-Test

6. **Use the `TO` role option** — never rely solely on `auth.uid()` / `auth.jwt()` to exclude `anon`.
   Always add `authenticated` to the approved roles instead of `public`.
   This eliminates `anon` users without taxing the database to process the rest of the RLS.
