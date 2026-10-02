/* =========================================================
   SCCE ATTENDANCE CALCULATOR
========================================================= */


/* =========================================================
   GET ATTENDANCE FROM SESSION

   Dashboard must provide:
   { attended: 130, conducted: 286 }
========================================================= */

function readSavedStats() {

    try {

        return JSON.parse(
            sessionStorage.getItem("attendanceStats") || "null"
        );

    } catch {

        return null;
    }
}


const savedStats = readSavedStats();


if (
    !savedStats ||
    typeof savedStats.attended !== "number" ||
    typeof savedStats.conducted !== "number"
) {

    console.error(
        "Attendance data not found in sessionStorage:",
        savedStats
    );

    document.body.innerHTML = `
        <main style="
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:24px;
            font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;
            background:#f7f9ff;
        ">

            <div style="
                width:100%;
                max-width:420px;
                text-align:center;
                background:#fff;
                border:1px solid #e7eaf1;
                border-radius:20px;
                padding:32px;
                box-shadow:0 10px 30px rgba(25,35,65,.08);
            ">

                <h2 style="margin:0 0 10px;color:#11182b;">
                    Attendance data unavailable
                </h2>

                <p style="margin:0;color:#7a8498;line-height:1.6;">
                    Please open the dashboard first so your
                    latest attendance can be loaded.
                </p>

                <a
                    href="student.html"
                    style="
                        display:inline-block;
                        margin-top:20px;
                        padding:12px 18px;
                        border-radius:10px;
                        background:#6857e8;
                        color:white;
                        text-decoration:none;
                        font-weight:700;
                    "
                >
                    Go to Dashboard
                </a>

            </div>

        </main>
    `;

    throw new Error(
        "Valid attendanceStats not found in sessionStorage."
    );
}


/* =========================================================
   REAL ATTENDANCE
========================================================= */

const attended = savedStats.attended;
const conducted = savedStats.conducted;

const prefersReducedMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;


/* =========================================================
   ELEMENTS
========================================================= */

const $ = (id) => document.getElementById(id);

const targetSelect = $("targetSelect");
const attendSelect = $("attendSelect");
const missSelect = $("missSelect");
const customAttend = $("customAttend");
const customMiss = $("customMiss");

const percentageCircle = $("percentageCircle");
const currentPercentage = $("currentPercentage");
const attendedCount = $("attendedCount");
const conductedCount = $("conductedCount");
const targetStatus = $("targetStatus");
const classesNeeded = $("classesNeeded");
const targetMessage = $("targetMessage");

const attendResult = $("attendResult");
const attendChange = $("attendChange");
const missResult = $("missResult");
const missChange = $("missChange");
const customResult = $("customResult");
const customChange = $("customChange");

const avatar = $("avatar");
const hallTicketLabel = $("hallTicket");


/* =========================================================
   STUDENT INFO (header)
========================================================= */

const hallTicket = sessionStorage.getItem("hallTicket");

if (hallTicket) {

    hallTicketLabel.textContent = hallTicket;

    avatar.textContent =
        hallTicket.trim().charAt(0).toUpperCase() || "S";
}


/* =========================================================
   HELPERS
========================================================= */

function calculatePercentage(attended, conducted) {

    if (conducted <= 0) {
        return 0;
    }

    return (attended / conducted) * 100;
}


function formatPercentage(value) {
    return value.toFixed(1) + "%";
}


function formatChange(change, showArrow = "") {

    const sign = change > 0 ? "+" : "";

    return `${showArrow}${showArrow ? " " : ""}${sign}${change.toFixed(1)}%`;
}


/* Small "pop" so students notice a value changed */

function bump(element) {

    if (!element || prefersReducedMotion) {
        return;
    }

    element.classList.remove("bump");

    void element.offsetWidth;

    element.classList.add("bump");
}


/* Set text, and pop only if it actually changed */

function setText(element, text, animate) {

    if (element.textContent === text) {
        return;
    }

    element.textContent = text;

    if (animate) {
        bump(element);
    }
}


