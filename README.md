# Tvättstugan

Bokningsapp för tvättstugan i föreningen. React + Vite + Tailwind som installerbar PWA, Supabase som backend, publicerad på GitHub Pages: https://lindskoog.github.io/tvattstugan/

Kravspecifikationen ligger i `../instruktioner.md` (utanför repot).

## Utveckling

```bash
npm install
npm run dev        # http://localhost:5173/tvattstugan/
npm run build
```

Supabase CLI körs via `npx supabase` (ligger som devDependency). Projektet är länkat till `sbnafogvwkxaqrjzmzhe`.

```bash
npx supabase db push            # kör nya migrationer i supabase/migrations/
npx supabase config push        # skickar supabase/config.toml (Auth, SMTP, mallar) till projektet
npx supabase functions deploy   # publicerar Edge Functions
```

## Hemligheter

Inga hemligheter i repot. `.env` innehåller bara publika värden (URL och anon-nyckel). Hemligheter läggs här:

| Hemlighet | Var |
|---|---|
| Gmail-applösenord (SMTP) | Miljövariabeln `SMTP_PASS` när `npx supabase config push` körs: `read -s SMTP_PASS && export SMTP_PASS && npx supabase config push` |
| Service role key | Matas in interaktivt i `scripts/create-admin.mjs`. Edge Functions får den automatiskt. |
| VAPID private key (etapp 4) | `npx supabase secrets set VAPID_PRIVATE_KEY=…` |
| Databaslösenord | Sparas i nyckelringen av `npx supabase link` |

GitHub Actions läser `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` från repots *variables* (Settings → Secrets and variables → Actions → Variables), satta via `gh variable set`.

## Första admin

```bash
node scripts/create-admin.mjs "Namn" mejl@adress.se
```

Skriptet frågar efter service role key. Därefter läggs alla andra boende till i appen under Mer → Admin.

## Byta avsändaradress för mejl

När föreningens Gmail-konto ska användas:

1. Skapa ett applösenord i det nya Google-kontot (kräver tvåstegsverifiering).
2. I `supabase/config.toml` under `[auth.email.smtp]`: ändra `user` och `admin_email` till den nya adressen.
3. Kör `read -s SMTP_PASS && export SMTP_PASS && npx supabase config push` med det nya applösenordet.
4. Etapp 4: uppdatera även Edge Function-secrets `SMTP_USER` och `SMTP_PASS` med `npx supabase secrets set` (används för påminnelse- och blockeringsmejl).

## Säkerhetskopia

Gratisnivån saknar automatiska backuper. Ta en manuell dump då och då (hamnar utanför repot, innehåller personuppgifter):

```bash
npx supabase db dump --linked --data-only -f ~/Desktop/tvattstugan-data-$(date +%F).sql
```

Schemat finns i `supabase/migrations/`, så det räcker att spara datan. Återställ med `psql` mot projektets anslutningssträng vid behov.

## Keep-alive

`.github/workflows/keepalive.yml` anropar Supabase tre gånger i veckan så att gratisprojektet inte pausas.

## Tester av bokningsreglerna

`scripts/test-bookings.mjs` kör alla regler (en aktiv bokning per lägenhet, bokningsfönster, spärrar, flytt, avbokning, admin, samtidighet, radering) som inloggade testanvändare mot det riktiga projektet, och städar bort testdatan efteråt.

```bash
SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-bookings.mjs
SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-chat.mjs
```

Service role key kan hämtas med `npx supabase projects api-keys --project-ref sbnafogvwkxaqrjzmzhe` och ska aldrig sparas i en fil.
