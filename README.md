# Hatian

A group expense splitter that works out who owes whom, in the fewest payments.

Friends, roommates or a barkada on a trip log shared expenses; Hatian tracks balances and shows a **Settle up** screen like *Ana pays Ben ₱600, Carlo pays Ben ₱400. Done.*

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. No database setup is needed: data lives in `data/hatian.db`, which uses Node's built-in SQLite (Node 22.13+ required).

```bash
npm test
```

## Features

- **Groups and members.** Create a group, add people, and share the group URL as the invite link.
- **Four split types:** equal, exact amounts, percentages, and shares ("I ate double, count me twice"). The form previews each person's share live as you type.
- **Balances and settle-up.** Debts are simplified to the fewest payments, and the app shows how many payments that saves. "Mark as paid" records a payment, and you can undo it.
- **Activity log.** Every add, edit, delete and payment is recorded. Edits include a diff, for example *amount ₱1,000.00 → ₱1,200.00*. Expenses are soft-deleted, so nothing quietly disappears.
- **Live sync.** When a friend changes something, your open page updates within a few seconds.
- **Spending charts** by category and by person, plus **CSV export**.
- **"You are…" picker.** Pick your name to see your own share on each expense. This is stored in a cookie until real auth is added.

## The interesting parts

### Money is integers

Every amount is stored and computed in **centavos** (`src/lib/money.ts`), so floats never touch a balance. Splitting uses the **largest remainder method**:

```
allocate(10000, [1, 1, 1]) -> [3334, 3333, 3333]   // ₱100 three ways, sums back to exactly ₱100
```

Leftover centavos go to the parts with the biggest fractional remainder. Ties go to the first member, so results are deterministic. BigInt is used for the intermediate products so huge amounts can't overflow.

### Debt simplification (`src/lib/settle.ts`)

1. Net everyone's balance: what they paid minus their share, adjusted for payments already made. Balances always sum to 0.
2. A subgroup of *k* people whose balances sum to 0 can always settle in *k − 1* payments. So the minimum number of payments is

   **n − (maximum number of disjoint zero-sum subgroups)**

3. Finding that partition is NP-hard in general. For group sizes like a barkada, a **bitmask DP** over subsets (O(n·2ⁿ)) solves it exactly and instantly. Each subgroup is then settled greedily (largest debtor pays largest creditor).
4. Above 16 people with non-zero balances, it falls back to pure greedy, which needs at most n − 1 payments.

Cycles cancel completely: A owes B, B owes C, C owes A → **0 payments**. The tests include a case where plain greedy needs 4 payments and the DP finds 3. They also check the DP against a brute-force solver on random groups.

## Project layout

```
src/lib/money.ts        centavo parsing/formatting, largest-remainder allocate()
src/lib/splits.ts       equal / exact / percent / shares → per-member centavos
src/lib/balances.ts     net balances + naive pairwise payment count
src/lib/settle.ts       minimum-payment debt simplification
src/lib/expense-form.ts form strings → split inputs (shared by client preview and server)
src/lib/db.ts           SQLite schema (Postgres-portable SQL)
src/lib/repo.ts         data access, validation, activity log
src/app/actions.ts      server actions
src/app/g/[groupId]/    group dashboard, expense add/edit, CSV export
```

## Roadmap

- [x] Stage 1: groups, expenses, equal splits, balances
- [x] Stage 2: uneven splits, debt simplification
- [~] Stage 3: activity log is done; real auth and per-user invites are still to do
- [~] Stage 4: charts and CSV are done; receipt OCR and PDF export are still to do
- [ ] Stage 5: deploy (Postgres/Supabase), demo video

Moving to Supabase means swapping `db.ts` and the queries in `repo.ts`. The money logic, the UI and the tests stay as they are, and Supabase Realtime can replace the polling in `LiveSync.tsx`.
