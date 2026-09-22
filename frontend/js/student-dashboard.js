import {
    db,
    analytics,
    logEvent
} from "./firebase.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";



const hallTicket = sessionStorage.getItem("hallTicket");

const studentHallTicket =
    document.getElementById("studentHallTicket");

const overallPercentage =
    document.getElementById("overallPercentage");

const overallAttended =
    document.getElementById("overallAttended");

const overallConducted =
    document.getElementById("overallConducted");

const todayStatus =
    document.getElementById("todayStatus");

const todayDetails =
    document.getElementById("todayDetails");

const lastUpdated =
    document.getElementById("lastUpdated");

const historyList =
    document.getElementById("historyList");

const emptyState =
    document.getElementById("emptyState");

const historySection =
    document.getElementById("historySection");

const logoutButton =
    document.getElementById("logoutButton");


/* --------------------------------------------------
   Check session
-------------------------------------------------- */

if (!hallTicket) {
    window.location.replace("index.html");
}


/* --------------------------------------------------
   Helpers
-------------------------------------------------- */

function getTodayDate() {

    const now = new Date();

    const year = now.getFullYear();

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        now.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function formatDate(dateString) {

    if (!dateString) {
        return "Unknown date";
    }

    const date = new Date(
        `${dateString}T00:00:00`
    );

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


function formatTimestamp(timestamp) {

    if (!timestamp) {
        return "Not available";
    }

    try {

        const date =
            typeof timestamp.toDate === "function"
                ? timestamp.toDate()
                : new Date(timestamp);

        return date.toLocaleString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    } catch {

        return "Not available";
    }
}


/* --------------------------------------------------
   Load student
-------------------------------------------------- */

async function loadStudent() {

    const studentRef =
        doc(db, "students", hallTicket);

    const snapshot =
        await getDoc(studentRef);

    if (!snapshot.exists()) {

        sessionStorage.removeItem("hallTicket");

        window.location.replace("index.html");

        return null;
    }

    const student =
        snapshot.data();

    studentHallTicket.textContent =
        student.hallTicket || hallTicket;

    return student;
}


/* --------------------------------------------------
   Load ALL attendance records
--------------------------------------------------

   IMPORTANT:
   We need ALL records for calculating
   the student's real overall attendance.
-------------------------------------------------- */

async function loadAllAttendance() {

    const attendanceRef =
        collection(
            db,
            "students",
            hallTicket,
            "attendance"
        );

    const attendanceQuery =
        query(
            attendanceRef,
            orderBy("date", "desc")
        );

    const snapshot =
        await getDocs(attendanceQuery);

    const records = [];

    snapshot.forEach((item) => {

        records.push({
            id: item.id,
            ...item.data()
        });

    });

    return records;
}


/* --------------------------------------------------
   Load latest 30 records
--------------------------------------------------

   These are ONLY for displaying history.
   They must NOT be used for overall calculation.
-------------------------------------------------- */

async function loadRecentAttendance() {

    const attendanceRef =
        collection(
            db,
            "students",
            hallTicket,
            "attendance"
        );

    const attendanceQuery =
        query(
            attendanceRef,
            orderBy("date", "desc"),
            limit(30)
        );

    const snapshot =
        await getDocs(attendanceQuery);

    const records = [];

    snapshot.forEach((item) => {

        records.push({
            id: item.id,
            ...item.data()
        });

    });

    return records;
}


/* --------------------------------------------------
   Overall attendance
-------------------------------------------------- */

function updateOverall(records) {

    if (!records.length) {

        overallPercentage.textContent = "--";
        overallAttended.textContent = "--";
        overallConducted.textContent = "--";

        sessionStorage.removeItem("attendanceStats");

        return;
    }

    let attended = 0;
    let conducted = 0;

    records.forEach((record) => {

        attended += Number(
            record.attended || 0
        );

        conducted += Number(
            record.conducted || 0
        );

    });

    const percentage =
        conducted > 0
            ? (attended / conducted) * 100
            : 0;

    overallPercentage.textContent =
        percentage.toFixed(2);

    overallAttended.textContent =
        attended;

    overallConducted.textContent =
        conducted;


    /* --------------------------------------------------
       Save exact totals for Attendance Calculator
    -------------------------------------------------- */

    sessionStorage.setItem(
        "attendanceStats",
        JSON.stringify({
            attended: attended,
            conducted: conducted
        })
    );

    console.log(
        "Attendance stats saved:",
        {
            attended,
            conducted,
            percentage
        }
    );
}

/* --------------------------------------------------
   Today's attendance
-------------------------------------------------- */

function updateToday(records) {

    const today =
        getTodayDate();

    const todayRecord =
        records.find(
            record => record.date === today
        );

    if (!todayRecord) {

        todayStatus.textContent =
            "Not available";

        todayStatus.className =
            "today-status not-available";

        todayDetails.textContent =
            "No attendance record for today.";

        return;
    }

    const attended =
        Number(todayRecord.attended || 0);

    const conducted =
        Number(todayRecord.conducted || 0);

    if (conducted === 0) {

        todayStatus.textContent =
            "Not available";

        todayStatus.className =
            "today-status not-available";

        todayDetails.textContent =
            "No classes recorded.";

        return;
    }

    const percentage =
        (attended / conducted) * 100;

    todayStatus.textContent =
        `${percentage.toFixed(0)}%`;

    todayStatus.className =
        percentage >= 75
            ? "today-status present"
            : "today-status absent";

    todayDetails.textContent =
        `${attended} attended • ${conducted} conducted`;
}


/* --------------------------------------------------
   Render history
-------------------------------------------------- */

function renderHistory(records) {

    if (!records.length) {

        historySection.classList.add("hidden");

        emptyState.classList.remove("hidden");

        return;
    }

    historySection.classList.remove("hidden");

    emptyState.classList.add("hidden");

    historyList.innerHTML = "";

    records.forEach((record) => {

        const attended =
            Number(record.attended || 0);

        const conducted =
            Number(record.conducted || 0);

        const percentage =
            conducted > 0
                ? (attended / conducted) * 100
                : 0;

        const percentageClass =
            percentage >= 75
                ? "present"
                : "absent";

        const item =
            document.createElement("div");

        item.className =
            "history-item";

        item.innerHTML = `
            <div>
                <div class="history-date">
                    ${formatDate(record.date)}
                </div>

                <div class="history-subtitle">
                    ${attended} attended
                    •
                    ${conducted} conducted
                </div>
            </div>

            <div class="history-percentage ${percentageClass}">
                ${percentage.toFixed(0)}%
            </div>
        `;

        historyList.appendChild(item);
    });
}


/* --------------------------------------------------
   Last updated
-------------------------------------------------- */

function updateLastUpdated(records) {

    if (!records.length) {

        lastUpdated.textContent =
            "No attendance records yet.";

        return;
    }

    const latest =
        records[0];

    lastUpdated.textContent =
        formatTimestamp(latest.updatedAt);
}


/* --------------------------------------------------
   Logout
-------------------------------------------------- */

logoutButton.addEventListener(
    "click",
    () => {

        sessionStorage.removeItem(
            "hallTicket"
        );

        window.location.replace(
            "index.html"
        );
        logEvent(analytics, "student_logout");

    }
);


/* --------------------------------------------------
   Initialize dashboard
-------------------------------------------------- */

async function initializeDashboard() {

    try {

        const student =
            await loadStudent();

        if (!student) {
            return;
        }
        logEvent(analytics, "attendance_viewed");

        // ALL records
        const allRecords =
            await loadAllAttendance();
        logEvent(analytics, "attendance_load_success");

        // Latest 30 records
        const recentRecords =
            await loadRecentAttendance();


        // Overall uses ALL records
        updateOverall(allRecords);


        // Today uses ALL records
        updateToday(allRecords);
        logEvent(analytics, "today_attendance_viewed");

        // History displays latest 30
        renderHistory(recentRecords);
        logEvent(analytics, "attendance_history_viewed");


        // Last updated uses latest record
        updateLastUpdated(recentRecords);

    } catch (error) {

        console.error(
            "Dashboard loading failed:",
            error
        );
        logEvent(analytics, "attendance_load_failed");

        historyList.innerHTML = `
            <div class="loading">
                Unable to load attendance right now.
                Please try again later.
            </div>
        `;
    }
}


initializeDashboard();