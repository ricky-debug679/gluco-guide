# GlucoGuide

GlucoGuide helps people with prediabetes, or at risk of it, build the daily habits that lower blood sugar: eating more fiber and protein, staying hydrated, moving, sleeping, and tracking the lab results that matter. Point your phone camera at a meal or your groceries, and AI explains what's in them and what would make them better.

**Try it:** [gluco-guide-mu.vercel.app](https://gluco-guide-mu.vercel.app). It works in any phone browser and can be added to the home screen like an app.

Built for the 2026 Congressional App Challenge.

## What it does

**Daily dashboard.** Nine progress rings track calories, fiber, protein, carbs, fat, water, mind and sleep, supplements, and exercise. The calorie target is personalized from height, weight, age, sex, and activity level using the Mifflin-St Jeor equation.

**Log a meal by photo.** Snap a plate and AI identifies the dish, estimates nutrition for the portion shown, and asks a short question when something can't be told from a photo, such as whether a dish is made with chicken or paneer, instead of guessing. You can also search about 326,000 foods from the OpenNutrition database or enter a meal by hand.

**Scan groceries.** Photograph your groceries or build a shopping list. AI flags items worth limiting, suggests combinations that slow blood sugar spikes (pairing a carb with protein or fiber), and offers a homemade high-protein swap for sweets and snacks. Each trip is saved, with favorites and a trend over time.

**Fiber, water, and supplements.** Choose a fiber supplement (psyllium, barley beta-glucan, or acacia) with guidance on when to take it. For any other product, AI looks it up and summarizes how to use it. Track water by the cup, and keep a checklist of supplements linked to insulin sensitivity, such as vitamin D and magnesium.

**Exercise, mind, and sleep.** Log activity against the CDC National Diabetes Prevention Program goal of 150 minutes a week. Log stress-relief activities (meditation, breathing, journaling, and more) and nightly sleep.

**Lab trends.** Record fasting glucose, 2-hour glucose, and HbA1c, the three markers the American Diabetes Association uses to define prediabetes. Each chart shows the normal range and says in plain language whether your numbers are moving the right way.

**History and progress summary.** Fourteen-day charts for food, water, exercise, sleep, and supplements. On request, AI writes a short, encouraging summary of what's going well and what to focus on next.

**Four languages.** The whole app, including AI responses, works in English, Spanish, Simplified Chinese, and Hindi.

## Privacy and safety

- Every table holding personal data uses row-level security, so each person can only read and change their own data.
- AI requests run on the server (Supabase Edge Functions). The AI provider's key is never sent to the browser, and every request requires a signed-in user.
- The progress summary sends only aggregate numbers, such as average cups of water per day, never raw logs.
- Users can permanently delete their account and all of its data from the Profile screen.

GlucoGuide is an educational tool, not medical advice. Lab ranges follow published ADA and CDC guidance; always confirm changes with a doctor.

## How it's built

| Layer | Technology |
| --- | --- |
| App | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query |
| Installable app | Progressive Web App (vite-plugin-pwa) |
| Languages | react-i18next |
| Backend | Supabase: Postgres, Auth, row-level security, Edge Functions (Deno) |
| AI | Anthropic Claude: Sonnet for meal and grocery photos, Haiku for text tasks |
| Hosting | Vercel, deployed automatically from `main` |

```
gluco-guide/
  src/
    pages/        one file per screen
    hooks/        data access (Supabase queries and AI calls)
    lib/          calculations, app content, translations setup
    locales/      en, es, zh, hi translation files
  supabase/
    schema.sql    base database schema
    0NN_*.sql     migrations, run in numeric order
    functions/    Edge Functions for AI features and account deletion
```

## Running it locally

You need Node.js 20.19 or newer.

```bash
cd gluco-guide
npm install
npm run dev
```

With no backend configured, the app opens in demo mode with sample data, so you can look around without an account. Sign-in and the AI features need the backend below.

To connect a real backend:

1. Create a Supabase project. In its SQL editor, run `supabase/schema.sql`, then each numbered migration in order.
2. Copy `.env.example` to `.env.local` and fill in your project's URL and anon key.
3. Deploy the folders in `supabase/functions/` as Edge Functions, and add an `ANTHROPIC_API_KEY` secret.
4. Optional: import the OpenNutrition food data for search, following the notes at the top of `supabase/010_opennutrition_foods.sql`.

## Credits

- Food search data: [OpenNutrition](https://www.opennutrition.app)
- Health targets: American Diabetes Association diagnostic criteria and the CDC National Diabetes Prevention Program
