# EcoCourse

Application mobile-first qui aide les utilisateurs québécois à faire leur épicerie au meilleur prix en scannant les circulaires de rabais et en générant des listes d'épicerie + recettes optimisées selon leurs préférences alimentaires et leur budget.

---

## 1. Vision produit

**Problème** : Le coût de la vie augmente. L'épicerie devient inabordable. Comparer les rabais entre 4-5 épiceries chaque semaine est impraticable manuellement.

**Solution** : EcoCourse scanne automatiquement les circulaires hebdomadaires des épiceries québécoises, croise les rabais avec les préférences alimentaires de l'utilisateur, et génère :
- Une liste d'épicerie optimisée (1 commerce ou multi-commerces)
- Des recettes hebdomadaires basées sur les items en rabais
- Une estimation du coût total et des économies réalisées

**Cible géographique** : Québec uniquement.
**Épiceries supportées au lancement** : IGA, Metro, Maxi, Super C.

---

## 2. Stack technique

| Couche | Techno | Raison |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Front + API routes, SSR mobile-friendly |
| UI | Tailwind CSS + shadcn/ui | Mobile-first, composants accessibles |
| DB | Neon Postgres (via Vercel) | Postgres serverless, intégration Vercel native |
| ORM | Drizzle ORM | Type-safe, léger, migrations versionnées |
| Auth | Auth.js v5 (NextAuth) + Credentials provider | Email/password, sessions JWT, intégration Next.js native |
| Scraping | Playwright (worker séparé) | Headless browser pour Flipp + sites épiceries |
| LLM | Claude API (claude-sonnet-4-6) | Génération de recettes, normalisation de noms d'items |
| Recettes externes | Ricardo Cuisine + Trois fois par jour (scrape) | Base de recettes québécoise authentique |
| Hosting | Vercel (front + API) + Supabase (DB) | Edge-friendly, CI/CD intégré |
| Background jobs | Vercel Cron + Supabase Edge Functions | Refresh des circulaires hebdo |

**Note importante** : Playwright ne tourne PAS sur Vercel serverless standard (trop lourd). On utilise **`@sparticuz/chromium` + `playwright-core`** sur une route API Vercel avec runtime Node.js et `maxDuration` étendu, sinon un service externe (Browserless, ScrapingBee) si nécessaire.

**Sécurité auth (sans RLS Supabase)** : comme Neon n'a pas de Row Level Security intégrée à l'auth, **toute requête DB doit être faite côté serveur (API routes / Server Components)** avec filtrage explicite par `user_id` issu de la session Auth.js. Jamais de client DB exposé au navigateur.

---

## 3. Sources de données

