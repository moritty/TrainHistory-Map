import type { RailwayData } from "@/types/railway";

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`${path} を読み込めませんでした`);
  }

  return response.json() as Promise<T>;
}

export async function loadRailwayData(): Promise<RailwayData> {
  const [segments, stations, events, summaries] = await Promise.all([
    loadJson<RailwayData["segments"]>("/data/railway_segments.json"),
    loadJson<RailwayData["stations"]>("/data/stations.json"),
    loadJson<RailwayData["events"]>("/data/events.json"),
    loadJson<RailwayData["summaries"]>("/data/year_summaries.json"),
  ]);

  return {
    segments,
    stations,
    events,
    summaries,
  };
}
