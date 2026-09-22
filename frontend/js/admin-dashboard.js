import { db, auth } from "./firebase.js";

import {
    collection,
    doc,
    getDocs,
    getDoc,
    query,
    where,
    updateDoc,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


// ======================================================
// DOM ELEMENTS
// ======================================================

const adminEmail =
    document.getElementById("adminEmail");

const logoutButton =
    document.getElementById("logoutButton");


// Statistics

const pendingCount =
    document.getElementById("pendingCount");

const studentCount =
    document.getElementById("studentCount");

const jobCount =
    document.getElementById("jobCount");

const runningJobCount =
    document.getElementById("runningJobCount");

const failedJobCount =
    document.getElementById("failedJobCount");

const pendingJobCount =
    document.getElementById("pendingJobCount");


// Containers

const requestsContainer =
    document.getElementById("requestsContainer");

const studentsContainer =
    document.getElementById("studentsContainer");

const jobsContainer =
    document.getElementById("jobsContainer");

const workerContainer =
    document.getElementById("workerContainer");

const jobDetailsSection =
    document.getElementById("jobDetailsSection");

const jobDetailsContainer =
    document.getElementById("jobDetailsContainer");


// Buttons

const refreshRequests =
    document.getElementById("refreshRequests");

const refreshStudents =
    document.getElementById("refreshStudents");

const refreshJobs =
    document.getElementById("refreshJobs");

const refreshWorker =
    document.getElementById("refreshWorker");

const closeJobDetails =
    document.getElementById("closeJobDetails");


// ======================================================
// AUTH GUARD
// ======================================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "index.html";

        return;
    }

    adminEmail.textContent =
        user.email || "Admin";

    await loadDashboard();

});


// ======================================================
// DASHBOARD LOAD
// ======================================================

async function loadDashboard() {

    await Promise.all([
        loadRegistrationRequests(),
        loadStudents(),
        loadJobs()
    ]);

}


// ======================================================
// REGISTRATION REQUESTS
// ======================================================

async function loadRegistrationRequests() {

    requestsContainer.innerHTML = `
        <div class="admin-loading">
            Loading registration requests...
        </div>
    `;

    try {

        const snapshot = await getDocs(
            collection(db, "registration_requests")
        );

        const requests = [];

        snapshot.forEach((docSnap) => {

            const data = docSnap.data();

            if (data.status === "PENDING") {

                requests.push({
                    id: docSnap.id,
                    ...data
                });

            }

        });


        // Newest first

        requests.sort((a, b) => {

            return (
                getTimestampMillis(b.requestedAt) -
                getTimestampMillis(a.requestedAt)
            );

        });


        pendingCount.textContent =
            requests.length;


        if (requests.length === 0) {

            requestsContainer.innerHTML = `
                <div class="admin-empty">

                    <div class="empty-icon">
                        ✓
                    </div>

                    <h3>
                        No pending requests
                    </h3>

                    <p>
                        New student registration requests
                        will appear here.
                    </p>

                </div>
            `;

            return;
        }


        requestsContainer.innerHTML =
            requests
                .map(renderRequest)
                .join("");


        attachRequestListeners();


    } catch (error) {

        console.error(
            "Failed to load requests:",
            error
        );

        requestsContainer.innerHTML = `
            <div class="admin-error">

                Failed to load registration requests.

                <br>

                <small>
                    ${escapeHTML(error.message)}
                </small>

            </div>
        `;

    }

}


// ======================================================
// RENDER REQUEST
// ======================================================

function renderRequest(request) {

    return `
        <div class="request-card">

            <div class="request-info">

                <div class="request-hall">
                    ${escapeHTML(request.hallTicket)}
                </div>

                <div class="request-date">
                    Requested
                    ${formatTimestamp(request.requestedAt)}
                </div>

            </div>


            <div class="request-actions">

                <button
                    class="approve-button"
                    data-action="approve"
                    data-hall="${escapeHTML(request.hallTicket)}"
                >
                    ✓ Approve
                </button>


                <button
                    class="reject-button"
                    data-action="reject"
                    data-hall="${escapeHTML(request.hallTicket)}"
                >
                    ✕ Reject
                </button>

            </div>

        </div>
    `;

}


// ======================================================
// REQUEST LISTENERS
// ======================================================

