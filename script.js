// -----------------------------
// Scroll + name logic
// -----------------------------

let marauderNameValue = ""; // start blank

// A random Harry Potter surname gets tacked onto whatever first name is
// typed in — every Marauder needs a proper wizarding surname.
const HP_SURNAMES = [
  "Potter", "Weasley", "Granger", "Longbottom", "Lovegood", "Malfoy",
  "Black", "Lupin", "Diggory", "Chang", "Finnigan", "Thomas", "Patil",
  "Brown", "Bones", "Abbott", "Creevey", "Jordan", "Wood", "Bell",
  "Johnson", "Dumbledore", "McGonagall", "Flitwick", "Sprout",
  "Trelawney", "Moody", "Tonks", "Shacklebolt", "Riddle", "Scamander",
  "Ollivander", "Fawley"
];
function randomSurname() {
  return HP_SURNAMES[Math.floor(Math.random() * HP_SURNAMES.length)];
}

// References
const scrollIntro = document.getElementById("scrollIntro");
const scrollReveal = document.getElementById("scrollReveal");
const enterNameBtn = document.getElementById("enterName");
const enterMapBtn = document.getElementById("enterMap");
const nameInput = document.getElementById("marauderName");
const mapVignette = document.getElementById("mapVignette");
const parchmentFrame = document.getElementById("parchmentFrame");
const titleBanner = document.getElementById("titleBanner");
const compassRose = document.getElementById("compassRose");
const mischiefToast = document.getElementById("mischiefToast");
const groupCodeInput = document.getElementById("groupCode");
const generateCodeBtn = document.getElementById("generateCode");
const consentLabel = document.getElementById("consentLabel");
const consentCheckbox = document.getElementById("consentCheckbox");
const groupError = document.getElementById("groupError");

// Consent only matters if a group code is actually entered — with no
// code, you're just navigating solo, nothing is shared with anyone.
groupCodeInput.addEventListener("input", () => {
  const hasCode = groupCodeInput.value.trim().length > 0;
  consentLabel.classList.toggle("hidden", !hasCode);
  if (!hasCode) consentCheckbox.checked = false;
  groupError.classList.add("hidden");
});
generateCodeBtn.addEventListener("click", () => {
  groupCodeInput.value = generateGroupCode();
  groupCodeInput.dispatchEvent(new Event("input"));
});

// Member list expand/collapse
const memberListToggleBtn = document.getElementById("memberListToggle");
memberListToggleBtn.addEventListener("click", () => {
  document.getElementById("memberList").classList.toggle("expanded");
});

// Parchment/ink/gold — kept consistent with the rest of the theme
// rather than generic rainbow confetti.
const CONFETTI_COLORS = ["#ffd700", "#d9a24a", "#f5ecd7", "#6e1f16", "#2b1d10"];

// A circular "wand tap" burst centred on a screen point. canvas-confetti
// takes fractional viewport coordinates (0-1), not pixels.
function fireConfetti(x, y) {
  if (typeof confetti !== "function") return; // CDN blocked/offline — fail quietly
  confetti({
    particleCount: 90,
    spread: 360,
    startVelocity: 32,
    ticks: 90,
    gravity: 0.9,
    scalar: 0.9,
    colors: CONFETTI_COLORS,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight }
  });
}

// Plays the ink ripple growing outward from a point without touching
// the map's own clip-path reveal — used for the Marauder Mode toggle,
// where the map is already visible and only the *style* is changing.
function fireInkRippleAt(x, y) {
  const ripple = document.getElementById("rippleEffect");
  ripple.style.transition = "none";
  ripple.style.top = `${y}px`;
  ripple.style.left = `${x}px`;
  ripple.style.width = "0";
  ripple.style.height = "0";
  ripple.style.opacity = "1";
  void ripple.offsetWidth; // force layout so the reset above isn't animated
  ripple.style.transition = "";
  requestAnimationFrame(() => {
    ripple.style.width = "200vw";
    ripple.style.height = "200vw";
    ripple.style.opacity = "0";
  });
}

const wandSound = new Audio("assets/wand-flick.mp3");
wandSound.volume = 0.7;

