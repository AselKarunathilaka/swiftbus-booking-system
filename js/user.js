// public/js/user.js
import { db } from "./firebase-config.js";
import { logout, requireAuth, validateName, validatePhoneLK } from "./auth.js";
import { collection, doc, getDocs, query, where, orderBy, limit, onSnapshot, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// --- Toast System ---
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if(!container) return;
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> ${msg}`;
  container.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// Elements
const who = document.getElementById("who");
const adminLink = document.getElementById("adminLink");
const logoutBtn = document.getElementById("logoutBtn");

const routeSel = document.getElementById("routeSel");
const dateSel = document.getElementById("dateSel");
const timeSel = document.getElementById("timeSel");
const priceView = document.getElementById("priceView");
const seatView = document.getElementById("seatView");

const seatGrid = document.getElementById("seatGrid");
const pName = document.getElementById("pName");
const pPhone = document.getElementById("pPhone");
const bookBtn = document.getElementById("bookBtn");
const myBookingsBody = document.getElementById("myBookings");

// State
let currentUser = null;
let currentProfile = null;
let selectedScheduleId = "";
let selectedSeat = "";
let bookedSeats = new Set();
let unsubscribeSeats = null;

// Helpers
const todayISO = () => new Date().toISOString().split('T')[0];

if(logoutBtn){
  logoutBtn.addEventListener("click", async () => {
    await logout();
    window.location.href = "./login.html";
  });
}

// --- NEW SRI LANKAN SEAT MAP LOGIC ---
function buildSeatLayout() {
  const seats = [];
  
  // Generate 12 regular rows (2x2 layout)
  for (let r = 1; r <= 12; r++) {
    seats.push(`${r}A`);     // Left Window
    seats.push(`${r}B`);     // Left Aisle
    seats.push("AISLE");     // The Walking Aisle Gap
    seats.push(`${r}C`);     // Right Aisle
    seats.push(`${r}D`);     // Right Window
  }
  
  // Generate the Back Row (5 continuous seats)
  // Since 12 rows x 4 = 48 seats, the back row starts at 49
  seats.push("49", "50", "51", "52", "53");
  
  return seats;
}

function renderSeats() {
  seatGrid.innerHTML = "";
  if (!selectedScheduleId) {
    seatGrid.innerHTML = `<div class="muted" style="grid-column:1/-1;text-align:center;padding:20px;">Select a schedule to view seats</div>`;
    return;
  }

  // Fetch the new Sri Lankan layout
  const layout = buildSeatLayout(); 

  layout.forEach(seatNo => {
    // If the array item is "AISLE", render an invisible gap
    if (seatNo === "AISLE") {
      const aisle = document.createElement("div");
      aisle.className = "seat-col-gap";
      seatGrid.appendChild(aisle);
      return;
    }

    // Otherwise, render an actual clickable seat
    const div = document.createElement("div");
    div.className = "seat";
    div.textContent = seatNo;

    // Apply booked or selected styles
    if (bookedSeats.has(seatNo)) {
      div.classList.add("booked");
    } else if (seatNo === selectedSeat) {
      div.classList.add("selected");
    }

    // Click Event Handler
    div.addEventListener("click", () => {
      if (bookedSeats.has(seatNo)) return;
      
      if (selectedSeat === seatNo) {
        selectedSeat = "";
        seatView.value = "";
        bookBtn.disabled = true;
      } else {
        selectedSeat = seatNo;
        seatView.value = seatNo;
        bookBtn.disabled = false;
      }
      renderSeats(); 
    });

    seatGrid.appendChild(div);
  });
}

// --- Data Loading ---
async function loadRoutes() {
  try {
    routeSel.innerHTML = `<option value="">Loading...</option>`;
    const q = query(collection(db, "routes"), where("isActive", "==", true));
    const snap = await getDocs(q);
    
    routeSel.innerHTML = `<option value="">Select a route</option>`;
    snap.forEach(d => {
      const r = d.data();
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${r.from} ➝ ${r.to}`;
      routeSel.appendChild(opt);
    });
  } catch(e) {
    console.error("Route Error:", e);
    routeSel.innerHTML = `<option value="">Error loading routes</option>`;
  }
}

