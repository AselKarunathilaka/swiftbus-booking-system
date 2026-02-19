// public/js/admin.js
import { db } from "./firebase-config.js";
import { logout, requireAuth } from "./auth.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc,
  query, orderBy, onSnapshot, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// --- Toast Notification Helper ---
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if(!container) return alert(msg);
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> ${msg}`;
  container.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

const logoutBtn = document.getElementById("logoutBtn");

// Elements
const fromIn = document.getElementById("fromIn");
const toIn = document.getElementById("toIn");
const addRouteBtn = document.getElementById("addRouteBtn");
const routesBody = document.getElementById("routesBody");
const routeSel = document.getElementById("routeSel");

const dateIn = document.getElementById("dateIn");
const timeIn = document.getElementById("timeIn");
const priceIn = document.getElementById("priceIn");
const addScheduleBtn = document.getElementById("addScheduleBtn");
const schedBody = document.getElementById("schedBody");

const filterInput = document.getElementById("filterSchedule");
const applyFilterBtn = document.getElementById("applyFilterBtn");
const bookingsBody = document.getElementById("bookingsBody");

const kpiRoutes = document.getElementById("kpiRoutes");
const kpiSchedules = document.getElementById("kpiSchedules");
const kpiBookings = document.getElementById("kpiBookings");

// --- GLOBAL DATA CACHE (The Secret Sauce) ---
let routeCache = {};      // routeID -> {from, to}
let scheduleCache = {};   // scheduleID -> {time, routeId, date}
let allBookingsData = []; // raw bookings

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await logout();
    window.location.href = "./login.html";
  });
}

// ----------------------
// 1. ROUTES
// ----------------------
function listenRoutes() {
  const q = query(collection(db, "routes"), orderBy("from"));

  onSnapshot(q, (snap) => {
    routesBody.innerHTML = "";
    routeSel.innerHTML = `<option value="">Select Route</option>`;
    routeCache = {};
    let activeCount = 0;

    snap.forEach(d => {
      const r = d.data();

      routeCache[d.id] = r;

      if (r.isActive) activeCount++;

      if (r.isActive) {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${r.from} ➝ ${r.to}`;
        routeSel.appendChild(opt);
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${r.from}</b> ➝ <b>${r.to}</b></td>
        <td><span class="badge ${r.isActive ? 'green' : 'gray'}">${r.isActive ? 'Active' : 'Disabled'}</span></td>
        <td>
          <button class="btn small" onclick="window.toggleRoute('${d.id}', ${!r.isActive})">
            ${r.isActive ? 'Disable' : 'Enable'}
          </button>
          <button class="btn small danger" onclick="window.deleteRoute('${d.id}')">Delete</button>
        </td>
      `;
      routesBody.appendChild(tr);
    });

    if (kpiRoutes) kpiRoutes.textContent = activeCount;

    // refresh bookings table (route names become available)
    renderBookingsTable(filterInput ? filterInput.value : "");
  });
}

addRouteBtn.addEventListener("click", async () => {
  const fromVal = fromIn.value.trim();
  const toVal = toIn.value.trim();

  if (fromVal.length < 2 || toVal.length < 2) return toast("City names too short", "error");

  addRouteBtn.disabled = true;
  addRouteBtn.textContent = "Adding...";

  try {
    await addDoc(collection(db, "routes"), {
      from: fromVal,
      to: toVal,
      isActive: true,
      createdAt: serverTimestamp()
    });

    toast("Route added!");
    fromIn.value = "";
    toIn.value = "";
  } catch (e) {
    console.error(e);
    toast("Failed to add route", "error");
  } finally {
    addRouteBtn.disabled = false;
    addRouteBtn.textContent = "Add Route";
  }
});

window.toggleRoute = async (id, val) => {
  try {
    await updateDoc(doc(db, "routes", id), { isActive: val });
    toast(val ? "Route enabled" : "Route disabled");
  } catch (e) {
    console.error(e);
    toast("Failed to update route", "error");
  }
};

window.deleteRoute = async (id) => {
  if (!confirm("Delete route? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "routes", id));
    toast("Route deleted");
  } catch (e) {
    console.error(e);
    toast("Failed to delete route", "error");
  }
};

// ----------------------
// 2. SCHEDULES
// ----------------------
function listenSchedules() {
  const q = query(collection(db, "schedules"), orderBy("date"), orderBy("time"));

  onSnapshot(q, (snap) => {
    schedBody.innerHTML = "";
    scheduleCache = {};
    let count = 0;

    snap.forEach(d => {
      const s = d.data();
      scheduleCache[d.id] = s;
      count++;

      const r = routeCache[s.routeId];
      const routeName = r ? `${r.from} ➝ ${r.to}` : "Unknown Route";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${routeName}</b></td>
        <td>${s.date}</td>
        <td>${s.time}</td>
        <td>${s.price}</td>
        <td>
          <button class="btn small danger" onclick="window.deleteSchedule('${d.id}')">Delete</button>
        </td>
      `;
      schedBody.appendChild(tr);
    });

    if (kpiSchedules) kpiSchedules.textContent = count;

    // refresh bookings table (schedule time becomes available)
    renderBookingsTable(filterInput ? filterInput.value : "");
  });
}

