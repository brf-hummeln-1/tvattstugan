# Tvättstugan

Bokningsapp för tvättstugan i föreningen. React + Vite + Tailwind som installerbar PWA, Supabase som backend, publicerad på GitHub Pages: https://brf-hummeln-1.github.io/tvattstugan/

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
| Gmail-applösenord för inloggningsmejl (Auth SMTP) | Miljövariabeln `SMTP_PASS` när `npx supabase config push` körs: `read -s SMTP_PASS && export SMTP_PASS && npx supabase config push` |
| Gmail-applösenord för notismejl (Edge Function) | Supabase-secret `SMTP_PASS` (och `SMTP_USER` = avsändaradressen), se kommandot nedan |
| VAPID-nycklar för webb-push | Supabase-secrets `VAPID_PUBLIC_KEY` och `VAPID_PRIVATE_KEY`. Den publika ligger även i `.env` och i GitHub-variabeln `VITE_VAPID_PUBLIC_KEY`. |
| Service role key | Matas in interaktivt i skripten under `scripts/`. Edge Functions får den automatiskt. |
| Databaslösenord | Sparas i nyckelringen av `npx supabase link` |
| `cron_secret` (pg_net → Edge Function) | Genereras i databasen (`private.config`) och läses av funktionen via RPC. Finns aldrig i repot. |

Sätt notis-secrets (frågar efter applösenordet, genererar nya VAPID-nycklar och skriver ut den publika):

```bash
read -s "P?Gmail-applösenord: " && echo && OUT=$(node scripts/generate-vapid.mjs) && npx supabase secrets set VAPID_PUBLIC_KEY="${OUT%% *}" VAPID_PRIVATE_KEY="${OUT##* }" SMTP_USER=l.lindskoog@gmail.com SMTP_PASS="$P" && echo "VAPID_PUBLIC_KEY=${OUT%% *}"
```

Lägg sedan den publika nyckeln i `.env` (`VITE_VAPID_PUBLIC_KEY`) och som GitHub-variabel: `gh variable set VITE_VAPID_PUBLIC_KEY --body "<nyckel>"`. Byts VAPID-nycklarna måste alla slå på notiser igen.

GitHub Actions läser `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` och `VITE_VAPID_PUBLIC_KEY` från repots *variables* (Settings → Secrets and variables → Actions → Variables), satta via `gh variable set`.

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
4. Uppdatera Edge Function-secrets för notismejlen: `npx supabase secrets set SMTP_USER=<ny adress> SMTP_PASS=<nytt applösenord>` (skriv hellre `read -s` som i kommandot ovan så hamnar lösenordet inte i historiken).

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
SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-notifications.mjs [mejladress]
```

Notistestet anropar den riktiga Edge Function-kedjan (trigger → pg_net → send-notifications). Anges en mejladress skickas ett riktigt reservmejl dit.

## Notiser: hur det hänger ihop

- `pg_cron` kör `private.call_send_notifications()` var 10:e minut, som via `pg_net` anropar Edge Function `send-notifications` med headern `x-cron-secret`.
- Samma funktion anropas direkt av en trigger så fort något läggs i `notification_queue` (chattmeddelanden, bokningar avbokade av spärr).
- Påminnelser: `due_reminders()` hittar bokningar som börjar inom 60 minuter och inte påmints; `reminder_sent_at` sätts innan utskick så inget går dubbelt.
- Push via VAPID (`npm:web-push`). Prenumerationer som svarar 404/410 tas bort. Saknar en boende push skickas påminnelser och spärr-avbokningar som mejl via Gmail SMTP port 465 (`denomailer`). Chattnotiser skickas aldrig som mejl.

Service role key kan hämtas med `npx supabase projects api-keys --project-ref sbnafogvwkxaqrjzmzhe` och ska aldrig sparas i en fil.
