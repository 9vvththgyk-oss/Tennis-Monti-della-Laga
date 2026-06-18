# Prenotazioni Tennis Condominio - Vercel

Questa versione salva le prenotazioni in un database condiviso: tutti vedono e modificano gli stessi dati.

## Come pubblicarlo

1. Crea una repository GitHub e carica tutti questi file.
2. Vai su Vercel e importa la repository.
3. Nel progetto Vercel aggiungi un database Postgres dal Marketplace/Storage.
4. Verifica che Vercel abbia creato le variabili `POSTGRES_URL` oppure `DATABASE_URL`.
5. Fai Redeploy.

## Regole incluse

- Nessuna password amministratore.
- Qualsiasi utente può aggiungere, modificare o cancellare prenotazioni.
- Massimo 2 ore al giorno per nominativo.
- Massimo 4 ore nei 5 giorni fino alla data selezionata inclusa.
- `Torneo Condominiale` è escluso dai limiti.
- Celle bianche se libere, verdi se prenotate.
- I nomi lunghi vengono mostrati completi con testo che si riduce automaticamente.

## Nota

Il database parte vuoto. Se usi un database già usato prima, i dati presenti nella tabella `tennis_bookings` resteranno visibili.
