import {

    db,

    auth,

    analytics,

    logEvent,

    signInAnonymously

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



import {

    saveAttendance,

    getCachedAttendance

} from "./attendanceDB.js";





const hallTicket = sessionStorage.getItem("hallTicket");





/* --------------------------------------------------

   Elements

\-------------------------------------------------- */



const $ = (id) => document.getElementById(id);



const studentHallTicket = $("studentHallTicket");

const overallPercentage = $("overallPercentage");

const overallAttended = $("overallAttended");

const overallConducted = $("overallConducted");

const overallBar = $("overallBar");

const overallTrack = $("overallTrack");

const overallNote = $("overallNote");

const todayStatus = $("todayStatus");

const todayDetails = $("todayDetails");

const lastUpdated = $("lastUpdated");

const historyList = $("historyList");

const emptyState = $("emptyState");

const historySection = $("historySection");

const logoutButton = $("logoutButton");

const updateAttendanceButton = $("updateAttendanceButton");

const updateButtonText = $("updateButtonText");

const attendanceUpdateOverlay = $("attendanceUpdateOverlay");

const attendanceUpdateModal = $("attendanceUpdateModal");

const updateLoadingTitle = $("updateLoadingTitle");

const updateLoadingText = $("updateLoadingText");

const loaderIcon = $("loaderIcon");

const updateDismissButton = $("updateDismissButton");





const ATTENDANCE_API_URL =

    "http://129.225.119.134:8000/attendance/latest";



const REQUEST_TIMEOUT_MS = 60000;


// --------------------------------------------------
// Attendance update cooldown
// One successful update per student every hour.
// --------------------------------------------------

const ATTENDANCE_UPDATE_COOLDOWN_MS = 60 * 60 * 1000;
const ATTENDANCE_UPDATE_COOLDOWN_KEY =
    "attendanceUpdateCooldown:" + hallTicket;

function getAttendanceCooldownRemaining() {
    const raw = localStorage.getItem(ATTENDANCE_UPDATE_COOLDOWN_KEY);
    if (!raw) return 0;
    const lastUpdate = Number(raw);
    if (!Number.isFinite(lastUpdate)) {
        localStorage.removeItem(ATTENDANCE_UPDATE_COOLDOWN_KEY);
        return 0;
    }
    const remaining = ATTENDANCE_UPDATE_COOLDOWN_MS - (Date.now() - lastUpdate);
    if (remaining <= 0) {
        localStorage.removeItem(ATTENDANCE_UPDATE_COOLDOWN_KEY);
        return 0;
    }
    return remaining;
}

function formatCooldown(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function updateCooldownButton() {
    if (!updateAttendanceButton || !updateButtonText) return false;
    if (attendanceUpdateInProgress) return true;
    const remaining = getAttendanceCooldownRemaining();
    if (remaining <= 0) {
        updateAttendanceButton.disabled = false;
        updateAttendanceButton.classList.remove("is-cooldown");
        updateButtonText.textContent = "Update Attendance";
        return false;
    }
    updateAttendanceButton.disabled = true;
    updateAttendanceButton.classList.add("is-cooldown");
    updateButtonText.textContent = `Available in ${formatCooldown(remaining)}`;
    return true;
}

function startAttendanceCooldown() {
    localStorage.setItem(ATTENDANCE_UPDATE_COOLDOWN_KEY, String(Date.now()));
    updateCooldownButton();
}



const prefersReducedMotion =

    window.matchMedia("(prefers-reduced-motion: reduce)").matches;





let attendanceUpdateInProgress = false;





/* --------------------------------------------------

   Check session

\-------------------------------------------------- */



if (!hallTicket) {

    window.location.replace("index.html");

}





/* --------------------------------------------------

   Helpers

\-------------------------------------------------- */



function getTodayDate() {



    const now = new Date();



    const year = now.getFullYear();

    const month = String(now.getMonth() + 1).padStart(2, "0");

    const day = String(now.getDate()).padStart(2, "0");



    return `${year}-${month}-${day}`;

}





function formatDate(dateString) {



    if (!dateString) {

        return "Unknown date";

    }



    const date = new Date(`${dateString}T00:00:00`);



    return date.toLocaleDateString("en-IN", {

        day: "2-digit",

        month: "short",

        year: "numeric"

    });

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



        if (Number.isNaN(date.getTime())) {

            return "Not available";

        }



        return date.toLocaleString("en-IN", {

            day: "2-digit",

            month: "short",

            year: "numeric",

            hour: "2-digit",

            minute: "2-digit"

        });



    } catch {



        return "Not available";

    }

}





function sleep(ms) {

    return new Promise((resolve) => setTimeout(resolve, ms));

}





/* Smoothly count a number up to its value */



function animateNumber(element, target, decimals = 0, duration = 700) {



    if (!element) {

        return;

    }



    const format = (value) => value.toFixed(decimals);



    if (prefersReducedMotion || !Number.isFinite(target)) {

        element.textContent = format(target);

        return;

    }



    const start = performance.now();



    const tick = (now) => {



        const progress = Math.min((now - start) / duration, 1);



        // ease-out cubic

        const eased = 1 - Math.pow(1 - progress, 3);



        element.textContent = format(target * eased);



        if (progress < 1) {

            requestAnimationFrame(tick);

        } else {

            element.textContent = format(target);

        }

    };



    requestAnimationFrame(tick);

}





/* Turn technical errors into messages students understand */



function friendlyError(error) {



    if (error?.name === "AbortError") {

        return "The college portal took too long to respond. Please try again.";

    }



    if (error instanceof TypeError) {

        return "Couldn't reach the server. Check your connection and try again.";

    }



    return (

        error?.message ||

        "We could not update your attendance right now."

    );

}





/* --------------------------------------------------

   Load student

\-------------------------------------------------- */



async function loadStudent() {



    const studentRef = doc(db, "students", hallTicket);



    const snapshot = await getDoc(studentRef);



    if (!snapshot.exists()) {



        sessionStorage.removeItem("hallTicket");



        window.location.replace("index.html");



        return null;

    }



    const student = snapshot.data();



    studentHallTicket.textContent =

        student.hallTicket || hallTicket;



    return student;

}





/* --------------------------------------------------

   Load ALL attendance records



   We need ALL records for calculating the

   student's real overall attendance.

\-------------------------------------------------- */



async function loadAllAttendance() {



    const attendanceRef =

        collection(db, "students", hallTicket, "attendance");



    const attendanceQuery =

        query(attendanceRef, orderBy("date", "desc"));



    const snapshot = await getDocs(attendanceQuery);



    const records = [];



    snapshot.forEach((item) => {

        records.push({ id: item.id, ...item.data() });

    });



    return records;

}





/* --------------------------------------------------

   Load latest 30 records (display only)

\-------------------------------------------------- */



async function loadRecentAttendance() {



    const attendanceRef =

        collection(db, "students", hallTicket, "attendance");



    const attendanceQuery =

        query(attendanceRef, orderBy("date", "desc"), limit(30));



    const snapshot = await getDocs(attendanceQuery);



    const records = [];



    snapshot.forEach((item) => {

        records.push({ id: item.id, ...item.data() });

    });



    return records;

}





/* --------------------------------------------------

   Overall attendance

\-------------------------------------------------- */



function setOverallProgress(percentage, hasData) {



    if (!overallBar || !overallTrack || !overallNote) {

        return;

    }



    overallBar.classList.remove("present", "absent");

    overallNote.classList.remove("present", "absent");



    if (!hasData) {



        overallBar.style.width = "0%";



        overallTrack.setAttribute("aria-valuenow", "0");



        overallNote.textContent = "Waiting for attendance data";



        return;

    }



    const clamped = Math.max(0, Math.min(percentage, 100));



    const status = percentage >= 75 ? "present" : "absent";



    overallBar.style.width = `${clamped}%`;



    overallBar.classList.add(status);



    overallNote.classList.add(status);



    overallTrack.setAttribute(

        "aria-valuenow",

        clamped.toFixed(0)

    );



    overallNote.textContent =

        status === "present"

            ? "You're above the 75% minimum"

            : "You're below the 75% minimum";

}





function updateOverall(records) {



    if (!records.length) {



        overallPercentage.textContent = "--";

        overallAttended.textContent = "--";

        overallConducted.textContent = "--";



        setOverallProgress(0, false);



        sessionStorage.removeItem("attendanceStats");



        return;

    }



    let attended = 0;

    let conducted = 0;



    records.forEach((record) => {

        attended += Number(record.attended || 0);

        conducted += Number(record.conducted || 0);

    });



    const percentage =

        conducted > 0

            ? (attended / conducted) * 100

            : 0;



    animateNumber(overallPercentage, percentage, 2);

    animateNumber(overallAttended, attended, 0, 500);

    animateNumber(overallConducted, conducted, 0, 500);



    setOverallProgress(percentage, true);





    // Save exact totals for Attendance Calculator



    sessionStorage.setItem(

        "attendanceStats",

        JSON.stringify({ attended, conducted })

    );

}





/* --------------------------------------------------

   Today's attendance

\-------------------------------------------------- */



function updateToday(records) {



    const today = getTodayDate();



    const todayRecord =

        records.find((record) => record.date === today);



    if (!todayRecord) {



        todayStatus.textContent = "Not available";

        todayStatus.className = "today-status not-available";

        todayDetails.textContent = "No attendance record for today.";



        return;

    }



    const attended = Number(todayRecord.attended || 0);

    const conducted = Number(todayRecord.conducted || 0);



    if (conducted === 0) {



        todayStatus.textContent = "Not available";

        todayStatus.className = "today-status not-available";

        todayDetails.textContent = "No classes recorded.";



        return;

    }



    const percentage = (attended / conducted) * 100;



    todayStatus.textContent = `${percentage.toFixed(0)}%`;



    todayStatus.className =

        percentage >= 75

            ? "today-status present"

            : "today-status absent";



    todayDetails.textContent =

        `${attended} attended • ${conducted} conducted`;

}





/* --------------------------------------------------

   Render history

\-------------------------------------------------- */



function renderHistory(records) {



    if (!records.length) {



        historySection.classList.add("hidden");

        emptyState.classList.remove("hidden");



        return;

    }



    historySection.classList.remove("hidden");

    emptyState.classList.add("hidden");



    const fragment = document.createDocumentFragment();



    records.forEach((record, index) => {



        const attended = Number(record.attended || 0);

        const conducted = Number(record.conducted || 0);



        const percentage =

            conducted > 0

                ? (attended / conducted) * 100

                : 0;



        const percentageClass =

            conducted === 0

                ? "not-available"

                : percentage >= 75

                    ? "present"

                    : "absent";



        const item = document.createElement("div");



        item.className = "history-item";



        // Stagger the first few rows only

        item.style.setProperty(

            "--i",

            Math.min(index, 8)

        );



        const left = document.createElement("div");



        const date = document.createElement("div");

        date.className = "history-date";

        date.textContent = formatDate(record.date);



        const subtitle = document.createElement("div");

        subtitle.className = "history-subtitle";

        subtitle.textContent =

            `${attended} attended • ${conducted} conducted`;



        left.append(date, subtitle);



        const value = document.createElement("div");

        value.className = `history-percentage ${percentageClass}`;

        value.textContent =

            conducted === 0

                ? "--"

                : `${percentage.toFixed(0)}%`;



        item.append(left, value);



        fragment.appendChild(item);

    });



    historyList.replaceChildren(fragment);

}





/* --------------------------------------------------

   Last updated

\-------------------------------------------------- */



function updateLastUpdated(records) {



    if (!records.length) {



        lastUpdated.textContent = "No attendance records yet.";



        return;

    }



    lastUpdated.textContent =

        formatTimestamp(records[0].updatedAt);

}





/* ==================================================

   ATTENDANCE UPDATE OVERLAY

\================================================== */



let overlayReturnFocus = null;



function setOverlayState(state) {



    if (!attendanceUpdateModal) {

        return;

    }



    attendanceUpdateModal.classList.remove("is-success", "is-error");



    if (state === "success") {



        attendanceUpdateModal.classList.add("is-success");



        if (loaderIcon) {

            loaderIcon.textContent = "✓";

        }



    } else if (state === "error") {



        attendanceUpdateModal.classList.add("is-error");



        if (loaderIcon) {

            loaderIcon.textContent = "✕";

        }



    } else if (loaderIcon) {



        loaderIcon.textContent = "✓";

    }

}





function showAttendanceUpdateOverlay(

    title = "Updating Attendance",

    message = "We're checking your latest attendance.",

    state = "loading"

) {



    if (!attendanceUpdateOverlay) {

        return;

    }



    if (updateLoadingTitle) {

        updateLoadingTitle.textContent = title;

    }



    if (updateLoadingText) {

        updateLoadingText.textContent = message;

    }



    setOverlayState(state);



    if (!attendanceUpdateOverlay.classList.contains("active")) {



        overlayReturnFocus = document.activeElement;



        attendanceUpdateOverlay.classList.add("active");



        attendanceUpdateOverlay.setAttribute("aria-hidden", "false");



        document.body.style.overflow = "hidden";

    }

}





function hideAttendanceUpdateOverlay() {



    if (!attendanceUpdateOverlay) {

        return;

    }



    attendanceUpdateOverlay.classList.remove("active");



    attendanceUpdateOverlay.setAttribute("aria-hidden", "true");



    document.body.style.overflow = "";



    if (overlayReturnFocus && typeof overlayReturnFocus.focus === "function") {

        overlayReturnFocus.focus({ preventScroll: true });

    }



    overlayReturnFocus = null;

}





/* Wait for the student to dismiss an error */



function waitForDismiss() {



    return new Promise((resolve) => {



        const finish = () => {



            updateDismissButton?.removeEventListener("click", finish);

            attendanceUpdateOverlay.removeEventListener("click", onBackdrop);

            document.removeEventListener("keydown", onKey);



            resolve();

        };



        const onBackdrop = (event) => {

            if (event.target === attendanceUpdateOverlay) {

                finish();

            }

        };



        const onKey = (event) => {

            if (event.key === "Escape") {

                finish();

            }

        };



        updateDismissButton?.addEventListener("click", finish);

        attendanceUpdateOverlay.addEventListener("click", onBackdrop);

        document.addEventListener("keydown", onKey);



        updateDismissButton?.focus({ preventScroll: true });

    });

}





/* --------------------------------------------------

   Firebase auth

\-------------------------------------------------- */



async function ensureFirebaseAuth() {



    if (auth.currentUser) {

        return auth.currentUser;

    }



    const result = await signInAnonymously(auth);



    return result.user;

}





async function getFirebaseIdToken() {



    await ensureFirebaseAuth();



    return await auth.currentUser.getIdToken(true);

}





/* --------------------------------------------------

   Call FastAPI

\-------------------------------------------------- */



async function requestAttendanceUpdate() {



    const token = await getFirebaseIdToken();



    const controller = new AbortController();



    const timeout = setTimeout(

        () => controller.abort(),

        REQUEST_TIMEOUT_MS

    );



    try {



        const response = await fetch(ATTENDANCE_API_URL, {

            method: "POST",



            headers: {

                "Content-Type": "application/json",

                "Authorization": `Bearer ${token}`

            },



            body: JSON.stringify({ hall_ticket: hallTicket }),



            signal: controller.signal

        });



        let data = null;



        try {

            data = await response.json();

        } catch {

            data = null;

        }



        if (!response.ok) {



            throw new Error(

                (typeof data?.detail === "string" && data.detail) ||

                `Attendance update failed (${response.status})`

            );

        }



        return data;



    } finally {



        clearTimeout(timeout);

    }

}





/* --------------------------------------------------

   Update attendance

\-------------------------------------------------- */



function setUpdateButtonBusy(busy) {



    if (!updateAttendanceButton) {

        return;

    }



    updateAttendanceButton.disabled = busy;



    updateAttendanceButton.classList.toggle("is-loading", busy);



    if (updateButtonText) {

        updateButtonText.textContent =

            busy ? "Updating..." : "Update Attendance";

    }

}





async function updateAttendance() {

    if (attendanceUpdateInProgress || !hallTicket) return;

    const remaining = getAttendanceCooldownRemaining();
    if (remaining > 0) {
        updateCooldownButton();
        showAttendanceUpdateOverlay(
            "Update Already Used",
            `You can update your attendance again in ${formatCooldown(remaining)}.`,
            "error"
        );
        await sleep(1200);
        hideAttendanceUpdateOverlay();
        return false;
    }

    attendanceUpdateInProgress = true;
    setUpdateButtonBusy(true);
    showAttendanceUpdateOverlay(
        "Checking College Portal",
        "Fetching your latest attendance records..."
    );

    let failed = false;

    try {
        logEvent(analytics, "attendance_update_started");
        await requestAttendanceUpdate();
        startAttendanceCooldown();

        showAttendanceUpdateOverlay(
            "Refreshing Dashboard",
            "Loading your latest attendance data..."
        );
        const freshRecords = await loadAllAttendance();

        try {
            await saveAttendance(hallTicket, freshRecords);
        } catch (cacheError) {
            console.warn("Could not refresh attendance cache:", cacheError);
        }

        updateOverall(freshRecords);
        updateToday(freshRecords);
        renderHistory(freshRecords.slice(0, 30));
        updateLastUpdated(freshRecords.slice(0, 30));

        logEvent(analytics, "attendance_update_success");
        showAttendanceUpdateOverlay(
            "Attendance Updated",
            "Your dashboard now shows the latest attendance.",
            "success"
        );
        await sleep(900);
        hideAttendanceUpdateOverlay();

    } catch (error) {
        failed = true;
        console.error("Attendance update failed:", error);
        logEvent(analytics, "attendance_update_failed");
        showAttendanceUpdateOverlay(
            "Update Failed",
            friendlyError(error),
            "error"
        );
        await waitForDismiss();
        hideAttendanceUpdateOverlay();

    } finally {
        attendanceUpdateInProgress = false;
        setUpdateButtonBusy(false);
        updateCooldownButton();
    }

    return !failed;
}


/* --------------------------------------------------

   Update button listener

\-------------------------------------------------- */



if (updateAttendanceButton) {



    updateAttendanceButton.addEventListener(

        "click",

        updateAttendance

    );

}





// Restore the cooldown immediately when the dashboard opens.
updateCooldownButton();

// Keep the countdown accurate without requiring a page refresh.
setInterval(() => {
    updateCooldownButton();
}, 1000);


/* --------------------------------------------------

   Logout

\-------------------------------------------------- */



logoutButton.addEventListener("click", () => {



    try {

        logEvent(analytics, "student_logout");

    } catch {

        // Analytics should never block logging out

    }



    sessionStorage.removeItem("hallTicket");



    window.location.replace("index.html");

});





/* --------------------------------------------------

   Initialize dashboard

\-------------------------------------------------- */



function renderDashboard(records) {



    updateOverall(records);

    updateToday(records);

    renderHistory(records.slice(0, 30));

    updateLastUpdated(records.slice(0, 30));

}





async function initializeDashboard() {



    try {



        // 1. CHECK INDEXEDDB FIRST



        let cached = null;



        try {



            cached = await getCachedAttendance(hallTicket);



        } catch (error) {



            console.warn(

                "Could not load attendance cache:",

                error

            );

        }





        // 2. CACHE FOUND → USE CACHE ONLY



        if (

            cached &&

            Array.isArray(cached.records) &&

            cached.records.length > 0

        ) {



            studentHallTicket.textContent = hallTicket;



            renderDashboard(cached.records);



            return;

        }





        // 3. NO CACHE → FIRST LOAD FROM FIREBASE



        const student = await loadStudent();



        if (!student) {

            return;

        }



        studentHallTicket.textContent =

            student.hallTicket || hallTicket;



        logEvent(analytics, "attendance_viewed");





        // 4. GET ATTENDANCE FROM FIREBASE



        const allRecords = await loadAllAttendance();



        logEvent(analytics, "attendance_load_success");





        // 5. SAVE FIREBASE DATA TO INDEXEDDB



        try {



            await saveAttendance(hallTicket, allRecords);



        } catch (error) {



            console.warn(

                "Could not save attendance cache:",

                error

            );

        }





        // 6. RENDER FIREBASE DATA



        renderDashboard(allRecords);



    } catch (error) {



        console.error("Dashboard loading failed:", error);



        logEvent(analytics, "attendance_load_failed");



        todayStatus.textContent = "Not available";

        todayStatus.className = "today-status not-available";

        todayDetails.textContent = "Couldn't load today's attendance.";

        lastUpdated.textContent = "Not available";



        const message = document.createElement("div");

        message.className = "loading error";

        message.textContent =

            "Unable to load attendance right now. Check your connection and try again.";



        const retry = document.createElement("button");

        retry.type = "button";

        retry.className = "retry-button";

        retry.textContent = "Try again";

        retry.addEventListener("click", () => window.location.reload());



        historyList.replaceChildren(message, retry);

    }

}





if (hallTicket) {

    initializeDashboard();

}