async function loadTimes() {
  const routeId = routeSel.value;
  const date = dateSel.value;
  
  timeSel.innerHTML = `<option value="">Select time</option>`;
  timeSel.disabled = true;
  
  selectedScheduleId = "";
  selectedSeat = "";
  bookedSeats.clear();
  renderSeats(); 

  if (!routeId || !date) return;

  const q = query(collection(db, "schedules"), where("routeId", "==", routeId), where("date", "==", date), where("isActive", "==", true), orderBy("time"));
  
  const snap = await getDocs(q);
  if (snap.empty) {
    timeSel.innerHTML = `<option value="">No busses found</option>`;
    return;
  }

  timeSel.disabled = false;
  snap.forEach(d => {
    const s = d.data();
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${s.time}`;
    opt.dataset.price = s.price;
    timeSel.appendChild(opt);
  });
}

function startRealtimeSeats(scheduleId) {
  if (unsubscribeSeats) unsubscribeSeats();
  
  const q = query(collection(db, "bookings"), where("scheduleId", "==", scheduleId), where("status", "==", "booked"));
  
  unsubscribeSeats = onSnapshot(q, (snap) => {
    bookedSeats.clear();
    snap.forEach(d => bookedSeats.add(d.data().seatNo));
    
    if (selectedSeat && bookedSeats.has(selectedSeat)) {
      selectedSeat = "";
      seatView.value = "";
      toast("The seat you selected was just booked!", "error");
    }
    renderSeats(); 
  }, (error) => {
    console.error("Snapshot Error:", error);
  });
}

// --- Events ---
routeSel.addEventListener("change", loadTimes);
dateSel.addEventListener("change", loadTimes);

timeSel.addEventListener("change", () => {
  const opt = timeSel.options[timeSel.selectedIndex];
  if (!opt.value) {
    selectedScheduleId = "";
    renderSeats();
    return;
  }

  selectedScheduleId = opt.value;
  priceView.value = `LKR ${opt.dataset.price}`;
  
  renderSeats(); 
  startRealtimeSeats(selectedScheduleId);
});

bookBtn.addEventListener("click", async () => {
  if (!selectedSeat) return toast("Please select a seat", "error");
  if (!validateName(pName.value)) return toast("Please enter a valid name", "error");
  if (!validatePhoneLK(pPhone.value)) return toast("Invalid phone number", "error");

  const btnText = bookBtn.textContent;
  bookBtn.textContent = "Booking...";
  bookBtn.disabled = true;

  try {
    const bookingId = `${selectedScheduleId}_${selectedSeat}`;
    
    const routeText = routeSel.options[routeSel.selectedIndex].text; 
    const timeText = timeSel.options[timeSel.selectedIndex].text;
    const dateText = dateSel.value;

    await runTransaction(db, async (tx) => {
      const ref = doc(db, "bookings", bookingId);
      const docSnap = await tx.get(ref);
      if (docSnap.exists() && docSnap.data().status === "booked") {
        throw new Error("Seat just taken! Please pick another.");
      }
      
      tx.set(ref, {
        scheduleId: selectedScheduleId,
        seatNo: selectedSeat,
        passengerName: pName.value.trim(),
        phone: pPhone.value.trim(),
        userId: currentUser.uid,
        status: "booked",
        createdAt: serverTimestamp(),
        routeDetails: routeText,
        timeDetails: timeText,
        dateDetails: dateText
      });
    });

    toast("Booking confirmed! Safe travels.", "success");
    pName.value = "";
    pPhone.value = "";
    selectedSeat = "";
    seatView.value = "";
    renderSeats();
  } catch (e) {
    toast(e.message, "error");
  } finally {
    bookBtn.textContent = btnText;
    bookBtn.disabled = false; 
  }
});

// --- Init ---
(async function init() {
  dateSel.min = todayISO();
  dateSel.value = todayISO();

  const authData = await requireAuth({
    onUser: (u, profile) => {
      currentUser = u;
      currentProfile = profile;
    }
  });

  if (!authData) {
    window.location.href = "./login.html";
    return;
  }

  who.textContent = currentProfile?.name || "User";
  if (currentProfile?.role === "admin") {
    adminLink.style.display = "inline-flex";
  }

  loadRoutes();
  
  const q = query(collection(db, "bookings"), where("userId", "==", authData.user.uid), orderBy("createdAt", "desc"), limit(5));
  onSnapshot(q, (snap) => {
    myBookingsBody.innerHTML = "";
    snap.forEach(d => {
      const b = d.data();
      
      const routeDisplay = b.routeDetails || "Loading...";
      const timeDisplay = b.timeDetails || "N/A";
      const dateDisplay = b.dateDetails || (b.createdAt?.toDate ? b.createdAt.toDate().toLocaleDateString() : 'N/A');
      
      const shortId = d.id.substring(0, 8) + "...";

      const row = `<tr>
        <td><span class="muted" style="font-family:monospace; font-size:0.8em">${shortId}</span></td>
        <td><div style="font-weight:bold; font-size:0.9em">${routeDisplay}</div></td>
        <td>${timeDisplay}</td>
        <td>${dateDisplay}</td>
        <td><span class="badge gray">${b.seatNo}</span></td>
        <td><span class="badge green">Confirmed</span></td>
      </tr>`;
      myBookingsBody.innerHTML += row;
    });
  });
})();