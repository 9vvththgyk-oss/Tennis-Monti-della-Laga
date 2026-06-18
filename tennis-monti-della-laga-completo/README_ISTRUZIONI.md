# Prenotazioni Tennis Monti della Laga

## File inclusi

- `index.html`: sito completo con calendario, history e statistiche.
- `api/bookings.js`: API prenotazioni.
- `api/history.js`: API history protetta.
- `api/stats.js`: API statistiche protetta.
- `bookings.js`: logica condivisa, database, history, statistiche e regole.
- `package.json`
- `vercel.json`

## Password

La password predefinita per History e Statistiche è:

```text
condominio1041
```

Puoi cambiarla da Vercel aggiungendo una variabile d'ambiente:

```text
ADMIN_PASSWORD=nuova_password
```

## Database condiviso

Per avere dati persistenti e condivisi tra tutti devi creare un database Redis Upstash e aggiungere su Vercel queste variabili d'ambiente:

```text
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Senza queste variabili il sito funziona solo in memoria temporanea sul server, quindi i dati possono perdersi quando Vercel riavvia la funzione.

## Cosa fa

- Calendario prenotazioni condiviso.
- History delle ultime 20 modifiche condivisa.
- Statistiche protette da password.
- Conteggio ore da sempre per nominativo.
- Ore usate nella scorsa settimana.
- Media ore settimanali da sempre.
- Rolling degli ultimi 7 giorni passati.
- Il Torneo Condominiale non viene contato nei limiti e nelle statistiche.

## Come caricare su GitHub

1. Svuota la repository o sostituisci i file attuali.
2. Carica tutti i file contenuti in questa cartella.
3. Fai commit.
4. Su Vercel aggiungi le variabili Upstash indicate sopra.
5. Redeploy.
