# bKash Social Campaign (prototype)

Front-end-only demo. There is no backend.

- `/social` – campaign form with intro popup. OTP is simulated: use code `123456`.
- `/admin` – view submissions, export CSV, download screenshots or a ZIP of
  everything. Demo login: `admin` / `bkash123`.

Submissions are saved in the browser's IndexedDB (`lib/social-store.ts`), so
`/admin` only shows submissions made in the same browser. Replace the functions
in `lib/social-store.ts` with API calls when a real backend is added. The admin
login is checked in the browser and is not real security.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # static HTML export in dist/
npm start       # serve dist/ locally
```
