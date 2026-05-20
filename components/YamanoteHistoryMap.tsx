"use client";

import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { APP_VERSION } from "@/lib/appVersion";
import { getCurrentSummary, getSegmentStatus, getYearSummary, labelStatus } from "@/lib/railwayStatus";
import { getRouteGeometry } from "@/lib/routeGeometry";
import { loadRailwayData } from "@/lib/loadRailwayData";
import type { RailwayData, RailwaySegment, RailwayStatus, Station } from "@/types/railway";

const START_YEAR = 1870;
const END_YEAR = 2025;
const YEAR_STEP = 2;
const YEARS = Array.from({ length: Math.floor((END_YEAR - START_YEAR) / YEAR_STEP) + 1 }, (_, index) => START_YEAR + index * YEAR_STEP);
if (YEARS[YEARS.length - 1] !== END_YEAR) {
  YEARS.push(END_YEAR);
}
const PLAYBACK_SPEEDS = [
  { label: "ゆっくり", interval: 1600 },
  { label: "標準", interval: 1000 },
  { label: "速い", interval: 600 },
] as const;
const DISPLAY_MODES = [
  { id: "all", label: "全部" },
  { id: "yamanote", label: "山手" },
  { id: "jr", label: "JR" },
  { id: "private", label: "私鉄" },
] as const;
const PRIVATE_COMPANY_FILTERS = [
  { id: "all", label: "すべて" },
  { id: "seibu", label: "西武" },
  { id: "keio", label: "京王" },
  { id: "tokyu", label: "東急" },
  { id: "tobu", label: "東武" },
  { id: "keisei", label: "京成" },
  { id: "keikyu", label: "京急" },
] as const;
const PRIVATE_FOCUS_SUMMARIES: Record<PrivateCompanyFilter, { title: string; body: string }> = {
  all: {
    title: "私鉄全体",
    body: "東京の私鉄は、都心側の端点から郊外へ放射状に伸び、沿線開発や住宅地形成と結びつきながら広がっていきます。",
  },
  seibu: {
    title: "西武フォーカス",
    body: "池袋から飯能方面へ伸びる武蔵野鉄道系と、高田馬場から東村山方面へ伸びる西武新宿線系の2軸で、西北部の郊外化を支えます。",
  },
  keio: {
    title: "京王フォーカス",
    body: "笹塚・新宿から調布、府中、八王子方面へ伸びる西東京の私鉄軸です。都心西側と多摩方面の結びつきが見えます。",
  },
  tokyu: {
    title: "東急フォーカス",
    body: "玉電、池上、目蒲、東横系が南西部から神奈川方面へ広がります。住宅地開発と都市圏拡大の関係が見えやすい会社です。",
  },
  tobu: {
    title: "東武フォーカス",
    body: "下町から北千住方面へ入る伊勢崎線系と、池袋から川越方面へ向かう東上線系で、東京北部・北西部への軸を作ります。",
  },
  keisei: {
    title: "京成フォーカス",
    body: "押上から葛飾・千葉方面へ伸びる東東京の私鉄軸です。柴又・金町方面の支線形成も同時に見られます。",
  },
  keikyu: {
    title: "京急フォーカス",
    body: "川崎・横浜方面から品川側へ入る南方向の軸です。東京南部と京浜間のつながりを先に見る入口になります。",
  },
};

const EMPTY_DATA: RailwayData = {
  segments: [],
  stations: [],
  events: [],
  summaries: [],
};

type RouteStyle = {
  color: string;
  weight: number;
  dashArray?: string;
  opacity: number;
};
type DisplayMode = (typeof DISPLAY_MODES)[number]["id"];
type PrivateCompanyFilter = (typeof PRIVATE_COMPANY_FILTERS)[number]["id"];

function routeStyle(status: RailwayStatus): RouteStyle {
  const styles: Record<RailwayStatus, RouteStyle> = {
    opened: { color: "#15803d", weight: 8, opacity: 0.98 },
    construction: { color: "#d97706", weight: 7, dashArray: "14 10", opacity: 0.82 },
    planned: { color: "#7c8591", weight: 6, dashArray: "7 10", opacity: 0.56 },
    future: { color: "#c7cdd3", weight: 4, dashArray: "3 12", opacity: 0 },
  };

  return styles[status];
}

