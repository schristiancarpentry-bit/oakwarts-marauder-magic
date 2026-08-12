// -----------------------------
// Scroll + name logic
// -----------------------------

let marauderNameValue = ""; // start blank

// References
const scrollIntro = document.getElementById("scrollIntro");
const scrollReveal = document.getElementById("scrollReveal");
const enterNameBtn = document.getElementById("enterName");
const enterMapBtn = document.getElementById("enterMap");
const nameInput = document.getElementById("marauderName");
const mapVignette = document.getElementById("mapVignette");
const titleBanner = document.getElementById("titleBanner");
const compassRose = document.getElementById("compassRose");

// Step 1: enter name
function proceedToOath() {
  marauderNameValue = nameInput.value.trim() || "Unknown Marauder";
  localStorage.setItem("marauderName", marauderNameValue);

  scrollIntro.style.animation = "rollUp 1s ease-in-out forwards";
  setTimeout(() => {
    scrollIntro.style.display = "none";
    scrollReveal.style.opacity = 1;
    scrollReveal.style.pointerEvents = "auto";
  }, 1000);
}

// Step 2: Mischief Managed → reveal map with ripple
function startMap(event) {
  marauderNameValue =
    nameInput.value.trim() ||
    localStorage.getItem("marauderName") ||
    "Unknown Marauder";
  localStorage.setItem("marauderName", marauderNameValue);

  const ripple = document.getElementById("rippleEffect");
  const x = event.clientX || window.innerWidth / 2;
  const y = event.clientY || window.innerHeight / 2;

  ripple.style.top = `${y}px`;
  ripple.style.left = `${x}px`;
  ripple.style.width = "0";
  ripple.style.height = "0";
  ripple.style.opacity = "1";

  requestAnimationFrame(() => {
    ripple.style.width = "200vw";
    ripple.style.height = "200vw";
    ripple.style.opacity = "0";
  });

  setTimeout(() => {
    scrollReveal.style.display = "none";
    document.getElementById("map").classList.add("mapVisible");
    mapVignette.classList.add("show");
    titleBanner.classList.add("show");
    compassRose.classList.add("show");

    // Force name update before GPS begins
    marauderNameValue = localStorage.getItem("marauderName") || "Unknown Marauder";
    map.invalidateSize();
  }, 1300);
}

enterNameBtn.addEventListener("click", proceedToOath);
nameInput.addEventListener("keypress", e => {
  if (e.key === "Enter") proceedToOath();
});
enterMapBtn.addEventListener("click", e => startMap(e));

// -----------------------------
// Map initialisation
// -----------------------------
const map = L.map("map").setView([51.755845, -0.288546], 17);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// -----------------------------
// Marauder Mode toggle (enchanted parchment view <-> plain real map)
// -----------------------------
let marauderOn = true; // you've just sworn the oath, so it starts active
const modeToggleBtn = document.getElementById("modeToggle");

function setMarauderMode(on) {
  marauderOn = on;
  document.body.classList.toggle("plainMode", !on);
  modeToggleBtn.textContent = on ? "Reveal Real Map" : "Marauder Mode";
  modeToggleBtn.classList.toggle("active", on);
}
modeToggleBtn.addEventListener("click", () => setMarauderMode(!marauderOn));
setMarauderMode(true);

// -----------------------------
// Saved markers from localStorage
// -----------------------------
let savedMarkers = JSON.parse(localStorage.getItem("oaklandsMarkers")) || [];

const labelLayer = L.layerGroup().addTo(map);