function attachRequestListeners() {

    const approveButtons =
        document.querySelectorAll(
            '[data-action="approve"]'
        );

    const rejectButtons =
        document.querySelectorAll(
            '[data-action="reject"]'
        );


    approveButtons.forEach((button) => {

        button.addEventListener(
            "click",
            async () => {

                const hallTicket =
                    button.dataset.hall;

                await approveStudent(
                    hallTicket,
                    button
                );

            }
        );

    });


    rejectButtons.forEach((button) => {

        button.addEventListener(
            "click",
            async () => {

                const hallTicket =
                    button.dataset.hall;

                await rejectStudent(
                    hallTicket,
                    button
                );

            }
        );

    });

}


// ======================================================
// APPROVE STUDENT
// ======================================================

async function approveStudent(
    hallTicket,
    button
) {

    const user = auth.currentUser;

    if (!user) {

        alert(
            "Admin session expired. Please login again."
        );

        return;
    }


    const confirmed = confirm(
        `Approve ${hallTicket}?\n\n` +
        `This will create the student record ` +
        `and queue the initial attendance sync.`
    );


    if (!confirmed) {
        return;
    }


    button.disabled = true;

    button.textContent =
        "Approving...";


    try {

        const requestRef = doc(
            db,
            "registration_requests",
            hallTicket
        );


        const studentRef = doc(
            db,
            "students",
            hallTicket
        );


        const jobId =
            `initial_${hallTicket}`;


        const jobRef = doc(
            db,
            "jobs",
            jobId
        );


        await runTransaction(
            db,
            async (transaction) => {

                // ------------------------------------------
                // READ
                // ------------------------------------------

                const requestSnapshot =
                    await transaction.get(
                        requestRef
                    );


                const studentSnapshot =
                    await transaction.get(
                        studentRef
                    );


                if (!requestSnapshot.exists()) {

                    throw new Error(
                        "Registration request no longer exists."
                    );

                }


                const requestData =
                    requestSnapshot.data();


                if (
                    requestData.status !==
                    "PENDING"
                ) {

                    throw new Error(
                        `This request is already ${requestData.status}.`
                    );

                }


                // ------------------------------------------
                // STUDENT ALREADY EXISTS
                // ------------------------------------------

                if (studentSnapshot.exists()) {

                    throw new Error(
                        "This student is already registered."
                    );

                }


                // ------------------------------------------
                // CREATE STUDENT
                // ------------------------------------------

                transaction.set(
                    studentRef,
                    {

                        hallTicket:
                            hallTicket,

                        registeredAt:
                            serverTimestamp(),

                        firstScrapedDate:
                            null,

                        lastScrapedDate:
                            null,

                        status:
                            "ACTIVE",

                        updatedAt:
                            serverTimestamp()

                    }
                );


                // ------------------------------------------
                // CREATE INITIAL SYNC JOB
                // ------------------------------------------

                transaction.set(
                    jobRef,
                    {

                        type:
                            "INITIAL_SYNC",

                        hallTicket:
                            hallTicket,

                        status:
                            "PENDING",

                        attempts:
                            0,

                        maxAttempts:
                            3,

                        workerId:
                            null,

                        startedAt:
                            null,

                        lastError:
                            null,

                        currentDate:
                            null,

                        lastCompletedDate:
                            null,

                        completedCount:
                            0,

                        totalCount:
                            null,

                        createdAt:
                            serverTimestamp(),

                        updatedAt:
                            serverTimestamp()

                    }
                );


                // ------------------------------------------
                // UPDATE REQUEST
                // ------------------------------------------

                transaction.update(
                    requestRef,
                    {

                        status:
                            "APPROVED",

                        reviewedAt:
                            serverTimestamp(),

                        reviewedBy:
                            user.uid,

                        rejectionReason:
                            null

                    }
                );

            }
        );


        alert(
            `${hallTicket} approved successfully.\n\n` +
            `Initial attendance sync has been queued.`
        );


        await loadDashboard();


    } catch (error) {

        console.error(
            "Approval failed:",
            error
        );


        alert(
            `Approval failed:\n\n${error.message}`
        );


        button.disabled = false;

        button.textContent =
            "✓ Approve";

    }

}


// ======================================================
// REJECT STUDENT
// ======================================================

