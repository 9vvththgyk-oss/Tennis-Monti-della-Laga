# Prenotazioni Tennis Monti della Laga

Carica questi file nella root della repository GitHub, non dentro una sottocartella.

La struttura corretta deve essere:

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

## Password

La password predefinita per History e Statistiche è:

```text
condominio1041
```

Puoi cambiarla in Vercel aggiungendo questa Environment Variable:

```text
ADMIN_PASSWORD=nuova_password
```

## Database

Il sito funziona anche senza database Redis, ma i dati potrebbero non restare salvati per sempre.

Per dati persistenti e condivisi devi aggiungere in Vercel:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Importante:
- `UPSTASH_REDIS_REST_URL` deve iniziare con `https://`
- non mettere virgolette
- non mettere spazi
- dopo aver cambiato variabili fai Redeploy

## Cosa include

- calendario prenotazioni
- regole prenotazioni
- history ultime 20 modifiche
- statistiche protette da password
- ordinamento statistiche per più ore giocate da sempre
- media ore settimanali
- ore scorsa settimana
- rolling ultimi 7 giorni passati
