// Vercel Serverless Function: /api/forecast
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
      `&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code` +
      `&wind_speed_unit=kmh&timezone=${enc(TZ)}`;

    const { data } = await axios.get(url, { timeout: 20000 });

    const hourly = (data?.hourly?.time || []).map((t, i) => ({
      time: new Date(t).getTime(),
      temp: Number(data.hourly.temperature_2m?.[i] ?? null),
      icon: data.hourly.weather_code?.[i] ?? null,
    }));

    const daily = (data?.daily?.time || []).map((d, i) => ({
      date: d,
      min: Number(data.daily.temperature_2m_min?.[i] ?? null),
      max: Number(data.daily.temperature_2m_max?.[i] ?? null),
      icon: data.daily.weather_code?.[i] ?? null,
    }));

    return res.status(200).json({
      location: LOCATION,
      hourly,
      daily,
    });
  } catch (_e) {
    return res.status(500).json({ error: "forecast-failed" });
  }
}
