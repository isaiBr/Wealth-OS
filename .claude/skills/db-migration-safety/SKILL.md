---
name: db-migration-safety
description: Use whenever creating or modifying a database migration (new table, new column, altering/dropping a column, changing a constraint). Apply before running any migration against a database that has real data in it.
---

# DB migration safety

## Before writing a migration
- Never write a migration that drops a column or table containing data without an explicit backup step or a confirmed "this data is safe to lose" from the user.
- Adding a required (`NOT NULL`) column to a table with existing rows needs a default value or a two-step migration (add nullable → backfill → make required).
- Renaming a column/table: prefer add-new + migrate-data + remove-old over an in-place rename if the app can't be taken offline during deploy.

## Multi-sucursal specific
- Any new table that stores per-branch data must include a `sucursal_id` foreign key from the start. Retrofitting this later is expensive — check every new table against this before finalizing it.
- Stock-related tables: prefer an append-only movement log (`stock_movements`: producto, sucursal, cantidad, tipo, fecha) over only keeping a current-count column, so history is never lost and concurrent updates are auditable.

## Every migration
- Reversible when possible — write the down/rollback migration, don't skip it because "we probably won't need it."
- Test on a copy of real-shaped data, not just an empty dev database, before running against production.
