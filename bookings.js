const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "condominio1041";
const DB_KEY = "tennis_monti_laga_db_v2";

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

let memoryDb = { bookings: {}, history: [], statsSlots: {} };

function hasValidRedisEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  if (!url.startsWith("https://")) return false;
  if (url.includes('"') || url.includes("'") || url.includes(" ")) return false;
  if (token.includes('"') || token.includes("'") || token.includes(" ")) return false;
  return true;
}

async function redisCommand(command, ...args) {
  if (!hasValidRedisEnv()) return null;

  try {
    const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([command, ...args])
    });

    let data;
    try {
      data = await response.json();
    } catch {
      return null;
    }

    if (!response.ok) {
      console.error("Redis error:", data);
      return null;
    }

    return data.result;
  } catch (error) {
    console.error("Redis connection failed:", error.message);
    return null;
  }
}

async function loadDb() {
  const stored = await redisCommand("GET", DB_KEY);

  if (!stored) return memoryDb;

  try {
    const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
    return {
      bookings: parsed.bookings || {},
      history: parsed.history || [],
      statsSlots: parsed.statsSlots || {}
    };
  } catch {
    return memoryDb;
  }
}

async function saveDb(db) {
  const clean = {
    bookings: db.bookings || {},
    history: (db.history || []).slice(0, 20),
    statsSlots: db.statsSlots || {}
  };

  const saved = await redisCommand("SET", DB_KEY, JSON.stringify(clean));

  if (saved === null) {
    memoryDb = clean;
  }

  return clean;
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
  return { date, hour: Number(hour) };
}

function formatDateIt(dateStr) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return dateStr;
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

function addHistory(db, key, oldSurname, newSurname) {
  db.history = db.history || [];
  db.history.unshift({
    ts: new Date().toISOString(),
    key,
    oldSurname,
    newSurname,
    text: makeHistoryText(key, oldSurname, newSurname)
  });
  db.history = db.history.slice(0, 20);
}

function getWeekStartMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function computeStats(db) {
  const statsSlots = db.statsSlots || {};
  const names = SURNAMES.filter(name => name !== "Torneo Condominiale");

  const byNameMap = {};
  names.forEach(name => {
    byNameMap[name] = { name, totalHours: 0, rolling7PastHours: 0 };
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const rollingStart = new Date(today);
  rollingStart.setDate(rollingStart.getDate() - 7);

  const thisMonday = getWeekStartMonday(today);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);

  let lastWeekHours = 0;
  const weeklyTotals = {};

  for (const [key, name] of Object.entries(statsSlots)) {
    if (!name || name === "Torneo Condominiale") continue;

    if (!byNameMap[name]) {
      byNameMap[name] = { name, totalHours: 0, rolling7PastHours: 0 };
    }

    const { date } = parseKey(key);
    const d = new Date(`${date}T00:00:00`);
    if (Number.isNaN(d.getTime())) continue;

    byNameMap[name].totalHours += 1;

    if (d >= rollingStart && d < today) {
      byNameMap[name].rolling7PastHours += 1;
    }

    if (d >= lastMonday && d < thisMonday) {
      lastWeekHours += 1;
    }

    const weekStart = isoDate(getWeekStartMonday(d));
    weeklyTotals[weekStart] = (weeklyTotals[weekStart] || 0) + 1;
  }

  const weekValues = Object.values(weeklyTotals);
  const averageWeeklyHours = weekValues.length
    ? weekValues.reduce((a, b) => a + b, 0) / weekValues.length
    : 0;

  return {
    byName: Object.values(byNameMap).sort((a, b) => {
      if (b.totalHours !== a.totalHours) return b.totalHours - a.totalHours;
      return a.name.localeCompare(b.name, "it");
    }),
    lastWeekHours,
    averageWeeklyHours
  };
}

function validateBookingRules(db, key, surname) {
  if (!surname || surname === "Torneo Condominiale") return null;

  const { date, hour } = parseKey(key);

  if (!date || !hour) {
    return "Cella non valida.";
  }

  const sameDayHours = Object.entries(db.bookings || {}).filter(([k, name]) => {
    if (k === key) return false;
    const parsed = parseKey(k);
    return parsed.date === date && name === surname;
  }).length;

  if (sameDayHours >= 2) {
    return "Massimo 2 ore al giorno per nominativo.";
  }

  const chosen = new Date(`${date}T00:00:00`);
  const start = new Date(chosen);
  start.setDate(start.getDate() - 4);

  const fiveDayHours = Object.entries(db.bookings || {}).filter(([k, name]) => {
    if (k === key) return false;
    if (name !== surname) return false;

    const parsed = parseKey(k);
    const d = new Date(`${parsed.date}T00:00:00`);
    return d >= start && d <= chosen;
  }).length;

  if (fiveDayHours >= 4) {
    return "Nei 5 giorni fino alla data scelta compresa, questo nominativo ha già 4 ore prenotate.";
  }

  return null;
}

module.exports = {
  ADMIN_PASSWORD,
  SURNAMES,
  loadDb,
  saveDb,
  json,
  requireAdmin,
  addHistory,
  computeStats,
  validateBookingRules
};
