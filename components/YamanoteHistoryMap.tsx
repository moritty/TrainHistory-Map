"use client";

import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentSummary, getSegmentStatus, getYearSummary, labelStatus } from "@/lib/railwayStatus";
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

function routeStyle(status: RailwayStatus): RouteStyle {
  const styles: Record<RailwayStatus, RouteStyle> = {
    opened: { color: "#15803d", weight: 8, opacity: 0.98 },
    construction: { color: "#d97706", weight: 7, dashArray: "14 10", opacity: 0.82 },
    planned: { color: "#7c8591", weight: 6, dashArray: "7 10", opacity: 0.56 },
    future: { color: "#c7cdd3", weight: 4, dashArray: "3 12", opacity: 0 },
  };

  return styles[status];
}

function segmentStyle(segment: RailwaySegment, status: RailwayStatus): RouteStyle {
  const style = routeStyle(status);

  if (status !== "opened" || !segment.displayColor) {
    return style;
  }

  return {
    ...style,
    color: segment.displayColor,
    weight: segment.lineId === "yamanote-formation" ? 8 : 5,
    opacity: segment.lineId === "yamanote-formation" ? 0.98 : 0.72,
  };
}

function toLatLngs(segment: RailwaySegment): [number, number][] {
  return segment.geoLine.map((point) => [point.lat, point.lng]);
}

function stationLatLng(station: Station): [number, number] {
  return [station.geo.lat, station.geo.lng];
}

function changeYearByStep(current: number, direction: -1 | 1): number {
  const currentIndex = YEARS.indexOf(current);
  const nextIndex = Math.min(Math.max(currentIndex + direction, 0), YEARS.length - 1);
  return YEARS[nextIndex];
}

export function YamanoteHistoryMap() {
  const [data, setData] = useState<RailwayData>(EMPTY_DATA);
  const [selectedYear, setSelectedYear] = useState(1885);
  const [summaryOverride, setSummaryOverride] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<RailwaySegment | null>(null);
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
    () => data.segments.filter((segment) => getSegmentStatus(segment, selectedYear) !== "future"),
    [data.segments, selectedYear],
  );

  const visibleEvents = useMemo(
    () => data.events.filter((event) => event.year <= selectedYear),
    [data.events, selectedYear],
  );

  const currentSummary = useMemo(() => getCurrentSummary(data.summaries, selectedYear), [data.summaries, selectedYear]);
  const activeEvent = useMemo(
    () =>
      data.events
        .filter((event) => event.year <= selectedYear)
        .reduce<(typeof data.events)[number] | null>((current, event) => (!current || event.year > current.year ? event : current), null),
    [data.events, selectedYear],
  );
  const progressPercent = ((selectedYear - START_YEAR) / (END_YEAR - START_YEAR)) * 100;
  const yearSummary = summaryOverride ?? getYearSummary(data.summaries, selectedYear);

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

    data.segments.forEach((segment) => {
      const status = getSegmentStatus(segment, selectedYear);
      if (status === "future") return;

      const style = segmentStyle(segment, status);
      leaflet
        .polyline(toLatLngs(segment), {
          color: "#ffffff",
          weight: style.weight + 5,
          opacity: Math.min(style.opacity + 0.08, 1),
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
  }, [data.segments, data.stations, isMapReady, selectedYear]);

  useEffect(() => {
    setSummaryOverride(null);
    setSelectedSegment(null);
  }, [selectedYear]);

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
      </header>

      <section className="workspace" aria-label="時系列地図サンプル">
        <section className="map-panel" aria-label="地図">
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
                return (
                  <li key={segment.id} style={{ borderColor: segmentStyle(segment, status).color }}>
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
                setSelectedYear(YEARS[0]);
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
              setSelectedYear(YEARS[0]);
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