// A quick wand flick at a screen point — plays alongside the ripple and
// confetti at all three "magic" moments (open, Marauder Mode on, Exit).
function fireWandAt(x, y) {
  const wand = document.getElementById("wandEffect");
  wand.style.left = `${x}px`;
  wand.style.top = `${y}px`;
  wand.classList.remove("flick");
  void wand.offsetWidth; // restart the animation if it's fired again mid-flick
  wand.classList.add("flick");

  wandSound.currentTime = 0;
  wandSound.play().catch(() => {}); // autoplay can be blocked in some contexts — fail quietly
}

// The three "magic" moments all want the same wand + confetti pairing —
// only the ripple mechanics differ per moment (a growing map reveal on
// open, a plain ripple on the toggle, a shrinking reverse on Exit).
function fireMagicAt(x, y) {
  fireWandAt(x, y);
  fireConfetti(x, y);
}

// Step 1: enter name
function proceedToOath() {
  const firstName = nameInput.value.trim();
  marauderNameValue = firstName ? `${firstName} ${randomSurname()}` : "Unknown Marauder";
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
  // A group code with no consent ticked is refused outright — sharing
  // location only ever happens with an explicit, fresh "yes" each time.
  const groupCode = groupCodeInput.value.trim();
  if (groupCode && !consentCheckbox.checked) {
    groupError.textContent = "Tick the box to share your location with this group, or clear the code to explore alone.";
    groupError.classList.remove("hidden");
    return;
  }

  // Every open lands on the plain map, never carrying over Marauder
  // Mode from a previous session (e.g. Exit -> reopen) — the enchanted
  // view is always a deliberate press of the button, not a leftover state.
  setMarauderMode(false);

  // The full "First Surname" was already decided back in Step 1 — reread
  // from storage rather than the raw first-name field, which would
  // otherwise silently strip the randomly-assigned surname back off.
  marauderNameValue =
    localStorage.getItem("marauderName") ||
    marauderNameValue ||
    "Unknown Marauder";
  localStorage.setItem("marauderName", marauderNameValue);

  if (groupCode) {
    joinRoom(groupCode);
  } else {
    leaveRoomCompletely();
  }

  const ripple = document.getElementById("rippleEffect");
  const mapEl = document.getElementById("map");
  const x = event.clientX || window.innerWidth / 2;
  const y = event.clientY || window.innerHeight / 2;

  ripple.style.top = `${y}px`;
  ripple.style.left = `${x}px`;
  ripple.style.width = "0";
  ripple.style.height = "0";
  ripple.style.opacity = "1";

  fireMagicAt(x, y);

  // Ink-blot reveal: the map is raised above the parchment and shown
  // only within a growing circle centred on the tap point, so the
  // parchment appears "eaten through" by ink spreading to the edges.
  mapEl.style.setProperty("--tap-x", `${x}px`);
  mapEl.style.setProperty("--tap-y", `${y}px`);
  mapEl.classList.add("mapVisible", "revealing");

  requestAnimationFrame(() => {
    ripple.style.width = "200vw";
    ripple.style.height = "200vw";
    ripple.style.opacity = "0";
    mapEl.classList.add("inkReveal");
  });

  setTimeout(() => {
    scrollReveal.style.display = "none";
    // Reveal finished — drop the temporary clip-path/z-index so the map
    // behaves normally again (pannable, unclipped) for the rest of the session.
    mapEl.classList.remove("revealing", "inkReveal");
    mapEl.style.removeProperty("--tap-x");
    mapEl.style.removeProperty("--tap-y");
    mapVignette.classList.add("show");
    parchmentFrame.classList.add("show");
    titleBanner.classList.add("show");
    compassRose.classList.add("show");

    // Force name update before GPS begins
    marauderNameValue = localStorage.getItem("marauderName") || "Unknown Marauder";
    map.invalidateSize();
  }, 1450);
}

// Step 3: Exit → reverse of startMap(). The ink retreats back into the
// exit button's position, taking the map with it, and the blank oath
// parchment returns — ready to be reopened with another "Mischief Managed."
const exitButton = document.getElementById("exitButton");
const mischiefFull = document.getElementById("mischiefFull");

