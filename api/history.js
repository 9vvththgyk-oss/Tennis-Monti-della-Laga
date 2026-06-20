const {
  json,
  requireAdmin,
  getHistory
} = require("../bookings.js");

module.exports = async function handler(req, res) {
  try {
    if (!requireAdmin(req, res)) return;

    const history = await getHistory();
    return json(res, 200, { history });
  } catch (error) {
    console.error("API /history error:", error);
    return json(res, 500, { error: error.message || "Errore server" });
  }
};
