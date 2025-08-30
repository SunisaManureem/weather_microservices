// display/index.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();

const PORT = process.env.PORT || 8080;

// พิกัด/โซนเวลา/ชื่อเมืองสำหรับพยากรณ์
const LAT = process.env.LAT || '13.7563';
const LON = process.env.LON || '100.5018';
const TZ  = process.env.TZ  || 'Asia/Bangkok';
const LOCATION = process.env.LOCATION || 'Bangkok, TH';

/* ======================================================
 * Utils
 * ====================================================== */
function normalizeRow(x) {
  return {
    time:     x.time ?? x.timestamp ?? Date.now(),
    temp:     x.temp ?? x.temperature ?? null,
    wind:     x.wind ?? x.windspeed ?? null,
    humidity: x.humidity ?? null,
    pressure: x.pressure ?? null,
    source:   x.source || 'open-meteo',
    icon:     x.icon ?? null, // อาจเป็น weather_code (ตัวเลข) หรือข้อความ
  };
}

/* ======================================================
 * 1) APIs สำหรับหน้าเว็บ (ดึงจาก Open-Meteo โดยตรง)
 * ====================================================== */

// /api/current : สภาพอากาศปัจจุบัน
app.get('/api/current', async (req, res) => {
  try {
    // เรียก current+hourly ใกล้ ๆ ตอนนี้ เพื่อได้ humidity/pressure ด้วย
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,weather_code` +
      `&windspeed_unit=kmh&timezone=${encodeURIComponent(TZ)}`;

    const { data: j } = await axios.get(url, { timeout: 20000 });
    const c = j.current || {};
    const shaped = normalizeRow({
      time: c.time,
      temp: c.temperature_2m,
      wind: c.wind_speed_10m,
      humidity: c.relative_humidity_2m,
      pressure: c.pressure_msl,
      icon: c.weather_code, // เป็นตัวเลข
      source: 'open-meteo',
    });

    shaped.timezone = j.timezone || TZ;
    shaped.location = LOCATION;

    res.json(shaped);
  } catch (e) {
    console.error('[display] /api/current error:', e.message);
    res.status(500).json({ error: 'current error' });
  }
});

// /api/forecast : พยากรณ์รายชั่วโมง/รายสัปดาห์
app.get('/api/forecast', async (req, res) => {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&hourly=temperature_2m,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
      `&forecast_days=10&windspeed_unit=kmh&timezone=${encodeURIComponent(TZ)}`;

    const { data: j } = await axios.get(url, { timeout: 20000 });

    const hourlyTimes = Array.isArray(j.hourly?.time) ? j.hourly.time : [];
    const dailyTimes  = Array.isArray(j.daily?.time)  ? j.daily.time  : [];

    const hourly = hourlyTimes.map((t, i) => ({
      time: t,
      temp: j.hourly?.temperature_2m?.[i] ?? null,
      wind: j.hourly?.wind_speed_10m?.[i] ?? null,
      icon: j.hourly?.weather_code?.[i] ?? null, // code เป็นตัวเลข
    }));

    const daily = dailyTimes.map((d, i) => ({
      date: d,
      min:  j.daily?.temperature_2m_min?.[i] ?? null,
      max:  j.daily?.temperature_2m_max?.[i] ?? null,
      pop:  j.daily?.precipitation_probability_max?.[i] ?? null, // %
      icon: j.daily?.weather_code?.[i] ?? null,
    }));

    res.json({
      source: 'open-meteo',
      timezone: j.timezone || TZ,
      location: LOCATION,
      hourly, daily,
    });
  } catch (e) {
    console.error('[display] /api/forecast error:', e.message);
    res.status(500).json({ error: 'forecast error' });
  }
});

/* ======================================================
 * 2) หน้า static
 * ====================================================== */
app.use(express.static('public'));

/* ======================================================
 * 3) SSE (ดึงค่า current รอบ ๆ ทุก 60 วิ แล้ว broadcast)
 * ====================================================== */
let sseClients = [];
app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write(`event: hello\ndata: "connected"\n\n`);

  const client = { id: Date.now(), res };
  sseClients.push(client);

  // ยิงค่าปัจจุบันให้ทันทีหนึ่งครั้ง
  pullCurrentOnce()
    .then((p) => p && res.write(`data: ${JSON.stringify(p)}\n\n`))
    .catch(() => {});

  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== client);
  });
});

async function pullCurrentOnce() {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,weather_code` +
      `&windspeed_unit=kmh&timezone=${encodeURIComponent(TZ)}`;
    const { data: j } = await axios.get(url, { timeout: 20000 });
    const c = j.current || {};
    return normalizeRow({
      time: c.time,
      temp: c.temperature_2m,
      wind: c.wind_speed_10m,
      humidity: c.relative_humidity_2m,
      pressure: c.pressure_msl,
      icon: c.weather_code,
      source: 'open-meteo',
    });
  } catch {
    return null;
  }
}

let lastSentKey = null;
setInterval(async () => {
  const p = await pullCurrentOnce();
  if (!p) return;
  const key = `${p.time}-${p.temp}-${p.wind}`;
  if (key !== lastSentKey) {
    lastSentKey = key;
    const msg = `data: ${JSON.stringify(p)}\n\n`;
    sseClients.forEach(c => c.res.write(msg));
  } else {
    // keepalive
    sseClients.forEach(c => c.res.write(': keepalive\n\n'));
  }
}, 60 * 1000);

app.listen(PORT, () => {
  console.log(`Display service running on ${PORT}`);
});
