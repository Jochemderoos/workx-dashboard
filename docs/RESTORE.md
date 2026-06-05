# Database restore — Workx Dashboard

Korte handleiding voor wanneer de productie-DB onverhoopt corrupt raakt of
data per ongeluk gewist is. Test deze procedure minimaal 1× per kwartaal
met een staging-omgeving.

## Beschikbare backups

1. **Supabase intern** — Point-in-Time Recovery (PITR) en daily backups.
   Toegang via Supabase dashboard → Project → Database → Backups.
   Retention afhankelijk van plan (Free: 7 dagen daily snapshots, Pro:
   PITR met 7+ dagen).

2. **Lokale backup** — `backups/workx-*.sql.gz` gegenereerd door
   `npx tsx scripts/backup-db.ts`. Aanrader: minimaal wekelijks draaien
   en het bestand kopiëren naar Google Drive of externe schijf.

## Restore-scenario's

### Scenario A — Recente onvoorziene wijziging (laatste 7 dagen)
Gebruik **Supabase PITR**:
1. Login op supabase.com → project `zkrihqpmunjglyzkajcx`
2. Database → Backups → Point-in-Time
3. Kies tijdstip vlak vóór de incident
4. Restore naar nieuwe database OF overschrijf bestaande (let op:
   alle wijzigingen ná dat tijdstip gaan verloren)

### Scenario B — Verder terug dan PITR-retention
Gebruik **lokale pg_dump backup**:
```bash
# Decomprimeer het backup-bestand
gunzip -k backups/workx-2026-06-05-14-30-00.sql.gz

# Restore naar productie (DESTRUCTIEF — eerst kopie maken!)
psql "$DATABASE_URL" -f backups/workx-2026-06-05-14-30-00.sql

# OF: restore naar staging DB om eerst te verifiëren
psql "$DATABASE_URL_STAGING" -f backups/workx-2026-06-05-14-30-00.sql
```

### Scenario C — Selectief een tabel terugzetten
Als bv. alleen `TransitieCalculation` corrupt is en je een SQL-dump hebt:
```bash
# Extract alleen die tabel uit de dump
grep -E "^(INSERT INTO|COPY) \"?TransitieCalculation" \
  backups/workx-2026-06-05.sql > transitie-restore.sql

# Eerst de bestaande tabel leeg maken (let op: weet zeker!)
psql "$DATABASE_URL" -c "DELETE FROM \"TransitieCalculation\";"

# Dan inserts toepassen
psql "$DATABASE_URL" -f transitie-restore.sql
```

## Post-restore checklist

Na elke restore:
- [ ] Controleer login werkt voor een test-user
- [ ] Verifieer een paar willekeurige records in elke kritieke tabel
- [ ] Draai `scripts/run-build-migrations.ts` voor schema-sync
- [ ] Trigger Vercel-redeploy zodat Prisma-client matched met DB
- [ ] Notificeer team via Slack dat restore klaar is

## Preventie

- Gebruik altijd transacties voor bulk-mutaties
- Cron-routes draaien fail-closed op `CRON_SECRET` (zie commit 0911494)
- Backup-script wekelijks draaien — voeg toe aan persoonlijke agenda
