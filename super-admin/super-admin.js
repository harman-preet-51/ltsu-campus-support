// SUPER ADMIN LOGIN
const loginForm = document.getElementById("login-form");
const loginPage = document.getElementById("login-page");
const dashboard = document.getElementById("dashboard");

if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const adminId = document.getElementById("admin-id").value.trim();
        const adminPin = document.getElementById("admin-pin").value.trim();

        if (adminId !== "" && adminPin !== "") {
            loginPage.classList.add("hidden");
            dashboard.classList.remove("hidden");
        } else {
            alert("Please enter Admin ID and PIN.");
        }
    });
}

// SIDEBAR NAVIGATION
const navButtons = document.querySelectorAll(".nav-btn");
const sections = document.querySelectorAll(".page-section");
const pageTitle = document.getElementById("page-title");

navButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const page = button.dataset.page;

        navButtons.forEach(function (item) {
            item.classList.remove("active");
        });

        button.classList.add("active");

        sections.forEach(function (section) {
            section.classList.remove("active");
        });

        const selectedSection = document.getElementById(page);

        if (selectedSection) {
            selectedSection.classList.add("active");
        }

        if (pageTitle) {
            pageTitle.textContent = button.textContent.trim();
        }
    });
});

// LOGOUT
const logoutButton = document.getElementById("logout-btn");

if (logoutButton) {
    logoutButton.addEventListener("click", function () {
        dashboard.classList.add("hidden");
        loginPage.classList.remove("hidden");
        document.getElementById("admin-pin").value = "";
    });
}

// AI ASSISTANT
const aiButton = document.getElementById("ai-button");
const aiWindow = document.getElementById("ai-window");
const aiClose = document.getElementById("ai-close");
const aiSend = document.getElementById("ai-send");
const aiInput = document.getElementById("ai-input");
const aiMessages = document.getElementById("ai-messages");

if (aiButton && aiWindow) {
    aiButton.addEventListener("click", function () {
        aiWindow.classList.toggle("hidden");
    });
}

if (aiClose && aiWindow) {
    aiClose.addEventListener("click", function () {
        aiWindow.classList.add("hidden");
    });
}

function sendAIMessage() {
    const message = aiInput.value.trim();

    if (message === "") {
        return;
    }

    const userMessage = document.createElement("p");
    userMessage.className = "bot-message";
    userMessage.style.background = "#dff5ed";
    userMessage.textContent = "You: " + message;

    aiMessages.appendChild(userMessage);

    const reply = document.createElement("p");
    reply.className = "bot-message";

    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("complaint")) {
        reply.textContent = "I can help you review and manage campus complaints.";
    } else if (lowerMessage.includes("student")) {
        reply.textContent = "You can manage student information from the Students section.";
    } else if (lowerMessage.includes("admin")) {
        reply.textContent = "You can manage administrator information from the Admins section.";
    } else if (lowerMessage.includes("help")) {
        reply.textContent = "Please tell me what you need help with in the Super Admin Portal.";
    } else {
        reply.textContent = "I am the Super Admin demo assistant. Please ask about complaints, students, or admins.";
    }

    aiMessages.appendChild(reply);
    aiInput.value = "";
    aiMessages.scrollTop = aiMessages.scrollHeight;
}

if (aiSend) {
    aiSend.addEventListener("click", sendAIMessage);
}

if (aiInput) {
    aiInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            sendAIMessage();
        }
    });
}
