---
name: secure-coding-baseline
description: Use whenever writing code that handles authentication, authorization, user input, database queries, file uploads, or any API endpoint. Apply this automatically while writing — don't wait for a review pass to catch these.
---

# Secure coding baseline

Non-negotiable defaults while writing code for this project. Apply these in the moment, not as an afterthought.

## Every API endpoint / server action
1. Check WHO can call it (authenticated?) AND what they're allowed to do (authorized for this specific action/resource — not just "logged in"). A cajero endpoint must reject an admin-only action even if called directly.
2. Validate every input server-side, even if the frontend already validates it. Never trust the client.
3. Never return more fields than the frontend needs. No leaking password hashes, other users'/branches' data, or internal IDs that aren't needed.
4. Scope every query to the resource owner — for this project, that means every product/sale/stock query includes the sucursal (branch) the requester belongs to. Never rely on the client sending the correct `sucursal_id`; derive it from the authenticated session.

## Database access
- Parameterized queries / ORM only. Never string-concatenate user input into a query.
- Wrap multi-step writes (e.g., "decrement stock" + "create sale record") in a transaction.
- For stock updates specifically: use an atomic decrement or row lock, never "read count in app → subtract → write back" (loses updates under concurrent sales).

## Secrets
- No API keys, DB credentials, or tokens in source code — always environment variables, never committed.
- If you're about to write a literal secret-looking string into a file, stop and use `.env` instead.

## Passwords & sessions
- Hash with bcrypt/argon2, never store or log plaintext.
- Session/token expiry set explicitly; don't leave it to library defaults without checking what they are.

## When in doubt
If a piece of logic touches money, stock counts, or another branch's data, treat it as high-risk by default — add the transaction/lock/scope-check even if the immediate feature doesn't seem to need it yet.