async function rejectStudent(
    hallTicket,
    button
) {

    const user = auth.currentUser;

    if (!user) {

        alert(
            "Admin session expired. Please login again."
        );

        return;
    }


    const reason = prompt(
        `Why are you rejecting ${hallTicket}?\n\n` +
        `You can leave this blank.`
    );


    if (reason === null) {
        return;
    }


    const confirmed = confirm(
        `Reject registration request for ${hallTicket}?`
    );


    if (!confirmed) {
        return;
    }


    button.disabled = true;

    button.textContent =
        "Rejecting...";


    try {

        const requestRef = doc(
            db,
            "registration_requests",
            hallTicket
        );


        const requestSnapshot =
            await getDoc(requestRef);


        if (!requestSnapshot.exists()) {

            throw new Error(
                "Registration request no longer exists."
            );

        }


        const requestData =
            requestSnapshot.data();


        if (
            requestData.status !==
            "PENDING"
        ) {

            throw new Error(
                `This request is already ${requestData.status}.`
            );

        }


        await updateDoc(
            requestRef,
            {

                status:
                    "REJECTED",

                reviewedAt:
                    serverTimestamp(),

                reviewedBy:
                    user.uid,

                rejectionReason:
                    reason.trim() || null

            }
        );


        alert(
            `${hallTicket} registration request rejected.`
        );


        await loadDashboard();


    } catch (error) {

        console.error(
            "Rejection failed:",
            error
        );


        alert(
            `Rejection failed:\n\n${error.message}`
        );


        button.disabled = false;

        button.textContent =
            "✕ Reject";

    }

}


// ======================================================
// STUDENTS
// ======================================================

async function loadStudents() {

    studentsContainer.innerHTML = `
        <div class="admin-loading">
            Loading students...
        </div>
    `;


    try {

        const studentsQuery = query(
            collection(db, "students"),
            where(
                "status",
                "==",
                "ACTIVE"
            )
        );


        const snapshot =
            await getDocs(
                studentsQuery
            );


        const students = [];


        snapshot.forEach((docSnap) => {

            students.push({

                id:
                    docSnap.id,

                ...docSnap.data()

            });

        });


        students.sort((a, b) => {

            return (
                String(a.hallTicket || "")
                    .localeCompare(
                        String(b.hallTicket || "")
                    )
            );

        });


        studentCount.textContent =
            students.length;


        if (students.length === 0) {

            studentsContainer.innerHTML = `
                <div class="admin-empty">

                    <div class="empty-icon">
                        👤
                    </div>

                    <h3>
                        No students yet
                    </h3>

                    <p>
                        Approved students will appear here.
                    </p>

                </div>
            `;

            return;
        }


        studentsContainer.innerHTML =
            students
                .map(renderStudent)
                .join("");


    } catch (error) {

        console.error(
            "Failed to load students:",
            error
        );


        studentsContainer.innerHTML = `
            <div class="admin-error">

                Failed to load students.

                <br>

                <small>
                    ${escapeHTML(error.message)}
                </small>

            </div>
        `;

    }

}


// ======================================================
// RENDER STUDENT
// ======================================================

function renderStudent(student) {

    const firstScraped =
        student.firstScrapedDate
            ? escapeHTML(
                String(student.firstScrapedDate)
            )
            : "Not started";


    const lastScraped =
        student.lastScrapedDate
            ? escapeHTML(
                String(student.lastScrapedDate)
            )
            : "Not available";


    return `
        <div class="student-card">

            <div class="student-info">

                <div class="student-hall">
                    ${escapeHTML(
                        student.hallTicket ||
                        "Unknown"
                    )}
                </div>

                <div class="student-date">

                    Registered
                    ${formatTimestamp(
                        student.registeredAt
                    )}

                    <br>

                    First scraped:
                    ${firstScraped}

                    <br>

                    Last scraped:
                    ${lastScraped}

                </div>

            </div>


            <div class="status-badge status-active">
                ACTIVE
            </div>

        </div>
    `;

}


// ======================================================
// JOBS
// ======================================================