function closeMap() {
  leaveRoomCompletely();
  clearNpcs(); // stop the wander interval immediately rather than leaving it running in the background

  const mapEl = document.getElementById("map");
  const rect = exitButton.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const ripple = document.getElementById("rippleEffect");

  // Snap the ripple to "fully spread" at the exit point with no
  // transition, matching the state the map is actually in right now —
  // then let it retreat, mirroring the opening ripple in reverse.
  ripple.style.transition = "none";
  ripple.style.top = `${y}px`;
  ripple.style.left = `${x}px`;
  ripple.style.width = "200vw";
  ripple.style.height = "200vw";
  ripple.style.opacity = "1";
  void ripple.offsetWidth; // force layout so the snap above isn't animated
  ripple.style.transition = "";

  fireMagicAt(x, y);

  mapEl.style.setProperty("--tap-x", `${x}px`);
  mapEl.style.setProperty("--tap-y", `${y}px`);
  mapEl.classList.add("revealing", "inkReveal"); // clip-path: circle(150%) — visually identical to unclipped, no jump

  mischiefFull.classList.add("show");

  requestAnimationFrame(() => {
    ripple.style.width = "0";
    ripple.style.height = "0";
    ripple.style.opacity = "0";
    mapEl.classList.remove("inkReveal"); // shrinks the circle back to the exit point
  });

  setTimeout(() => {
    mapEl.classList.remove("mapVisible", "revealing");
    mapEl.style.removeProperty("--tap-x");
    mapEl.style.removeProperty("--tap-y");
    mapVignette.classList.remove("show");
    parchmentFrame.classList.remove("show");
    titleBanner.classList.remove("show");
    compassRose.classList.remove("show");
    mischiefFull.classList.remove("show");

    // Consent is asked fresh every time, never silently carried over —
    // the group code can stay pre-filled for convenience, but the tick
    // itself resets so reopening always requires an explicit new "yes".
    consentCheckbox.checked = false;

    // Bring the blank oath parchment back, ready to reopen.
    scrollReveal.style.display = "";
  }, 1450);
}
exitButton.addEventListener("click", closeMap);

enterNameBtn.addEventListener("click", proceedToOath);
nameInput.addEventListener("keypress", e => {
  if (e.key === "Enter") proceedToOath();
});
enterMapBtn.addEventListener("click", e => startMap(e));

// -----------------------------
// Map initialisation
// -----------------------------
// West Herts College, Hempstead Road, Watford, WD17 3EZ
const map = L.map("map").setView([51.6603421, -0.4072999], 17);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// -----------------------------
// Marauder Mode toggle (enchanted parchment view <-> plain real map)
// -----------------------------
// The map opens PLAIN — the oath gets you in, but the enchanted view
// itself is behind the Marauder Mode button, like tapping a wand to
// activate the real map rather than something that's just always on.
let marauderOn = false;
const modeToggleBtn = document.getElementById("modeToggle");
let mischiefTimer = null;

function setMarauderMode(on) {
  const wasOn = marauderOn;
  marauderOn = on;
  document.body.classList.toggle("plainMode", !on);
  modeToggleBtn.textContent = on ? "Reveal Real Map" : "Marauder Mode";
  modeToggleBtn.classList.toggle("active", on);

  // The wand-tap moment: switching plain -> enchanted gets the same ink
  // ripple + wand + confetti as opening the map in the first place,
  // centred on the button rather than a random tap point. Ambient film
  // characters also start wandering — they're part of the enchantment,
  // not something a plain accurate map should show.
  if (!wasOn && on) {
    const rect = modeToggleBtn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    fireInkRippleAt(x, y);
    fireMagicAt(x, y);
    spawnNpcs();
  } else if (wasOn && !on) {
    clearNpcs();
  }

  // This toggle IS the privacy switch for the friend-presence feature —
  // switching off stops both sending your position and receiving
  // friends', not just hiding them visually. Switching back on resumes
  // the same room, no need to re-enter the code.
  if (currentRoomCode) {
    if (on) {
      startRoomListener(currentRoomCode);
    } else {
      pauseRoomListener();
    }
  }

  // Closing half of the film's ritual phrase pair — the oath reveals
  // the map, "Mischief Managed" is the flourish for hiding it again.
  if (wasOn && !on) {
    clearTimeout(mischiefTimer);
    mischiefToast.classList.add("show");
    mischiefTimer = setTimeout(() => mischiefToast.classList.remove("show"), 1800);
  }
}
modeToggleBtn.addEventListener("click", () => setMarauderMode(!marauderOn));
setMarauderMode(false);

