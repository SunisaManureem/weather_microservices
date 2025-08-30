require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(morgan('tiny'));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017';
const DB_NAME   = process.env.DB_NAME   || 'weatherdb';
const PORT      = process.env.PORT      || 3000;

let db, coll;

// ---------- helpers ----------
function pickNumber(v) {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// ---------- health ----------
app.get('/healthz', (_req, res) => {
  res.status(coll ? 200 : 503).json({ ok: !!coll });
});

// ---------- routes ----------
app.post('/weather', async (req, res) => {
  try {
    if (!coll) return res.status(503).json({ error: 'db not ready' }); // กันเหนียว
    const b = req.body || {};
    const doc = {
      timestamp: b.timestamp || new Date().toISOString(),
      temperature: pickNumber(b.temperature),
      windspeed:   pickNumber(b.windspeed),
      humidity:    pickNumber(b.humidity),
      pressure:    pickNumber(b.pressure),
      icon:        b.icon || undefined,
      source:      b.source || 'open-meteo',
      created_at:  new Date()
    };

    await coll.insertOne(doc);
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error('[CRUD] POST /weather error', e);
    res.status(500).json({ error: 'insert failed' });
  }
});

app.get('/weather', async (req, res) => {
  try {
    if (!coll) return res.status(503).json({ error: 'db not ready' }); // กันเหนียว
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 200);
    const rows = await coll.find({})
      .project({ raw: 0 })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    res.json(rows);
  } catch (e) {
    console.error('[CRUD] GET /weather error', e);
    res.status(500).json({ error: 'query failed' });
  }
});

// ---------- bootstrap DB แล้วค่อยเริ่มฟังพอร์ต ----------
(async () => {
  try {
    const client = new MongoClient(MONGO_URI, { ignoreUndefined: true });
    await client.connect();
    db = client.db(DB_NAME);
    coll = db.collection('weather');
    await coll.createIndex({ timestamp: -1 });

    console.log(`[CRUD] connected to ${MONGO_URI}/${DB_NAME}`);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[CRUD] listening on ${PORT}`);
    });
  } catch (err) {
    console.error('[CRUD] DB connect error', err);
    process.exit(1);
  }
})();
