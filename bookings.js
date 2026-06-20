const { Pool } = require("pg");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "condominio1041";

const SURNAMES = [
  "AZZARO","AZZOLINI Antonella","BERNARDIS / Di BARTOLOMEI",
  "BRUNO/AZZOLINI","CAMPLANI","CARPINELLI","CHUNG","COSTANTINI",
  "CUPPARI","D'AMOJA","DE ANTONI","DE BELLO","DE BIASE",
  "DE GREGORIO","DI BARTOLOMEI","DI NAPOLI","FISCHER",
  "GALLIZIOLI / MARENZANA","GALLIZIOLI Paola","GIORGINI",
  "GRANDOLINI","LANARI","LAZZARI","LEFEMINE","LEONE",
  "LOMBARDO Maria Rosaria e Gabriella","LOMBARDO Paola",
  "MANDELLI","MESSINA Manuela","MESSINA Marco","MORAZZO",
  "PEPE Francesco","PEPE Valeria","PEZZOLI","PINARELLO",
  "POCCIONI/ATANASIO","REGGIANI","RINALDI RINCON",
  "SACCHETTI","SCHIAFFINI","SCHIAVETTI","SINI",
  "TOMBOLINI","VENTURINI","ZACCARELLI","Torneo Condominiale"
];

let pool;
let initialized = false;

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ""
  );
}

function getPool() {
  if (!pool) {
    const connectionString = getConnectionString();

    if (!connectionString) {
      throw new Error("DATABASE_URL non configurato su Vercel.");
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000
    });
  }

  return pool;
}

async function initDb() {
  if (initialized) return;

  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      key TEXT PRIMARY KEY,
      surname TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS booking_history (
      id BIGSERIAL PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      key TEXT NOT NULL,
      old_surname TEXT,
      new_surname TEXT,
      text TEXT NOT NULL
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS stats_slots (
      key TEXT PRIMARY KEY,
      surname TEXT NOT NULL,
      played_date DATE NOT NULL,
      hour INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  initialized = true;
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function requireAdmin(req, res) {
  const password = req.headers["x-admin-password"] || "";

  if (password !== ADMIN_PASSWORD) {
    json(res, 401, { error: "Password errata" });
    return false;
  }

  return true;
}

function parseKey(key) {
  const [date, hour] = String(key || "").split("_");
  return {
    date,
    hour: Number(hour)
  };
}

function formatDateIt(dateStr) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);

  if (!y || !m || !d) {
    return dateStr;
  }

  return new Date(y, m - 1, d).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function makeHistoryText(key, oldSurname, newSurname) {
  const { date, hour } = parseKey(key);

  const now = new Date();
  const time = now.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome"
  });

  const dateText = formatDateIt(date);
  const hourText = String(hour).padStart(2, "0") + ":00";

  if (newSurname && !oldSurname) {
    return `alle ${time} qualcuno ha inserito il nome "${newSurname}" nella cella del ${dateText} alle ${hourText}`;
  }

  if (!newSurname && oldSurname) {
    return `alle ${time} qualcuno ha cancellato il nome "${oldSurname}" dalla cella del ${dateText} alle ${hourText}`;
  }

  return `alle ${time} qualcuno ha sostituito "${oldSurname}" con "${newSurname}" nella cella del ${dateText} alle ${hourText}`;
}

async function getBookings() {
  await initDb();

  const result = await getPool().query(`
    SELECT key, surname
    FROM bookings
    ORDER BY key ASC;
  `);

  const bookings = {};
  for (const row of result.rows) {
    bookings[row.key] = row.surname;
  }

  return bookings;
}

async function getOldSurname(key) {
  await initDb();

  const result = await getPool().query(
    "SELECT surname FROM bookings WHERE key = $1;",
    [key]
  );

  return result.rows[0]?.surname || "";
}

async function validateBookingRules(key, surname) {
  if (!surname || surname === "Torneo Condominiale") return null;

  const { date, hour } = parseKey(key);

  if (!date || !hour) {
    return "Cella non valida.";
  }

  const sameDay = await getPool().query(
    `
    SELECT COUNT(*)::int AS count
    FROM bookings
    WHERE key <> $1
      AND surname = $2
      AND split_part(key, '_', 1) = $3;
    `,
    [key, surname, date]
  );

  if (sameDay.rows[0].count >= 2) {
    return "Massimo 2 ore al giorno per nominativo.";
  }

  const fiveDayWindow = await getPool().query(
    `
    WITH windows AS (
      SELECT
        gs::date AS window_start,
        (gs::date + INTERVAL '4 days')::date AS window_end
      FROM generate_series(
        $3::date - INTERVAL '4 days',
        $3::date,
        INTERVAL '1 day'
      ) AS gs
    )
    SELECT
      w.window_start,
      w.window_end,
      COUNT(b.key)::int AS existing_count
    FROM windows w
    LEFT JOIN bookings b
      ON b.key <> $1
      AND b.surname = $2
      AND split_part(b.key, '_', 1)::date BETWEEN w.window_start AND w.window_end
    GROUP BY w.window_start, w.window_end
    ORDER BY w.window_start ASC;
    `,
    [key, surname, date]
  );

  const blockedWindow = fiveDayWindow.rows.find(row => row.existing_count + 1 > 4);

  if (blockedWindow) {
    const windowStart = blockedWindow.window_start instanceof Date
      ? blockedWindow.window_start.toISOString().slice(0, 10)
      : String(blockedWindow.window_start).slice(0, 10);
    const windowEnd = blockedWindow.window_end instanceof Date
      ? blockedWindow.window_end.toISOString().slice(0, 10)
      : String(blockedWindow.window_end).slice(0, 10);
    const startText = formatDateIt(windowStart);
    const endText = formatDateIt(windowEnd);
    return `Massimo 4 ore in qualunque finestra di 5 giorni consecutivi. Dal ${startText} al ${endText} questo nominativo supererebbe il limite.`;
  }

  return null;
}

