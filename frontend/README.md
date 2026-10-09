# @wastable/frontend

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4.

```
src/
├─ app/          routes (layout, pages)
├─ components/   shared UI (ApiStatus, FoodSafetyDisclaimer, ...)
├─ features/     one folder per feature: auth, listings, search, claims, notifications, moderation
└─ lib/          api-client (fetch wrapper for the Express API), config
```

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` if the API is not on `http://localhost:4000/api`.
