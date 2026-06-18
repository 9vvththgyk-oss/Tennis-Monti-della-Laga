const { sql } = require('@vercel/postgres');

const TORNEO_EXEMPT = 'Torneo Condominiale';

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS tennis_bookings (
      slot_key TEXT PRIMARY KEY,
      booking_date DATE NOT NULL,
      booking_hour INTEGER NOT NULL,
      surname TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function parseSlotKey(slotKey) {
  const match = /^(\d{4}-\d{2}-\d{2})_(\d{1,2})$/.exec(slotKey || '');
  if (!match) return null;
  const hour = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 7 || hour > 21) return null;
  return { date: match[1], hour };
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  try {
    await ensureTable();

    if (req.method === 'GET') {
      const result = await sql`SELECT slot_key, surname FROM tennis_bookings ORDER BY booking_date, booking_hour`;
      const bookings = {};
      for (const row of result.rows) bookings[row.slot_key] = row.surname;
      return send(res, 200, { bookings });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return send(res, 405, { error: 'Metodo non consentito' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const slotKey = body.key;
    const surname = String(body.surname || '').trim();
    const parsed = parseSlotKey(slotKey);

    if (!parsed) return send(res, 400, { error: 'Slot non valido' });

    if (!surname) {
      await sql`DELETE FROM tennis_bookings WHERE slot_key = ${slotKey}`;
      return send(res, 200, { ok: true });
    }

    const occupied = await sql`SELECT surname FROM tennis_bookings WHERE slot_key = ${slotKey}`;
    if (occupied.rowCount && occupied.rows[0].surname !== surname) {
      return send(res, 409, { error: `Slot già occupato da: ${occupied.rows[0].surname}` });
    }

    if (surname !== TORNEO_EXEMPT) {
      const daily = await sql`
        SELECT COUNT(*)::int AS count
        FROM tennis_bookings
        WHERE surname = ${surname}
          AND booking_date = ${parsed.date}
          AND slot_key <> ${slotKey}
      `;
      if (daily.rows[0].count >= 2) {
        return send(res, 400, { error: 'Massimo 2 ore al giorno per persona.' });
      }

      const last5 = await sql`
        SELECT COUNT(*)::int AS count
        FROM tennis_bookings
        WHERE surname = ${surname}
          AND booking_date BETWEEN (${parsed.date}::date - INTERVAL '4 days') AND ${parsed.date}::date
          AND slot_key <> ${slotKey}
      `;
      if (last5.rows[0].count >= 4) {
        return send(res, 400, { error: 'Non puoi aggiungere questa prenotazione: nei 5 giorni fino alla data selezionata sono già presenti 4 ore o più per questo nominativo.' });
      }
    }

    await sql`
      INSERT INTO tennis_bookings (slot_key, booking_date, booking_hour, surname, updated_at)
      VALUES (${slotKey}, ${parsed.date}, ${parsed.hour}, ${surname}, NOW())
      ON CONFLICT (slot_key)
      DO UPDATE SET surname = EXCLUDED.surname, updated_at = NOW()
    `;

    return send(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: 'Errore server/database. Controlla che il database Postgres sia collegato su Vercel.' });
  }
};
