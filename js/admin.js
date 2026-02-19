// public/js/admin.js
import { db } from "./firebase-config.js";
import { logout, requireAuth } from "./auth.js";
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, 
  query, orderBy, onSnapshot, serverTimestamp, limit,
  where, getDocs, writeBatch
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
const clearAllBtn = document.getElementById("clearAllBtn"); 

const kpiRoutes = document.getElementById("kpiRoutes");
const kpiSchedules = document.getElementById("kpiSchedules");
const kpiBookings = document.getElementById("kpiBookings");

// --- GLOBAL DATA CACHE ---
let routeCache = {};      
let scheduleCache = {};   
let allBookingsData = []; 

// Logout
if(logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await logout();
    window.location.href = "./login.html";
  });
}

// ----------------------
// HELPER: CLEANUP BOOKINGS
// ----------------------
async function cleanupBookings(filterField, filterValue) {
  const q = query(collection(db, "bookings"), where(filterField, "==", filterValue));
  const snap = await getDocs(q);
  
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
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

    if(kpiRoutes) kpiRoutes.textContent = activeCount;
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
      from: fromVal, to: toVal, isActive: true, createdAt: serverTimestamp()
    });
    toast("Route added successfully!");
    fromIn.value = ""; toIn.value = "";
  } catch (e) {
    toast("Error: " + e.message, "error");
  } finally {
    addRouteBtn.disabled = false;
    addRouteBtn.textContent = "Add Route";
  }
});

window.toggleRoute = async (id, state) => {
  try { await updateDoc(doc(db, "routes", id), { isActive: state }); } catch(e) { toast("Error updating", "error"); }
};

window.deleteRoute = async (id) => {
  if(confirm("Delete route? This will permanently delete ALL associated schedules and bookings.")) {
    try {
      const schedQ = query(collection(db, "schedules"), where("routeId", "==", id));
      const schedSnap = await getDocs(schedQ);
      
      for (const sDoc of schedSnap.docs) {
        await cleanupBookings("scheduleId", sDoc.id); 
        await deleteDoc(doc(db, "schedules", sDoc.id)); 
      }
      
      await deleteDoc(doc(db, "routes", id));
      
      toast("Route and all related data deleted.");
    } catch (e) {
      console.error(e);
      toast("Error during deletion: " + e.message, "error");
    }
  }
};

