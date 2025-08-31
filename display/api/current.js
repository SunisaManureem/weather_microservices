// Vercel Serverless Function: /api/current
import axios from "axios";

const LAT = process.env.LAT || "13.7563";
const LON = process.env.LON || "100.5018";
const TZ  = process.env.TZ  || "Asia/Bangkok";
const LOCATION = process.env.LOCATION || "Bangkok, TH";

const enc = encodeURIComponent;

export default async function handler(req, res) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,weather_code` +
      `&wind_speed_unit=kmh&timezone=${enc(TZ)}`;

    const { data } = await axios.get(url, { timeout: 20000 });

    const c = data?.current || {};
    const shaped = {
      time: c.time ? new Date(c.time).toISOString() : new Date().toISOString(),
      temp: c.temperature_2m ?? null,
      wind: c.wind_speed_10m ?? null,
      humidity: c.relative_humidity_2m ?? null,
      pressure: c.pressure_msl ?? null,
      icon: c.weather_code ?? null,
      source: "open-meteo",
      location: LOCATION,
    };

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(shaped);
  } catch (e) {
    return res.status(500).json({ error: "fetch-failed" });
  }
}