async function saveBooking(key, surname) {
  await initDb();

  const { date, hour } = parseKey(key);

  if (!date || !hour) {
    throw new Error("Cella non valida.");
  }

  const oldSurname = await getOldSurname(key);

  if (surname === oldSurname) {
    return getBookings();
  }

  if (oldSurname && surname) {
    const error = new Error("Questa cella è già prenotata");
    error.statusCode = 400;
    throw error;
  }

  const ruleError = await validateBookingRules(key, surname);
  if (ruleError) {
    const error = new Error(ruleError);
    error.statusCode = 400;
    throw error;
  }

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    if (surname) {
      await client.query(
        `
        INSERT INTO bookings (key, surname, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key)
        DO UPDATE SET surname = EXCLUDED.surname, updated_at = NOW();
        `,
        [key, surname]
      );
    } else {
      await client.query("DELETE FROM bookings WHERE key = $1;", [key]);
    }

    if (surname && surname !== "Torneo Condominiale") {
      await client.query(
        `
        INSERT INTO stats_slots (key, surname, played_date, hour, updated_at)
        VALUES ($1, $2, $3::date, $4, NOW())
        ON CONFLICT (key)
        DO UPDATE SET surname = EXCLUDED.surname, played_date = EXCLUDED.played_date, hour = EXCLUDED.hour, updated_at = NOW();
        `,
        [key, surname, date, hour]
      );
    } else {
      await client.query("DELETE FROM stats_slots WHERE key = $1;", [key]);
    }

    await client.query(
      `
      INSERT INTO booking_history (key, old_surname, new_surname, text)
      VALUES ($1, $2, $3, $4);
      `,
      [key, oldSurname || null, surname || null, makeHistoryText(key, oldSurname, surname)]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getBookings();
}

async function getHistory() {
  await initDb();

  const result = await getPool().query(`
    SELECT ts, key, old_surname AS "oldSurname", new_surname AS "newSurname", text
    FROM booking_history
    ORDER BY ts DESC, id DESC
    LIMIT 40;
  `);

  return result.rows;
}

async function computeStats() {
  await initDb();

  const totals = await getPool().query(`
    SELECT surname, COUNT(*)::int AS total_hours
    FROM stats_slots
    WHERE surname <> 'Torneo Condominiale'
    GROUP BY surname;
  `);

  const rolling = await getPool().query(`
    SELECT surname, COUNT(*)::int AS rolling_hours
    FROM stats_slots
    WHERE surname <> 'Torneo Condominiale'
      AND played_date >= (CURRENT_DATE - INTERVAL '7 days')
      AND played_date < CURRENT_DATE
    GROUP BY surname;
  `);

  const lastWeek = await getPool().query(`
    SELECT COUNT(*)::int AS hours
    FROM stats_slots
    WHERE surname <> 'Torneo Condominiale'
      AND played_date >= date_trunc('week', CURRENT_DATE)::date - INTERVAL '7 days'
      AND played_date < date_trunc('week', CURRENT_DATE)::date;
  `);

  const average = await getPool().query(`
    WITH weekly AS (
      SELECT date_trunc('week', played_date)::date AS week_start, COUNT(*)::int AS hours
      FROM stats_slots
      WHERE surname <> 'Torneo Condominiale'
      GROUP BY week_start
    )
    SELECT COALESCE(AVG(hours), 0)::float AS average
    FROM weekly;
  `);

  const summary = await getPool().query(`
    WITH base AS (
      SELECT played_date
      FROM stats_slots
      WHERE surname <> 'Torneo Condominiale'
    ), bounds AS (
      SELECT
        date_trunc('week', MIN(played_date))::date AS first_week_start,
        date_trunc('week', CURRENT_DATE)::date AS current_week_start,
        COUNT(*)::int AS total_hours
      FROM base
    )
    SELECT
      COALESCE(total_hours, 0)::int AS total_hours,
      CASE
        WHEN total_hours = 0 THEN 0
        ELSE GREATEST(
          0,
          FLOOR(EXTRACT(DAY FROM (current_week_start - first_week_start)) / 7)
        )::int
      END AS total_past_weeks
    FROM bounds;
  `);

  const totalMap = new Map();
  const rollingMap = new Map();

  for (const row of totals.rows) {
    totalMap.set(row.surname, row.total_hours);
  }

  for (const row of rolling.rows) {
    rollingMap.set(row.surname, row.rolling_hours);
  }

  const byName = SURNAMES
    .filter(name => name !== "Torneo Condominiale")
    .map(name => ({
      name,
      totalHours: totalMap.get(name) || 0,
      rolling7PastHours: rollingMap.get(name) || 0
    }))
    .sort((a, b) => {
      if (b.totalHours !== a.totalHours) return b.totalHours - a.totalHours;
      return a.name.localeCompare(b.name, "it");
    });

  return {
    byName,
    lastWeekHours: lastWeek.rows[0]?.hours || 0,
    averageWeeklyHours: Number(average.rows[0]?.average || 0),
    totalHoursAllTime: summary.rows[0]?.total_hours || 0,
    totalPastWeeks: summary.rows[0]?.total_past_weeks || 0
  };
}

module.exports = {
  ADMIN_PASSWORD,
  SURNAMES,
  json,
  requireAdmin,
  getBookings,
  saveBooking,
  getHistory,
  computeStats
};
