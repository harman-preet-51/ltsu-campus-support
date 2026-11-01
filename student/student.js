
/* =========================================
   LTSU CAMPUS SUPPORT
   STUDENT PORTAL - JAVASCRIPT
========================================= */

document.addEventListener("DOMContentLoaded", function () {

    // ---------- ELEMENTS ----------

    const loginTab = document.getElementById("login-tab");
    const registerTab = document.getElementById("register-tab");

    const loginPanel = document.getElementById("login-panel");
    const registerPanel = document.getElementById("register-panel");

    const authSection = document.getElementById("auth-section");
    const dashboard = document.getElementById("student-dashboard");

    const loginForm = document.getElementById("student-login-form");
    const registerForm = document.getElementById("student-register-form");

    const logoutButton = document.getElementById("logout-btn");

    const complaintButton = document.getElementById("show-complaint");
    const historyButton = document.getElementById("show-history");
    const feedbackButton = document.getElementById("show-feedback");

    const complaintPanel = document.getElementById("complaint-panel");
    const historyPanel = document.getElementById("history-panel");
    const feedbackPanel = document.getElementById("feedback-panel");

    const currentYear = document.getElementById("current-year");


    // ---------- CURRENT YEAR ----------

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }


    // ---------- HELPER: SHOW MESSAGE ----------

    function showMessage(form, message) {

        if (!form) return;

        let messageBox = form.querySelector(".form-message");

        if (!messageBox) {
            messageBox = document.createElement("div");
            messageBox.className = "form-message";
            messageBox.setAttribute("role", "status");
            form.appendChild(messageBox);
        }

        messageBox.textContent = message;
    }


    // ---------- LOGIN / REGISTER TABS ----------

    function openLogin() {

        if (loginPanel) loginPanel.classList.remove("hidden");
        if (registerPanel) registerPanel.classList.add("hidden");

        if (loginTab) {
            loginTab.classList.add("active");
            loginTab.setAttribute("aria-selected", "true");
        }

        if (registerTab) {
            registerTab.classList.remove("active");
            registerTab.setAttribute("aria-selected", "false");
        }
    }

    function openRegister() {

        if (registerPanel) registerPanel.classList.remove("hidden");
        if (loginPanel) loginPanel.classList.add("hidden");

        if (registerTab) {
            registerTab.classList.add("active");
            registerTab.setAttribute("aria-selected", "true");
        }

        if (loginTab) {
            loginTab.classList.remove("active");
            loginTab.setAttribute("aria-selected", "false");
        }
    }

    if (loginTab) {
        loginTab.addEventListener("click", openLogin);
    }

    if (registerTab) {
        registerTab.addEventListener("click", openRegister);
    }


    // ---------- SWITCH LINKS ----------

    document.querySelectorAll(".switch-text a").forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

            const linkText = link.textContent.toLowerCase();

            if (linkText.includes("register") ||
                linkText.includes("create account")) {
                openRegister();
            } else {
                openLogin();
            }

        });

    });


    // ---------- LOGIN FORM ----------

    if (loginForm) {

        loginForm.addEventListener("submit", function (event) {

            event.preventDefault();

            showMessage(
                loginForm,
                "Student login will be available after secure backend connection."
            );

        });

    }


    // ---------- REGISTRATION FORM ----------

    if (registerForm) {

        registerForm.addEventListener("submit", function (event) {

            event.preventDefault();

            showMessage(
                registerForm,
                "Student registration will be available after secure backend connection."
            );

        });

    }


    // ---------- DASHBOARD SECTION NAVIGATION ----------

    function hideDashboardPanels() {

        [complaintPanel, historyPanel, feedbackPanel].forEach(function (panel) {

            if (panel) {
                panel.classList.add("hidden");
            }

        });

    }

    function showDashboardPanel(panel) {

        if (!dashboard) return;

        hideDashboardPanels();

        if (panel) {
            panel.classList.remove("hidden");

            panel.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }

    }

    if (complaintButton) {
        complaintButton.addEventListener("click", function () {
            showDashboardPanel(complaintPanel);
        });
    }

    if (historyButton) {
        historyButton.addEventListener("click", function () {
            showDashboardPanel(historyPanel);
        });
    }

    if (feedbackButton) {
        feedbackButton.addEventListener("click", function () {
            showDashboardPanel(feedbackPanel);
        });
    }


    // ---------- LOGOUT BUTTON ----------

    if (logoutButton) {

        logoutButton.addEventListener("click", function () {

            if (dashboard) {
                dashboard.classList.add("hidden");
            }

            if (authSection) {
                authSection.classList.remove("hidden");
            }

            hideDashboardPanels();
            openLogin();

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

        });

    }


    // ---------- COMPLAINT FORM ----------

    if (complaintPanel) {

        const complaintForm = complaintPanel.querySelector("form");

        if (complaintForm) {

            complaintForm.addEventListener("submit", function (event) {

                event.preventDefault();

                showMessage(
                    complaintForm,
                    "Complaint submission will be available after secure backend connection."
                );

            });

        }

    }


    // ---------- FEEDBACK FORM ----------

    const feedbackForm = document.getElementById("feedback-form");

    if (feedbackForm) {

        feedbackForm.addEventListener("submit", function (event) {

            event.preventDefault();

            showMessage(
                feedbackForm,
                "Feedback submission will be available after secure backend connection."
            );

        });

    }


    // ---------- INITIAL PAGE STATE ----------

    if (dashboard) {
        dashboard.classList.add("hidden");
    }

    if (authSection) {
        authSection.classList.remove("hidden");
    }

    openLogin();


    // ---------- CONSOLE MESSAGE ----------

    console.log("LTSU Campus Support Student Portal Loaded Successfully.");

});
