
import {
    db,
    analytics,
    logEvent
} from "./firebase.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* ======================================================
   DOM ELEMENTS
====================================================== */

const form =
    document.getElementById("studentForm");

const hallTicketInput =
    document.getElementById("hallTicket");

const errorMessage =
    document.getElementById("errorMessage");

const proceedButton =
    document.getElementById("proceedButton");

const loadingScreen =
    document.getElementById("loadingScreen");

const loadingTitle =
    document.getElementById("loadingTitle");

const loadingText =
    document.getElementById("loadingText");


/* ======================================================
   SECRET ADMIN ACCESS
   Click the logo 5 times within 2 seconds
====================================================== */

const secretAdminTrigger =
    document.getElementById(
        "secretAdminTrigger"
    );

let logoClickCount = 0;
let logoClickTimer = null;


secretAdminTrigger?.addEventListener(
    "click",
    () => {

        logoClickCount++;

        console.log(
            `Admin trigger: ${logoClickCount}/5`
        );

        clearTimeout(
            logoClickTimer
        );

        logoClickTimer =
            setTimeout(() => {

                logoClickCount = 0;

            }, 2000);


        if (logoClickCount >= 5) {

            logoClickCount = 0;

            clearTimeout(
                logoClickTimer
            );

            window.location.href =
                "admin/";

        }

    }
);


/* ======================================================
   HELPERS
====================================================== */

function normalizeHallTicket(value) {

    return value
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");

}


/* ======================================================
   LOADING SCREEN
====================================================== */

function showLoading(
    title,
    message
) {

    if (!loadingScreen) {
        return;
    }

    if (loadingTitle) {

        loadingTitle.textContent =
            title;

    }

    if (loadingText) {

        loadingText.textContent =
            message;

    }

    loadingScreen.classList.add(
        "active"
    );

}


function hideLoading() {

    if (!loadingScreen) {
        return;
    }

    loadingScreen.classList.remove(
        "active"
    );

}


/* ======================================================
   STUDENT LOGIN / REGISTRATION
====================================================== */

form?.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        errorMessage.textContent = "";


        /* -----------------------------------------------
           Get hall ticket
        ----------------------------------------------- */

        const hallTicket =
            normalizeHallTicket(
                hallTicketInput.value
            );


        /* -----------------------------------------------
           Validate
        ----------------------------------------------- */

        if (!hallTicket) {

            errorMessage.textContent =
                "Please enter your hall ticket number.";

            return;

        }


        /* -----------------------------------------------
           Disable button
        ----------------------------------------------- */

        proceedButton.disabled = true;


        const buttonText =
            proceedButton.querySelector(
                "span:first-child"
            );


        if (buttonText) {

            buttonText.textContent =
                "Checking...";

        }


        try {

            /* ==========================================
               1. CHECK EXISTING STUDENT
            ========================================== */

            showLoading(
                "Checking your attendance",
                "Finding your student record..."
            );


            const studentRef =
                doc(
                    db,
                    "students",
                    hallTicket
                );


            const studentSnapshot =
                await getDoc(
                    studentRef
                );


            /* ==========================================
               STUDENT EXISTS
            ========================================== */

            if (
                studentSnapshot.exists()
            ) {

                const student =
                    studentSnapshot.data();


                /* Check status */

                if (
                    student.status &&
                    student.status !== "ACTIVE"
                ) {

                    hideLoading();

                    errorMessage.textContent =
                        "Your student account is currently inactive.";

                    return;

                }


                logEvent(
                    analytics,
                    "student_login"
                );


                /* Save hall ticket */

                sessionStorage.setItem(
                    "hallTicket",
                    hallTicket
                );


                /* Load dashboard */

                showLoading(
                    "Loading your attendance",
                    "Getting your latest records..."
                );


                setTimeout(() => {

                    window.location.href =
                        "student.html";

                }, 300);


                return;

            }


            /* ==========================================
               2. STUDENT DOESN'T EXIST
               CHECK REGISTRATION REQUEST
            ========================================== */

            showLoading(
                "Checking registration",
                "Looking for your registration request..."
            );


            const requestRef =
                doc(
                    db,
                    "registration_requests",
                    hallTicket
                );


            const requestSnapshot =
                await getDoc(
                    requestRef
                );


            /* ==========================================
               3. EXISTING REGISTRATION REQUEST
            ========================================== */

            if (
                requestSnapshot.exists()
            ) {

                const request =
                    requestSnapshot.data();

                const status =
                    request.status;


                /* --------------------------------------
                   PENDING
                -------------------------------------- */

                if (
                    status === "PENDING"
                ) {

                    sessionStorage.setItem(
                        "pendingHallTicket",
                        hallTicket
                    );


                    window.location.href =
                        "pending.html";

                    return;

                }


                /* --------------------------------------
                   APPROVED
                -------------------------------------- */

                if (
                    status === "APPROVED"
                ) {

                    hideLoading();

                    errorMessage.textContent =
                        "Your registration is approved. Please try again shortly.";

                    return;

                }


                /* --------------------------------------
                   REJECTED
                -------------------------------------- */

                if (
                    status === "REJECTED"
                ) {

                    hideLoading();

                    errorMessage.textContent =
                        "Your registration request was not approved. Please contact the admin.";

                    return;

                }


                /* --------------------------------------
                   UNKNOWN STATUS
                -------------------------------------- */

                hideLoading();

                errorMessage.textContent =
                    "Your registration request is being processed.";

                return;

            }


            /* ==========================================
               4. CREATE NEW REGISTRATION REQUEST
            ========================================== */

            showLoading(
                "Registration request",
                "Sending your request for admin approval..."
            );


            logEvent(
                analytics,
                "registration_requested"
            );


            await setDoc(
                requestRef,
                {

                    hallTicket:
                        hallTicket,

                    status:
                        "PENDING",

                    requestedAt:
                        serverTimestamp(),

                    reviewedAt:
                        null,

                    reviewedBy:
                        null,

                    rejectionReason:
                        null

                }
            );


            /* ==========================================
               5. SAVE PENDING SESSION
            ========================================== */

            sessionStorage.setItem(
                "pendingHallTicket",
                hallTicket
            );


            /* ==========================================
               6. OPEN PENDING PAGE
            ========================================== */

            window.location.href =
                "pending.html";


        } catch (error) {

            console.error(
                "Registration / student lookup failed:",
                error
            );


            hideLoading();


            errorMessage.textContent =
                "Something went wrong. Please try again.";


        } finally {

            proceedButton.disabled = false;


            if (buttonText) {

                buttonText.textContent =
                    "Proceed";

            }

        }

    }
);