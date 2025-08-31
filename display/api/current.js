// /display/api/current.js  (Vercel Serverless Function)
const LAT = process.env.LAT || "13.7563";
const LON = process.env.LON || "100.5018";
const TZ  = process.env.TZ  || "Asia/Bangkok";
const LOCATION = process.env.LOCATION || "Bangkok, TH";

export default async function handler(req, res) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,weather_code` +
      `&wind_speed_unit=kmh&timezone=${encodeURIComponent(TZ)}`;

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const j = await r.json();
    const c = j?.current ?? {};

    // ป้องกัน undefined และ normalize เวลาเป็น ISO
    const nowIso = new Date().toISOString();
    const shaped = {
      time: c.time ? new Date(c.time).toISOString() : nowIso,
      temp: c.temperature_2m ?? null,
      wind: c.wind_speed_10m ?? null,
      humidity: c.relative_humidity_2m ?? null,
      pressure: c.pressure_msl ?? null,
      icon: c.weather_code ?? null,
      source: "open-meteo",
      location: LOCATION,
    };

    // กัน cache และเปิด CORS เผื่อเรียกทดสอบตรง ๆ
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(shaped);
  } catch (err) {
    return res.status(500).json({ error: "fetch-failed" });
  }
}
