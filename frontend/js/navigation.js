/* =========================================================
   SCCE ATTENDANCE — SHARED NAVIGATION
   Single source of truth for the bottom nav markup.
   Add new pages to NAV_ITEMS only — never hardcode
   <nav> HTML inside a page again.
========================================================= */

const NAV_ITEMS = [
    { id: "dashboard",  href: "student.html",     icon: "⌂",  label: "Dashboard" },
    { id: "calculator", href: "calculator.html",  icon: "🧮", label: "Calculator" }
];


export function loadStudentNavigation(activePage) {

    const mount =
        document.getElementById("studentNavigation");

    if (!mount) {
        console.warn(
            'loadStudentNavigation: no element with id="studentNavigation" found on this page.'
        );
        return;
    }

    const linksHtml = NAV_ITEMS
        .map((item) => {

            const isActive = item.id === activePage;

            return `
                <a
                    href="${item.href}"
                    class="nav-item${isActive ? " active" : ""}"
                    ${isActive ? 'aria-current="page"' : ""}
                >
                    <span class="nav-icon">${item.icon}</span>
                    <span class="nav-label">${item.label}</span>
                </a>
            `;
        })
        .join("");

    mount.innerHTML = `
        <nav class="student-nav" aria-label="Student navigation">
            ${linksHtml}
        </nav>
    `;
}