// -----------------------------
// Saved markers from localStorage
// -----------------------------
let savedMarkers = JSON.parse(localStorage.getItem("westhertsMarkers")) || [];

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
    html: `<div class="mapLabelWrap"><span class="placeLabelText">${name}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 12]
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
    localStorage.setItem("westhertsMarkers", JSON.stringify(savedMarkers));
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

// -----------------------------
// Ambient film characters — pure decoration, never real people. A
// handful wander near you while Marauder Mode is on and vanish the
// moment it's switched off, same as footprints/friends.
// -----------------------------
const NPC_ROSTER = [
  "Dobby", "Hagrid", "Luna Lovegood", "Peeves", "Moaning Myrtle",
  "Nearly Headless Nick", "Fang", "Professor McGonagall", "Filch",
  "Madam Pomfrey", "Professor Flitwick", "Kreacher", "Winky",
  "The Grey Lady", "The Fat Friar", "Professor Sprout", "Professor Snape"
];
const NPC_SNAPE_NAME = "Professor Snape";
const NPC_SNAPE_AVOID_RADIUS_M = 35; // everyone else keeps this far from him if they can help it
const NPC_COUNT = 7;
const NPC_STEP_MS = 3000; // how often each one takes a "step"
const NPC_SPAWN_MIN_M = 100; // never spawn closer than this to you — stops them clustering around your dot
const NPC_SPAWN_SPREAD_M = 400; // scattered out to roughly this far, so zooming out reveals more of them
const NPC_WANDER_RADIUS_M = 45; // how far each one roams from ITS OWN spot once placed — local, not a march toward you or anyone else

let npcs = []; // { name, pin, label, lat, lon, homeLat, homeLon }
let npcInterval = null;

function metersToDegLat(m) {
  return m / 111320;
}
function metersToDegLon(m, atLat) {
  return m / (111320 * Math.cos((atLat * Math.PI) / 180));
}

function spawnNpcs() {
  clearNpcs();
  const center = userMarker ? userMarker.getLatLng() : map.getCenter();
  // A fresh shuffle + fresh angles/distances every single spawn (every
  // Marauder Mode toggle-on) — genuinely randomised each time, not a
  // fixed pattern, and never synced/visible to anyone else (see note
  // in the surrounding comment block — this is purely local to your
  // own screen, so there's nothing to "repeat" between different
  // people even when several friends are in the same group).
  const chosen = [...NPC_ROSTER].sort(() => Math.random() - 0.5).slice(0, NPC_COUNT);

  chosen.forEach(name => {
    const angle = Math.random() * Math.PI * 2;
    const dist = NPC_SPAWN_MIN_M + Math.random() * NPC_SPAWN_SPREAD_M;
    const lat = center.lat + metersToDegLat(Math.cos(angle) * dist);
    const lon = center.lng + metersToDegLon(Math.sin(angle) * dist, center.lat);

    // A plain divIcon (not L.circleMarker) so it moves via CSS transform
    // like everything else on the map — that's what lets .npcMoving's
    // CSS transition smooth each step into a glide instead of a snap.
    const dotIcon = L.divIcon({
      className: "npcMoving",
      html: '<div class="npcDot"></div>',
      iconSize: [10, 10],
      iconAnchor: [5, 5]
    });
    const pin = L.marker([lat, lon], { icon: dotIcon, interactive: false }).addTo(map);

    const labelIcon = L.divIcon({
      className: "npcLabelIcon npcMoving",
      html: `<div class="mapLabelWrap"><div class="marauderNameLabel npcLabel">${name}</div></div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 40]
    });
    const label = L.marker([lat, lon], { icon: labelIcon, interactive: false }).addTo(map);

    // "Home" is THIS character's own spawn spot, not your position —
    // otherwise the wander-back logic below would pull every one of
    // them toward you instead of letting them roam their own patch.
    npcs.push({ name, pin, label, lat, lon, homeLat: lat, homeLon: lon });
  });

  npcInterval = setInterval(stepNpcs, NPC_STEP_MS);
}

