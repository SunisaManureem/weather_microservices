// fetcher/index.js
require('dotenv').config();
const axios = require('axios');
const https = require('https');
const cron = require('node-cron');

const CRUD_URL = process.env.CRUD_URL || 'http://crud:3000/weather';
const LAT = process.env.LAT || '13.7563';
const LON = process.env.LON || '100.5018';
const TZ  = process.env.TZ  || 'Asia/Bangkok';
const SCHEDULE = process.env.SCHEDULE || '*/5 * * * *';

const httpsAgent = new https.Agent({ family: 4, keepAlive: true });

async function httpGet(url, { retries = 2, timeout = 20000 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.get(url, {
        httpsAgent,
        timeout,
        headers: { 'User-Agent': 'weather-fetcher/1.0' }
      });
    } catch (err) {
      lastErr = err;
      const code = err.code || err.cause?.code;
      const retriable = ['ETIMEDOUT','ENETUNREACH','ECONNRESET','EAI_AGAIN','ECONNABORTED'].includes(code);
      if (!retriable || i === retries) break;
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

function wxCodeToIcon(code){
  if ([51,53,55,61,63,65,80,81,82].includes(code)) return 'rain';
  if ([95,96,99].includes(code)) return 'thunder';
  if ([45,48].includes(code)) return 'cloud';
  if ([1,2,3].includes(code)) return 'partly';
  if (code === 0) return 'clear';
  return 'cloud';
}

async function fetchWeatherAndSend() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,weather_code` +
    `&timezone=${encodeURIComponent(TZ)}&windspeed_unit=kmh`;
  console.log('[fetcher] Fetching URL:', url, ' now=', new Date().toISOString());

  try {
    const resp = await httpGet(url);
    const cur = resp.data?.current || {};          // current.* ของ Open-Meteo (เวลาที่นี่เป็น local TZ, ไม่มี Z)
    const nowIsoUtc = new Date().toISOString();    // 👉 ใช้เวลาจริงของเครื่องเป็นหลัก

    const payload = {
      source: 'open-meteo',
      timestamp: nowIsoUtc,                         // ← เก็บเป็นเวลาจริงของเซิร์ฟเวอร์ (UTC)
      api_time: cur.time || null,                   // (ออปชัน) เวลาที่ API รายงาน (string local TZ)
      temperature: cur.temperature_2m ?? null,      // °C
      windspeed:   cur.wind_speed_10m ?? null,      // km/h
      humidity:    cur.relative_humidity_2m ?? null,// %
      pressure:    cur.surface_pressure ?? null,    // hPa
      icon:        wxCodeToIcon(cur.weather_code),
      raw:         undefined                        // ไม่ต้องส่ง raw ให้ DB โต
    };

    await axios.post(CRUD_URL, payload, { timeout: 10000 });
    console.log('[fetcher] Sent reading at', payload.timestamp, 'api_time=', payload.api_time);
  } catch (err) {
    const code = err.code || err.cause?.code;
    const status = err.response?.status;
    console.error('[fetcher] Fetch/send error', code || status || err.message);
    if (err.config?.url) console.error('  URL:', err.config.url);
  }
}

fetchWeatherAndSend();
cron.schedule(SCHEDULE, fetchWeatherAndSend);
