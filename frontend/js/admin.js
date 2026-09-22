import { auth } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


// ======================================================
// DOM ELEMENTS
// ======================================================

const form =
    document.getElementById("adminLoginForm");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const loginButton =
    document.getElementById("loginButton");

const loginError =
    document.getElementById("loginError");


// ======================================================
// CHECK ELEMENTS
// ======================================================

if (!form) {
    console.error("Admin login form not found.");
}

if (!emailInput) {
    console.error("Email input not found.");
}

if (!passwordInput) {
    console.error("Password input not found.");
}

if (!loginButton) {
    console.error("Login button not found.");
}

if (!loginError) {
    console.error("Login error element not found.");
}


// ======================================================
// CHECK EXISTING LOGIN
// ======================================================

onAuthStateChanged(auth, (user) => {

    console.log(
        "Firebase auth state:",
        user ? user.email : "Not logged in"
    );


    if (user) {

        console.log(
            "Already logged in. Opening dashboard..."
        );

        window.location.replace(
            "dashboard.html"
        );
    }

});


// ======================================================
// LOGIN
// ======================================================

form?.addEventListener("submit", async (event) => {

    event.preventDefault();


    if (!emailInput || !passwordInput || !loginButton) {
        return;
    }


    // Clear previous error
    if (loginError) {
        loginError.textContent = "";
    }


    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;


    // ==================================================
    // VALIDATION
    // ==================================================

    if (!email) {

        if (loginError) {
            loginError.textContent =
                "Please enter your email.";
        }

        emailInput.focus();

        return;
    }


    if (!password) {

        if (loginError) {
            loginError.textContent =
                "Please enter your password.";
        }

        passwordInput.focus();

        return;
    }


    // ==================================================
    // LOADING
    // ==================================================

    loginButton.disabled = true;

    loginButton.textContent =
        "Signing in...";


    try {

        console.log(
            "Attempting Firebase login..."
        );


        // ==================================================
        // FIREBASE LOGIN
        // ==================================================

        const result =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        console.log(
            "Login successful:",
            result.user.email
        );


        // ==================================================
        // OPEN DASHBOARD
        // ==================================================

        window.location.replace(
            "dashboard.html"
        );


    } catch (error) {

        console.error(
            "Admin login failed:",
            error
        );


        // ==================================================
        // ERROR MESSAGES
        // ==================================================

        if (!loginError) {
            return;
        }


        switch (error.code) {

            case "auth/invalid-credential":

            case "auth/wrong-password":

            case "auth/user-not-found":

                loginError.textContent =
                    "Invalid email or password.";

                break;


            case "auth/invalid-email":

                loginError.textContent =
                    "Please enter a valid email address.";

                break;


            case "auth/too-many-requests":

                loginError.textContent =
                    "Too many attempts. Please try again later.";

                break;


            case "auth/network-request-failed":

                loginError.textContent =
                    "Network error. Please check your connection.";

                break;


            default:

                loginError.textContent =
                    "Unable to sign in. Please try again.";

                console.error(
                    "Firebase error code:",
                    error.code
                );
        }


    } finally {

        loginButton.disabled = false;

        loginButton.textContent =
            "Sign in";
    }

});