addScheduleBtn.addEventListener("click", async () => {
  const routeId = routeSel.value;
  const dateVal = dateIn.value;
  const timeVal = timeIn.value;
  const priceVal = parseFloat(priceIn.value);

  if (!routeId) return toast("Select a route first", "error");
  if (!dateVal) return toast("Select a date", "error");
  if (!timeVal) return toast("Select a time", "error");
  if (isNaN(priceVal) || priceVal < 0) return toast("Invalid price", "error");

  addScheduleBtn.disabled = true;
  addScheduleBtn.textContent = "Adding...";

  try {
    await addDoc(collection(db, "schedules"), {
      routeId,
      date: dateVal,
      time: timeVal,
      price: priceVal,
      seatCount: 44,
      createdAt: serverTimestamp()
    });

    toast("Schedule added!");
    timeIn.value = "";
    priceIn.value = "";
  } catch (e) {
    console.error(e);
    toast("Failed to add schedule", "error");
  } finally {
    addScheduleBtn.disabled = false;
    addScheduleBtn.textContent = "Add Schedule";
  }
});

window.deleteSchedule = async (id) => {
  if (!confirm("Delete schedule?")) return;
  try {
    await deleteDoc(doc(db, "schedules", id));
    toast("Schedule deleted");
  } catch (e) {
    console.error(e);
    toast("Failed to delete schedule", "error");
  }
};

// ----------------------
// 3. BOOKINGS
// ----------------------
function listenBookings() {
  const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"), limit(200));

  onSnapshot(q, (snap) => {
    allBookingsData = [];
    let count = 0;

    snap.forEach(d => {
      const b = d.data();
      count++;

      // createdAt formatting
      let createdAtDate = "";
      try {
        createdAtDate = b.createdAt?.toDate
          ? b.createdAt.toDate().toLocaleDateString()
          : "";
      } catch {
        createdAtDate = "";
      }

      allBookingsData.push({
        id: d.id,
        ...b,
        createdAtDate
      });
    });

    if (kpiBookings) kpiBookings.textContent = count;

    renderBookingsTable(filterInput ? filterInput.value : "");
  });
}

function renderBookingsTable(filterText) {
  if (!bookingsBody) return;
  bookingsBody.innerHTML = "";
  const term = filterText.toLowerCase().trim();

  const filtered = allBookingsData.filter(b => {
    if (!term) return true;
    return (
      (b.passengerName && b.passengerName.toLowerCase().includes(term)) ||
      (b.phone && b.phone.includes(term)) ||
      (b.scheduleId && b.scheduleId.toLowerCase().includes(term))
    );
  });

  if (filtered.length === 0) {
    bookingsBody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center; padding:20px;">No bookings found</td></tr>`;
    return;
  }

  filtered.forEach(b => {
    const sched = scheduleCache[b.scheduleId];
    let routeName = "Unknown Route";
    let timeStr = "Unknown Time";
    let dateStr = "";

    if (sched) {
      timeStr = sched.time;
      dateStr = sched.date;
      const r = routeCache[sched.routeId];
      if (r) routeName = `${r.from} ➝ ${r.to}`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="font-weight:bold; font-size:0.9em">${b.createdAtDate}</div>
        <div class="muted" style="font-size:0.75em">Booked on</div>
      </td>
      <td>
        <div style="font-weight:bold; color:var(--primary)">${routeName}</div>
        <div class="muted" style="font-size:0.8em">${dateStr}</div>
      </td>
      <td><b>${timeStr}</b></td>
      <td><span class="badge gray">${b.seatNo}</span></td>
      <td>${b.passengerName}</td>
      <td>${b.phone}</td>
      <td><span class="badge ${b.status === 'booked' ? 'green' : 'red'}">${b.status}</span></td>
      <td>
        ${b.status === 'booked'
          ? `<button class="btn small danger" onclick="window.cancelBooking('${b.id}')">Cancel</button>`
          : `<span class="muted">-</span>`}
        <button class="btn small danger" style="margin-left:8px" onclick="window.deleteBooking('${b.id}')">Delete</button>
      </td>
    `;
    bookingsBody.appendChild(tr);
  });
}

applyFilterBtn.addEventListener("click", () => renderBookingsTable(filterInput.value));
filterInput.addEventListener("keyup", (e) => renderBookingsTable(e.target.value));

window.cancelBooking = async (id) => {
  if (confirm("Cancel booking?")) {
    await updateDoc(doc(db, "bookings", id), { status: "cancelled" });
    toast("Booking cancelled");
  }
};

window.deleteBooking = async (id) => {
  if (confirm("Permanently delete this booking?")) {
    await deleteDoc(doc(db, "bookings", id));
    toast("Booking deleted");
  }
};

// ----------------------
// INIT
// ----------------------
(async function init() {
  if (dateIn) dateIn.min = new Date().toISOString().split('T')[0];

  const authData = await requireAuth({});
  if (!authData) return;

  // Must be admin
  if (!authData.isAdmin) {
    toast("Admins only", "error");
    window.location.href = "./index.html";
    return;
  }

  listenRoutes();
  listenSchedules();
  listenBookings();
})();