async function loadJobs() {

    jobsContainer.innerHTML = `
        <div class="admin-loading">
            Loading jobs...
        </div>
    `;


    workerContainer.innerHTML = `
        <div class="admin-loading">
            Checking worker activity...
        </div>
    `;


    try {

        const snapshot =
            await getDocs(
                collection(db, "jobs")
            );


        const jobs = [];


        snapshot.forEach((docSnap) => {

            jobs.push({

                id:
                    docSnap.id,

                ...docSnap.data()

            });

        });


        // Sort newest updated first

        jobs.sort((a, b) => {

            return (
                getTimestampMillis(b.updatedAt) -
                getTimestampMillis(a.updatedAt)
            );

        });


        // ------------------------------------------
        // STATISTICS
        // ------------------------------------------

        const runningJobs =
            jobs.filter(
                job =>
                    job.status ===
                    "PROCESSING"
            );


        const failedJobs =
            jobs.filter(
                job =>
                    job.status ===
                    "FAILED"
            );


        const pendingJobs =
            jobs.filter(
                job =>
                    job.status ===
                    "PENDING"
            );


        const todayStart =
            new Date();

        todayStart.setHours(
            0,
            0,
            0,
            0
        );


        const todayJobs =
            jobs.filter((job) => {

                const updated =
                    getTimestampMillis(
                        job.updatedAt
                    );

                return (
                    updated >=
                    todayStart.getTime()
                );

            });


        jobCount.textContent =
            todayJobs.length;


        runningJobCount.textContent =
            runningJobs.length;


        failedJobCount.textContent =
            failedJobs.length;


        pendingJobCount.textContent =
            pendingJobs.length;


        // ------------------------------------------
        // JOBS
        // ------------------------------------------

        if (jobs.length === 0) {

            jobsContainer.innerHTML = `
                <div class="admin-empty">

                    <div class="empty-icon">
                        ⚙
                    </div>

                    <h3>
                        No jobs yet
                    </h3>

                    <p>
                        Attendance sync jobs
                        will appear here.
                    </p>

                </div>
            `;

        } else {

            jobsContainer.innerHTML =
                jobs
                    .slice(0, 30)
                    .map(renderJob)
                    .join("");

            attachJobListeners();

        }


        // ------------------------------------------
        // WORKER
        // ------------------------------------------

        renderWorker(
            runningJobs,
            pendingJobs,
            failedJobs
        );


    } catch (error) {

        console.error(
            "Failed to load jobs:",
            error
        );


        jobsContainer.innerHTML = `
            <div class="admin-error">

                Failed to load jobs.

                <br>

                <small>
                    ${escapeHTML(error.message)}
                </small>

            </div>
        `;


        workerContainer.innerHTML = `
            <div class="admin-error">

                Failed to load worker status.

                <br>

                <small>
                    ${escapeHTML(error.message)}
                </small>

            </div>
        `;

    }

}


// ======================================================
// RENDER JOB
// ======================================================

function renderJob(job) {

    const status =
        job.status || "UNKNOWN";


    const statusClass =
        getJobStatusClass(status);


    const completed =
        Number(job.completedCount || 0);


    const total =
        Number(job.totalCount || 0);


    let progress = 0;


    if (total > 0) {

        progress =
            Math.min(
                100,
                Math.round(
                    (completed / total) * 100
                )
            );

    }


    const progressText =
        total > 0
            ? `${completed} / ${total}`
            : `${completed} / —`;


    return `
        <article
            class="job-card"
            data-job-id="${escapeHTML(job.id)}"
        >

            <div class="job-info">

                <div class="job-hall">
                    ${escapeHTML(
                        job.hallTicket ||
                        "Unknown"
                    )}
                </div>


                <div class="job-date">

                    ${escapeHTML(
                        job.type ||
                        "JOB"
                    )}

                    · Updated

                    ${formatTimestamp(
                        job.updatedAt
                    )}

                </div>


                <div class="job-progress">

                    <div class="job-progress-label">

                        <span>
                            Progress
                        </span>

                        <span>
                            ${progressText}
                        </span>

                    </div>


                    <div class="job-progress-track">

                        <div
                            class="job-progress-bar"
                            style="width: ${progress}%"
                        ></div>

                    </div>

                </div>


                <div class="job-meta">

                    <span>
                        Current:
                        ${formatJobDate(
                            job.currentDate
                        )}
                    </span>

                    <span>
                        Last completed:
                        ${formatJobDate(
                            job.lastCompletedDate
                        )}
                    </span>

                </div>

            </div>


            <div class="job-side">

                <div
                    class="status-badge ${statusClass}"
                >
                    ${escapeHTML(status)}
                </div>


                <button
                    type="button"
                    class="secondary-button job-details-button"
                    data-job-id="${escapeHTML(job.id)}"
                >
                    View Details
                </button>

            </div>

        </article>
    `;

}


// ======================================================
// JOB LISTENERS
// ======================================================

