import type { PrivateRailwayOpening, RailwayData, RailwaySegment } from "@/types/railway";

const PRIVATE_COMPANY_COLORS: Record<string, string> = {
  東武鉄道: "#f68b1f",
  京浜電気鉄道: "#00a3e0",
  玉川電気鉄道: "#7a4bb3",
  京成電気軌道: "#005aaa",
  京王電気軌道: "#dd0077",
  東上鉄道: "#0f8f5f",
  武蔵野鉄道: "#2b55a2",
  池上電気鉄道: "#d6508f",
  目黒蒲田電鉄: "#e45c2b",
  玉南電気鉄道: "#8a5a15",
  西武鉄道: "#00a6b2",
};

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`${path} を読み込めませんでした`);
  }

  return response.json() as Promise<T>;
}

export async function loadRailwayData(): Promise<RailwayData> {
  const [segments, privateOpenings, stations, events, summaries] = await Promise.all([
    loadJson<RailwayData["segments"]>("/data/railway_segments.json"),
    loadJson<PrivateRailwayOpening[]>("/data/railway_openings.json"),
    loadJson<RailwayData["stations"]>("/data/stations.json"),
    loadJson<RailwayData["events"]>("/data/events.json"),
    loadJson<RailwayData["summaries"]>("/data/year_summaries.json"),
  ]);

  return {
    segments: [...segments, ...privateOpenings.map(toRailwaySegment)],
    stations,
    events: [...events, ...privateOpenings.map(toTimelineEvent)],
    summaries,
  };
}

function toRailwaySegment(opening: PrivateRailwayOpening): RailwaySegment {
  const isClosed = opening.status === "closed";

  return {
    id: opening.id,
    lineId: opening.currentLineImage,
    lineName: opening.currentLineImage,
    historicalName: opening.companyAtOpening,
    name: opening.name,
    description: `${opening.theme}。${opening.notes}`,
    category: opening.category,
    displayColor: isClosed ? "#6b7280" : (PRIVATE_COMPANY_COLORS[opening.companyAtOpening] ?? opening.displayColor),
    plannedYear: Math.max(1900, opening.openedYear - 2),
    constructionStartYear: Math.max(1900, opening.openedYear - 1),
    openedYear: opening.openedYear,
    closedYear: isClosed ? opening.openedYear : null,
    geoLine: opening.approxCoordinates.map(([lng, lat]) => ({ lat, lng })),
    geojsonFile: opening.geojsonFile,
    sourceRefs: [opening.sourceStatus],
    openedDate: opening.openedDate,
    companyAtOpening: opening.companyAtOpening,
    currentOperator: opening.currentOperator,
    currentLineImage: opening.currentLineImage,
    area: opening.area,
    theme: opening.theme,
    systemType: opening.systemType,
    needsVerification: opening.needsVerification,
    sourceStatus: opening.sourceStatus,
    notes: opening.notes,
    sourceStatusLabel: opening.needsVerification ? "要検証" : "初期確認済み",
  };
}

function toTimelineEvent(opening: PrivateRailwayOpening): RailwayData["events"][number] {
  return {
    id: `${opening.id}-event`,
    year: opening.openedYear,
    title: `${opening.companyAtOpening} ${opening.name} 開業`,
    body: `${opening.theme}。${opening.currentLineImage}の初期区間として表示します。`,
    category: opening.category,
    relatedSegmentIds: [opening.id],
    relatedStationIds: [],
    sourceRefs: [opening.sourceStatus],
  };
}
