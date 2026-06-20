# Prenotazioni Tennis Monti della Laga - versione Neon/Postgres

Questa versione usa solo Neon/Postgres. Non serve Upstash Redis.

## Struttura corretta su GitHub

Carica i file nella root della repository:

```text
api/
  bookings.js
  history.js
  stats.js
bookings.js
index.html
package.json
vercel.json
README_ISTRUZIONI.md
```

## Variabili ambiente richieste su Vercel

Hai già Neon collegato, quindi di solito hai già:

```text
DATABASE_URL
```

Il codice usa automaticamente, in ordine:

```text
DATABASE_URL
POSTGRES_URL
POSTGRES_PRISMA_URL
POSTGRES_URL_NON_POOLING
```

## Password

La password predefinita per History e Statistiche è:

```text
condominio1041
```

Puoi cambiarla aggiungendo su Vercel:

```text
ADMIN_PASSWORD=nuova_password
```

## Dopo l'upload

1. Carica tutti i file su GitHub.
2. Fai commit su `main`.
3. Vercel farà il deploy.
4. Se non parte, fai `Redeploy`.

## Cosa fa

- Salva prenotazioni su Neon/Postgres.
- Crea automaticamente le tabelle:
  - `bookings`
  - `booking_history`
  - `stats_slots`
- History ultime 20 modifiche.
- Statistiche protette da password.
- Ordinamento statistiche per più ore giocate da sempre.
- Ore ultimi 7 giorni passati.
- Ore usate scorsa settimana.
- Media ore settimanali da sempre.

## Nuova regola modifica prenotazioni

Se una cella è già occupata, non è possibile sostituire direttamente il nominativo. Prima bisogna cancellare la prenotazione esistente, poi inserire il nuovo nome.

## Modifiche in questa versione

- Se provi a sostituire direttamente un nome in una cella già occupata, compare solo il messaggio: `Questa cella è già prenotata`.
- Nel tab Statistiche vengono mostrati solo:
  - ore giocate da sempre per nominativo
  - media ore settimanali da sempre
