const {
  loadDb,
  saveDb,
  json,
  addHistory,
  validateBookingRules
} = require("../bookings.js");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const db = await loadDb();
      return json(res, 200, { bookings: db.bookings || {} });
    }

    if (req.method === "POST") {
      const db = await loadDb();
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const key = String(body.key || "");
      const surname = String(body.surname || "");

      if (!key || !key.includes("_")) {
        return json(res, 400, { error: "Cella non valida." });
      }

      const oldSurname = (db.bookings || {})[key] || "";

      if (surname === oldSurname) {
        return json(res, 200, { bookings: db.bookings || {} });
      }

      const ruleError = validateBookingRules(db, key, surname, oldSurname);
      if (ruleError) {
        return json(res, 400, { error: ruleError });
      }

      db.bookings = db.bookings || {};
      db.statsSlots = db.statsSlots || {};

      if (surname) {
        db.bookings[key] = surname;
      } else {
        delete db.bookings[key];
      }

      if (surname && surname !== "Torneo Condominiale") {
        db.statsSlots[key] = surname;
      } else {
        delete db.statsSlots[key];
      }

      addHistory(db, key, oldSurname, surname);
      await saveDb(db);

      return json(res, 200, { bookings: db.bookings || {} });
    }

    return json(res, 405, { error: "Metodo non consentito" });
  } catch (error) {
    return json(res, 500, { error: error.message || "Errore server" });
  }
};
