
/* =================================================
   LTSU CAMPUS SUPPORT
   ADMIN PORTAL JAVASCRIPT + AI FLOATING CHATBOT
================================================= */

document.addEventListener("DOMContentLoaded", function () {

    const get = (id) => document.getElementById(id);

    // ==============================================
    // 1. COMMON MESSAGE FUNCTION
    // ==============================================

    function showMessage(message) {
        let box = get("admin-js-message");

        if (!box) {
            box = document.createElement("div");
            box.id = "admin-js-message";

            box.style.cssText = `
                position:fixed;
                top:20px;
                right:20px;
                z-index:99999;
                max-width:320px;
                padding:14px 18px;
                background:#102b3d;
                color:white;
                border:1px solid #20c997;
                border-radius:12px;
                font-size:14px;
                box-shadow:0 8px 25px #0004;
            `;

            document.body.appendChild(box);
        }

        box.textContent = message;
        box.style.display = "block";

        clearTimeout(box.hideTimer);

        box.hideTimer = setTimeout(function () {
            box.style.display = "none";
        }, 4500);
    }

    // ==============================================
    // 2. LOGIN AND REGISTRATION TABS
    // ==============================================

    const loginTab = get("admin-login-tab");
    const registerTab = get("admin-register-tab");

    const loginPanel = get("admin-login-panel");
    const registerPanel = get("admin-register-panel");

    function showLogin() {
        if (loginPanel) loginPanel.classList.remove("hidden");
        if (registerPanel) registerPanel.classList.add("hidden");

        if (loginTab) loginTab.classList.add("active");
        if (registerTab) registerTab.classList.remove("active");
    }

    function showRegister() {
        if (registerPanel) registerPanel.classList.remove("hidden");
        if (loginPanel) loginPanel.classList.add("hidden");

        if (registerTab) registerTab.classList.add("active");
        if (loginTab) loginTab.classList.remove("active");
    }

    if (loginTab) {
        loginTab.addEventListener("click", showLogin);
    }

    if (registerTab) {
        registerTab.addEventListener("click", showRegister);
    }

    const openRegister = get("open-admin-register");
    const openLogin = get("open-admin-login");

    if (openRegister) {
        openRegister.addEventListener("click", function (event) {
            event.preventDefault();
            showRegister();
        });
    }

    if (openLogin) {
        openLogin.addEventListener("click", function (event) {
            event.preventDefault();
            showLogin();
        });
    }

    // ==============================================
    // 3. ADMIN LOGIN
    // ==============================================

    const loginForm = get("admin-login-form");

    if (loginForm) {
        loginForm.addEventListener("submit", function (event) {
            event.preventDefault();

            showMessage(
                "Admin login is not connected yet. Secure backend authentication is pending."
            );
        });
    }

    // ==============================================
    // 4. ADMIN REGISTRATION
    // ==============================================

    const registerForm = get("admin-register-form");

    if (registerForm) {
        registerForm.addEventListener("submit", function (event) {
            event.preventDefault();

            showMessage(
                "Registration is not connected yet. Admin accounts will require Super Admin approval."
            );
        });
    }

    // ==============================================
    // 5. DASHBOARD NAVIGATION
    // ==============================================

    const navigationButtons = document.querySelectorAll(".nav-btn");

    const dashboardPanels = [
        get("complaints-section"),
        get("email-section"),
        get("admin-profile-section")
    ].filter(Boolean);

    navigationButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            const targetId = button.dataset.section;
            const targetPanel = get(targetId);

            if (!targetPanel) return;

            dashboardPanels.forEach(function (panel) {
                panel.classList.add("hidden");
            });

            targetPanel.classList.remove("hidden");

            navigationButtons.forEach(function (nav) {
                nav.classList.remove("active");
            });

            button.classList.add("active");
        });

    });

    // ==============================================
    // 6. ADMIN LOGOUT
    // ==============================================

    const logoutButton = get("admin-logout");
    const authSection = get("admin-auth-section");
    const dashboard = get("admin-dashboard");

    if (logoutButton) {
        logoutButton.addEventListener("click", function () {

            if (dashboard) dashboard.classList.add("hidden");
            if (authSection) authSection.classList.remove("hidden");

            showLogin();

            showMessage("You have returned to the Admin login page.");
        });
    }

    // ==============================================
    // 7. COMPLAINT SEARCH AND FILTERS
    // ==============================================

    const searchInput = get("complaint-search");
    const statusFilter = get("complaint-status-filter");
    const categoryFilter = get("complaint-category-filter");
    const complaintTable = get("complaints-table-body");

    function filterComplaints() {

        if (!complaintTable) return;

        const searchText = searchInput
            ? searchInput.value.toLowerCase().trim()
            : "";

        const selectedStatus = statusFilter
            ? statusFilter.value.toLowerCase()
            : "";

        const selectedCategory = categoryFilter
            ? categoryFilter.value.toLowerCase()
            : "";

        const rows = complaintTable.querySelectorAll("tr");

        rows.forEach(function (row) {

            const rowText = row.textContent.toLowerCase();

            const matchesSearch = rowText.includes(searchText);

            const matchesStatus =
                !selectedStatus || rowText.includes(selectedStatus);

            const matchesCategory =
                !selectedCategory || rowText.includes(selectedCategory);

            row.style.display =
                matchesSearch && matchesStatus && matchesCategory
                    ? ""
                    : "none";

        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", filterComplaints);
    }

    if (statusFilter) {
        statusFilter.addEventListener("change", filterComplaints);
    }

    if (categoryFilter) {
        categoryFilter.addEventListener("change", filterComplaints);
    }

    // ==============================================
    // 8. COMPLAINT STATUS UPDATE
    // ==============================================

    const updateForm = get("complaint-update-form");

    if (updateForm) {
        updateForm.addEventListener("submit", function (event) {
            event.preventDefault();

            showMessage(
                "Complaint updates cannot be saved yet. Database connection is pending."
            );
        });
    }

    // ==============================================
    // 9. EMAIL PREVIEW
    // ==============================================

    const emailForm = get("admin-email-form");
    const previewBox = get("email-preview");
    const previewContent = get("email-preview-content");
    const confirmSend = get("confirm-email-send");

    if (emailForm) {

        emailForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const subject = get("email-subject");
            const message = get("email-message");

            if (!subject || !message || !previewContent || !previewBox) {
                showMessage("Email preview elements are not available.");
                return;
            }

            previewContent.textContent =
                "Subject: " + subject.value +
                "\n\nMessage: " + message.value;

            previewBox.classList.remove("hidden");
        });

    }

    if (confirmSend) {
        confirmSend.addEventListener("click", function () {
            showMessage(
                "Email sending is not connected yet. No email has been sent."
            );
        });
    }

    // ==============================================
    // 10. CURRENT YEAR
    // ==============================================

    const yearElement = get("current-year");

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // ==============================================
    // 11. AI CHATBOT CSS
    // Created dynamically using JavaScript
    // ==============================================

    const chatStyle = document.createElement("style");

    chatStyle.textContent = `

        #ltsu-chat-button {
            position:fixed;
            right:22px;
            bottom:22px;
            z-index:99990;
            border:none;
            border-radius:50px;
            padding:15px 21px;
            background:linear-gradient(135deg,#10b981,#087f68);
            color:white;
            font-size:15px;
            font-weight:bold;
            cursor:pointer;
            box-shadow:0 8px 25px #0005;
            transition:transform 0.2s ease;
        }

        #ltsu-chat-button:hover {
            transform:translateY(-3px);
        }

        #ltsu-chat-window {
            position:fixed;
            right:20px;
            bottom:85px;
            width:min(360px,calc(100vw - 30px));
            height:450px;
            max-height:70vh;
            z-index:99991;
            background:#102b3d;
            color:white;
            border:1px solid #20c997;
            border-radius:18px;
            overflow:hidden;
            display:none;
            flex-direction:column;
            box-shadow:0 12px 35px #0005;
            font-family:Arial,sans-serif;
        }

        #ltsu-chat-header {
            background:#087f68;
            padding:15px;
            display:flex;
            justify-content:space-between;
            align-items:center;
            font-weight:bold;
        }

        #ltsu-chat-close {
            background:transparent;
            border:none;
            color:white;
            font-size:24px;
            cursor:pointer;
        }

        #ltsu-chat-notice {
            padding:9px 12px;
            background:#183c4e;
            color:#c8e7df;
            font-size:11px;
            line-height:1.5;
        }

        #ltsu-chat-messages {
            flex:1;
            overflow-y:auto;
            padding:13px;
            display:flex;
            flex-direction:column;
            gap:10px;
        }

        .ltsu-chat-message {
            max-width:88%;
            padding:10px 12px;
            border-radius:13px;
            font-size:13px;
            line-height:1.5;
            white-space:pre-wrap;
            overflow-wrap:anywhere;
        }

        .ltsu-chat-bot {
            align-self:flex-start;
            background:#234457;
        }

        .ltsu-chat-user {
            align-self:flex-end;
            background:#087f68;
        }

        #ltsu-chat-input-area {
            display:flex;
            gap:7px;
            padding:10px;
            border-top:1px solid #315064;
        }

        #ltsu-chat-input {
            min-width:0;
            flex:1;
            padding:11px;
            border:1px solid #547080;
            border-radius:10px;
            outline:none;
            background:#18394b;
            color:white;
        }

        #ltsu-chat-input:focus {
            border-color:#20c997;
        }

        #ltsu-chat-send {
            border:0;
            border-radius:10px;
            padding:0 15px;
            background:#10b981;
            color:#062c27;
            font-weight:bold;
            cursor:pointer;
        }

        @media(max-width:480px) {
            #ltsu-chat-window {
                right:10px;
                bottom:80px;
                width:calc(100vw - 20px);
            }

            #ltsu-chat-button {
                right:14px;
                bottom:14px;
            }
        }
    `;

    document.head.appendChild(chatStyle);

    // ==============================================
    // 12. CREATE FLOATING AI CHATBOT
    // ==============================================

    const chatButton = document.createElement("button");

    chatButton.id = "ltsu-chat-button";
    chatButton.type = "button";
    chatButton.textContent = "✦ AI Assistant";

    const chatWindow = document.createElement("div");
    chatWindow.id = "ltsu-chat-window";

    const chatHeader = document.createElement("div");
    chatHeader.id = "ltsu-chat-header";

    const chatTitle = document.createElement("span");
    chatTitle.textContent = "LTSU AI Assistant";

    const closeButton = document.createElement("button");
    closeButton.id = "ltsu-chat-close";
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close chatbot");

    chatHeader.append(chatTitle, closeButton);

    const notice = document.createElement("div");
    notice.id = "ltsu-chat-notice";

    notice.textContent =
        "Demo assistant: basic guidance only. Secure AI connection is coming later.";

    const chatMessages = document.createElement("div");
    chatMessages.id = "ltsu-chat-messages";

    const inputArea = document.createElement("form");
    inputArea.id = "ltsu-chat-input-area";

    const chatInput = document.createElement("input");

    chatInput.id = "ltsu-chat-input";
    chatInput.type = "text";
    chatInput.placeholder = "Ask about campus complaints...";
    chatInput.autocomplete = "off";
    chatInput.setAttribute("aria-label", "Type your message");

    const sendButton = document.createElement("button");

    sendButton.id = "ltsu-chat-send";
    sendButton.type = "submit";
    sendButton.textContent = "Send";

    inputArea.append(chatInput, sendButton);

    chatWindow.append(
        chatHeader,
        notice,
        chatMessages,
        inputArea
    );

    document.body.append(chatButton, chatWindow);

    // ==============================================
    // 13. CHATBOT MESSAGE DISPLAY
    // ==============================================

    function addChatMessage(message, sender) {

        const bubble = document.createElement("div");

        bubble.className =
            "ltsu-chat-message " +
            (sender === "user"
                ? "ltsu-chat-user"
                : "ltsu-chat-bot");

        bubble.textContent = message;

        chatMessages.appendChild(bubble);

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // ==============================================
    // 14. DEMO CHATBOT REPLIES
    // ==============================================

    function getBotReply(message) {

        const text = message.toLowerCase();

        if (
            text.includes("complaint") ||
            text.includes("report") ||
            text.includes("problem")
        ) {
            return "To report a campus problem, use the Student Portal. Select the correct category, enter the campus location and describe the issue clearly. Actual complaint submission will work after the database is connected.";
        }

        if (
            text.includes("water") ||
            text.includes("electricity") ||
            text.includes("wifi") ||
            text.includes("clean")
        ) {
            return "You can report water, electricity, Wi-Fi and cleanliness issues through the Student Portal. Mention the exact campus location to help the responsible team understand the issue.";
        }

        if (
            text.includes("status") ||
            text.includes("pending") ||
            text.includes("solved")
        ) {
            return "The planned complaint statuses are Posted, Reviewed, Work in Progress and Solved. Live status tracking will become available after the database connection.";
        }

        if (
            text.includes("admin") ||
            text.includes("register") ||
            text.includes("approval")
        ) {
            return "Admin registration requests will require Super Admin approval. This chatbot cannot approve accounts or change admin permissions.";
        }

        if (
            text.includes("email") ||
            text.includes("send")
        ) {
            return "The Admin Portal includes an email preview feature. Actual email delivery is not active until a secure backend email service is connected.";
        }

        if (
            text.includes("hello") ||
            text.includes("hi") ||
            text.includes("namaste")
        ) {
            return "Hello! Welcome to LTSU Campus Support. I can guide you about campus complaints, complaint statuses and the Admin Portal.";
        }

        return "I can provide basic guidance about campus complaints, campus facilities, complaint statuses and the Admin Portal. Live AI connection is not active yet.";
    }

    // ==============================================
    // 15. SEND CHAT MESSAGE
    // ==============================================

    function sendChatMessage(message) {

        const cleanMessage = message.trim();

        if (!cleanMessage) return;

        addChatMessage(cleanMessage, "user");

        chatInput.value = "";

        const reply = getBotReply(cleanMessage);

        setTimeout(function () {
            addChatMessage(reply, "bot");
        }, 350);
    }

    inputArea.addEventListener("submit", function (event) {

        event.preventDefault();

        sendChatMessage(chatInput.value);

    });

    // ==============================================
    // 16. OPEN AND CLOSE CHATBOT
    // ==============================================

    chatButton.addEventListener("click", function () {

        chatWindow.style.display = "flex";

        chatInput.focus();

        if (chatMessages.children.length === 0) {
            addChatMessage(
                "Hello! I can help with campus complaint guidance. What would you like to know?",
                "bot"
            );
        }

    });

    closeButton.addEventListener("click", function () {

        chatWindow.style.display = "none";

    });

    // ==============================================
    // 17. INITIAL PAGE STATE
    // ==============================================

    if (dashboard) {
        dashboard.classList.add("hidden");
    }

    if (authSection) {
        authSection.classList.remove("hidden");
    }

    showLogin();

});