function segmentStyle(segment: RailwaySegment, status: RailwayStatus, isSelected: boolean, hasSelection: boolean): RouteStyle {
  const style = routeStyle(status);

  const routeStyleWithColor =
    status === "opened" && segment.displayColor
      ? {
          ...style,
          color: segment.displayColor,
          weight: segment.lineId === "yamanote-formation" ? 8 : 5,
          opacity: segment.lineId === "yamanote-formation" ? 0.98 : 0.78,
        }
      : style;

  return {
    ...routeStyleWithColor,
    weight: isSelected ? routeStyleWithColor.weight + 3 : routeStyleWithColor.weight,
    opacity: hasSelection && !isSelected ? Math.min(routeStyleWithColor.opacity, 0.26) : routeStyleWithColor.opacity,
  };
}

function toLatLngs(segment: RailwaySegment): [number, number][] {
  return getRouteGeometry(segment.id, segment.geoLine).map((point) => [point.lat, point.lng]);
}

function stationLatLng(station: Station): [number, number] {
  return [station.geo.lat, station.geo.lng];
}

function changeYearByStep(current: number, direction: -1 | 1): number {
  const currentIndex = YEARS.indexOf(current);
  const nextIndex = Math.min(Math.max(currentIndex + direction, 0), YEARS.length - 1);
  return YEARS[nextIndex];
}

function matchesDisplayMode(segment: RailwaySegment, mode: DisplayMode): boolean {
  if (mode === "all") return true;
  if (mode === "private") return segment.category === "private_railway";
  if (mode === "jr") return segment.category === "jr_major_kanto";
  return segment.lineId === "yamanote-formation" || segment.id === "central-line-to-tokyo";
}

function privateCompanyGroup(segment: RailwaySegment): PrivateCompanyFilter {
  const text = `${segment.companyAtOpening ?? ""} ${segment.currentOperator ?? ""} ${segment.currentLineImage ?? ""}`;
  if (text.includes("西武") || text.includes("武蔵野鉄道")) return "seibu";
  if (text.includes("京王") || text.includes("玉南")) return "keio";
  if (text.includes("東急") || text.includes("玉川電気鉄道") || text.includes("池上電気鉄道") || text.includes("目黒蒲田電鉄")) return "tokyu";
  if (text.includes("東武") || text.includes("東上鉄道")) return "tobu";
  if (text.includes("京成")) return "keisei";
  if (text.includes("京急") || text.includes("京浜電気鉄道")) return "keikyu";
  return "all";
}

function matchesPrivateFilters(segment: RailwaySegment, companyFilter: PrivateCompanyFilter, routeFilter: string): boolean {
  if (segment.category !== "private_railway") return true;
  if (companyFilter !== "all" && privateCompanyGroup(segment) !== companyFilter) return false;
  return routeFilter === "all" || segment.currentLineImage === routeFilter;
}

function firstOpeningYear(segments: RailwaySegment[], companyFilter: PrivateCompanyFilter, routeFilter: string): number | null {
  const years = segments
    .filter((segment) => segment.category === "private_railway")
    .filter((segment) => matchesPrivateFilters(segment, companyFilter, routeFilter))
    .map((segment) => segment.openedYear);
  return years.length > 0 ? Math.min(...years) : null;
}

function focusStartYear(
  segments: RailwaySegment[],
  displayMode: DisplayMode,
  companyFilter: PrivateCompanyFilter,
  routeFilter: string,
): number {
  const targetYears = segments
    .filter((segment) => matchesDisplayMode(segment, displayMode))
    .filter((segment) => matchesPrivateFilters(segment, companyFilter, routeFilter))
    .map((segment) => segment.openedYear);
  return targetYears.length > 0 ? Math.min(...targetYears) : YEARS[0];
}