function attachJobListeners() {

    const buttons =
        document.querySelectorAll(
            ".job-details-button"
        );


    buttons.forEach((button) => {

        button.addEventListener(
            "click",
            () => {

                const jobId =
                    button.dataset.jobId;

                showJobDetails(jobId);

            }
        );

    });

}


// ======================================================
// JOB DETAILS
// ======================================================

async function showJobDetails(jobId) {

    jobDetailsSection.hidden = false;


    jobDetailsContainer.innerHTML = `
        <div class="admin-loading">
            Loading job details...
        </div>
    `;


    try {

        const jobRef =
            doc(
                db,
                "jobs",
                jobId
            );


        const snapshot =
            await getDoc(jobRef);


        if (!snapshot.exists()) {

            throw new Error(
                "Job no longer exists."
            );

        }


        const job = {

            id:
                snapshot.id,

            ...snapshot.data()

        };


        jobDetailsContainer.innerHTML =
            renderJobDetails(job);


        jobDetailsSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });


    } catch (error) {

        console.error(
            "Failed to load job details:",
            error
        );


        jobDetailsContainer.innerHTML = `
            <div class="admin-error">

                Failed to load job details.

                <br>

                <small>
                    ${escapeHTML(
                        error.message
                    )}
                </small>

            </div>
        `;

    }

}


// ======================================================
// RENDER JOB DETAILS
// ======================================================

function renderJobDetails(job) {

    const completed =
        Number(
            job.completedCount || 0
        );


    const total =
        Number(
            job.totalCount || 0
        );


    let progress = 0;


    if (total > 0) {

        progress =
            Math.min(
                100,
                Math.round(
                    (completed / total) * 100
                )
            );

    }


    const status =
        job.status || "UNKNOWN";


    return `
        <div class="job-detail-card">

            <div class="job-detail-header">

                <div>

                    <p class="admin-eyebrow">
                        ${escapeHTML(
                            job.type ||
                            "JOB"
                        )}
                    </p>

                    <h3>
                        ${escapeHTML(
                            job.hallTicket ||
                            "Unknown"
                        )}
                    </h3>

                </div>


                <div
                    class="status-badge ${getJobStatusClass(status)}"
                >
                    ${escapeHTML(status)}
                </div>

            </div>


            <div class="job-detail-progress">

                <div class="job-progress-label">

                    <span>
                        Progress
                    </span>

                    <strong>
                        ${completed}
                        /
                        ${total || "—"}
                    </strong>

                </div>


                <div class="job-progress-track">

                    <div
                        class="job-progress-bar"
                        style="width: ${progress}%"
                    ></div>

                </div>


                <div class="job-progress-percent">
                    ${progress}%
                </div>

            </div>


            <div class="job-detail-grid">

                <div class="job-detail-item">

                    <span>
                        Current date
                    </span>

                    <strong>
                        ${formatJobDate(
                            job.currentDate
                        )}
                    </strong>

                </div>


                <div class="job-detail-item">

                    <span>
                        Last completed
                    </span>

                    <strong>
                        ${formatJobDate(
                            job.lastCompletedDate
                        )}
                    </strong>

                </div>


                <div class="job-detail-item">

                    <span>
                        Attempts
                    </span>

                    <strong>
                        ${Number(
                            job.attempts || 0
                        )}
                        /
                        ${Number(
                            job.maxAttempts || 0
                        )}
                    </strong>

                </div>


                <div class="job-detail-item">

                    <span>
                        Worker
                    </span>

                    <strong>
                        ${escapeHTML(
                            job.workerId ||
                            "Not assigned"
                        )}
                    </strong>

                </div>


                <div class="job-detail-item">

                    <span>
                        Started
                    </span>

                    <strong>
                        ${formatTimestamp(
                            job.startedAt
                        )}
                    </strong>

                </div>


                <div class="job-detail-item">

                    <span>
                        Updated
                    </span>

                    <strong>
                        ${formatTimestamp(
                            job.updatedAt
                        )}
                    </strong>

                </div>

            </div>


            ${
                job.lastError
                    ? `
                        <div class="job-error-box">

                            <div class="job-error-title">
                                Last error
                            </div>

                            <div class="job-error-message">
                                ${escapeHTML(
                                    job.lastError
                                )}
                            </div>

                        </div>
                    `
                    : `
                        <div class="job-success-box">
                            No recorded error.
                        </div>
                    `
            }

        </div>
    `;

}


// ======================================================
// WORKER STATUS
// ======================================================