function pluralize(count, word = "class") {
    return `${count} ${word}${count === 1 ? "" : "es"}`;
}


function animateNumber(element, target, render, duration = 900) {

    if (prefersReducedMotion) {
        element.textContent = render(target);
        return;
    }

    const start = performance.now();

    const tick = (now) => {

        const progress = Math.min((now - start) / duration, 1);

        const eased = 1 - Math.pow(1 - progress, 3);

        element.textContent = render(target * eased);

        if (progress < 1) {
            requestAnimationFrame(tick);
        } else {
            element.textContent = render(target);
        }
    };

    requestAnimationFrame(tick);
}


/* =========================================================
   CURRENT ATTENDANCE
========================================================= */

const current = calculatePercentage(attended, conducted);


/* Circle ring reflects the REAL percentage */

percentageCircle.style.setProperty(
    "--pct",
    Math.max(0, Math.min(current, 100)).toFixed(2)
);

animateNumber(currentPercentage, current, formatPercentage);

attendedCount.textContent = attended;
conductedCount.textContent = conducted;


/* =========================================================
   TARGET CALCULATOR
========================================================= */

function updateTarget(animate = true) {

    const target = Number(targetSelect.value);

    targetStatus.classList.remove("is-info");
    targetMessage.classList.remove("is-info");


    // Already reached target

    if (current >= target) {

        setText(classesNeeded, "0 classes", animate);

        targetMessage.textContent =
            `You're already above ${target}%.`;

        targetStatus.textContent =
            `✓ You're above your ${target}% target!`;

        return;
    }


    // (A + x) / (C + x) >= target  →  x >= (t*C - A) / (1 - t)

    const targetDecimal = target / 100;

    const required = Math.ceil(
        (targetDecimal * conducted - attended) /
        (1 - targetDecimal)
    );

    const safeRequired = Math.max(0, required);

    setText(classesNeeded, pluralize(safeRequired), animate);

    targetMessage.textContent =
        `Attend ${safeRequired} more ${
            safeRequired === 1 ? "class" : "classes"
        } to reach ${target}%.`;

    targetMessage.classList.add("is-info");

    targetStatus.textContent =
        `You're ${(target - current).toFixed(1)}% below your ${target}% target.`;

    targetStatus.classList.add("is-info");
}


/* =========================================================
   WHAT IF ATTEND
========================================================= */

function updateAttendScenario(animate = true) {

    const count = Number(attendSelect.value);

    const newAttendance =
        calculatePercentage(attended + count, conducted + count);

    const change = newAttendance - current;

    setText(attendResult, formatPercentage(newAttendance), animate);

    attendChange.textContent = formatChange(change, "▲");
}


/* =========================================================
   WHAT IF MISS
========================================================= */

function updateMissScenario(animate = true) {

    const count = Number(missSelect.value);

    const newAttendance =
        calculatePercentage(attended, conducted + count);

    const change = newAttendance - current;

    setText(missResult, formatPercentage(newAttendance), animate);

    missChange.textContent = formatChange(change, "▼");
}


/* =========================================================
   CUSTOM SCENARIO
========================================================= */

function updateCustomScenario(animate = true) {

    const attend = Number(customAttend.value);
    const miss = Number(customMiss.value);

    const newAttendance =
        calculatePercentage(
            attended + attend,
            conducted + attend + miss
        );

    const change = newAttendance - current;

    setText(customResult, formatPercentage(newAttendance), animate);

    customChange.textContent = formatChange(change);

    // Green when it goes up (or stays), red when it drops
    customChange.classList.toggle("is-down", change < 0);
}


/* =========================================================
   EVENTS
========================================================= */

targetSelect.addEventListener("change", () => updateTarget());

attendSelect.addEventListener("change", () => updateAttendScenario());

missSelect.addEventListener("change", () => updateMissScenario());

customAttend.addEventListener("change", () => updateCustomScenario());

customMiss.addEventListener("change", () => updateCustomScenario());


/* =========================================================
   INITIALIZE
========================================================= */

updateTarget(false);
updateAttendScenario(false);
updateMissScenario(false);
updateCustomScenario(false);