
document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. SUPABASE CONNECTION
    // ==========================================

    const supabase = window.supabaseClient;

    if (!supabase) {
        alert(
            "Supabase connection not found. Please check the Supabase scripts in admin.html."
        );
        return;
    }


    // ==========================================
    // 2. HTML ELEMENTS
    // ==========================================

    const authSection = document.getElementById("admin-auth-section");
    const dashboard = document.getElementById("admin-dashboard");

    const loginTab = document.getElementById("admin-login-tab");
    const registerTab = document.getElementById("admin-register-tab");

    const loginPanel = document.getElementById("admin-login-panel");
    const registerPanel = document.getElementById("admin-register-panel");

    const loginForm = document.getElementById("admin-login-form");
    const registerForm = document.getElementById("admin-register-form");

    const logoutButton = document.getElementById("admin-logout");

    let currentAdmin = null;
    let selectedComplaintId = null;
    let allComplaints = [];


    // ==========================================
    // 3. COMMON FUNCTIONS
    // ==========================================

    function showMessage(message) {
        alert(message);
    }

    function showLoginPanel() {
        loginPanel.classList.remove("hidden");
        registerPanel.classList.add("hidden");

        loginTab.classList.add("active");
        registerTab.classList.remove("active");
    }

    function showRegisterPanel() {
        registerPanel.classList.remove("hidden");
        loginPanel.classList.add("hidden");

        registerTab.classList.add("active");
        loginTab.classList.remove("active");
    }

    function showDashboard() {
        authSection.classList.add("hidden");
        dashboard.classList.remove("hidden");
    }

    function showAuthentication() {
        dashboard.classList.add("hidden");
        authSection.classList.remove("hidden");
        showLoginPanel();
    }

    function cleanText(value) {
        return String(value ?? "");
    }


    // ==========================================
    // 4. AUTHENTICATION TABS
    // ==========================================

    loginTab.addEventListener("click", showLoginPanel);

    registerTab.addEventListener("click", showRegisterPanel);

    document.getElementById("open-admin-register")
        .addEventListener("click", (event) => {
            event.preventDefault();
            showRegisterPanel();
        });

    document.getElementById("open-admin-login")
        .addEventListener("click", (event) => {
            event.preventDefault();
            showLoginPanel();
        });


    // ==========================================
    // 5. ADMIN REGISTRATION
    // ==========================================

    registerForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const fullName = document.getElementById("admin-name").value.trim();
        const email = document.getElementById("admin-email").value.trim().toLowerCase();
        const mobile = document.getElementById("admin-mobile").value.trim();
        const department = document.getElementById("admin-department").value;
        const reason = document.getElementById("admin-reason").value.trim();

        const password = document.getElementById("admin-create-password").value;
        const confirmPassword = document.getElementById("admin-confirm-password").value;


        // Required field validation
        if (
            !fullName ||
            !email ||
            !mobile ||
            !department ||
            !reason ||
            !password ||
            !confirmPassword
        ) {
            showMessage("Please fill in all registration fields.");
            return;
        }

        if (password.length < 8) {
            showMessage("Password must contain at least 8 characters.");
            return;
        }

        if (password !== confirmPassword) {
            showMessage("Passwords do not match.");
            return;
        }

        const confirmRequest = window.confirm(
            "Please confirm:\n\n" +
            "1. Your password is private.\n" +
            "2. The Super Admin cannot see your password.\n" +
            "3. Your Admin access requires Super Admin approval.\n\n" +
            "Do you want to submit your request?"
        );

        if (!confirmRequest) {
            return;
        }


        const submitButton = registerForm.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Submitting Request...";


        try {

            // Create Supabase Auth account
            const { data, error } = await supabase.auth.signUp({

                email: email,
                password: password,

                options: {
                    data: {
                        full_name: fullName
                    }
                }

            });


            if (error) {
                throw error;
            }

            if (!data.user) {
                throw new Error("Account could not be created.");
            }


            // Email confirmation must be disabled
            // for this immediate registration workflow.
            if (!data.session) {

                showMessage(
                    "Your authentication account was created, but Supabase has not provided an active session.\n\n" +
                    "Please ask the project administrator to check whether Email Confirmation is disabled in Supabase Authentication settings.\n\n" +
                    "Do not submit the registration repeatedly."
                );

                return;
            }


            // Save admin access request
            const { error: requestError } = await supabase
                .from("admin_requests")
                .insert({

                    user_id: data.user.id,
                    full_name: fullName,
                    email: email,
                    contact_number: mobile,
                    department: department,
                    reason: reason,
                    status: "pending"

                });


            if (requestError) {
                throw requestError;
            }


            showMessage(
                "Your Admin Access Request has been submitted successfully!\n\n" +
                "Status: Pending Approval\n\n" +
                "The Super Admin will review your request. You can log in after your request is approved."
            );


            registerForm.reset();

            await supabase.auth.signOut();

            showLoginPanel();

        } catch (error) {

            console.error("Registration Error:", error);

            showMessage(
                "Registration failed:\n\n" + error.message
            );

        } finally {

            submitButton.disabled = false;
            submitButton.textContent = "Submit Access Request";

        }

    });


    // ==========================================
    // 6. ADMIN LOGIN
    // ==========================================

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const email = document.getElementById("admin-email-login")
            .value.trim().toLowerCase();

        const password = document.getElementById("admin-password-login")
            .value;

        const submitButton = loginForm.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Checking Login...";


        try {

            // Sign in with Supabase
            const { data, error } = await supabase.auth.signInWithPassword({

                email: email,
                password: password

            });


            if (error) {
                throw error;
            }

            const user = data.user;

            if (!user) {
                throw new Error("User account not found.");
            }


            // Check admin request
            const { data: request, error: requestError } = await supabase
                .from("admin_requests")
                .select("status, full_name, email, department, contact_number")
                .eq("user_id", user.id)
                .maybeSingle();


            if (requestError) {
                throw requestError;
            }


            if (!request) {

                await supabase.auth.signOut();

                showMessage(
                    "No Admin Access Request was found for this account."
                );

                return;
            }


            if (request.status === "pending") {

                await supabase.auth.signOut();

                showMessage(
                    "Your Admin Access Request is still pending.\n\nPlease wait for Super Admin approval."
                );

                return;
            }


            if (request.status === "rejected") {

                await supabase.auth.signOut();

                showMessage(
                    "Your Admin Access Request has been rejected.\n\nPlease contact the Super Admin."
                );

                return;
            }


            if (request.status !== "approved") {

                await supabase.auth.signOut();

                showMessage("Your account does not have an approved request.");

                return;
            }


            // Check user profile role
            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("id, full_name, email, role, department, is_active")
                .eq("id", user.id)
                .maybeSingle();


            if (profileError) {
                throw profileError;
            }


            if (!profile) {

                await supabase.auth.signOut();

                showMessage("Your user profile could not be found.");

                return;
            }


            if (
                profile.role !== "admin" ||
                profile.is_active !== true
            ) {

                await supabase.auth.signOut();

                showMessage(
                    "Your request is approved, but your Admin profile is not active yet.\n\nPlease contact the Super Admin."
                );

                return;
            }


            // Successful Admin Login
            currentAdmin = {
                id: user.id,
                email: user.email,
                name: profile.full_name || request.full_name,
                department: profile.department || request.department
            };

            showDashboard();

            updateAdminProfile();

            await loadComplaints();

            showMessage("Welcome to the Admin Dashboard!");

        } catch (error) {

            console.error("Login Error:", error);

            showMessage(
                "Login failed:\n\n" + error.message
            );

        } finally {

            submitButton.disabled = false;
            submitButton.textContent = "Login to Dashboard";

        }

    });


    // ==========================================
    // 7. ADMIN PROFILE
    // ==========================================

    function updateAdminProfile() {

        if (!currentAdmin) {
            return;
        }

        document.getElementById("profile-admin-id").textContent =
            currentAdmin.id;

        document.getElementById("profile-admin-name").textContent =
            currentAdmin.name || "Admin";

        document.getElementById("profile-admin-email").textContent =
            currentAdmin.email;

        document.getElementById("profile-admin-department").textContent =
            currentAdmin.department || "Not Assigned";

        document.getElementById("profile-admin-status").textContent =
            "Active";

    }


    // ==========================================
    // 8. DASHBOARD NAVIGATION
    // ==========================================

    const navigationButtons = document.querySelectorAll(".nav-btn");

    navigationButtons.forEach((button) => {

        button.addEventListener("click", () => {

            const targetId = button.dataset.section;

            document.querySelectorAll(".dashboard-panel")
                .forEach((section) => {
                    section.classList.add("hidden");
                });

            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                targetSection.classList.remove("hidden");
            }

            navigationButtons.forEach((navButton) => {
                navButton.classList.remove("active");
            });

            button.classList.add("active");

        });

    });


    // ==========================================
    // 9. LOAD COMPLAINTS
    // ==========================================

    async function loadComplaints() {

        const tableBody = document.getElementById(
            "complaints-table-body"
        );

        tableBody.innerHTML = `
            <tr>
                <td colspan="6">Loading complaints...</td>
            </tr>
        `;


        try {

            const { data, error } = await supabase
                .from("complaints")
                .select("*")
                .order("created_at", { ascending: false });


            if (error) {
                throw error;
            }

            allComplaints = data || [];

            displayComplaints(allComplaints);

            updateDashboardStats(allComplaints);

        } catch (error) {

            console.error("Complaint Loading Error:", error);

            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">
                        Unable to load complaints. Please check database permissions.
                    </td>
                </tr>
            `;

        }

    }


    // ==========================================
    // 10. DISPLAY COMPLAINTS
    // ==========================================

    function displayComplaints(complaints) {

        const tableBody = document.getElementById(
            "complaints-table-body"
        );

        tableBody.innerHTML = "";

        if (!complaints || complaints.length === 0) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">No complaints found.</td>
                </tr>
            `;

            return;
        }


        complaints.forEach((complaint) => {

            const row = document.createElement("tr");

            const complaintId = complaint.complaint_id || complaint.id;

            const category = complaint.category || "General";

            const location = complaint.location || "Not specified";

            const date = complaint.created_at
                ? new Date(complaint.created_at).toLocaleDateString()
                : "--";

            const status = complaint.status || "Submitted";


            row.innerHTML = `
                <td>${escapeHTML(complaintId)}</td>
                <td>${escapeHTML(category)}</td>
                <td>${escapeHTML(location)}</td>
                <td>${escapeHTML(date)}</td>
                <td>${escapeHTML(status)}</td>
                <td>
                    <button
                        type="button"
                        class="view-complaint-btn"
                        data-id="${escapeHTML(complaint.id)}"
                    >
                        View
                    </button>
                </td>
            `;

            tableBody.appendChild(row);

        });


        tableBody.querySelectorAll(".view-complaint-btn")
            .forEach((button) => {

                button.addEventListener("click", () => {

                    const complaint = allComplaints.find(
                        (item) => item.id === button.dataset.id
                    );

                    if (complaint) {
                        showComplaintDetails(complaint);
                    }

                });

            });

    }


    function escapeHTML(value) {

        return String(value ?? "").replace(/[&<>"']/g, (character) => {

            const replacements = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return replacements[character];

        });

    }


    // ==========================================
    // 11. DASHBOARD STATISTICS
    // ==========================================

    function updateDashboardStats(complaints) {

        const total = complaints.length;

        const pending = complaints.filter((item) =>
            ["Submitted", "Pending", "Under Review"].includes(item.status)
        ).length;

        const inProgress = complaints.filter((item) =>
            ["In Progress", "Work in Progress"].includes(item.status)
        ).length;

        const resolved = complaints.filter((item) =>
            ["Resolved", "Solved", "Closed"].includes(item.status)
        ).length;


        document.getElementById("total-complaints").textContent = total;

        document.getElementById("pending-complaints").textContent = pending;

        document.getElementById("progress-complaints").textContent = inProgress;

        document.getElementById("resolved-complaints").textContent = resolved;

    }


    // ==========================================
    // 12. COMPLAINT SEARCH AND FILTER
    // ==========================================

    const complaintSearch = document.getElementById("complaint-search");

    const statusFilter = document.getElementById(
        "complaint-status-filter"
    );

    const categoryFilter = document.getElementById(
        "complaint-category-filter"
    );


    function filterComplaints() {

        const searchValue = complaintSearch.value.toLowerCase().trim();

        const selectedStatus = statusFilter.value;

        const selectedCategory = categoryFilter.value;


        const filtered = allComplaints.filter((complaint) => {

            const complaintId = cleanText(
                complaint.complaint_id || complaint.id
            ).toLowerCase();

            const matchesSearch = complaintId.includes(searchValue);

            const matchesStatus =
                selectedStatus === "all" ||
                complaint.status === selectedStatus;

            const matchesCategory =
                selectedCategory === "all" ||
                complaint.category === selectedCategory;

            return matchesSearch && matchesStatus && matchesCategory;

        });


        displayComplaints(filtered);

    }


    complaintSearch.addEventListener("input", filterComplaints);

    statusFilter.addEventListener("change", filterComplaints);

    categoryFilter.addEventListener("change", filterComplaints);


    // ==========================================
    // 13. COMPLAINT DETAILS
    // ==========================================

    function showComplaintDetails(complaint) {

        selectedComplaintId = complaint.id;

        const detailsCard = document.getElementById(
            "complaint-details"
        );

        const detailContent = document.getElementById(
            "complaint-detail-content"
        );


        detailContent.innerHTML = `
            <p><strong>Complaint ID:</strong> ${escapeHTML(complaint.complaint_id || complaint.id)}</p>

            <p><strong>Title:</strong> ${escapeHTML(complaint.title || "--")}</p>

            <p><strong>Category:</strong> ${escapeHTML(complaint.category || "--")}</p>

            <p><strong>Location:</strong> ${escapeHTML(complaint.location || "--")}</p>

            <p><strong>Description:</strong> ${escapeHTML(complaint.description || "--")}</p>

            <p><strong>Status:</strong> ${escapeHTML(complaint.status || "--")}</p>

            <p><strong>Admin Notes:</strong> ${escapeHTML(complaint.notes || "--")}</p>
        `;


        document.getElementById("update-status").value = "";

        document.getElementById("resolution-details").value =
            complaint.notes || "";

        detailsCard.classList.remove("hidden");

    }


    // ==========================================
    // 14. UPDATE COMPLAINT STATUS
    // ==========================================

    const complaintUpdateForm = document.getElementById(
        "complaint-update-form"
    );


    complaintUpdateForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        if (!selectedComplaintId) {
            showMessage("Please select a complaint first.");
            return;
        }

        const newStatus = document.getElementById("update-status").value;

        const notes = document.getElementById("resolution-details")
            .value.trim();

        if (!newStatus || !notes) {
            showMessage("Please select a status and enter remarks.");
            return;
        }


        const submitButton = complaintUpdateForm.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Saving...";


        try {

            const { error } = await supabase
                .from("complaints")
                .update({
                    status: newStatus,
                    notes: notes,
                    updated_at: new Date().toISOString()
                })
                .eq("id", selectedComplaintId);


            if (error) {
                throw error;
            }


            showMessage("Complaint status updated successfully.");

            document.getElementById("complaint-details")
                .classList.add("hidden");

            selectedComplaintId = null;

            await loadComplaints();

        } catch (error) {

            console.error("Complaint Update Error:", error);

            showMessage(
                "Unable to update complaint:\n\n" + error.message
            );

        } finally {

            submitButton.disabled = false;
            submitButton.textContent = "Save Status Update";

        }

    });


    // ==========================================
    // 15. EMAIL CENTRE - PREVIEW
    // ==========================================

    const emailForm = document.getElementById("admin-email-form");

    const emailPreview = document.getElementById("email-preview");

    const emailPreviewContent = document.getElementById(
        "email-preview-content"
    );


    emailForm.addEventListener("submit", (event) => {

        event.preventDefault();

        const complaintId = document.getElementById(
            "email-complaint-id"
        ).value.trim();

        const subject = document.getElementById(
            "email-subject"
        ).value.trim();

        const message = document.getElementById(
            "email-message"
        ).value.trim();


        emailPreviewContent.innerHTML = `
            <p><strong>Complaint ID:</strong> ${escapeHTML(complaintId)}</p>

            <p><strong>Subject:</strong> ${escapeHTML(subject)}</p>

            <p><strong>Message:</strong></p>

            <p>${escapeHTML(message)}</p>
        `;


        emailPreview.classList.remove("hidden");

    });


    document.getElementById("confirm-email-send")
        .addEventListener("click", () => {

            showMessage(
                "Email sending is not connected yet.\n\nA secure email backend needs to be configured before emails can actually be sent."
            );

        });


    // ==========================================
    // 16. ADMIN LOGOUT
    // ==========================================

    logoutButton.addEventListener("click", async () => {

        const confirmLogout = window.confirm(
            "Are you sure you want to logout?"
        );

        if (!confirmLogout) {
            return;
        }


        try {

            const { error } = await supabase.auth.signOut();

            if (error) {
                throw error;
            }

            currentAdmin = null;

            loginForm.reset();

            registerForm.reset();

            showAuthentication();

            showMessage("You have been logged out successfully.");

        } catch (error) {

            console.error("Logout Error:", error);

            showMessage(
                "Logout failed:\n\n" + error.message
            );

        }

    });


    // ==========================================
    // 17. CURRENT YEAR
    // ==========================================

    document.getElementById("current-year").textContent =
        new Date().getFullYear();


    // ==========================================
    // 18. INITIAL PAGE STATE
    // ==========================================

    showAuthentication();

    console.log("LTSUCare Admin Portal JavaScript Loaded Successfully.");

});
