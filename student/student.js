
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

/* =========================================
   LTSU STUDENT PORTAL - AI CHAT ASSISTANT
   Demo chatbot - frontend only
========================================= */

document.addEventListener("DOMContentLoaded", function () {

    // Prevent duplicate chatbot
    if (document.getElementById("student-ai-button")) return;

    // Add chatbot styles
    const style = document.createElement("style");

    style.textContent = `
        #student-ai-button {
            position: fixed;
            bottom: 22px;
            right: 22px;
            z-index: 9999;
            border: none;
            border-radius: 50px;
            padding: 14px 20px;
            background: linear-gradient(135deg, #7657e8, #12b981);
            color: white;
            font-size: 15px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 5px 20px rgba(0,0,0,0.25);
        }

        #student-ai-window {
            display: none;
            position: fixed;
            bottom: 85px;
            right: 20px;
            width: min(340px, calc(100vw - 40px));
            height: 440px;
            max-height: calc(100vh - 120px);
            background: white;
            border-radius: 18px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.25);
            z-index: 9999;
            overflow: hidden;
            font-family: Arial, sans-serif;
        }

        #student-ai-header {
            background: linear-gradient(135deg, #7657e8, #12b981);
            color: white;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: bold;
        }

        #student-ai-close {
            background: transparent;
            border: none;
            color: white;
            font-size: 22px;
            cursor: pointer;
        }

        #student-ai-messages {
            height: 315px;
            overflow-y: auto;
            padding: 14px;
            background: #f7f8fc;
        }

        .student-ai-message {
            padding: 10px 12px;
            margin: 8px 0;
            border-radius: 12px;
            max-width: 85%;
            font-size: 13px;
            line-height: 1.5;
            overflow-wrap: anywhere;
        }

        .student-ai-bot {
            background: #e8e5ff;
            color: #292044;
        }

        .student-ai-user {
            background: #d7f8e9;
            color: #174b37;
            margin-left: auto;
        }

        #student-ai-input-area {
            display: flex;
            gap: 7px;
            padding: 10px;
            border-top: 1px solid #eee;
        }

        #student-ai-input {
            flex: 1;
            min-width: 0;
            padding: 11px;
            border: 1px solid #ddd;
            border-radius: 20px;
            outline: none;
        }

        #student-ai-send {
            border: none;
            border-radius: 20px;
            padding: 0 16px;
            background: #7657e8;
            color: white;
            cursor: pointer;
        }

        #student-ai-note {
            text-align: center;
            font-size: 10px;
            color: #777;
            padding: 4px;
        }
    `;

    document.head.appendChild(style);

    // Floating assistant button
    const button = document.createElement("button");
    button.id = "student-ai-button";
    button.textContent = "✦ AI Assistant";
    document.body.appendChild(button);

    // Chat window
    const chat = document.createElement("div");
    chat.id = "student-ai-window";

    chat.innerHTML = `
        <div id="student-ai-header">
            <span>✦ LTSU Student Assistant</span>
            <button id="student-ai-close" aria-label="Close chat">×</button>
        </div>

        <div id="student-ai-messages">
            <div class="student-ai-message student-ai-bot">
                Hello! Welcome to LTSU Student Support. 👋
                <br><br>
                I can guide you about:
                <br>• Reporting campus problems
                <br>• Complaint tracking
                <br>• Student portal help
                <br><br>
                How can I help you?
            </div>
        </div>

        <div id="student-ai-input-area">
            <input
                id="student-ai-input"
                type="text"
                placeholder="Type your message..."
                aria-label="Type your message"
            >
            <button id="student-ai-send">Send</button>
        </div>

        <div id="student-ai-note">
            Demo Assistant • Replies are automated
        </div>
    `;

    document.body.appendChild(chat);

    // Open and close chatbot
    button.addEventListener("click", function () {
        chat.style.display = "block";
        button.style.display = "none";
        document.getElementById("student-ai-input").focus();
    });

    document.getElementById("student-ai-close")
        .addEventListener("click", function () {
            chat.style.display = "none";
            button.style.display = "block";
        });

    const input = document.getElementById("student-ai-input");
    const messages = document.getElementById("student-ai-messages");
    const send = document.getElementById("student-ai-send");

    // Add a chat message safely
    function addMessage(message, sender) {
        const bubble = document.createElement("div");
        bubble.className = "student-ai-message " +
            (sender === "user" ? "student-ai-user" : "student-ai-bot");
        bubble.textContent = message;
        messages.appendChild(bubble);
        messages.scrollTop = messages.scrollHeight;
    }

    // Demo reply system
    function getStudentReply(message) {
        const text = message.toLowerCase();

        if (text.includes("hello") || text.includes("hi") ||
            text.includes("hey")) {
            return "Hello! How can I help you with the LTSU Student Portal?";
        }

        if (text.includes("complaint") || text.includes("problem") ||
            text.includes("report")) {
            return "To report a campus problem, open the complaint section in your Student Portal and submit the required details.";
        }

        if (text.includes("status") || text.includes("track")) {
            return "You can check your complaint progress in the complaint history or tracking section of the portal.";
        }

        if (text.includes("register") || text.includes("account")) {
            return "If you are a new student, use the New Registration option to create your student account.";
        }

        if (text.includes("login") || text.includes("password") ||
            text.includes("pin")) {
            return "Please check that your Student ID and Security PIN are correct. If the issue continues, contact the university support team.";
        }

        if (text.includes("water") || text.includes("electricity") ||
            text.includes("wifi") || text.includes("clean")) {
            return "You can report water, electricity, Wi-Fi, cleanliness and other campus-related issues through the complaint section.";
        }

        if (text.includes("thank")) {
            return "You're welcome! Feel free to ask if you need help.";
        }

        return "I can help with student registration, login, campus complaints and complaint tracking. Please tell me a little more about your issue.";
    }

    // Send message
    function sendStudentMessage() {
        const message = input.value.trim();

        if (!message) return;

        addMessage(message, "user");
        input.value = "";

        const reply = getStudentReply(message);
        addMessage(reply, "bot");
    }

    send.addEventListener("click", sendStudentMessage);

    input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            sendStudentMessage();
        }
    });

});