### 3.1 Rabais (circulaires)
- **Source principale** : [Flipp.com](https://flipp.com) — agrège IGA, Metro, Maxi, Super C avec une structure standardisée. URL paramétrable par code postal.
- **Fallback / enrichissement** : sites des épiceries directement
  - iga.net (Adoglobal)
  - metro.ca
  - maxi.ca
  - supercpa.ca
- **Stratégie** : Flipp d'abord (1 scraper, données propres). Fallback sur sites individuels seulement si Flipp manque un commerce ou un item. Refresh hebdo (jeudi matin, jour de sortie des nouvelles circulaires QC).

### 3.2 Recettes
- **Ricardo Cuisine** : `https://www.ricardocuisine.com/recettes`
- **Trois fois par jour** : `https://www.troisfoisparjour.com/fr/recettes/`
- **Stratégie** : scrape une fois, indexe en DB avec ingrédients normalisés. Re-scrape mensuel pour nouveautés.
- **Fallback créatif** : si aucune recette en base ne matche les rabais, Claude génère une recette à partir des ingrédients disponibles.

### 3.3 Historique des prix
- Stocké à chaque scan pour distinguer "vrai rabais" d'un "prix normal qu'on appelle rabais".
- Permet la feature "ce produit est-il vraiment en rabais ?".

---

## 4. Modèle de données (Neon Postgres / Drizzle)

```
users (Auth.js)
├── id (uuid, PK)
├── email (unique)
├── password_hash (text) -- bcrypt
└── created_at

sessions (Auth.js JWT — pas de table session si stateless)

profiles
├── user_id (uuid, FK → users.id)
├── postal_code (text) -- pour géolocaliser les rabais
├── household_size (int) -- nb de personnes pour adapter les portions
├── weekly_budget (numeric) -- budget cible en $
├── shopping_mode (enum: 'single_store' | 'multi_store')
├── preferred_store (text, nullable) -- si single_store
└── updated_at

dietary_preferences
├── user_id (uuid, FK)
├── preference_type (enum: 'vegetarian', 'vegan', 'pescatarian', 'meat_lover', etc.)
└── created_at

allergies -- distinct des préférences (médical, zéro tolérance)
├── user_id (uuid, FK)
├── allergen (enum: 'gluten', 'lactose', 'nuts', 'shellfish', 'eggs', 'soy', etc.)
└── severity (enum: 'intolerance' | 'allergy')

dislikes -- aliments à exclure
├── user_id (uuid, FK)
└── ingredient (text)

pantry -- garde-manger
├── user_id (uuid, FK)
├── ingredient (text, normalized)
├── quantity (numeric, nullable)
├── unit (text, nullable)
└── added_at

stores
├── id (uuid, PK)
├── name (text) -- 'IGA', 'Metro', etc.
├── slug (text)
└── flipp_merchant_id (text)

products -- catalogue normalisé
├── id (uuid, PK)
├── name_normalized (text) -- 'pomme gala'
├── name_raw (text) -- nom tel qu'affiché
├── category (text) -- 'fruits', 'viandes', etc.
├── unit (text) -- 'kg', 'unité', '500g'
└── created_at

deals -- rabais détectés
├── id (uuid, PK)
├── product_id (FK)
├── store_id (FK)
├── price (numeric)
├── regular_price (numeric, nullable)
├── valid_from (date)
├── valid_to (date)
├── source (enum: 'flipp', 'iga', 'metro', 'maxi', 'superc')
├── scraped_at (timestamp)
└── raw_data (jsonb) -- copie brute pour debug

price_history
├── product_id (FK)
├── store_id (FK)
├── price (numeric)
└── recorded_at (timestamp)

recipes
├── id (uuid, PK)
├── source (enum: 'ricardo', 'trois_fois_par_jour', 'claude_generated')
├── source_url (text, nullable)
├── title (text)
├── servings (int)
├── prep_time_min (int)
├── cook_time_min (int)
├── instructions (text)
├── tags (text[]) -- 'vegetarian', 'gluten-free', etc.
└── scraped_at (timestamp)

recipe_ingredients
├── recipe_id (FK)
├── ingredient_normalized (text)
├── quantity (numeric)
├── unit (text)
└── optional (bool)

shopping_lists
├── id (uuid, PK)
├── user_id (FK)
├── created_at (timestamp)
├── total_estimated_cost (numeric)
├── total_savings (numeric)
└── mode (enum: 'single_store' | 'multi_store')

shopping_list_items
├── list_id (FK)
├── product_id (FK)
├── store_id (FK) -- où acheter cet item
├── deal_id (FK, nullable)
├── quantity (numeric)
├── recipe_ids (uuid[]) -- recettes qui utilisent cet item
└── checked (bool, default false) -- pour cocher pendant l'épicerie
```

**Sécurité** : pas de RLS au niveau DB (Neon ne l'intègre pas avec Auth.js). Toute requête user-scopée DOIT inclure `WHERE user_id = session.user.id` côté serveur. Pattern obligatoire dans `lib/db/queries/*.ts` qui prend `userId` en paramètre — jamais d'accès DB depuis le client.

---

## 5. Flow utilisateur (mobile-first)

### 5.1 Onboarding (premier lancement)
1. Création compte (email/password Supabase)
2. Code postal (pour géolocaliser rabais)
3. Taille du ménage (nb de personnes)
4. Budget hebdo cible (optionnel)
5. Préférences alimentaires (multi-select : végétarien, végé, pescétarien, carnivore, etc.)
6. Allergies (multi-select avec sévérité)
7. Aliments détestés (input libre)
8. Mode achat préféré : 1 commerce ou multi-commerces
9. Si 1 commerce : choix du préféré (ou "le moins cher chaque semaine")

### 5.2 Utilisation hebdomadaire
1. Bouton principal **"Faire ma liste d'épicerie"**
2. App vérifie si scan récent (< 24h) — sinon lance scan
3. Affiche écran de progression (scan en cours, items trouvés…)
4. Algorithme de matching :
   - Filtre les rabais selon préférences/allergies/dislikes
   - Filtre selon le pantry (n'inclut pas ce qu'on a déjà)
   - Trouve les recettes qui maximisent l'usage des items en rabais
   - Optimise selon budget et mode (single/multi store)
5. Affiche :
   - **Liste d'épicerie** groupée par commerce (ou 1 seul si single_store)
   - **Recettes proposées** pour la semaine (avec portions ajustées au household_size)
   - **Coût total estimé**
   - **Économies vs prix réguliers**
   - Bouton **"Régénérer"** si l'utilisateur n'aime pas la suggestion
6. À l'épicerie : mode "shopping" avec items cochables, regroupés par allée si possible.

### 5.3 Features secondaires
- **Historique** des listes passées
- **Favoris** : recettes aimées qu'on revoit
- **Substitutions** : "remplacer le poulet par dinde (en rabais)"
- **Notifications** : "ton produit favori est en rabais cette semaine"
- **Mode défi** : "menu sous 50$/semaine"
- **Coût par portion / par g de protéine** sur chaque recette
- **Export PDF** de la liste

---

## 6. Architecture des dossiers

```
ecocourse/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── (app)/                  # routes authentifiées
│   │   ├── onboarding/
│   │   ├── home/               # bouton "Faire ma liste"
│   │   ├── list/[id]/          # liste d'épicerie active
│   │   ├── recipes/
│   │   ├── pantry/
│   │   ├── history/
│   │   └── settings/
│   ├── api/
│   │   ├── shopping-list/
│   │   │   ├── generate/route.ts
│   │   │   └── regenerate/route.ts
│   │   ├── deals/
│   │   │   └── refresh/route.ts    # cron hebdo
│   │   ├── recipes/
│   │   │   └── search/route.ts
│   │   └── claude/
│   │       └── generate-recipe/route.ts
│   └── layout.tsx
├── components/
│   ├── ui/                     # shadcn
│   ├── shopping/
│   ├── recipes/
│   └── onboarding/
├── lib/
│   ├── db/
│   │   ├── client.ts           # Neon + Drizzle client
│   │   ├── schema.ts           # tables Drizzle
│   │   └── queries/            # toutes les requêtes (server-only)
│   ├── auth/
│   │   ├── config.ts           # Auth.js config
│   │   └── session.ts          # helpers session
│   ├── claude/
│   │   └── client.ts           # Anthropic SDK + prompt caching
│   ├── scrapers/
│   │   ├── flipp.ts
│   │   ├── iga.ts
│   │   ├── metro.ts
│   │   ├── maxi.ts
│   │   ├── superc.ts
│   │   ├── ricardo.ts
│   │   └── trois-fois-par-jour.ts
│   ├── matching/
│   │   ├── filter-by-prefs.ts
│   │   ├── optimize-list.ts    # algo single vs multi store
│   │   └── recipe-matcher.ts
│   ├── normalize/
│   │   └── ingredients.ts      # normalisation noms produits
│   └── types/
├── workers/
│   └── scrape-deals/           # job hebdo (Vercel cron ou Supabase function)
├── drizzle/
│   ├── migrations/             # SQL migrations générées par drizzle-kit
│   └── seed.ts
├── public/
└── claude.md (ce fichier)
```

---

## 7. Algorithme d'optimisation de la liste

### Mode `single_store`
1. Pour chaque épicerie, calculer le panier total (recettes + items utilitaires) à ses prix.
2. Retourner le commerce avec le coût total minimum (sous contrainte budget si défini).

### Mode `multi_store`
1. Pour chaque ingrédient nécessaire, choisir le commerce avec le meilleur prix.
2. Regrouper par commerce dans la liste finale.
3. Heuristique anti-éparpillement : si un commerce a < 3 items, fusionner avec le commerce voisin si écart de prix < 15 %.

### Sélection des recettes
1. Cible : N recettes / semaine (par défaut 5, configurable).
2. Score de recette = (% d'ingrédients en rabais) × (économie totale) − pénalité si ingrédients allergènes/disliked.
3. Maximiser la réutilisation d'ingrédients entre recettes (réduit le gaspillage).
4. Respecter pantry : ingrédients déjà possédés = bonus de score.

---

## 8. Considérations légales et éthiques du scraping

- Respecter `robots.txt` de chaque site.
- Rate limiting : max 1 req/sec par domaine.
- User-Agent identifiable + email de contact.
- Cache local : ne pas re-scraper inutilement.
- Pas de redistribution publique des données scrapées (usage personnel utilisateur).
- Si une épicerie ferme l'accès : pivot vers Flipp ou alternative.

---

## 9. Variables d'environnement

```
# Neon Postgres (fournis automatiquement par l'intégration Vercel-Neon)
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Auth.js
AUTH_SECRET=                  # openssl rand -base64 32
AUTH_URL=http://localhost:3000  # en prod: URL Vercel

# Anthropic
ANTHROPIC_API_KEY=

# Scraping (si externe)
BROWSERLESS_TOKEN= (optionnel)

# Cron secret
CRON_SECRET=
```

---

## 10. Roadmap de développement

### Phase 1 — Fondations (semaine 1)
- [ ] Init Next.js 15 + TS + Tailwind + shadcn
- [ ] Drizzle ORM + connexion Neon
- [ ] Schéma DB complet + première migration
- [ ] Auth.js v5 (email/password) + middleware de protection des routes

### Phase 2 — Onboarding + Profile (semaine 1-2)
- [ ] Pages onboarding mobile-first
- [ ] CRUD préférences/allergies/pantry/dislikes
- [ ] Settings page

### Phase 3 — Scraping (semaine 2-3)
- [ ] Scraper Flipp avec Playwright
- [ ] Scrapers Ricardo + Trois fois par jour
- [ ] Worker hebdo + endpoint cron sécurisé
- [ ] Normalisation ingrédients (Claude pour ambiguïtés)

### Phase 4 — Matching & génération (semaine 3-4)
- [ ] Algo d'optimisation single/multi store
- [ ] Algo de sélection de recettes
- [ ] Endpoint `/api/shopping-list/generate`
- [ ] UI liste d'épicerie + recettes

### Phase 5 — Polish & features (semaine 4-5)
- [ ] Mode shopping (cocher items)
- [ ] Historique
- [ ] Notifications (push/email pour rabais)
- [ ] Export PDF
- [ ] Substitutions intelligentes
- [ ] Coût par portion

### Phase 6 — Déploiement
- [ ] Deploy Vercel
- [ ] Cron hebdo configuré
- [ ] Tests E2E (Playwright) sur flows critiques
- [ ] Monitoring (Sentry ou Vercel Analytics)

---

## 11. Conventions de code

- **TypeScript strict** : pas de `any` non justifié.
- **Server Components par défaut** ; `'use client'` seulement quand nécessaire (interactivité).
- **Zod** pour validation à toutes les frontières (API, formulaires, données scrapées).
- **Erreurs typées** : pas de `throw` génériques côté API. Retourner `{ error: { code, message } }`.
- **Pas de commentaires inutiles** — noms de variables explicites.
- **Mobile-first** : toujours designer pour 375px d'abord, puis élargir.
- **Accessibilité** : tous les composants shadcn respectent ARIA. Ne pas casser ça.
- **i18n** : interface en **français québécois** uniquement pour le MVP. Pas de système i18n compliqué — strings en français directement, mais regroupées dans `lib/i18n/fr.ts` pour faciliter une éventuelle traduction.
- **Migrations Drizzle** versionnées dans `drizzle/migrations/` (générées via `drizzle-kit generate`). Jamais de modif directe en prod — toujours via migration.
- **Aucune requête DB côté client.** Toute lecture/écriture passe par `lib/db/queries/*` appelée depuis Server Component ou route API.

---

## 12. Prompts Claude (recettes & normalisation)

### Génération de recette (fallback)
> Tu es un chef québécois. À partir de ces ingrédients en rabais cette semaine : [liste], génère une recette pour [N] personnes qui respecte ces contraintes : [allergies, préférences]. Format JSON strict : `{title, servings, prep_time_min, cook_time_min, ingredients: [{name, quantity, unit}], instructions}`.

### Normalisation d'ingrédients
> Normalise ces noms de produits d'épicerie québécois en forme canonique. Exemple : "POMMES GALA SAC 3 LB" → `{normalized: "pomme gala", category: "fruits", unit: "lb", quantity: 3}`. Réponds en JSON.

**Prompt caching** : mettre en cache la liste des préférences utilisateur + le système (instructions chef) pour économiser les coûts.

---

## 13. Ce que cette app n'est PAS (pour le MVP)

- ❌ Une app de livraison
- ❌ Un comparateur de prix en temps réel scanné en magasin (caméra)
- ❌ Une app de meal planning complet (lunch, déjeuner — focus soupers)
- ❌ Multi-pays / multi-langue
- ❌ Réseau social de partage de recettes

Ces features peuvent venir en v2.
