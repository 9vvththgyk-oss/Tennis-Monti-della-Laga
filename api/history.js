const { loadDb, json, requireAdmin } = require("../bookings.js");

module.exports = async function handler(req, res) {
  try {
    if (!requireAdmin(req, res)) return;
    const db = await loadDb();
    return json(res, 200, { history: (db.history || []).slice(0, 20) });
  } catch (error) {
    return json(res, 500, { error: error.message || "Errore server" });
  }
};
