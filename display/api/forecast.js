// /display/api/forecast.js
const LAT = process.env.LAT || "13.7563";
const LON = process.env.LON || "100.5018";
const TZ  = process.env.TZ  || "Asia/Bangkok";
const LOCATION = process.env.LOCATION || "Bangkok, TH";

export default async function handler(req, res) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&hourly=temperature_2m,weather_code` +
      `&daily=temperature_2m_min,temperature_2m_max,weather_code` +
      `&timezone=${encodeURIComponent(TZ)}`;

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const j = await r.json();

    const hourly = (j.hourly?.time ?? []).map((t, i) => ({
      time: t,
      temp: j.hourly?.temperature_2m?.[i] ?? null,
      icon: j.hourly?.weather_code?.[i] ?? null,
    }));

    const daily = (j.daily?.time ?? []).map((d, i) => ({
      date: d,
      min: j.daily?.temperature_2m_min?.[i] ?? null,
      max: j.daily?.temperature_2m_max?.[i] ?? null,
      icon: j.daily?.weather_code?.[i] ?? null,
    }));

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ hourly, daily, source: "open-meteo", location: LOCATION });
  } catch {
    return res.status(500).json({ error: "fetch-failed" });
  }
}
