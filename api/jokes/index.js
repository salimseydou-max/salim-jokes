import { getJokes, toSafeRouteError } from "../../lib/database.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const filters = req.query && typeof req.query === "object" ? req.query : {};
    const result = await getJokes(filters);
    return res.status(200).json({
      jokes: result.jokes,
      total: result.total,
      filters: result.filters,
      cached: result.cached,
    });
  } catch (error) {
    console.error("GET /api/jokes failed:", error);
    const safe = toSafeRouteError(error);
    return res.status(safe.status).json(safe.body);
  }
}
