
const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const API_KEY = process.env.API_KEY;

async function setupDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS equipped_units (
      user_id BIGINT PRIMARY KEY,
      units JSONB NOT NULL DEFAULT '[]'::jsonb
    )
  `);
}

function authenticate(req, res, next) {
  if (!API_KEY || req.headers["x-api-key"] !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/", (req, res) => {
  res.json({ status: "Roblox Unit API is running" });
});

app.get("/v1/equipped/:userId", authenticate, async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!/^\d+$/.test(userId)) {
      return res.status(400).json({ error: "Invalid UserId" });
    }

    const result = await pool.query(
      "SELECT units FROM equipped_units WHERE user_id = $1",
      [userId]
    );

    res.json({
      units: result.rows[0]?.units || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/v1/equipped/:userId", authenticate, async (req, res) => {
  try {
    const userId = req.params.userId;
    const units = req.body.units;

    if (!/^\d+$/.test(userId)) {
      return res.status(400).json({ error: "Invalid UserId" });
    }

    if (!Array.isArray(units) || units.length > 5) {
      return res.status(400).json({ error: "Maximum 5 units" });
    }

    for (const unit of units) {
      if (
        !unit ||
        typeof unit.Unit !== "string" ||
        typeof unit.UnitID !== "string"
      ) {
        return res.status(400).json({ error: "Invalid unit data" });
      }
    }

    await pool.query(
      `INSERT INTO equipped_units (user_id, units)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (user_id)
       DO UPDATE SET units = EXCLUDED.units`,
      [userId, JSON.stringify(units)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;

setupDatabase()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log("Roblox Unit API running on port " + PORT);
    });
  })
  .catch(error => {
    console.error("Database setup failed:", error);
    process.exit(1);
  });
