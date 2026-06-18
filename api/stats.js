const { loadDb, json, requireAdmin, computeStats } = require("../bookings.js");

module.exports = async function handler(req, res) {
  try {
    if (!requireAdmin(req, res)) return;

    const db = await loadDb();
    return json(res, 200, { stats: computeStats(db) });
  } catch (error) {
    console.error("API /stats error:", error);
    return json(res, 500, { error: error.message || "Errore server" });
  }
};