function renderWorker(
    runningJobs,
    pendingJobs,
    failedJobs
) {

    if (
        runningJobs.length === 0 &&
        pendingJobs.length === 0
    ) {

        workerContainer.innerHTML = `
            <div class="worker-card">

                <div class="worker-status">

                    <span class="worker-dot"></span>

                    <strong>
                        Worker idle
                    </strong>

                </div>


                <div class="worker-summary">

                    <span>
                        No job is currently running.
                    </span>

                    <span>
                        ${failedJobs.length}
                        failed
                    </span>

                </div>

            </div>
        `;

        return;
    }


    const current =
        runningJobs[0];


    workerContainer.innerHTML = `
        <div class="worker-card">

            <div class="worker-status">

                <span class="worker-dot worker-active"></span>

                <strong>
                    Worker active
                </strong>

            </div>


            ${
                current
                    ? `
                        <div class="worker-current">

                            <div>

                                <span class="worker-label">
                                    Current job
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        current.hallTicket ||
                                        "Unknown"
                                    )}
                                </strong>

                            </div>


                            <div>

                                <span class="worker-label">
                                    Current date
                                </span>

                                <strong>
                                    ${formatJobDate(
                                        current.currentDate
                                    )}
                                </strong>

                            </div>


                            <div>

                                <span class="worker-label">
                                    Progress
                                </span>

                                <strong>
                                    ${Number(
                                        current.completedCount ||
                                        0
                                    )}
                                    /
                                    ${Number(
                                        current.totalCount ||
                                        0
                                    ) || "—"}
                                </strong>

                            </div>

                        </div>
                    `
                    : `
                        <div class="worker-current">

                            <span>
                                No job is currently processing.
                            </span>

                        </div>
                    `
            }


            <div class="worker-summary">

                <span>
                    ${pendingJobs.length}
                    pending
                </span>

                <span>
                    ${runningJobs.length}
                    running
                </span>

                <span>
                    ${failedJobs.length}
                    failed
                </span>

            </div>

        </div>
    `;

}


// ======================================================
// JOB STATUS CLASS
// ======================================================

function getJobStatusClass(status) {

    switch (status) {

        case "SUCCESS":
            return "status-success";

        case "PROCESSING":
            return "status-processing";

        case "FAILED":
            return "status-failed";

        case "PENDING":
            return "status-pending";

        default:
            return "status-unknown";

    }

}


// ======================================================
// REFRESH BUTTONS
// ======================================================

refreshRequests?.addEventListener(
    "click",
    loadRegistrationRequests
);


refreshStudents?.addEventListener(
    "click",
    loadStudents
);


refreshJobs?.addEventListener(
    "click",
    loadJobs
);


refreshWorker?.addEventListener(
    "click",
    loadJobs
);


// ======================================================
// CLOSE JOB DETAILS
// ======================================================

closeJobDetails?.addEventListener(
    "click",
    () => {

        jobDetailsSection.hidden = true;

    }
);


// ======================================================
// LOGOUT
// ======================================================

logoutButton?.addEventListener(
    "click",
    async () => {

        try {

            await signOut(auth);

            window.location.href =
                "index.html";

        } catch (error) {

            console.error(
                "Logout failed:",
                error
            );

            alert(
                "Logout failed. Please try again."
            );

        }

    }
);


// ======================================================
// TIMESTAMP HELPERS
// ======================================================

function getTimestampMillis(timestamp) {

    if (!timestamp) {
        return 0;
    }


    if (
        typeof timestamp.toMillis ===
        "function"
    ) {

        return timestamp.toMillis();

    }


    if (
        timestamp.seconds !== undefined
    ) {

        return (
            Number(timestamp.seconds) *
            1000
        );

    }


    if (
        timestamp instanceof Date
    ) {

        return timestamp.getTime();

    }


    return 0;

}


// ======================================================
// FORMAT TIMESTAMP
// ======================================================

function formatTimestamp(timestamp) {

    const millis =
        getTimestampMillis(timestamp);


    if (!millis) {
        return "Not available";
    }


    const date =
        new Date(millis);


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

}


// ======================================================
// FORMAT JOB DATE
// ======================================================

function formatJobDate(value) {

    if (!value) {
        return "Not started";
    }


    if (
        typeof value === "object" &&
        value.seconds !== undefined
    ) {

        return formatTimestamp(value);

    }


    return escapeHTML(
        String(value)
    );

}


// ======================================================
// HTML ESCAPE
// ======================================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}