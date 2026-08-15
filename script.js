// -----------------------------
// Scroll + name logic
// -----------------------------

let marauderNameValue = ""; // start blank
// True only once the ink-blot reveal has actually finished and the map
// is genuinely on screen — guards the GPS callback below so it can't
// create your marker early, before your name/house are decided.
let hasEnteredMap = false;

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

// The four houses. "color" is used everywhere (name-tag border,
// confetti burst) — Hufflepuff's is deliberately darker than the real
// house yellow (#FFDB00), which fails contrast against the cream
// parchment background.
const HOUSES = [
  { name: "Gryffindor", color: "#740001", accent: "#d3a625" },
  { name: "Slytherin", color: "#1a472a", accent: "#8a8a8a" },
  { name: "Hufflepuff", color: "#8a6d00", accent: "#2b1d10" },
  { name: "Ravenclaw", color: "#0e1a40", accent: "#946b2d" }
];
function randomHouse() {
  return HOUSES[Math.floor(Math.random() * HOUSES.length)];
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

// Lets whoever started (or joined) a group actually see and share the
// code — previously it vanished the moment you left the oath screen,
// with no way to tell a friend what to type in.
const memberListCodeCopyBtn = document.getElementById("memberListCodeCopy");
memberListCodeCopyBtn.addEventListener("click", () => {
  if (!currentRoomCode) return;
  const done = () => {
    const original = memberListCodeCopyBtn.textContent;
    memberListCodeCopyBtn.textContent = "Copied!";
    setTimeout(() => { memberListCodeCopyBtn.textContent = original; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(currentRoomCode).then(done).catch(() => {});
  }
});

// Parchment/ink/gold — kept consistent with the rest of the theme
// rather than generic rainbow confetti.
const CONFETTI_COLORS = ["#ffd700", "#d9a24a", "#f5ecd7", "#6e1f16", "#2b1d10"];

// A circular "wand tap" burst centred on a screen point. canvas-confetti
// takes fractional viewport coordinates (0-1), not pixels. Pass a
// `colors` array to override the default parchment/ink palette — used
// for the Sorting reveal, which bursts in the assigned house's colours.
function fireConfetti(x, y, colors) {
  if (typeof confetti !== "function") return; // CDN blocked/offline — fail quietly
  confetti({
    particleCount: 90,
    spread: 360,
    startVelocity: 32,
    ticks: 90,
    gravity: 0.9,
    scalar: 0.9,
    colors: colors || CONFETTI_COLORS,
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

// Step 1: enter name -> Step 1.5: get Sorted
const scrollSorting = document.getElementById("scrollSorting");
const sortingHat = document.getElementById("sortingHat");
const sortingStatus = document.getElementById("sortingStatus");
const sortingResult = document.getElementById("sortingResult");
const sortingHouseName = document.getElementById("sortingHouseName");
const sortingFullName = document.getElementById("sortingFullName");
const continueSortingBtn = document.getElementById("continueSorting");
let marauderHouse = null; // { name, color, accent }

function proceedToSorting() {
  const firstName = nameInput.value.trim();
  marauderNameValue = firstName ? `${firstName} ${randomSurname()}` : "Unknown Marauder";
  localStorage.setItem("marauderName", marauderNameValue);

  scrollIntro.style.animation = "rollUp 1s ease-in-out forwards";
  setTimeout(() => {
    scrollIntro.style.display = "none";
    scrollSorting.style.opacity = 1;
    scrollSorting.style.pointerEvents = "auto";
    runSorting();
  }, 1000);
}

// Speaks a line as the Hat, using whatever voice the browser has —
// no audio file to source, works immediately everywhere the Web
// Speech API exists. Pitched down and slowed slightly for a more
// "ancient talking hat" read than a flat default TTS voice.
function speakAsHat(text) {
  if (!("speechSynthesis" in window)) return; // unsupported browser — fail quietly
  speechSynthesis.cancel(); // don't let two Sortings queue up and overlap
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.85;
  utter.pitch = 0.55;
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => /male|david|daniel|george|arthur|ryan|guy/i.test(v.name));
  if (preferred) utter.voice = preferred;
  speechSynthesis.speak(utter);
}

function runSorting() {
  // Reset in case someone's been Sorted before this session (Exit -> reopen).
  sortingHat.classList.remove("decided");
  sortingStatus.classList.remove("hidden");
  sortingResult.classList.add("hidden");
  continueSortingBtn.classList.add("hidden");

  // "What do we have here?" -> a genuine 2s silent pause (just the hat
  // wobbling, no speech — TTS engines can't convincingly drawl out a
  // wordless "hmmmm", so a real held pause reads as thinking far
  // better than trying to stretch a nonsense sound) -> "I have it!
  // You are a—" -> reveal completes the sentence with the house name.
  sortingStatus.textContent = "What do we have here?";
  speakAsHat("What do we have here?");

  setTimeout(() => {
    sortingStatus.textContent = "I have it! You are a...";
    speakAsHat("I have it! You are a...");
  }, 4000);

  setTimeout(() => {
    marauderHouse = randomHouse();
    localStorage.setItem("marauderHouse", JSON.stringify(marauderHouse));

    sortingHat.classList.add("decided");
    sortingStatus.classList.add("hidden");
    sortingHouseName.textContent = marauderHouse.name.toUpperCase() + "!";
    sortingHouseName.style.color = marauderHouse.color;
    sortingFullName.textContent = marauderNameValue;
    sortingResult.classList.remove("hidden");
    continueSortingBtn.classList.remove("hidden");
    speakAsHat(marauderHouse.name + "!");

    const rect = sortingHat.getBoundingClientRect();
    fireConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, [marauderHouse.color, marauderHouse.accent, "#f5ecd7"]);
  }, 6800);
}

continueSortingBtn.addEventListener("click", () => {
  scrollSorting.style.opacity = 0;
  scrollSorting.style.pointerEvents = "none";
  scrollReveal.style.opacity = 1;
  scrollReveal.style.pointerEvents = "auto";
});

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

    // Force name update, then let the GPS callback actually start
    // creating/moving your marker — see hasEnteredMap above. If a fix
    // already arrived while we were still on the name/Sorting screens,
    // use it right now instead of waiting on a fresh one that might be
    // a long time coming on some phones.
    marauderNameValue = localStorage.getItem("marauderName") || "Unknown Marauder";
    hasEnteredMap = true;
    if (lastKnownPos) handlePosition(lastKnownPos);
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

// Snaps the view back to your own position — for when you've zoomed
// or panned away looking around and want to find yourself again.
const recentreButton = document.getElementById("recentreButton");
recentreButton.addEventListener("click", () => {
  if (userMarker) map.setView(userMarker.getLatLng(), 18);
});

enterNameBtn.addEventListener("click", proceedToSorting);
nameInput.addEventListener("keypress", e => {
  if (e.key === "Enter") proceedToSorting();
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

  // Writing your position only happens inside a live GPS callback —
  // toggling this on doesn't itself send anything. If you're stationary
  // (very likely mid-test), the browser might not fire another GPS
  // update for a long time, so nothing would ever actually reach
  // Firestore. Same fix as the map-open case: replay the last known
  // position immediately rather than waiting on a fresh callback.
  if (on && lastKnownPos) handlePosition(lastKnownPos);

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

// Markers saved before the delete feature existed have no id — give
// them one now so "Remove marker" works on those too, not just new ones.
if (savedMarkers.some(m => !m.id)) {
  savedMarkers.forEach(m => { if (!m.id) m.id = randomMarkerId(); });
  localStorage.setItem("westhertsMarkers", JSON.stringify(savedMarkers));
}

// Pins used to be added straight to the map, outside any layer group —
// renderMarkers() only ever cleared labelLayer, so re-rendering after a
// delete would leave the old pins behind and duplicate the remaining
// ones on top. Both pins and labels now live in their own layer group
// so a full clear+rebuild is actually clean.
const pinLayer = L.layerGroup().addTo(map);
const labelLayer = L.layerGroup().addTo(map);

const inkPinIcon = L.divIcon({
  className: "inkPinIcon",
  html: '<div class="inkPin"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

function randomMarkerId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function addMarkerAndLabel(lat, lon, name, id) {
  const pin = L.marker([lat, lon], { icon: inkPinIcon });
  pin.bindPopup(
    `<b>${name}</b><br>Lat: ${lat}<br>Lon: ${lon}` +
    `<br><button class="popupDeleteBtn" data-marker-id="${id}">Remove marker</button>`
  );
  pinLayer.addLayer(pin);

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
  pinLayer.clearLayers();
  labelLayer.clearLayers();
  savedMarkers.forEach(m => addMarkerAndLabel(m.lat, m.lon, m.name, m.id));
}
renderMarkers();

function removeMarker(id) {
  savedMarkers = savedMarkers.filter(m => m.id !== id);
  localStorage.setItem("westhertsMarkers", JSON.stringify(savedMarkers));
  renderMarkers();
}

// Leaflet deliberately stops clicks inside a popup from bubbling out
// (that's what stops "click the map to add a marker" firing when you
// click inside a popup) — which also means a delegated listener on
// #map would never see this click. Using Leaflet's own popupopen event
// instead: it hands us the freshly-created popup DOM directly, so we
// can wire the button up right there, no bubbling required.
map.on("popupopen", e => {
  const el = e.popup.getElement();
  const btn = el && el.querySelector(".popupDeleteBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      removeMarker(btn.dataset.markerId);
      map.closePopup();
    });
  }
});

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
    const id = randomMarkerId();
    addMarkerAndLabel(pendingLatLng.lat, pendingLatLng.lon, name, id);
    savedMarkers.push({ id, name, lat: pendingLatLng.lat, lon: pendingLatLng.lon });
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

function getMarauderName() {
  // Always read the freshest name from storage
  return localStorage.getItem("marauderName") || marauderNameValue || "Unknown Marauder";
}

function getMarauderHouseColor() {
  if (marauderHouse) return marauderHouse.color;
  try {
    const stored = JSON.parse(localStorage.getItem("marauderHouse"));
    return (stored && stored.color) || null;
  } catch (e) {
    return null;
  }
}

// A cream ink dot at each step — not a directional shoe shape, since a
// bearing computed from two consecutive raw GPS fixes is often just
// wrong at pedestrian scale (ordinary GPS jitter overwhelms the "true"
// direction over a couple of steps). See .foot in style.css.
function dropFootprint(lat, lon) {
  const footIcon = L.divIcon({
    className: "footprintMarker",
    html: `<div class="footprint-icon"><div class="foot"></div></div>`,
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

// Harry, Ron and Hermione always show up together — clearly "up to
// something" — rather than being left to the same random chance as
// everyone else in NPC_ROSTER. They spawn as a tight cluster and
// actively stick close to each other as they wander.
const TRIO_NAMES = ["Harry Potter", "Ron Weasley", "Hermione Granger"];
const NPC_TRIO_SPAWN_SPREAD_M = 12; // how close together they spawn
const NPC_TRIO_COHESION_RADIUS_M = 25; // drift further than this from the group and you head back

let npcs = []; // { name, pin, label, lat, lon, homeLat, homeLon }
let npcInterval = null;

function metersToDegLat(m) {
  return m / 111320;
}
function metersToDegLon(m, atLat) {
  return m / (111320 * Math.cos((atLat * Math.PI) / 180));
}

// Creates one NPC marker (dot + label) at a given point and adds it to
// the npcs array. Shared by the general roster and the trio spawn below.
function spawnOneNpc(name, lat, lon) {
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
    spawnOneNpc(name, lat, lon);
  });

  // The trio: one shared spawn point, each of the three placed a few
  // metres from it — always present, always clustered together.
  const trioAngle = Math.random() * Math.PI * 2;
  const trioDist = NPC_SPAWN_MIN_M + Math.random() * NPC_SPAWN_SPREAD_M;
  const trioLat = center.lat + metersToDegLat(Math.cos(trioAngle) * trioDist);
  const trioLon = center.lng + metersToDegLon(Math.sin(trioAngle) * trioDist, center.lat);

  TRIO_NAMES.forEach(name => {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * NPC_TRIO_SPAWN_SPREAD_M;
    const lat = trioLat + metersToDegLat(Math.cos(angle) * dist);
    const lon = trioLon + metersToDegLon(Math.sin(angle) * dist, trioLat);
    spawnOneNpc(name, lat, lon);
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

    // Harry, Ron and Hermione stick together — if this one's drifted
    // too far from the other two, head back toward them instead of
    // wandering off solo.
    if (angle === undefined && TRIO_NAMES.includes(npc.name)) {
      const others = npcs.filter(n => TRIO_NAMES.includes(n.name) && n !== npc);
      if (others.length) {
        const groupLat = others.reduce((sum, n) => sum + n.lat, 0) / others.length;
        const groupLon = others.reduce((sum, n) => sum + n.lon, 0) / others.length;
        const distFromGroupM = Math.hypot(
          (npc.lat - groupLat) * 111320,
          (npc.lon - groupLon) * 111320 * Math.cos((npc.lat * Math.PI) / 180)
        );
        if (distFromGroupM > NPC_TRIO_COHESION_RADIUS_M) {
          angle = Math.atan2(groupLon - npc.lon, groupLat - npc.lat) + (Math.random() - 0.5) * 0.6;
        }
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
    dropFootprint(prevLat, prevLon);
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

// Split out from the watchPosition callback so a position that arrived
// BEFORE the map opened can be replayed immediately the moment it does
// (see lastKnownPos below) — some phones (especially stationary/indoors)
// won't fire another GPS update for a long time afterward, so simply
// discarding an early fix could leave the map stuck with no marker and
// no recentre for minutes.
function handlePosition(pos) {
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
    const houseColor = getMarauderHouseColor();
    const houseStyle = houseColor ? ` style="--house-color:${houseColor}"` : "";
    const nameIcon = L.divIcon({
      className: "marauderNameIcon",
      html: `<div class="mapLabelWrap"><div class="marauderNameLabel"${houseStyle}>${currentName}</div></div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 40]
    });

    nameLabel = L.marker([lat, lon], { icon: nameIcon, interactive: false }).addTo(map);

    setTimeout(() => map.setView([lat, lon], 18), 500);
  } else {
    // footfall trail — only while Marauder Mode is on, since it's
    // part of the magic, not something a plain accurate map should show.
    if (marauderOn) {
      const prev = userMarker.getLatLng();
      const jitterLat = prev.lat + (Math.random() - 0.5) * 0.00003;
      const jitterLon = prev.lng + (Math.random() - 0.5) * 0.00003;
      dropFootprint(jitterLat, jitterLon);
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
  if (marauderOn) writeMyPosition(lat, lon, currentName, getMarauderHouseColor());
}

// The most recent position, kept even while hasEnteredMap is still
// false, so it can be replayed the instant the map opens instead of
// waiting on a fresh GPS callback that might not arrive for a while.
let lastKnownPos = null;

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    pos => {
      lastKnownPos = pos;
      // GPS starts watching the moment the page loads — completely
      // independent of the oath/Sorting flow. Without this guard, a fix
      // arriving while still on the name-entry or Sorting screen would
      // create the "you" marker right then, using whatever name/house
      // state happened to exist at that instant (often "Unknown
      // Marauder" and no house at all, since Sorting hasn't run yet).
      // The name text self-corrects on the next tick, but the house
      // colour never does — it's only ever set once, at creation — so
      // this was the real cause of "the hat says one thing, the map
      // shows another." (See handlePosition() above for why the early
      // fix is cached rather than just dropped.)
      if (!hasEnteredMap) return;
      handlePosition(pos);
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
