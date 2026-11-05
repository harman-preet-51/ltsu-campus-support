
document.addEventListener("DOMContentLoaded", () => {

    // =====================================
    // SUPABASE
    // =====================================

    const db = window.supabaseClient;

    const $ = (id) => document.getElementById(id);

    const loginPage = $("login-page");
    const dashboard = $("dashboard");
    const loginForm = $("login-form");
    const loginMessage = $("login-message");

    let currentUser = null;

    function message(text, success = false) {
        if (!loginMessage) return;
        loginMessage.textContent = text;
        loginMessage.style.color = success ? "green" : "crimson";
    }

    function showLogin() {
        dashboard?.classList.add("hidden");
        loginPage?.classList.remove("hidden");
    }

    function showDashboard() {
        loginPage?.classList.add("hidden");
        dashboard?.classList.remove("hidden");
    }

    if (!db) {
        showLogin();
        message("Supabase connection nahi mili. Configuration check karein.");
        return;
    }


    // =====================================
    // VERIFY SUPER ADMIN
    // =====================================

    async function verifySuperAdmin(user) {

        const { data: profile, error } = await db
            .from("profiles")
            .select("id, full_name, role, is_active")
            .eq("id", user.id)
            .maybeSingle();

        if (error || !profile) {
            await db.auth.signOut();
            showLogin();
            message("Profile error: " + (error?.message || "Profile not found"));
            return false;
        }

        if (profile.role !== "super_admin" || profile.is_active !== true) {
            await db.auth.signOut();
            showLogin();
            message("Access denied. Active Super Admin account required.");
            return false;
        }

        currentUser = user;
        showDashboard();

        const label = document.querySelector(".admin-label");
        if (label) {
            label.textContent = profile.full_name || "Super Admin";
        }

        await loadAdminRequests();
        await loadAdminCount();

        return true;
    }


    // =====================================
    // LOGIN
    // =====================================

    loginForm?.addEventListener("submit", async (event) => {

        event.preventDefault();

        const email = $("admin-id").value.trim();
        const password = $("admin-pin").value;

        const button = loginForm.querySelector('button[type="submit"]');

        if (button) {
            button.disabled = true;
            button.textContent = "Please wait...";
        }

        try {

            const { data, error } = await db.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                message("Login failed: " + error.message);
                return;
            }

            await verifySuperAdmin(data.user);

        } catch (error) {
            message("Login error: " + error.message);
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Login";
            }
        }
    });


    // =====================================
    // ADMIN MANAGEMENT UI
    // =====================================

    function createAdminManagementUI() {

        const section = $("admins");
        if (!section) return null;

        let box = section.querySelector(".content-box");

        if (!box) {
            box = document.createElement("div");
            box.className = "content-box";
            section.appendChild(box);
        }

        box.innerHTML = `
            <h3>Admin Management</h3>

            <div style="margin:15px 0;">
                <button id="refresh-admin-requests"
                    type="button"
                    style="padding:10px 18px;cursor:pointer;">
                    Refresh Requests
                </button>
            </div>

            <h3>Pending Admin Requests</h3>

            <div id="pending-admin-requests"
                style="overflow-x:auto;">
                Loading requests...
            </div>

            <br>

            <h3>All Admin Requests</h3>

            <div id="all-admin-requests"
                style="overflow-x:auto;">
                Loading requests...
            </div>

            <p id="admin-request-message"
                style="margin-top:15px;"></p>
        `;

        $("refresh-admin-requests")?.addEventListener(
            "click",
            loadAdminRequests
        );

        return box;
    }


    // =====================================
    // SAFE TABLE CREATION
    // =====================================

    function makeTable(requests, showActions) {

        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";

        const headings = [
            "Name",
            "Email",
            "Mobile",
            "Department",
            "Reason",
            "Date",
            "Status"
        ];

        if (showActions) headings.push("Action");

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        headings.forEach((heading) => {
            const th = document.createElement("th");
            th.textContent = heading;
            th.style.padding = "10px";
            th.style.borderBottom = "1px solid #ddd";
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        requests.forEach((request) => {

            const tr = document.createElement("tr");

            const values = [
                request.full_name,
                request.email,
                request.contact_number,
                request.department,
                request.reason,
                request.created_at
                    ? new Date(request.created_at).toLocaleString()
                    : "-",
                request.status
            ];

            values.forEach((value) => {
                const td = document.createElement("td");
                td.textContent = value || "-";
                td.style.padding = "10px";
                td.style.borderBottom = "1px solid #ddd";
                tr.appendChild(td);
            });

            if (showActions) {

                const actionCell = document.createElement("td");
                actionCell.style.padding = "10px";

                const approveButton = document.createElement("button");
                approveButton.textContent = "Approve";
                approveButton.style.margin = "4px";
                approveButton.style.padding = "7px 12px";
                approveButton.style.cursor = "pointer";

                approveButton.addEventListener("click", () => {
                    approveRequest(request, approveButton);
                });

                const rejectButton = document.createElement("button");
                rejectButton.textContent = "Reject";
                rejectButton.style.margin = "4px";
                rejectButton.style.padding = "7px 12px";
                rejectButton.style.cursor = "pointer";

                rejectButton.addEventListener("click", () => {
                    rejectRequest(request, rejectButton);
                });

                actionCell.append(approveButton, rejectButton);
                tr.appendChild(actionCell);
            }

            tbody.appendChild(tr);
        });

        if (requests.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = headings.length;
            td.textContent = "No requests found.";
            td.style.padding = "12px";
            tr.appendChild(td);
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        return table;
    }


    // =====================================
    // LOAD ADMIN REQUESTS
    // =====================================

    async function loadAdminRequests() {

        createAdminManagementUI();

        const pendingBox = $("pending-admin-requests");
        const allBox = $("all-admin-requests");
        const statusMessage = $("admin-request-message");

        if (!pendingBox || !allBox) return;

        pendingBox.textContent = "Loading...";
        allBox.textContent = "Loading...";

        const { data, error } = await db
            .from("admin_requests")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {

            pendingBox.textContent =
                "Could not load requests: " + error.message;

            allBox.textContent =
                "Database permission or connection error.";

            if (statusMessage) {
                statusMessage.textContent = error.message;
                statusMessage.style.color = "crimson";
            }

            return;
        }

        const requests = data || [];

        const pending = requests.filter(
            (request) => request.status === "pending"
        );

        pendingBox.innerHTML = "";
        allBox.innerHTML = "";

        pendingBox.appendChild(makeTable(pending, true));
        allBox.appendChild(makeTable(requests, false));

        if (statusMessage) {
            statusMessage.textContent =
                "Total requests: " + requests.length +
                " | Pending: " + pending.length;

            statusMessage.style.color = "green";
        }
    }


    // =====================================
    // APPROVE REQUEST
    // =====================================

    async function approveRequest(request, button) {

        if (!currentUser) {
            alert("Please login again.");
            return;
        }

        const confirmed = confirm(
            "Approve admin request for " +
            request.full_name + "?"
        );

        if (!confirmed) return;

        button.disabled = true;
        button.textContent = "Approving...";

        try {

            // First activate the user's admin profile
            const { data: profileData, error: profileError } = await db
                .from("profiles")
                .update({
                    role: "admin",
                    is_active: true
                })
                .eq("id", request.user_id)
                .select("id");

            if (profileError) {
                throw new Error(
                    "Profile update failed: " + profileError.message
                );
            }

            if (!profileData || profileData.length === 0) {
                throw new Error(
                    "Profile was not updated. Check profiles UPDATE policy."
                );
            }

            // Then mark the request approved
            const { error: requestError } = await db
                .from("admin_requests")
                .update({
                    status: "approved",
                    reviewed_by: currentUser.id,
                    reviewed_at: new Date().toISOString()
                })
                .eq("id", request.id);

            if (requestError) {
                throw new Error(
                    "Profile activated, but request status update failed: " +
                    requestError.message
                );
            }

            alert("Admin request approved successfully!");

            await loadAdminRequests();
            await loadAdminCount();

        } catch (error) {

            alert("Approval error: " + error.message);

            button.disabled = false;
            button.textContent = "Approve";
        }
    }


    // =====================================
    // REJECT REQUEST
    // =====================================

    async function rejectRequest(request, button) {

        if (!currentUser) {
            alert("Please login again.");
            return;
        }

        const confirmed = confirm(
            "Reject admin request for " +
            request.full_name + "?"
        );

        if (!confirmed) return;

        button.disabled = true;
        button.textContent = "Rejecting...";

        const { error } = await db
            .from("admin_requests")
            .update({
                status: "rejected",
                reviewed_by: currentUser.id,
                reviewed_at: new Date().toISOString()
            })
            .eq("id", request.id);

        if (error) {

            alert("Rejection error: " + error.message);

            button.disabled = false;
            button.textContent = "Reject";
            return;
        }

        alert("Request rejected successfully!");

        await loadAdminRequests();
    }


    // =====================================
    // ADMIN COUNT
    // =====================================

    async function loadAdminCount() {

        const countElement = $("admin-count");
        if (!countElement) return;

        const { count, error } = await db
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("role", "admin")
            .eq("is_active", true);

        if (!error) {
            countElement.textContent = count ?? 0;
        }
    }


    // =====================================
    // SIDEBAR NAVIGATION
    // =====================================

    document.querySelectorAll(".nav-btn").forEach((button) => {

        button.addEventListener("click", () => {

            document.querySelectorAll(".nav-btn").forEach((item) => {
                item.classList.remove("active");
            });

            document.querySelectorAll(".page-section").forEach((section) => {
                section.classList.remove("active");
            });

            button.classList.add("active");

            const selectedPage = $(button.dataset.page);

            selectedPage?.classList.add("active");

            if (button.dataset.page === "admins" && currentUser) {
                loadAdminRequests();
            }
        });
    });


    // =====================================
    // LOGOUT
    // =====================================

    $("logout-btn")?.addEventListener("click", async () => {

        const { error } = await db.auth.signOut();

        if (error) {
            alert("Logout error: " + error.message);
            return;
        }

        currentUser = null;
        loginForm?.reset();
        showLogin();
        message("Successfully logged out.", true);
    });


    // =====================================
    // FORGOT PASSWORD
    // =====================================

    $("forgot-password-btn")?.addEventListener("click", async () => {

        const email = $("admin-id").value.trim();

        if (!email) {
            message("Pehle email address enter karein.");
            return;
        }

        const { error } = await db.auth.resetPasswordForEmail(email, {
            redirectTo:
                "https://harman-preet-51.github.io/ltsu-campus-support/super-admin/reset-password.html"
        });

        if (error) {
            message(error.message);
        } else {
            message("Password reset email sent.", true);
        }
    });


    // =====================================
    // AI ASSISTANT
    // =====================================

    const aiButton = $("ai-button");
    const aiWindow = $("ai-window");

    aiButton?.addEventListener("click", () => {
        aiWindow?.classList.toggle("hidden");
    });

    $("ai-close")?.addEventListener("click", () => {
        aiWindow?.classList.add("hidden");
    });

    function sendAIMessage() {

        const input = $("ai-input");
        const messages = $("ai-messages");

        if (!input || !messages) return;

        const question = input.value.trim();
        if (!question) return;

        const userMessage = document.createElement("div");
        userMessage.className = "bot-message";
        userMessage.textContent = question;
        messages.appendChild(userMessage);

        const reply = document.createElement("div");
        reply.className = "bot-message";

        const q = question.toLowerCase();

        if (q.includes("admin")) {
            reply.textContent =
                "Admin Management section mein admin requests approve ya reject karein.";
        } else if (q.includes("complaint")) {
            reply.textContent =
                "Complaints section mein submitted complaints dekhein.";
        } else if (q.includes("student")) {
            reply.textContent =
                "Students section mein student records dekhein.";
        } else {
            reply.textContent =
                "Main LTSUCare Super Admin Assistant hoon.";
        }

        messages.appendChild(reply);
        input.value = "";
        messages.scrollTop = messages.scrollHeight;
    }

    $("ai-send")?.addEventListener("click", sendAIMessage);

    $("ai-input")?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") sendAIMessage();
    });


    // =====================================
    // RESTORE SESSION
    // =====================================

    async function checkSession() {

        const { data, error } = await db.auth.getSession();

        if (error) {
            showLogin();
            message(error.message);
            return;
        }

        if (data.session?.user) {
            await verifySuperAdmin(data.session.user);
        } else {
            showLogin();
        }
    }

    showLogin();
    checkSession();

});
