
document.addEventListener("DOMContentLoaded", () => {

    // =====================================
    // SUPABASE CONNECTION
    // =====================================

    const supabaseClient = window.supabaseClient;

    const loginPage = document.getElementById("login-page");
    const dashboard = document.getElementById("dashboard");
    const loginForm = document.getElementById("login-form");

    const emailInput = document.getElementById("admin-id");
    const passwordInput = document.getElementById("admin-pin");

    const loginMessage = document.getElementById("login-message");
    const forgotPasswordBtn = document.getElementById("forgot-password-btn");
    const logoutBtn = document.getElementById("logout-btn");


    // =====================================
    // MESSAGE FUNCTION
    // =====================================

    function showMessage(message, success = false) {

        if (!loginMessage) return;

        loginMessage.textContent = message;
        loginMessage.style.display = "block";
        loginMessage.style.color = success ? "#168c79" : "#d94b64";
        loginMessage.style.marginTop = "12px";
        loginMessage.style.fontSize = "13px";
    }


    // =====================================
    // SHOW LOGIN / DASHBOARD
    // =====================================

    function showLogin() {

        if (dashboard) {
            dashboard.classList.add("hidden");
        }

        if (loginPage) {
            loginPage.classList.remove("hidden");
        }
    }


    function showDashboard() {

        if (loginPage) {
            loginPage.classList.add("hidden");
        }

        if (dashboard) {
            dashboard.classList.remove("hidden");
        }
    }


    // =====================================
    // CHECK SUPABASE CONNECTION
    // =====================================

    if (!supabaseClient) {

        showLogin();

        showMessage(
            "Supabase connection nahi mili. Configuration check karein."
        );

        return;
    }


    // =====================================
    // VERIFY SUPER ADMIN ACCOUNT
    // =====================================

    async function verifySuperAdmin(user) {

        try {

            const { data: profile, error } = await supabaseClient
                .from("profiles")
                .select("id, full_name, email, role, is_active")
                .eq("id", user.id)
                .maybeSingle();

            if (error || !profile) {

                await supabaseClient.auth.signOut();

                showLogin();

                showMessage(
                    "Profile verify nahi ho paayi. Administrator se contact karein."
                );

                return false;
            }


            if (
                profile.role !== "super_admin" ||
                profile.is_active !== true
            ) {

                await supabaseClient.auth.signOut();

                showLogin();

                showMessage(
                    "Access denied. Sirf active Super Admin login kar sakta hai."
                );

                return false;
            }


            showDashboard();

            const adminLabel = document.querySelector(".admin-label");

            if (adminLabel) {
                adminLabel.textContent =
                    profile.full_name || "Super Admin";
            }

            return true;

        } catch (error) {

            console.error("Profile verification error:", error);

            await supabaseClient.auth.signOut();

            showLogin();

            showMessage(
                "Account verify karte waqt error aayi. Please try again."
            );

            return false;
        }
    }


    // =====================================
    // SUPER ADMIN LOGIN
    // =====================================

    if (loginForm) {

        loginForm.addEventListener("submit", async (event) => {

            event.preventDefault();

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {

                showMessage("Email aur password enter karein.");

                return;
            }


            const submitButton = loginForm.querySelector(
                'button[type="submit"]'
            );

            if (submitButton) {

                submitButton.disabled = true;
                submitButton.textContent = "Please wait...";
            }


            try {

                const { data, error } =
                    await supabaseClient.auth.signInWithPassword({
                        email: email,
                        password: password
                    });


                if (error) {

                    showMessage("Login failed: " + error.message);

                } else {

                    await verifySuperAdmin(data.user);
                }

            } catch (error) {

                console.error("Login error:", error);

                showMessage(
                    "Login nahi ho paaya. Please dobara try karein."
                );

            } finally {

                if (submitButton) {

                    submitButton.disabled = false;
                    submitButton.textContent = "Login";
                }
            }

        });
    }


    // =====================================
    // FORGOT PASSWORD
    // =====================================

    if (forgotPasswordBtn) {

        forgotPasswordBtn.addEventListener("click", async () => {

            const email = emailInput.value.trim();

            if (!email) {

                showMessage(
                    "Pehle apna email address enter karein."
                );

                emailInput.focus();

                return;
            }


            forgotPasswordBtn.disabled = true;
            forgotPasswordBtn.textContent = "Sending...";


            try {

                const redirectTo =
                    "https://harman-preet-51.github.io/ltsu-campus-support/super-admin/reset-password.html";


                const { error } =
                    await supabaseClient.auth.resetPasswordForEmail(
                        email,
                        {
                            redirectTo: redirectTo
                        }
                    );


                if (error) {

                    showMessage(
                        "Reset email nahi bheji ja saki: " + error.message
                    );

                } else {

                    showMessage(
                        "Password reset link email par bhej diya gaya hai. Inbox check karein.",
                        true
                    );
                }

            } catch (error) {

                console.error("Password reset error:", error);

                showMessage(
                    "Password reset request fail ho gayi. Dobara try karein."
                );

            } finally {

                forgotPasswordBtn.disabled = false;
                forgotPasswordBtn.textContent = "Forgot Password?";
            }

        });
    }


    // =====================================
    // SIDEBAR NAVIGATION
    // =====================================

    const navButtons = document.querySelectorAll(".nav-btn");

    const pageSections = document.querySelectorAll(".page-section");


    navButtons.forEach((button) => {

        button.addEventListener("click", () => {

            const pageName = button.dataset.page;


            navButtons.forEach((item) => {
                item.classList.remove("active");
            });


            pageSections.forEach((section) => {
                section.classList.remove("active");
            });


            button.classList.add("active");


            const selectedPage =
                document.getElementById(pageName);

            if (selectedPage) {
                selectedPage.classList.add("active");
            }

        });

    });


    // =====================================
    // LOGOUT
    // =====================================

    if (logoutBtn) {

        logoutBtn.addEventListener("click", async () => {

            try {

                const { error } =
                    await supabaseClient.auth.signOut();

                if (error) {
                    showMessage("Logout error: " + error.message);
                    return;
                }

                showLogin();

                if (loginForm) {
                    loginForm.reset();
                }

                showMessage("You have successfully logged out.", true);

            } catch (error) {

                console.error("Logout error:", error);

                showMessage("Logout nahi ho paaya. Dobara try karein.");
            }

        });
    }


    // =====================================
    // AI ASSISTANT
    // =====================================

    const aiButton = document.getElementById("ai-button");
    const aiWindow = document.getElementById("ai-window");
    const aiClose = document.getElementById("ai-close");

    const aiSend = document.getElementById("ai-send");
    const aiInput = document.getElementById("ai-input");
    const aiMessages = document.getElementById("ai-messages");


    if (aiButton && aiWindow) {

        aiButton.addEventListener("click", () => {

            aiWindow.classList.toggle("hidden");

        });
    }


    if (aiClose && aiWindow) {

        aiClose.addEventListener("click", () => {

            aiWindow.classList.add("hidden");

        });
    }


    // AI MESSAGE FUNCTION

    function sendAIMessage() {

        if (!aiInput || !aiMessages) return;

        const question = aiInput.value.trim();

        if (!question) return;


        // USER MESSAGE

        const userMessage = document.createElement("div");

        userMessage.className = "bot-message";
        userMessage.style.marginLeft = "auto";
        userMessage.style.background = "#dff4ed";

        userMessage.textContent = question;

        aiMessages.appendChild(userMessage);


        // ASSISTANT REPLY

        const reply = document.createElement("div");

        reply.className = "bot-message";

        const lowerQuestion = question.toLowerCase();


        if (lowerQuestion.includes("complaint")) {

            reply.textContent =
                "Complaints section mein submitted complaints review karein.";

        } else if (lowerQuestion.includes("student")) {

            reply.textContent =
                "Students section mein student records aur account status dekhein.";

        } else if (lowerQuestion.includes("admin")) {

            reply.textContent =
                "Admin Management section mein admin access requests review karein.";

        } else if (lowerQuestion.includes("help")) {

            reply.textContent =
                "Main LTSUCare Super Admin Assistant hoon. Main portal ke basic sections ke baare mein help kar sakta hoon.";

        } else {

            reply.textContent =
                "Complaints, students aur admin management ke baare mein pooch sakte hain.";
        }


        aiMessages.appendChild(reply);

        aiInput.value = "";

        aiMessages.scrollTop = aiMessages.scrollHeight;
    }


    if (aiSend) {

        aiSend.addEventListener("click", sendAIMessage);
    }


    if (aiInput) {

        aiInput.addEventListener("keydown", (event) => {

            if (event.key === "Enter") {
                sendAIMessage();
            }

        });
    }


    // =====================================
    // CHECK EXISTING LOGIN SESSION
    // =====================================

    async function checkExistingSession() {

        try {

            const { data, error } =
                await supabaseClient.auth.getSession();


            if (error) {

                showLogin();

                showMessage(
                    "Session check nahi ho paaya. Please login karein."
                );

                return;
            }


            if (data.session) {

                await verifySuperAdmin(data.session.user);

            } else {

                showLogin();
            }

        } catch (error) {

            console.error("Session error:", error);

            showLogin();
        }
    }


    // START APPLICATION

    showLogin();

    checkExistingSession();

});
