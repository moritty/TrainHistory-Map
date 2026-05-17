export type RailwayStatus = "planned" | "construction" | "opened" | "future";

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type RailwaySegment = {
  id: string;
  lineId: string;
  lineName: string;
  historicalName: string;
  name: string;
  description: string;
  category: string;
  displayColor?: string;
  plannedYear: number;
  constructionStartYear: number;
  openedYear: number;
  closedYear: number | null;
  svgPath?: string;
  geoLine: GeoPoint[];
  geojsonFile: string | null;
  sourceRefs: string[];
};

export type Station = {
  id: string;
  name: string;
  openedYear: number;
  closedYear: number | null;
  lines: string[];
  position?: {
    x: number;
    y: number;
  };
  geo: GeoPoint;
  sourceRefs: string[];
};

export type TimelineEvent = {
  id: string;
  year: number;
  title: string;
  body: string;
  category: string;
  relatedSegmentIds: string[];
  relatedStationIds: string[];
  sourceRefs: string[];
};

export type YearSummary = {
  id: string;
  year: number;
  phase: string;
  body: string;
};

export type RailwayData = {
  segments: RailwaySegment[];
  stations: Station[];
  events: TimelineEvent[];
  summaries: YearSummary[];
};
