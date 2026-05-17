const years = Array.from({ length: 9 }, (_, index) => 1885 + index * 5);

let segments = [];
let stations = [];
let events = [];
let summaries = [];

const yearSlider = document.querySelector("#yearSlider");
const selectedYear = document.querySelector("#selectedYear");
const yearSummary = document.querySelector("#yearSummary");
const segmentList = document.querySelector("#segmentList");
const eventList = document.querySelector("#eventList");
const playButton = document.querySelector("#playButton");

let timer = null;
let map = null;
let railwayLayer = null;
let stationLayer = null;

function getStatus(segment, year) {
  if (year >= segment.openedYear) return "opened";
  if (year >= segment.constructionStartYear) return "construction";
  if (year >= segment.plannedYear) return "planned";
  return "future";
}

function routeStyle(status) {
  const styles = {
    opened: { color: "#16a34a", weight: 7, dashArray: null, opacity: 1 },
    construction: { color: "#d97706", weight: 7, dashArray: "16 10", opacity: 0.85 },
    planned: { color: "#8a8f98", weight: 6, dashArray: "8 10", opacity: 0.58 },
    future: { color: "#c7cdd3", weight: 4, dashArray: "3 12", opacity: 0 },
  };
  return styles[status];
}

function renderRoutes(year) {
  railwayLayer.clearLayers();

  segments.forEach((segment) => {
    const status = getStatus(segment, year);
    if (status === "future") return;

    const style = routeStyle(status);
    const polyline = L.polyline(getSegmentLatLngs(segment), {
      color: style.color,
      weight: style.weight,
      opacity: style.opacity,
      dashArray: style.dashArray,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(railwayLayer);

    polyline.bindPopup(`<strong>${segment.name}</strong><br>${segment.openedYear}年開業<br>${segment.description ?? ""}`);
    polyline.on("click", () => {
      yearSummary.textContent = `${segment.name}: ${segment.openedYear}年開業。現在の選択年では「${labelStatus(status)}」です。${segment.description ?? ""}`;
    });
  });
}

function renderStations(year) {
  stationLayer.clearLayers();

  stations
    .filter((station) => year >= getStationOpenedYear(station))
    .forEach((station) => {
      const marker = L.marker(getStationLatLng(station), {
        icon: L.divIcon({
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
      marker.bindPopup(`<strong>${station.name}</strong><br>${getStationOpenedYear(station)}年表示開始`);
    });
}

function getSegmentLatLngs(segment) {
  return segment.geoLine.map((point) => [point.lat, point.lng]);
}

function getStationOpenedYear(station) {
  return station.openedYear ?? station.year;
}

function getStationLatLng(station) {
  return [station.geo.lat, station.geo.lng];
}

function renderPanel(year) {
  selectedYear.textContent = year;
  yearSummary.textContent = getSummary(year);

  segmentList.replaceChildren(
    ...segments
      .filter((segment) => getStatus(segment, year) !== "future")
      .map((segment) => {
        const item = document.createElement("li");
        item.style.borderColor = routeStyle(getStatus(segment, year)).color;
        item.innerHTML = `<strong>${segment.name}</strong>${segment.openedYear}年開業 / ${labelStatus(getStatus(segment, year))}`;
        return item;
      }),
  );

  eventList.replaceChildren(
    ...events
      .filter((event) => event.year <= year)
      .map((event) => {
        const item = document.createElement("li");
        item.innerHTML = `<strong>${event.year}年 ${event.title}</strong>${event.body}`;
        return item;
      }),
  );
}

function getSummary(year) {
  return summaries.reduce((current, summary) => (year >= summary.year ? summary.body : current), summaries[0]?.body ?? "");
}

function labelStatus(status) {
  return {
    opened: "開業済み",
    construction: "建設中",
    planned: "計画中",
    future: "未表示",
  }[status];
}

function render(year) {
  renderRoutes(year);
  renderStations(year);
  renderPanel(year);
}

function stopPlayback() {
  clearInterval(timer);
  timer = null;
  playButton.textContent = "再生";
}

yearSlider.addEventListener("input", (event) => {
  stopPlayback();
  render(Number(event.target.value));
});

playButton.addEventListener("click", () => {
  if (timer) {
    stopPlayback();
    return;
  }

  playButton.textContent = "停止";
  timer = setInterval(() => {
    const current = Number(yearSlider.value);
    const nextIndex = (years.indexOf(current) + 1) % years.length;
    yearSlider.value = years[nextIndex];
    render(years[nextIndex]);
  }, 1000);
});

async function loadJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`${path} を読み込めませんでした`);
  }

  return response.json();
}

function initializeMap() {
  map = L.map("map", {
    zoomControl: false,
    preferCanvas: true,
  }).setView([35.704, 139.733], 12);

  L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',
  }).addTo(map);

  railwayLayer = L.layerGroup().addTo(map);
  stationLayer = L.layerGroup().addTo(map);

  document.querySelector("#zoomIn").addEventListener("click", () => {
    map.zoomIn();
  });

  document.querySelector("#zoomOut").addEventListener("click", () => {
    map.zoomOut();
  });
}

async function initialize() {
  try {
    initializeMap();

    [segments, stations, events, summaries] = await Promise.all([
      loadJson("./data/railway_segments.json"),
      loadJson("./data/stations.json"),
      loadJson("./data/events.json"),
      loadJson("./data/year_summaries.json"),
    ]);

    render(Number(yearSlider.value));
  } catch (error) {
    yearSummary.textContent = "データの読み込みに失敗しました。ローカルサーバー経由で index.html を開いてください。";
    console.error(error);
  }
}

initialize();
