
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

    let currentSuperAdmin = null;

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
        dashboard?.classList.add("hidden");
        loginPage?.classList.remove("hidden");
    }

    function showDashboard() {
        loginPage?.classList.add("hidden");
        dashboard?.classList.remove("hidden");
    }

    // =====================================
    // CHECK SUPABASE
    // =====================================

    if (!supabaseClient) {
        showLogin();
        showMessage("Supabase connection nahi mili. Configuration check karein.");
        return;
    }

    // =====================================
    // SAFE HTML
    // =====================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }

    // =====================================
    // VERIFY SUPER ADMIN
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
                showMessage("Profile verify nahi ho paayi. Administrator se contact karein.");
                return false;
            }

            if (
                profile.role !== "super_admin" ||
                profile.is_active !== true
            ) {
                await supabaseClient.auth.signOut();
                showLogin();
                showMessage("Access denied. Sirf active Super Admin login kar sakta hai.");
                return false;
            }

            currentSuperAdmin = user;

            showDashboard();

            const adminLabel = document.querySelector(".admin-label");
            if (adminLabel) {
                adminLabel.textContent = profile.full_name || "Super Admin";
            }

            await loadAdminRequests();
            await loadAdminCount();

            return true;

        } catch (error) {
            console.error("Profile verification error:", error);
            await supabaseClient.auth.signOut();
            showLogin();
            showMessage("Account verify karte waqt error aayi.");
            return false;
        }
    }

    // =====================================
    // SUPER ADMIN LOGIN
    // =====================================

    if (loginForm) {
        loginForm.addEventListener("submit", async event => {
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
                        email,
                        password
                    });

                if (error) throw error;

                await verifySuperAdmin(data.user);

            } catch (error) {
                console.error("Login error:", error);
                showMessage("Login failed: " + error.message);

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
                showMessage("Pehle apna email address enter karein.");
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
                        { redirectTo }
                    );

                if (error) throw error;

                showMessage(
                    "Password reset link email par bhej diya gaya hai. Inbox check karein.",
                    true
                );

            } catch (error) {
                showMessage("Reset email nahi bheji ja saki: " + error.message);

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

    navButtons.forEach(button => {
        button.addEventListener("click", async () => {

            const pageName = button.dataset.page;

            navButtons.forEach(item => item.classList.remove("active"));
            pageSections.forEach(section => section.classList.remove("active"));

            button.classList.add("active");

            const selectedPage = document.getElementById(pageName);

            if (selectedPage) {
                selectedPage.classList.add("active");
            }

            if (pageName === "admins") {
                await loadAdminRequests();
            }
        });
    });

    // =====================================
    // ADMIN MANAGEMENT UI
    // =====================================

    function prepareAdminManagement() {

        const adminsPage = document.getElementById("admins");

        if (!adminsPage) return null;

        let box = adminsPage.querySelector(".content-box");

        if (!box) {
            box = document.createElement("div");
            box.className = "content-box";
            adminsPage.appendChild(box);
        }

        box.innerHTML = `
            <h3>Admin Management</h3>

            <p>Review and manage administrator access requests.</p>

            <div style="margin:15px 0;">
                <button type="button" id="refresh-admin-requests">
                    Refresh Requests
                </button>
            </div>

            <h3>Pending Admin Requests</h3>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Mobile</th>
                            <th>Department</th>
                            <th>Reason</th>
                            <th>Date</th>
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody id="admin-requests-body">
                        <tr>
                            <td colspan="7">Loading requests...</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <h3 style="margin-top:25px;">All Admin Requests</h3>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Department</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody id="all-admin-requests-body">
                        <tr>
                            <td colspan="4">Loading...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById("refresh-admin-requests")
            .addEventListener("click", loadAdminRequests);

        return adminsPage;
    }

    // =====================================
    // LOAD ADMIN REQUESTS
    // =====================================

    async function loadAdminRequests() {

        const adminsPage = document.getElementById("admins");
        if (!adminsPage) return;

        prepareAdminManagement();

        const pendingBody = document.getElementById("admin-requests-body");
        const allBody = document.getElementById("all-admin-requests-body");

        pendingBody.innerHTML =
            `<tr><td colspan="7">Loading requests...</td></tr>`;

        allBody.innerHTML =
            `<tr><td colspan="4">Loading...</td></tr>`;

        try {

            const { data: requests, error } = await supabaseClient
                .from("admin_requests")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            if (!requests || requests.length === 0) {

                pendingBody.innerHTML =
                    `<tr><td colspan="7">No pending requests found.</td></tr>`;

                allBody.innerHTML =
                    `<tr><td colspan="4">No admin requests found.</td></tr>`;

                return;
            }

            const pendingRequests = requests.filter(
                request => request.status === "pending"
            );

            if (pendingRequests.length === 0) {
                pendingBody.innerHTML =
                    `<tr><td colspan="7">No pending requests.</td></tr>`;
            } else {

                pendingBody.innerHTML = pendingRequests.map(request => {

                    const date = request.created_at
                        ? new Date(request.created_at).toLocaleDateString()
                        : "--";

                    return `
                        <tr>
                            <td>${escapeHTML(request.full_name)}</td>
                            <td>${escapeHTML(request.email)}</td>
                            <td>${escapeHTML(request.contact_number)}</td>
                            <td>${escapeHTML(request.department)}</td>
                            <td>${escapeHTML(request.reason)}</td>
                            <td>${escapeHTML(date)}</td>
                            <td>
                                <button
                                    type="button"
                                    class="approve-admin-btn"
                                    data-id="${escapeHTML(request.id)}"
                                    data-user="${escapeHTML(request.user_id)}">
                                    Approve
                                </button>

                                <button
                                    type="button"
                                    class="reject-admin-btn"
                                    data-id="${escapeHTML(request.id)}">
                                    Reject
                                </button>
                            </td>
                        </tr>
                    `;
                }).join("");
            }

            allBody.innerHTML = requests.map(request => `
                <tr>
                    <td>${escapeHTML(request.full_name)}</td>
                    <td>${escapeHTML(request.email)}</td>
                    <td>${escapeHTML(request.department)}</td>
                    <td>${escapeHTML(request.status)}</td>
                </tr>
            `).join("");

            pendingBody.querySelectorAll(".approve-admin-btn")
                .forEach(button => {
                    button.addEventListener("click", () => {
                        approveAdmin(
                            button.dataset.id,
                            button.dataset.user
                        );
                    });
                });

            pendingBody.querySelectorAll(".reject-admin-btn")
                .forEach(button => {
                    button.addEventListener("click", () => {
                        rejectAdmin(button.dataset.id);
                    });
                });

        } catch (error) {

            console.error("Admin requests loading error:", error);

            pendingBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        Error loading requests: ${escapeHTML(error.message)}
                    </td>
                </tr>
            `;

            allBody.innerHTML =
                `<tr><td colspan="4">Unable to load requests.</td></tr>`;
        }
    }

    // =====================================
    // APPROVE ADMIN
    // =====================================

    async function approveAdmin(requestId, userId) {

        const confirmed = window.confirm(
            "Are you sure you want to approve this Admin request?"
        );

        if (!confirmed) return;

        try {

            // Activate the profile first
            const { data: profile, error: profileError } =
                await supabaseClient
                    .from("profiles")
                    .update({
                        role: "admin",
                        is_active: true
                    })
                    .eq("id", userId)
                    .select("id");

            if (profileError) throw profileError;

            if (!profile || profile.length === 0) {
                throw new Error(
                    "Profile update nahi hui. Check profiles table permissions."
                );
            }

            // Mark request as approved
            const { error: requestError } =
                await supabaseClient
                    .from("admin_requests")
                    .update({
                        status: "approved",
                        reviewed_by: currentSuperAdmin.id,
                        reviewed_at: new Date().toISOString()
                    })
                    .eq("id", requestId);

            if (requestError) throw requestError;

            alert(
                "Admin request approved successfully!\n\nThe user can now try Admin Login."
            );

            await loadAdminRequests();
            await loadAdminCount();

        } catch (error) {

            console.error("Approval error:", error);

            alert(
                "Approval failed:\n\n" + error.message +
                "\n\nCheck Supabase RLS policies."
            );
        }
    }

    // =====================================
    // REJECT ADMIN
    // =====================================

    async function rejectAdmin(requestId) {

        const confirmed = window.confirm(
            "Are you sure you want to reject this Admin request?"
        );

        if (!confirmed) return;

        try {

            const { error } = await supabaseClient
                .from("admin_requests")
                .update({
                    status: "rejected",
                    reviewed_by: currentSuperAdmin.id,
                    reviewed_at: new Date().toISOString()
                })
                .eq("id", requestId);

            if (error) throw error;

            alert("Admin request rejected.");

            await loadAdminRequests();

        } catch (error) {

            console.error("Rejection error:", error);

            alert(
                "Rejection failed:\n\n" + error.message
            );
        }
    }

    // =====================================
    // TOTAL ADMIN COUNT
    // =====================================

    async function loadAdminCount() {

        const adminCount = document.getElementById("admin-count");

        if (!adminCount) return;

        try {

            const { count, error } = await supabaseClient
                .from("profiles")
                .select("*", { count: "exact", head: true })
                .eq("role", "admin");

            if (error) throw error;

            adminCount.textContent = count ?? 0;

        } catch (error) {
            console.error("Admin count error:", error);
        }
    }

    // =====================================
    // LOGOUT
    // =====================================

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {

            try {

                const { error } = await supabaseClient.auth.signOut();

                if (error) throw error;

                currentSuperAdmin = null;

                showLogin();

                if (loginForm) loginForm.reset();

                showMessage("You have successfully logged out.", true);

            } catch (error) {
                showMessage("Logout nahi ho paaya: " + error.message);
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
        aiInput.addEventListener("keydown", event => {
            if (event.key === "Enter") sendAIMessage();
        });
    }

    // =====================================
    // CHECK EXISTING LOGIN SESSION
    // =====================================

    async function checkExistingSession() {

        try {

            const { data, error } =
                await supabaseClient.auth.getSession();

            if (error) throw error;

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

    // =====================================
    // START APPLICATION
    // =====================================

    showLogin();

    checkExistingSession();

});
