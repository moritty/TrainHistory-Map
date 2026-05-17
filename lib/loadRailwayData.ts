import type { PrivateRailwayOpening, RailwayData, RailwaySegment } from "@/types/railway";

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
    displayColor: isClosed ? "#6b7280" : "#22c55e",
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
