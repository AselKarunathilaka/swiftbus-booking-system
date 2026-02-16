# 🚌 SwiftBus - Real-Time Bus Seat Booking System

![Status](https://img.shields.io/badge/Status-Active-success)
![License](https://img.shields.io/badge/License-MIT-blue)
![Tech](https://img.shields.io/badge/Tech-HTML%20|%20CSS%20|%20JS%20|%20Firebase-orange)

**SwiftBus** is a full-stack web application designed to streamline bus ticket reservations. It allows passengers to view real-time seat availability, book tickets instantly, and enables administrators to manage routes, schedules, and bookings through a secure dashboard.

🔗 **Live Demo:** [Insert your Netlify/GitHub Pages link here]  
📂 **Repository:** https://github.com/AselKarunathilaka/swiftbus-booking-system.git

---

## ✨ Features

### 👤 User Panel (Passenger)
* **Visual Seat Map:** Interactive bus layout displaying seat status (Available, Selected, Booked).
* **Real-Time Locking:** Seat availability updates instantly across all devices using Firestore listeners.
* **Trip Search:** Filter trips by Route, Date, and Time.
* **Booking Management:** View booking history and status.
* **Responsive UI:** Optimized for mobile and desktop booking.

### 🛠️ Admin Panel
* **Dashboard KPIs:** At-a-glance view of Active Routes, Schedules, and Total Bookings.
* **Route Management:** Add, Disable, or Delete bus routes (e.g., Colombo ⇄ Kandy).
* **Schedule Management:** Assign busses to routes with specific prices and seat counts.
* **Booking Oversight:** Search bookings by Schedule ID and cancel tickets to free up seats.
* **Security:** Role-based access control preventing unauthorized admin access.

---

## 🏗️ Technology Stack

* **Frontend:** HTML5, CSS3 (Custom Glassmorphism/Dark Theme), Vanilla JavaScript (ES6 Modules).
* **Backend (BaaS):** Google Firebase.
* **Database:** Cloud Firestore (NoSQL).
* **Authentication:** Firebase Authentication (Email/Password).
* **Hosting:** GitHub Pages / Netlify.

---

## 💾 Database Schema (Firestore)

The application uses a NoSQL structure with the following collections:

| Collection | Description | Key Fields |
| :--- | :--- | :--- |
| **`users`** | User profiles | `name`, `phone`, `email`, `role` ("user" or "admin") |
| **`routes`** | Bus routes | `from`, `to`, `isActive` |
| **`schedules`** | Trip times | `routeId`, `date`, `time`, `price`, `seatCount` |
| **`bookings`** | Reservations | `scheduleId`, `seatNo`, `userId`, `passengerName`, `status` |

---