const inkPinIcon = L.divIcon({
  className: "inkPinIcon",
  html: '<div class="inkPin"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

function addMarkerAndLabel(lat, lon, name) {
  const pin = L.marker([lat, lon], { icon: inkPinIcon }).addTo(map);
  pin.bindPopup(`<b>${name}</b><br>Lat: ${lat}<br>Lon: ${lon}`);

  const labelIcon = L.divIcon({
    className: "placeLabelIcon",
    html: `<span class="placeLabelText">${name}</span>`,
    iconSize: [120, 24]
  });

  const label = L.marker([lat, lon], { icon: labelIcon, interactive: false });
  labelLayer.addLayer(label);
}

function renderMarkers() {
  labelLayer.clearLayers();
  savedMarkers.forEach(m => addMarkerAndLabel(m.lat, m.lon, m.name));
}
renderMarkers();

// -----------------------------
// Marker naming modal (replaces the native prompt())
// -----------------------------
const markerModal = document.getElementById("markerModal");
const markerNameInput = document.getElementById("markerNameInput");
const markerConfirmBtn = document.getElementById("markerConfirm");
const markerCancelBtn = document.getElementById("markerCancel");
let pendingLatLng = null;

function openMarkerModal(lat, lon) {
  pendingLatLng = { lat, lon };
  markerNameInput.value = "";
  markerModal.classList.add("show");
  setTimeout(() => markerNameInput.focus(), 150);
}

function closeMarkerModal() {
  markerModal.classList.remove("show");
  pendingLatLng = null;
}

function confirmMarker() {
  const name = markerNameInput.value.trim();
  if (name && pendingLatLng) {
    addMarkerAndLabel(pendingLatLng.lat, pendingLatLng.lon, name);
    savedMarkers.push({ name, lat: pendingLatLng.lat, lon: pendingLatLng.lon });
    localStorage.setItem("oaklandsMarkers", JSON.stringify(savedMarkers));
  }
  closeMarkerModal();
}

markerConfirmBtn.addEventListener("click", confirmMarker);
markerCancelBtn.addEventListener("click", closeMarkerModal);
markerNameInput.addEventListener("keypress", e => {
  if (e.key === "Enter") confirmMarker();
});

map.on("click", e => {
  const lat = parseFloat(e.latlng.lat.toFixed(6));
  const lon = parseFloat(e.latlng.lng.toFixed(6));
  openMarkerModal(lat, lon);
});

// -----------------------------
// GPS tracking + footfall trail
// -----------------------------
let userMarker, nameLabel;
let lastStepWasLeft = false;

function getMarauderName() {
  // Always read the freshest name from storage
  return localStorage.getItem("marauderName") || marauderNameValue || "Unknown Marauder";
}

// Bearing (in degrees) of travel from point 1 to point 2, film footprints
// point the way you're walking rather than sitting still on a compass axis.
function bearingBetween(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function dropFootprint(lat, lon, bearingDeg) {
  lastStepWasLeft = !lastStepWasLeft;
  const side = lastStepWasLeft ? "foot-left" : "foot-right";

  const footIcon = L.divIcon({
    className: "footprintMarker",
    html: `<div class="footprint-icon" style="transform: rotate(${bearingDeg}deg)"><div class="foot ${side}"></div></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  const footprint = L.marker([lat, lon], { icon: footIcon, interactive: false }).addTo(map);

  let opacity = 0.6;
  const fade = setInterval(() => {
    opacity -= 0.015;
    if (opacity <= 0) {
      clearInterval(fade);
      map.removeLayer(footprint);
    } else {
      const el = footprint.getElement();
      if (el) el.style.opacity = opacity;
    }
  }, 250);
}

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const currentName = getMarauderName();

      if (!userMarker) {
        // create user marker
        userMarker = L.circleMarker([lat, lon], {
          radius: 6,
          color: "black",
          fillColor: "black",
          fillOpacity: 0.9
        }).addTo(map);

        // add marauder's name label
        const nameIcon = L.divIcon({
          className: "marauderNameIcon",
          html: `<div class="marauderNameLabel">${currentName}</div>`,
          iconSize: [120, 24],
          iconAnchor: [60, 40]
        });

        nameLabel = L.marker([lat, lon], { icon: nameIcon, interactive: false }).addTo(map);

        setTimeout(() => map.setView([lat, lon], 18), 500);
      } else {
        // footfall trail, replacing the old plain dot trail
        const prev = userMarker.getLatLng();
        const jitterLat = prev.lat + (Math.random() - 0.5) * 0.00003;
        const jitterLon = prev.lng + (Math.random() - 0.5) * 0.00003;
        const bearingDeg = bearingBetween(prev.lat, prev.lng, lat, lon);

        dropFootprint(jitterLat, jitterLon, bearingDeg);

        // update position + label text live
        userMarker.setLatLng([lat, lon]);
        nameLabel.setLatLng([lat, lon]);

        // update the name text in case it changed
        const labelDiv = nameLabel.getElement();
        if (labelDiv) labelDiv.innerHTML = `<div class="marauderNameLabel">${currentName}</div>`;
      }
    },
    err => {
      console.error("GPS error:", err);
      alert("Unable to access GPS location.");
    },
    { enableHighAccuracy: true }
  );
} else {
  alert("Geolocation not supported by this device.");
}