export function YamanoteHistoryMap() {
  const [data, setData] = useState<RailwayData>(EMPTY_DATA);
  const [selectedYear, setSelectedYear] = useState(1885);
  const [summaryOverride, setSummaryOverride] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<RailwaySegment | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("all");
  const [privateCompanyFilter, setPrivateCompanyFilter] = useState<PrivateCompanyFilter>("all");
  const [privateRouteFilter, setPrivateRouteFilter] = useState("all");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackInterval, setPlaybackInterval] = useState<(typeof PLAYBACK_SPEEDS)[number]["interval"]>(1000);
  const [isMapReady, setIsMapReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const railwayLayerRef = useRef<LayerGroup | null>(null);
  const stationLayerRef = useRef<LayerGroup | null>(null);
  const timerRef = useRef<number | null>(null);

  const visibleSegments = useMemo(
    () =>
      data.segments.filter(
        (segment) =>
          matchesDisplayMode(segment, displayMode) &&
          matchesPrivateFilters(segment, privateCompanyFilter, privateRouteFilter) &&
          getSegmentStatus(segment, selectedYear) !== "future",
      ),
    [data.segments, displayMode, privateCompanyFilter, privateRouteFilter, selectedYear],
  );

  const privateRouteOptions = useMemo(() => {
    const routeNames = data.segments
      .filter((segment) => segment.category === "private_railway")
      .filter((segment) => matchesPrivateFilters(segment, privateCompanyFilter, "all"))
      .map((segment) => segment.currentLineImage)
      .filter((lineName): lineName is string => Boolean(lineName));

    return Array.from(new Set(routeNames)).sort((a, b) => a.localeCompare(b, "ja"));
  }, [data.segments, privateCompanyFilter]);

  const focusSegments = useMemo(
    () =>
      data.segments
        .filter((segment) => segment.category === "private_railway")
        .filter((segment) => matchesPrivateFilters(segment, privateCompanyFilter, privateRouteFilter))
        .sort((a, b) => a.openedYear - b.openedYear || (a.openedDate ?? "").localeCompare(b.openedDate ?? "")),
    [data.segments, privateCompanyFilter, privateRouteFilter],
  );
  const shouldShowPrivateFocus = displayMode === "private" || privateCompanyFilter !== "all" || privateRouteFilter !== "all";
  const privateFocusSummary = PRIVATE_FOCUS_SUMMARIES[privateCompanyFilter];
  const privateFocusTitle =
    privateRouteFilter !== "all" ? `${privateRouteFilter}フォーカス` : privateFocusSummary.title;
  const privateFocusBody =
    privateRouteFilter !== "all"
      ? `${privateRouteFilter}に関係する開業区間だけを表示しています。スライダーを動かすと、その路線の形成順を追えます。`
      : privateFocusSummary.body;

  const visibleEvents = useMemo(
    () =>
      data.events.filter((event) => {
        if (event.year > selectedYear) return false;
        if (displayMode === "all" && privateCompanyFilter === "all" && privateRouteFilter === "all") return true;
        return event.relatedSegmentIds.some((segmentId) =>
          data.segments.some(
            (segment) =>
              segment.id === segmentId &&
              matchesDisplayMode(segment, displayMode) &&
              matchesPrivateFilters(segment, privateCompanyFilter, privateRouteFilter),
          ),
        );
      }),
    [data.events, data.segments, displayMode, privateCompanyFilter, privateRouteFilter, selectedYear],
  );

  const currentSummary = useMemo(() => getCurrentSummary(data.summaries, selectedYear), [data.summaries, selectedYear]);
  const activeEvent = useMemo(
    () =>
      visibleEvents
        .reduce<(typeof data.events)[number] | null>((current, event) => (!current || event.year > current.year ? event : current), null),
    [visibleEvents],
  );
  const progressPercent = ((selectedYear - START_YEAR) / (END_YEAR - START_YEAR)) * 100;
  const yearSummary = summaryOverride ?? getYearSummary(data.summaries, selectedYear);
  const playbackStartYear = useMemo(
    () => focusStartYear(data.segments, displayMode, privateCompanyFilter, privateRouteFilter),
    [data.segments, displayMode, privateCompanyFilter, privateRouteFilter],
  );

  useEffect(() => {
    loadRailwayData()
      .then(setData)
      .catch((error: unknown) => {
        setErrorMessage("データの読み込みに失敗しました。");
        console.error(error);
      });
  }, []);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;
    let disposed = false;

    import("leaflet").then((leaflet) => {
      if (disposed || !mapElementRef.current) return;

      leafletRef.current = leaflet;

      const map = leaflet
        .map(mapElementRef.current, {
          zoomControl: false,
          preferCanvas: true,
        })
        .setView([35.72, 139.72], 9);

      leaflet
        .tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
          maxZoom: 18,
          opacity: 0.52,
          attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
        })
        .addTo(map);

      mapRef.current = map;
      railwayLayerRef.current = leaflet.layerGroup().addTo(map);
      stationLayerRef.current = leaflet.layerGroup().addTo(map);
      map.fitBounds(
        [
          [35.18, 138.85],
          [36.45, 140.45],
        ],
        { padding: [28, 28] },
      );
      window.setTimeout(() => {
        map.invalidateSize();
      }, 0);
      setIsMapReady(true);
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      leafletRef.current = null;
      mapRef.current = null;
      railwayLayerRef.current = null;
      stationLayerRef.current = null;
      setIsMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener("resize", handleResize);
    window.setTimeout(handleResize, 0);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isMapReady]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const railwayLayer = railwayLayerRef.current;
    const stationLayer = stationLayerRef.current;
    if (!leaflet || !railwayLayer || !stationLayer) return;

    railwayLayer.clearLayers();
    stationLayer.clearLayers();

    visibleSegments.forEach((segment) => {
      const status = getSegmentStatus(segment, selectedYear);
      if (status === "future") return;

      const isSelected = selectedSegment?.id === segment.id;
      const hasSelection = selectedSegment !== null;
      const style = segmentStyle(segment, status, isSelected, hasSelection);
      leaflet
        .polyline(toLatLngs(segment), {
          color: "#ffffff",
          weight: style.weight + (isSelected ? 7 : 5),
          opacity: hasSelection && !isSelected ? 0.24 : Math.min(style.opacity + 0.1, 1),
          lineCap: "round",
          lineJoin: "round",
          interactive: false,
        })
        .addTo(railwayLayer);

      const polyline = leaflet.polyline(toLatLngs(segment), {
        color: style.color,
        weight: style.weight,
        opacity: style.opacity,
        dashArray: style.dashArray,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(railwayLayer);

      polyline.bindPopup(
        `<strong>${segment.name}</strong><br>${segment.openedDate ?? `${segment.openedYear}年`}開業<br>${segment.description}`,
      );
      polyline.on("click", () => {
        setSelectedSegment(segment);
        setSummaryOverride(
          `${segment.name}: ${segment.openedYear}年開業。現在の選択年では「${labelStatus(status)}」です。${segment.description}`,
        );
      });
    });

    data.stations
      .filter((station) => selectedYear >= station.openedYear)
      .forEach((station) => {
        const marker = leaflet.marker(stationLatLng(station), {
          icon: leaflet.divIcon({
            className: "",
            html: '<span class="station-marker"></span>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        }).addTo(stationLayer);

        marker.bindTooltip(station.name, {
          className: "station-tooltip",
          direction: "top",
          offset: [0, -8],
          permanent: true,
        });
        marker.bindPopup(`<strong>${station.name}</strong><br>${station.openedYear}年表示開始`);
      });
  }, [data.stations, isMapReady, selectedSegment, selectedYear, visibleSegments]);

  useEffect(() => {
    setSummaryOverride(null);
    setSelectedSegment(null);
  }, [displayMode, privateCompanyFilter, privateRouteFilter, selectedYear]);

  useEffect(() => {
    if (privateRouteFilter !== "all" && !privateRouteOptions.includes(privateRouteFilter)) {
      setPrivateRouteFilter("all");
    }
  }, [privateRouteFilter, privateRouteOptions]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!leaflet || !map || !isMapReady) return;
    if (displayMode === "all" && privateCompanyFilter === "all" && privateRouteFilter === "all") return;

    const targetSegments = data.segments.filter(
      (segment) => matchesDisplayMode(segment, displayMode) && matchesPrivateFilters(segment, privateCompanyFilter, privateRouteFilter),
    );
    const routePoints = targetSegments.flatMap((segment) => toLatLngs(segment));
    if (routePoints.length === 0) return;

    map.fitBounds(leaflet.latLngBounds(routePoints), { padding: [36, 36], maxZoom: 11 });
    window.setTimeout(() => map.invalidateSize(), 0);
  }, [data.segments, displayMode, isMapReady, privateCompanyFilter, privateRouteFilter]);

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = window.setInterval(() => {
      setSelectedYear((current) => {
        const currentIndex = YEARS.indexOf(current);
        if (currentIndex === YEARS.length - 1) {
          setIsPlaying(false);
          return current;
        }

        const nextIndex = currentIndex + 1;
        return YEARS[nextIndex];
      });
    }, playbackInterval);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, playbackInterval]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">TrainHistory-Map</p>
          <h1>山手線が環状線になるまで</h1>
        </div>
        <div className="topbar-meta">
          <div className="status-legend" aria-label="路線状態の凡例">
            <span>
              <i className="legend planned" />
              計画
            </span>
            <span>
              <i className="legend construction" />
              建設中
            </span>
            <span>
              <i className="legend opened" />
              開業済み
            </span>
            <span>
              <i className="legend future" />
              未表示
            </span>
          </div>
          <span className="app-version">Ver. {APP_VERSION}</span>
        </div>
      </header>

      <section className="workspace" aria-label="時系列地図サンプル">
        <section className="map-panel" aria-label="地図">
          <span className="app-version map-version">Ver. {APP_VERSION}</span>
          <div className="mode-controls" aria-label="表示モード">
            {DISPLAY_MODES.map((mode) => (
              <button
                key={mode.id}
                className={mode.id === displayMode ? "active" : ""}
                type="button"
                onClick={() => {
                  setDisplayMode(mode.id);
                  if (mode.id !== "private") {
                    setPrivateCompanyFilter("all");
                    setPrivateRouteFilter("all");
                  }
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="focus-controls" aria-label="私鉄フォーカス">
            <label>
              <span>会社</span>
              <select
                value={privateCompanyFilter}
                onChange={(event) => {
                  const nextCompany = event.target.value as PrivateCompanyFilter;
                  const firstYear = firstOpeningYear(data.segments, nextCompany, "all");
                  setDisplayMode("private");
                  setPrivateCompanyFilter(nextCompany);
                  setPrivateRouteFilter("all");
                  if (firstYear !== null) {
                    setIsPlaying(false);
                    setSelectedYear(firstYear);
                  }
                }}
              >
                {PRIVATE_COMPANY_FILTERS.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>路線</span>
              <select
                value={privateRouteFilter}
                onChange={(event) => {
                  const nextRoute = event.target.value;
                  const firstYear = firstOpeningYear(data.segments, privateCompanyFilter, nextRoute);
                  setDisplayMode("private");
                  setPrivateRouteFilter(nextRoute);
                  if (firstYear !== null) {
                    setIsPlaying(false);
                    setSelectedYear(firstYear);
                  }
                }}
              >
                <option value="all">すべて</option>
                {privateRouteOptions.map((routeName) => (
                  <option key={routeName} value={routeName}>
                    {routeName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="map-toolbar">
            <button className="tool-button" type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="縮小">
              −
            </button>
            <button className="tool-button" type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="拡大">
              ＋
            </button>
          </div>
          {!isMapReady ? <div className="map-loading">地図を読み込み中</div> : null}
          <div ref={mapElementRef} id="map" role="img" aria-label="東京周辺の淡色地図と山手線形成史" />
        </section>

        <aside className="side-panel" aria-label="年表と詳細">
          <div className="year-readout">
            <span>{selectedYear}</span>
            <small>年時点</small>
          </div>
          <section className="phase-card" aria-label="現在の段階">
            <div>
              <p className="phase-label">現在の段階</p>
              <strong>{currentSummary?.phase ?? "読み込み中"}</strong>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <ol className="phase-steps" aria-label="山手線形成の流れ">
              <li className={selectedYear >= 1875 ? "active" : ""}>幹</li>
              <li className={selectedYear >= 1885 ? "active" : ""}>網</li>
              <li className={selectedYear >= 1925 ? "active" : ""}>環</li>
              <li className={selectedYear >= 1990 ? "active" : ""}>湾</li>
            </ol>
          </section>
          <section>
            <h2>この年の見え方</h2>
            <p>{errorMessage ?? yearSummary}</p>
          </section>
          {shouldShowPrivateFocus ? (
            <section className="focus-story" aria-label="フォーカス解説">
              <h2>{privateFocusTitle}</h2>
              <p>{privateFocusBody}</p>
              <ol className="focus-timeline" aria-label="フォーカス中の開業順">
                {focusSegments.map((segment) => (
                  <li key={segment.id} className={selectedYear >= segment.openedYear ? "active" : ""}>
                    <time>{segment.openedDate ?? `${segment.openedYear}年`}</time>
                    <span>{segment.name}</span>
                    <small>{segment.currentLineImage ?? segment.lineName}</small>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          {selectedSegment ? (
            <section className="segment-detail" aria-label="選択中の路線詳細">
              <h2>選択中の路線</h2>
              <strong>{selectedSegment.name}</strong>
              <dl>
                <div>
                  <dt>開業日</dt>
                  <dd>{selectedSegment.openedDate ?? `${selectedSegment.openedYear}年`}</dd>
                </div>
                <div>
                  <dt>当時の会社</dt>
                  <dd>{selectedSegment.companyAtOpening ?? selectedSegment.historicalName}</dd>
                </div>
                <div>
                  <dt>現在の路線イメージ</dt>
                  <dd>{selectedSegment.currentLineImage ?? selectedSegment.lineName}</dd>
                </div>
                {selectedSegment.theme ? (
                  <div>
                    <dt>表示テーマ</dt>
                    <dd>{selectedSegment.theme}</dd>
                  </div>
                ) : null}
                {selectedSegment.notes ? (
                  <div>
                    <dt>notes</dt>
                    <dd>{selectedSegment.notes}</dd>
                  </div>
                ) : null}
                {selectedSegment.sourceStatusLabel ? (
                  <div>
                    <dt>データ状態</dt>
                    <dd>{selectedSegment.sourceStatusLabel}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}
          {activeEvent ? (
            <section className="focus-event">
              <h2>直近の節目</h2>
              <strong>
                {activeEvent.year}年 {activeEvent.title}
              </strong>
              <p>{activeEvent.body}</p>
            </section>
          ) : null}
          <section className="data-note" aria-label="データ精度の注記">
            <h2>データについて</h2>
            <p>
              この画面は山手線形成史を理解するための概念デモです。線形と駅位置は現在地図上の概略表示で、当時の正確な線形や全駅を再現したものではありません。
            </p>
          </section>
          <section>
            <h2>表示中の路線</h2>
            <ul className="detail-list">
              {visibleSegments.map((segment) => {
                const status = getSegmentStatus(segment, selectedYear);
                const isSelected = selectedSegment?.id === segment.id;
                return (
                  <li
                    key={segment.id}
                    className={isSelected ? "selected" : ""}
                    style={{ borderColor: segmentStyle(segment, status, isSelected, selectedSegment !== null).color }}
                  >
                    <strong>{segment.name}</strong>
                    {segment.openedYear}年開業 / {labelStatus(status)}
                  </li>
                );
              })}
            </ul>
          </section>
          <section>
            <h2>イベント</h2>
            <ul className="event-list">
              {visibleEvents.map((event) => (
                <li key={event.id} className={event.id === activeEvent?.id ? "current" : ""}>
                  <strong>
                    {event.year}年 {event.title}
                  </strong>
                  {event.body}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </section>

      <footer className="timeline">
        <div className="timeline-actions">
          <button
            className="step-button"
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setSelectedYear((current) => changeYearByStep(current, -1));
            }}
            aria-label="前の年代へ"
          >
            前
          </button>
          <button
            className="play-button"
            type="button"
            onClick={() => {
              if (selectedYear === YEARS[YEARS.length - 1]) {
                setSelectedYear(playbackStartYear);
              }
              setIsPlaying((current) => !current);
            }}
          >
            {isPlaying ? "停止" : "再生"}
          </button>
          <button
            className="step-button"
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setSelectedYear((current) => changeYearByStep(current, 1));
            }}
            aria-label="次の年代へ"
          >
            次
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setSelectedYear(playbackStartYear);
            }}
          >
            最初へ
          </button>
        </div>
        <output className="timeline-year" aria-label="選択中の年">
          {selectedYear}
        </output>
        <div className="slider-wrap">
          <input
            type="range"
            min={START_YEAR}
            max={END_YEAR}
            value={selectedYear}
            step={YEAR_STEP}
            onChange={(event) => {
              setIsPlaying(false);
              setSelectedYear(Number(event.target.value));
            }}
          />
          <div className="ticks" aria-hidden="true">
            <span>{START_YEAR}</span>
            <span>1925</span>
            <span>{END_YEAR}</span>
          </div>
        </div>
        <div className="speed-control" aria-label="再生速度">
          {PLAYBACK_SPEEDS.map((speed) => (
            <button
              key={speed.interval}
              className={speed.interval === playbackInterval ? "active" : ""}
              type="button"
              onClick={() => setPlaybackInterval(speed.interval)}
            >
              {speed.label}
            </button>
          ))}
        </div>
      </footer>
    </main>
  );
}