function stepNpcs() {
  const snape = npcs.find(n => n.name === NPC_SNAPE_NAME);

  npcs.forEach(npc => {
    const prevLat = npc.lat;
    const prevLon = npc.lon;

    let angle;

    // Nobody wants to be near Snape. Takes priority over everything
    // else — even heading home — while he's actually close by.
    if (snape && npc !== snape) {
      const distFromSnapeM = Math.hypot(
        (npc.lat - snape.lat) * 111320,
        (npc.lon - snape.lon) * 111320 * Math.cos((npc.lat * Math.PI) / 180)
      );
      if (distFromSnapeM < NPC_SNAPE_AVOID_RADIUS_M) {
        angle = Math.atan2(npc.lon - snape.lon, npc.lat - snape.lat) + (Math.random() - 0.5) * 0.8;
      }
    }

    if (angle === undefined) {
      const distFromHomeM = Math.hypot(
        (npc.lat - npc.homeLat) * 111320,
        (npc.lon - npc.homeLon) * 111320 * Math.cos((npc.homeLat * Math.PI) / 180)
      );

      // Wandered too far from where they spawned — head roughly back
      // home (with a little wobble) instead of drifting off indefinitely.
      if (distFromHomeM > NPC_WANDER_RADIUS_M) {
        angle = Math.atan2(npc.homeLon - npc.lon, npc.homeLat - npc.lat) + (Math.random() - 0.5) * 1.2;
      } else {
        angle = Math.random() * Math.PI * 2;
      }
    }

    const dist = 4 + Math.random() * 8; // metres this step
    const newLat = npc.lat + metersToDegLat(Math.cos(angle) * dist);
    const newLon = npc.lon + metersToDegLon(Math.sin(angle) * dist, npc.lat);

    npc.lat = newLat;
    npc.lon = newLon;
    npc.pin.setLatLng([newLat, newLon]);
    npc.label.setLatLng([newLat, newLon]);

    // Leave a footprint behind at the step they just took — same visual
    // as real footprints, reinforcing "someone just walked through here."
    dropFootprint(prevLat, prevLon, bearingBetween(prevLat, prevLon, newLat, newLon));
  });
}

function clearNpcs() {
  if (npcInterval) {
    clearInterval(npcInterval);
    npcInterval = null;
  }
  npcs.forEach(npc => {
    map.removeLayer(npc.pin);
    map.removeLayer(npc.label);
  });
  npcs = [];
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

        // add marauder's name label — iconSize [0,0] lets the wrapper
        // collapse to a point; the label sizes to its own text and
        // centers itself via CSS (.mapLabelWrap), so long names grow
        // the tag instead of overflowing or drifting off-centre.
        const nameIcon = L.divIcon({
          className: "marauderNameIcon",
          html: `<div class="mapLabelWrap"><div class="marauderNameLabel">${currentName}</div></div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 40]
        });

        nameLabel = L.marker([lat, lon], { icon: nameIcon, interactive: false }).addTo(map);

        setTimeout(() => map.setView([lat, lon], 18), 500);
      } else {
        // footfall trail, replacing the old plain dot trail — only
        // while Marauder Mode is on, since footprints are part of the
        // magic, not something a plain accurate map should show.
        if (marauderOn) {
          const prev = userMarker.getLatLng();
          const jitterLat = prev.lat + (Math.random() - 0.5) * 0.00003;
          const jitterLon = prev.lng + (Math.random() - 0.5) * 0.00003;
          const bearingDeg = bearingBetween(prev.lat, prev.lng, lat, lon);
          dropFootprint(jitterLat, jitterLon, bearingDeg);
        }

        // update position + label text live
        userMarker.setLatLng([lat, lon]);
        nameLabel.setLatLng([lat, lon]);

        // Update the name text only if it actually changed, and only the
        // text itself — not the whole element. Replacing the element (as
        // this used to do, every single GPS tick) restarts the ink-fade-in
        // animation each time, which is what was making the tag flash on
        // and off on phones where GPS updates fire often.
        const labelDiv = nameLabel.getElement();
        const innerLabel = labelDiv && labelDiv.querySelector(".marauderNameLabel");
        if (innerLabel && innerLabel.textContent !== currentName) {
          innerLabel.textContent = currentName;
        }
      }

      // Share position with the group only while Marauder Mode is on —
      // writeMyPosition() itself no-ops if no room has been joined.
      if (marauderOn) writeMyPosition(lat, lon, currentName);
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
