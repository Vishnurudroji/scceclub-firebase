/* =========================================================
   SCCE ATTENDANCE CALCULATOR
========================================================= */


/* =========================================================
   GET ATTENDANCE FROM SESSION
========================================================= */

const savedStats =
    JSON.parse(
        sessionStorage.getItem("attendanceStats") || "null"
    );


/*
 * Dashboard must provide:
 *
 * {
 *     attended: 130,
 *     conducted: 286
 * }
 */

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
            font-family:Arial,sans-serif;
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

                <h2 style="
                    margin:0 0 10px;
                    color:#11182b;
                ">
                    Attendance data unavailable
                </h2>

                <p style="
                    margin:0;
                    color:#7a8498;
                    line-height:1.6;
                ">
                    Please open the dashboard first so your
                    latest attendance can be loaded.
                </p>

                <a
                    href="student.html"
                    style="
                        display:inline-block;
                        margin-top:20px;
                        padding:11px 18px;
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

const attended =
    savedStats.attended;

const conducted =
    savedStats.conducted;


/* =========================================================
   ELEMENTS
========================================================= */

const targetSelect =
    document.getElementById(
        "targetSelect"
    );

const attendSelect =
    document.getElementById(
        "attendSelect"
    );

const missSelect =
    document.getElementById(
        "missSelect"
    );

const customAttend =
    document.getElementById(
        "customAttend"
    );

const customMiss =
    document.getElementById(
        "customMiss"
    );


const currentPercentage =
    document.getElementById(
        "currentPercentage"
    );

const attendedCount =
    document.getElementById(
        "attendedCount"
    );

const conductedCount =
    document.getElementById(
        "conductedCount"
    );

const targetStatus =
    document.getElementById(
        "targetStatus"
    );

const classesNeeded =
    document.getElementById(
        "classesNeeded"
    );

const targetMessage =
    document.getElementById(
        "targetMessage"
    );

const attendResult =
    document.getElementById(
        "attendResult"
    );

const attendChange =
    document.getElementById(
        "attendChange"
    );

const missResult =
    document.getElementById(
        "missResult"
    );

const missChange =
    document.getElementById(
        "missChange"
    );

const customResult =
    document.getElementById(
        "customResult"
    );

const customChange =
    document.getElementById(
        "customChange"
    );


/* =========================================================
   CALCULATE PERCENTAGE
========================================================= */

function calculatePercentage(
    attended,
    conducted
) {

    if (conducted <= 0) {
        return 0;
    }

    return (
        attended /
        conducted *
        100
    );

}


/* =========================================================
   FORMAT PERCENTAGE
========================================================= */

function formatPercentage(value) {

    return value.toFixed(1) + "%";

}


/* =========================================================
   CURRENT ATTENDANCE
========================================================= */

const current =
    calculatePercentage(
        attended,
        conducted
    );


/*
 * Update current attendance card
 */

currentPercentage.textContent =
    formatPercentage(current);

attendedCount.textContent =
    attended;

conductedCount.textContent =
    conducted;


/*
 * Debug
 */

console.log(
    "Calculator attendance:",
    {
        attended,
        conducted,
        percentage: current
    }
);


/* =========================================================
   TARGET CALCULATOR
========================================================= */

function updateTarget() {

    const target =
        Number(
            targetSelect.value
        );


    /*
     * Already reached target
     */

    if (current >= target) {

        classesNeeded.textContent =
            "0 classes";

        targetMessage.textContent =
            `You're already above ${target}%.`;

        targetMessage.style.color =
            "#16a875";

        targetStatus.textContent =
            `✓ You're above your ${target}% target!`;

        targetStatus.style.background =
            "#e9faf3";

        targetStatus.style.color =
            "#087d58";

        return;
    }


    /*
     * Formula:
     *
     * (A + x) / (C + x) >= target
     *
     * x >=
     *
     * (target*C - A)
     * ----------------
     * (1 - target)
     */

    const targetDecimal =
        target / 100;


    const required =
        Math.ceil(
            (
                targetDecimal *
                conducted -
                attended
            ) /
            (
                1 -
                targetDecimal
            )
        );


    const safeRequired =
        Math.max(
            0,
            required
        );


    classesNeeded.textContent =
        `${safeRequired} ${
            safeRequired === 1
                ? "class"
                : "classes"
        }`;


    targetMessage.textContent =
        `Attend ${safeRequired} more ${
            safeRequired === 1
                ? "class"
                : "classes"
        } to reach ${target}%.`;


    targetMessage.style.color =
        "#6857e8";


    targetStatus.textContent =
        `You're ${(
            target -
            current
        ).toFixed(1)}% below your ${target}% target.`;


    targetStatus.style.background =
        "#f0edff";

    targetStatus.style.color =
        "#6857e8";

}


/* =========================================================
   WHAT IF ATTEND
========================================================= */

function updateAttendScenario() {

    const count =
        Number(
            attendSelect.value
        );


    const newAttendance =
        calculatePercentage(
            attended + count,
            conducted + count
        );


    const change =
        newAttendance -
        current;


    attendResult.textContent =
        formatPercentage(
            newAttendance
        );


    attendChange.textContent =
        `▲ ${
            change >= 0
                ? "+"
                : ""
        }${change.toFixed(1)}%`;

}


/* =========================================================
   WHAT IF MISS
========================================================= */

function updateMissScenario() {

    const count =
        Number(
            missSelect.value
        );


    const newAttendance =
        calculatePercentage(
            attended,
            conducted + count
        );


    const change =
        newAttendance -
        current;


    missResult.textContent =
        formatPercentage(
            newAttendance
        );


    missChange.textContent =
        `▼ ${change.toFixed(1)}%`;

}


/* =========================================================
   CUSTOM SCENARIO
========================================================= */

function updateCustomScenario() {

    const attend =
        Number(
            customAttend.value
        );

    const miss =
        Number(
            customMiss.value
        );


    const newAttendance =
        calculatePercentage(
            attended + attend,
            conducted +
            attend +
            miss
        );


    const change =
        newAttendance -
        current;


    customResult.textContent =
        formatPercentage(
            newAttendance
        );


    customChange.textContent =
        `${
            change >= 0
                ? "+"
                : ""
        }${change.toFixed(1)}%`;

}


/* =========================================================
   EVENTS
========================================================= */

targetSelect.addEventListener(
    "change",
    updateTarget
);


attendSelect.addEventListener(
    "change",
    updateAttendScenario
);


missSelect.addEventListener(
    "change",
    updateMissScenario
);


customAttend.addEventListener(
    "change",
    updateCustomScenario
);


customMiss.addEventListener(
    "change",
    updateCustomScenario
);


/* =========================================================
   INITIALIZE
========================================================= */

updateTarget();

updateAttendScenario();

updateMissScenario();

updateCustomScenario();