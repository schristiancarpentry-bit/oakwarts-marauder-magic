// -----------------------------
// Friend presence (Firebase Firestore backend)
//
// Loaded BEFORE script.js — the functions below only touch `map`/`L`
// inside function bodies (never at the top level), so it's safe for
// script.js to define those later and call these functions afterwards.
//
// Design (see project memory for the full discussion):
//  - Each friend group makes up its own room code — there's no single
//    shared password, and no way to list/discover other rooms.
//  - The Marauder Mode toggle IS the privacy switch: writing your
//    position and listening for friends only happens while it's on.
//  - Live position only — every write overwrites the last, never an
//    accumulating history.
//  - Staleness is handled client-side (fade at 2 min, hide at 5 min)
//    since Firestore has no equivalent to Realtime Database's
//    onDisconnect(); we also best-effort delete our own doc on unload.
// -----------------------------

const firebaseConfig = {
  projectId: "oakwarts-marauder-map",
  appId: "1:1046151998021:web:90f9fcdbf3a8678100512c",
  apiKey: "AIzaSyAg1ZXkHzN7BQaic2-U8EVGPp7cSohQXSU",
  authDomain: "oakwarts-marauder-map.firebaseapp.com"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const STALE_FADE_MS = 2 * 60 * 1000; // fade a friend's marker after 2 minutes of silence
const STALE_HIDE_MS = 5 * 60 * 1000; // stop showing them entirely after 5 minutes
const WRITE_THROTTLE_MS = 8000; // don't write to Firestore on every single GPS tick

let currentRoomCode = null;
let myMemberId = null;
let unsubscribeRoom = null;
let lastWrittenAt = 0;
let friendMarkers = {}; // memberId -> { pin, label }

function randomMemberId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const CODE_WORDS = ["wizards", "phoenix", "griffin", "serpent", "badger", "raven", "willow", "thestral", "niffler", "patronus"];
function generateGroupCode() {
  const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  return word + Math.floor(10 + Math.random() * 90);
}

function roomRef(code) {
  return db.collection("rooms").doc(code).collection("marauders");
}

// Clears rendered friend markers without touching Firestore.
function clearFriendMarkers() {
  Object.values(friendMarkers).forEach(m => {
    map.removeLayer(m.pin);
    map.removeLayer(m.label);
  });
  friendMarkers = {};
}

function updateMemberList(friends) {
  const list = document.getElementById("memberList");
  const toggle = document.getElementById("memberListToggle");
  const items = document.getElementById("memberListItems");
  if (!currentRoomCode) {
    list.classList.add("hidden");
    return;
  }
  list.classList.remove("hidden");
  const activeCount = friends.filter(f => !f.hidden).length + 1; // +1 for you
  toggle.textContent = `${activeCount} in group`;
  items.innerHTML = "";
  const meItem = document.createElement("li");
  meItem.textContent = "You";
  items.appendChild(meItem);
  friends.forEach(f => {
    if (f.hidden) return;
    const li = document.createElement("li");
    li.textContent = f.name + (f.stale ? " (away)" : "");
    items.appendChild(li);
  });
}

function renderFriends(friends) {
  const seen = new Set();
  friends.forEach(f => {
    seen.add(f.id);
    if (f.hidden) {
      if (friendMarkers[f.id]) {
        map.removeLayer(friendMarkers[f.id].pin);
        map.removeLayer(friendMarkers[f.id].label);
        delete friendMarkers[f.id];
      }
      return;
    }

    const opacity = f.stale ? 0.35 : 1;

    if (!friendMarkers[f.id]) {
      const pin = L.circleMarker([f.lat, f.lon], {
        radius: 6,
        color: "#a56a1e",
        fillColor: "#d9a24a",
        fillOpacity: 0.9
      }).addTo(map);

      const labelIcon = L.divIcon({
        className: "friendLabelIcon",
        html: `<div class="mapLabelWrap"><div class="marauderNameLabel friendLabel">${f.name}</div></div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 40]
      });
      const label = L.marker([f.lat, f.lon], { icon: labelIcon, interactive: false }).addTo(map);
      friendMarkers[f.id] = { pin, label };
    } else {
      friendMarkers[f.id].pin.setLatLng([f.lat, f.lon]);
      friendMarkers[f.id].label.setLatLng([f.lat, f.lon]);
      // Update text only, not the whole element — same fix as the "you"
      // label in script.js, avoids needless DOM churn on every snapshot.
      const labelDiv = friendMarkers[f.id].label.getElement();
      const innerLabel = labelDiv && labelDiv.querySelector(".marauderNameLabel");
      if (innerLabel && innerLabel.textContent !== f.name) {
        innerLabel.textContent = f.name;
      }
    }

    friendMarkers[f.id].pin.setStyle({ opacity, fillOpacity: opacity * 0.9 });
    const labelEl = friendMarkers[f.id].label.getElement();
    if (labelEl) labelEl.style.opacity = opacity;
  });

  // Anything no longer in the snapshot at all (doc deleted) — remove.
  Object.keys(friendMarkers).forEach(id => {
    if (!seen.has(id)) {
      map.removeLayer(friendMarkers[id].pin);
      map.removeLayer(friendMarkers[id].label);
      delete friendMarkers[id];
    }
  });
}

function handleSnapshot(snapshot) {
  const now = Date.now();
  const friends = [];
  snapshot.forEach(doc => {
    if (doc.id === myMemberId) return; // never show yourself as a "friend"
    const data = doc.data();
    const updatedAt = data.updatedAt && data.updatedAt.toMillis ? data.updatedAt.toMillis() : 0;
    const age = now - updatedAt;
    friends.push({
      id: doc.id,
      name: data.name || "Unknown Marauder",
      lat: data.lat,
      lon: data.lon,
      stale: age > STALE_FADE_MS,
      hidden: age > STALE_HIDE_MS
    });
  });
  renderFriends(friends);
  updateMemberList(friends);
}

// Starts (or resumes) listening for friends in the given room.
function startRoomListener(code) {
  if (unsubscribeRoom) unsubscribeRoom();
  unsubscribeRoom = roomRef(code).onSnapshot(handleSnapshot, err => {
    console.error("Room listen error:", err);
  });
}

// Pauses listening/showing friends without leaving the room — used
// when Marauder Mode is switched off. The room code is remembered so
// switching back on resumes it.
function pauseRoomListener() {
  if (unsubscribeRoom) {
    unsubscribeRoom();
    unsubscribeRoom = null;
  }
  clearFriendMarkers();
  updateMemberList([]);
}

// Group codes double as Firestore document IDs, so strip anything that
// isn't alphanumeric/hyphen before using one — a stray "/" or similar
// would otherwise silently break (or misdirect) the room path.
function sanitizeCode(code) {
  return code.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
}

// Joins a fresh room, replacing whatever was joined before. Deliberately
// does NOT start listening here — the map opens plain, so friends only
// appear once Marauder Mode is actually switched on (see setMarauderMode
// in script.js, which starts/stops the listener based on currentRoomCode).
function joinRoom(code) {
  leaveRoomCompletely();
  currentRoomCode = sanitizeCode(code);
  if (!currentRoomCode) return; // nothing left after sanitizing — treat as solo
  myMemberId = randomMemberId();
}

// Fully leaves the room: stops listening, deletes your own presence
// doc so friends see you gone immediately rather than waiting for the
// staleness fade, and forgets the room code entirely.
function leaveRoomCompletely() {
  if (unsubscribeRoom) {
    unsubscribeRoom();
    unsubscribeRoom = null;
  }
  if (currentRoomCode && myMemberId) {
    roomRef(currentRoomCode).doc(myMemberId).delete().catch(() => {});
  }
  currentRoomCode = null;
  myMemberId = null;
  clearFriendMarkers();
  updateMemberList([]);
}

// Throttled position write — no-ops if no room is joined. Call this
// from the GPS callback only while Marauder Mode is on.
function writeMyPosition(lat, lon, name) {
  if (!currentRoomCode || !myMemberId) return;
  const now = Date.now();
  if (now - lastWrittenAt < WRITE_THROTTLE_MS) return;
  lastWrittenAt = now;
  roomRef(currentRoomCode).doc(myMemberId).set({
    name,
    lat,
    lon,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(err => console.error("Position write error:", err));
}

// Best-effort cleanup if the tab is actually closed while still in a
// room — Firestore has no server-side "on disconnect", so this is a
// courtesy, not a guarantee. The 5-minute staleness hide is what
// actually keeps ghosts off the map if this never fires.
window.addEventListener("pagehide", () => {
  if (currentRoomCode && myMemberId) {
    roomRef(currentRoomCode).doc(myMemberId).delete().catch(() => {});
  }
});
