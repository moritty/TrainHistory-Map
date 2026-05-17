import type { RailwaySegment, RailwayStatus, YearSummary } from "@/types/railway";

export function getSegmentStatus(segment: RailwaySegment, year: number): RailwayStatus {
  if (year >= segment.openedYear) return "opened";
  if (year >= segment.constructionStartYear) return "construction";
  if (year >= segment.plannedYear) return "planned";
  return "future";
}

export function getYearSummary(summaries: YearSummary[], year: number): string {
  return getCurrentSummary(summaries, year)?.body ?? "";
}

export function getCurrentSummary(summaries: YearSummary[], year: number): YearSummary | null {
  return summaries.reduce<YearSummary | null>((current, summary) => (year >= summary.year ? summary : current), null);
}

export function labelStatus(status: RailwayStatus): string {
  const labels: Record<RailwayStatus, string> = {
    opened: "開業済み",
    construction: "建設中",
    planned: "計画中",
    future: "未表示",
  };

  return labels[status];
}
