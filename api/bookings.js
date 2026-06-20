const {
  json,
  getBookings,
  saveBooking
} = require("../bookings.js");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const bookings = await getBookings();
      return json(res, 200, { bookings });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const key = String(body.key || "");
      const surname = String(body.surname || "");

      if (!key || !key.includes("_")) {
        return json(res, 400, { error: "Cella non valida." });
      }

      const bookings = await saveBooking(key, surname);
      return json(res, 200, { bookings });
    }

    return json(res, 405, { error: "Metodo non consentito" });
  } catch (error) {
    console.error("API /bookings error:", error);
    return json(res, error.statusCode || 500, { error: error.message || "Errore server" });
  }
};
