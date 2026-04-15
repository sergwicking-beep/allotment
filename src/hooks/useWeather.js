import { useState, useEffect } from 'react';

const LAT = 53.38;
const LON = -1.47;
const TIMEZONE = 'Europe/London';

export function useWeather() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${LAT}&longitude=${LON}` +
          `&daily=precipitation_sum,temperature_2m_min,temperature_2m_max` +
          `&past_days=14&forecast_days=7` +
          `&timezone=${encodeURIComponent(TIMEZONE)}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
        const data = await res.json();
        const { daily } = data;

        const today = new Date().toISOString().split('T')[0];
        let todayIdx = daily.time.findIndex(d => d === today);
        if (todayIdx === -1) todayIdx = 14; // fallback: last of past_days

        // Past 7 days rainfall (today inclusive)
        const past7Precip = daily.precipitation_sum
          .slice(Math.max(0, todayIdx - 6), todayIdx + 1)
          .map(v => v ?? 0);
        const last7Rain = past7Precip.reduce((a, b) => a + b, 0);

        // Next 2 days rain
        const next2Rain = daily.precipitation_sum
          .slice(todayIdx + 1, todayIdx + 3)
          .map(v => v ?? 0)
          .reduce((a, b) => a + b, 0);

        // Next 7 days forecast
        const forecastPrecip = daily.precipitation_sum
          .slice(todayIdx + 1, todayIdx + 8)
          .map(v => v ?? 0);
        const forecastRain = forecastPrecip.reduce((a, b) => a + b, 0);

        // Frost risk: any night ≤ 2 °C in next 7 days
        const upcomingMins = daily.temperature_2m_min
          .slice(todayIdx + 1, todayIdx + 8)
          .filter(v => v !== null);
        const frostRisk = upcomingMins.some(t => t <= 2);
        const lowestForecastTemp = upcomingMins.length ? Math.min(...upcomingMins) : null;

        // Soil temp estimate: 7-day rolling average of daily mean * 0.85 + 1
        const last7AvgTemps = Array.from({ length: 7 }, (_, i) => {
          const idx = todayIdx - 6 + i;
          if (idx < 0) return null;
          const max = daily.temperature_2m_max[idx];
          const min = daily.temperature_2m_min[idx];
          return max !== null && min !== null ? (max + min) / 2 : null;
        }).filter(v => v !== null);

        const avgAirTemp =
          last7AvgTemps.length
            ? last7AvgTemps.reduce((a, b) => a + b, 0) / last7AvgTemps.length
            : null;
        const soilTemp = avgAirTemp !== null
          ? Math.round((avgAirTemp * 0.85 + 1) * 10) / 10
          : null;

        // Watering alert: < 15 mm in last 7 days AND < 5 mm in next 2 days
        const wateringAlert = last7Rain < 15 && next2Rain < 5;

        // Today's snapshot
        const todayMax = daily.temperature_2m_max[todayIdx] ?? null;
        const todayMin = daily.temperature_2m_min[todayIdx] ?? null;
        const todayRain = daily.precipitation_sum[todayIdx] ?? 0;

        // 7-day forecast rows for display
        const forecast = Array.from({ length: 7 }, (_, i) => {
          const idx = todayIdx + 1 + i;
          return {
            date: daily.time[idx] ?? null,
            max: daily.temperature_2m_max[idx] ?? null,
            min: daily.temperature_2m_min[idx] ?? null,
            rain: daily.precipitation_sum[idx] ?? 0,
          };
        }).filter(d => d.date);

        setWeather({
          today: { max: todayMax, min: todayMin, rain: todayRain },
          last7Rain: Math.round(last7Rain * 10) / 10,
          next2Rain: Math.round(next2Rain * 10) / 10,
          forecastRain: Math.round(forecastRain * 10) / 10,
          frostRisk,
          lowestForecastTemp,
          soilTemp,
          avgAirTemp: avgAirTemp !== null ? Math.round(avgAirTemp * 10) / 10 : null,
          wateringAlert,
          forecast,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, []);

  return { weather, loading, error };
}

// Which crops are sowable given current soil temperature
export function getSowableBySoilTemp(soilTemp, crops) {
  if (soilTemp === null) return [];
  return crops.filter(
    c => !c.perennial && c.minSoilTempC !== null && soilTemp >= c.minSoilTempC
  );
}
