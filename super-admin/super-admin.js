
document.addEventListener("DOMContentLoaded", () => {
    const supabaseClient = window.supabaseClient;

    const loginPage = document.getElementById("login-page");
    const dashboard = document.getElementById("dashboard");
    const loginForm = document.getElementById("login-form");
    const emailInput = document.getElementById("admin-id");
    const passwordInput = document.getElementById("admin-pin");
    const loginMessage = document.getElementById("login-message");
    const forgotPasswordBtn = document.getElementById("forgot-password-btn");
    const logoutBtn = document.getElementById("logout-btn");

    function showMessage(message, success = false) {
        if (!loginMessage) return;
        loginMessage.textContent = message;
        loginMessage.style.display = "block";
        loginMessage.style.color = success ? "#168c79" : "#d94b64";
        loginMessage.style.marginTop = "12px";
        loginMessage.style.fontSize = "13px";
    }

    function showDashboard() {
        loginPage?.classList.add("hidden");
        dashboard?.classList.remove("hidden");
    }

    function showLogin() {
        dashboard?.classList.add("hidden");
        loginPage?.classList.remove("hidden");
    }

    if (!supabaseClient) {
        showMessage("Supabase connection nahi mili. Configuration check karein.");
        return;
    }

    async function verifySuperAdmin(user) {
        const { data: profile, error } = await supabaseClient
            .from("profiles")
            .select("id, full_name, email, role, is_active")
            .eq("id", user.id)
            .maybeSingle();

        if (error || !profile) {
            await supabaseClient.auth.signOut();
            showLogin();
            showMessage("Profile verify nahi ho paayi.");
            return false;
        }

        if (profile.role !== "super_admin" || profile.is_active !== true) {
            await supabaseClient.auth.signOut();
            showLogin();
            showMessage("Access denied. Sirf active Super Admin login kar sakta hai.");
            return false;
        }

        showDashboard();

        const adminLabel = document.querySelector(".admin-label");
        if (adminLabel) adminLabel.textContent = profile.full_name || "Super Admin";

        return true;
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                showMessage("Email aur password enter karein.");
                return;
            }

            const submitButton = loginForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Please wait...";
            }

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) {
                    showMessage("Login failed: " + error.message);
                } else {
                    await verifySuperAdmin(data.user);
                }
            } catch (error) {
                showMessage("Something went wrong. Please try again.");
            }

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Login";
            }
        });
    }

    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener("click", async () => {
            const email = emailInput.value.trim();

            if (!email) {
                showMessage("Pehle email address enter karein.");
                emailInput.focus();
                return;
            }

            forgotPasswordBtn.disabled = true;
            forgotPasswordBtn.textContent = "Sending...";

            const redirectTo =
                "https://harman-preet-51.github.io/ltsu-campus-support/super-admin/reset-password.html";

            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo
            });

            if (error) {
                showMessage("Reset email nahi bheji ja saki: " + error.message);
            } else {
                showMessage("Password reset link email par bhej diya gaya hai.", true);
            }

            forgotPasswordBtn.disabled = false;
            forgotPasswordBtn.textContent = "Forgot Password?";
        });
    }

    document.querySelectorAll(".nav-btn").forEach((button) => {
        button.addEventListener("click", () => {
            const pageName = button.dataset.page;

            document.querySelectorAll(".nav-btn").forEach(item => item.classList.remove("active"));
            document.querySelectorAll(".page-section").forEach(section => section.classList.remove("active"));

            button.classList.add("active");
            document.getElementById(pageName)?.classList.add("active");
        });
    });

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await supabaseClient.auth.signOut();
            showLogin();
        });
    }

    const aiButton = document.getElementById("ai-button");
    const aiWindow = document.getElementById("ai-window");
    const aiClose = document.getElementById("ai-close");
    const aiSend = document.getElementById("ai-send");
    const aiInput = document.getElementById("ai-input");
    const aiMessages = document.getElementById("ai-messages");

    aiButton?.addEventListener("click", () => aiWindow?.classList.toggle("hidden"));
    aiClose?.addEventListener("click", () => aiWindow?.classList.add("hidden"));

    function sendAIMessage() {
        if (!aiInput || !aiMessages) return;

        const question = aiInput.value.trim();
        if (!question) return;

        const userMessage = document.createElement("div");
        userMessage.className = "bot-message";
        userMessage.style.marginLeft = "auto";
        userMessage.style.background = "#dff4ed";
        userMessage.textContent = question;
        aiMessages.appendChild(userMessage);

        const reply = document.createElement("div");
        reply.className = "bot-message";

        const lowerQuestion = question.toLowerCase();

        if (lowerQuestion.includes("complaint")) {
            reply.textContent = "Complaints section mein submitted complaints review karein.";
        } else if (lowerQuestion.includes("student")) {
            reply.textContent = "Students section mein student records dekhein.";
        } else if (lowerQuestion.includes("admin")) {
            reply.textContent = "Admins section mein admin access requests review karein.";
        } else {
            reply.textContent = "Main LTSUCare Super Admin Assistant hoon. Complaints, students aur admin management ke baare mein pooch sakte hain.";
        }

        aiMessages.appendChild(reply);
        aiInput.value = "";
        aiMessages.scrollTop = aiMessages.scrollHeight;
    }

    aiSend?.addEventListener("click", sendAIMessage);

    aiInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") sendAIMessage();
    });

    async function checkExistingSession() {
        const { data, error } = await supabaseClient.auth.getSession();

        if (!error && data.session) {
            await verifySuperAdmin(data.session.user);
        } else {
            showLogin();
        }
    }

    checkExistingSession();
});