// ----------------------
// 2. SCHEDULES
// ----------------------
function listenSchedules() {
  const q = query(collection(db, "schedules"), orderBy("date", "desc"));
  
  onSnapshot(q, (snap) => {
    schedBody.innerHTML = "";
    scheduleCache = {}; 
    if(kpiSchedules) kpiSchedules.textContent = snap.size;

    snap.forEach(d => {
      const s = d.data();
      
      scheduleCache[d.id] = s;

      const r = routeCache[s.routeId];
      const routeName = r ? `${r.from} ➝ ${r.to}` : "Unknown Route";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div style="font-weight:bold; color:var(--text-main)">${s.date} <span class="muted">@</span> ${s.time}</div>
          <div class="muted" style="font-size:0.85em">${routeName}</div>
        </td>
        <td>LKR ${s.price}</td>
        <td>${s.seatCount || 44}</td>
        <td>
          <button class="btn small danger" onclick="window.deleteSched('${d.id}')">Cancel</button>
        </td>
      `;
      schedBody.appendChild(tr);
    });

    renderBookingsTable(filterInput ? filterInput.value : "");
  });
}

addScheduleBtn.addEventListener("click", async () => {
  if (!routeSel.value || !dateIn.value || !timeIn.value || !priceIn.value) return toast("Fill all fields", "error");
  
  addScheduleBtn.disabled = true;
  addScheduleBtn.textContent = "Adding...";

  try {
    await addDoc(collection(db, "schedules"), {
      routeId: routeSel.value, date: dateIn.value, time: timeIn.value,
      price: Number(priceIn.value), seatCount: 44, isActive: true, createdAt: serverTimestamp()
    });
    toast("Schedule created!");
  } catch (e) {
    toast(e.message, "error");
  } finally {
    addScheduleBtn.disabled = false;
    addScheduleBtn.textContent = "Add";
  }
});

window.deleteSched = async (id) => {
  if(confirm("Cancel schedule? This will permanently delete all bookings for this trip.")) {
    try {
      await cleanupBookings("scheduleId", id);
      await deleteDoc(doc(db, "schedules", id));
      toast("Schedule and associated bookings cleared.");
    } catch (e) {
      console.error(e);
      toast("Error cancelling schedule: " + e.message, "error");
    }
  }
};

// ----------------------
// 3. BOOKINGS 
// ----------------------
function listenBookings() {
  const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"), limit(100));
  
  onSnapshot(q, (snap) => {
    allBookingsData = [];
    let activeBookings = 0;

    snap.forEach(d => {
      const b = d.data();
      if(b.status === 'booked') activeBookings++;
      
      allBookingsData.push({
        id: d.id,
        ...b,
        createdAtDate: b.createdAt?.toDate ? b.createdAt.toDate().toLocaleDateString() : 'N/A'
      });
    });
    
    if(kpiBookings) kpiBookings.textContent = activeBookings;
    renderBookingsTable(filterInput ? filterInput.value : "");
  });
}

function renderBookingsTable(filterText) {
  if(!bookingsBody) return;
  bookingsBody.innerHTML = "";
  const term = filterText.toLowerCase().trim();

  const filtered = allBookingsData.filter(b => {
    if(!term) return true;

    const sched = scheduleCache[b.scheduleId];
    let routeName = "";
    let timeStr = "";
    let dateStr = "";

    if (sched) {
      timeStr = sched.time ? sched.time.toLowerCase() : "";
      dateStr = sched.date ? sched.date.toLowerCase() : "";
      const r = routeCache[sched.routeId];
      if (r) routeName = `${r.from} ➝ ${r.to}`.toLowerCase();
    }

    return (
      (b.passengerName && b.passengerName.toLowerCase().includes(term)) ||
      (b.phone && b.phone.includes(term)) ||
      (b.seatNo && b.seatNo.toLowerCase().includes(term)) ||
      (routeName && routeName.includes(term)) ||
      (timeStr && timeStr.includes(term)) ||
      (dateStr && dateStr.includes(term)) ||
      (b.scheduleId && b.scheduleId.toLowerCase().includes(term)) ||
      (b.id && b.id.toLowerCase().includes(term)) // ID SEARCH INCLUDED HERE
    );
  });

  if(filtered.length === 0) {
    bookingsBody.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center; padding:20px;">No bookings found matching "${filterText}"</td></tr>`;
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

    // Generate short ID for display
    const shortId = b.id.substring(0, 8) + "...";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="muted" style="font-family:monospace; font-size:0.8em">${shortId}</span></td>
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
      <td><span class="badge ${b.status==='booked'?'green':'red'}">${b.status}</span></td>
      <td>
        ${b.status === 'booked' 
          ? `<button class="btn small danger" onclick="window.cancelBooking('${b.id}')">Cancel</button>` 
          : '<span class="muted">-</span>'}
      </td>
    `;
    bookingsBody.appendChild(tr);
  });
}

applyFilterBtn.addEventListener("click", () => renderBookingsTable(filterInput.value));
filterInput.addEventListener("keyup", (e) => renderBookingsTable(e.target.value));

window.cancelBooking = async (id) => {
  if(confirm("Cancel booking?")) {
    await updateDoc(doc(db, "bookings", id), { status: "cancelled" });
    toast("Booking cancelled");
  }
};

// --- WIPE ALL ORPHANED/STALE BOOKINGS ---
if(clearAllBtn) {
  clearAllBtn.addEventListener("click", async () => {
    if(!confirm("⚠️ DANGER: This will delete EVERY booking in the database.")) return;
    if(!confirm("Are you absolutely sure? This cannot be undone.")) return;

    clearAllBtn.disabled = true;
    clearAllBtn.textContent = "Deleting...";

    try {
      const q = query(collection(db, "bookings"));
      const snap = await getDocs(q);

      if (snap.empty) {
        toast("No bookings to delete.");
        return;
      }

      const batchSize = 400; 
      const chunks = [];
      const docs = snap.docs;

      for (let i = 0; i < docs.length; i += batchSize) {
        chunks.push(docs.slice(i, i + batchSize));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      toast(`Successfully deleted ${snap.size} bookings.`);
      
    } catch (e) {
      console.error(e);
      toast("Error clearing bookings: " + e.message, "error");
    } finally {
      clearAllBtn.disabled = false;
      clearAllBtn.textContent = "⚠️ Clear All Bookings";
    }
  });
}

// ----------------------
// INIT
// ----------------------
(async function init() {
  if(dateIn) dateIn.min = new Date().toISOString().split('T')[0];
  
  const authData = await requireAuth({});
  if (!authData || authData.profile?.role !== "admin") {
    window.location.href = "./login.html";
    return;
  }
  
  listenRoutes();
  listenSchedules();
  listenBookings();
})();