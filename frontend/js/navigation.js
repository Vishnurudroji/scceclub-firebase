export function loadStudentNavigation(activePage) {

    const navigation =
        document.getElementById("studentNavigation");

    if (!navigation) return;

    navigation.innerHTML = `
        <nav class="student-nav">

            <a
                href="student.html"
                class="${activePage === "dashboard" ? "active" : ""}"
            >
                <span>⌂</span>
                <small>Dashboard</small>
            </a>

            <a
                href="calculator.html"
                class="${activePage === "calculator" ? "active" : ""}"
            >
                <span>🧮</span>
                <small>Calculator</small>
            </a>

        </nav>
    `;
}