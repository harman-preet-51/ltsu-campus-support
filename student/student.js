
document.addEventListener("DOMContentLoaded", () => {
    const db = window.supabaseClient;
    const STORAGE_BUCKET = "complaint-media";

    let currentUser = null;
    let currentProfile = null;

    // ==========================================
    // ELEMENTS
    // ==========================================

    const loginTab = document.getElementById("login-tab");
    const registerTab = document.getElementById("register-tab");

    const loginPanel = document.getElementById("login-panel");
    const registerPanel = document.getElementById("register-panel");

    const authSection = document.getElementById("auth-section");
    const dashboard = document.getElementById("student-dashboard");

    const loginForm = document.getElementById("student-login-form");
    const registerForm = document.getElementById("student-register-form");
    const complaintForm = document.getElementById("complaint-form");
    const feedbackForm = document.getElementById("feedback-form");

    const loginMessage = document.getElementById("login-message");
    const registerMessage = document.getElementById("register-message");
    const complaintMessage = document.getElementById("complaint-message");
    const feedbackMessageStatus = document.getElementById("feedback-message-status");

    const logoutBtn = document.getElementById("logout-btn");

    const complaintPanel = document.getElementById("complaint-panel");
    const historyPanel = document.getElementById("history-panel");
    const feedbackPanel = document.getElementById("feedback-panel");

    const recipientType = document.getElementById("recipient-type");
    const recipientAdminWrap = document.getElementById("recipient-admin-wrap");
    const recipientAdminId = document.getElementById("recipient-admin-id");

    const complaintHistory = document.getElementById("complaint-history");

    // ==========================================
    // GENERAL HELPERS
    // ==========================================

    function showMessage(element, message, type = "info") {
        if (!element) return;

        element.textContent = message;
        element.className = `form-message ${type}`;
    }

    function clearMessage(element) {
        if (!element) return;

        element.textContent = "";
        element.className = "form-message";
    }

    function showLogin() {
        loginPanel.classList.remove("hidden");
        registerPanel.classList.add("hidden");

        loginTab.classList.add("active");
        registerTab.classList.remove("active");

        loginTab.setAttribute("aria-selected", "true");
        registerTab.setAttribute("aria-selected", "false");

        clearMessage(loginMessage);
        clearMessage(registerMessage);
    }

    function showRegister() {
        registerPanel.classList.remove("hidden");
        loginPanel.classList.add("hidden");

        registerTab.classList.add("active");
        loginTab.classList.remove("active");

        registerTab.setAttribute("aria-selected", "true");
        loginTab.setAttribute("aria-selected", "false");

        clearMessage(loginMessage);
        clearMessage(registerMessage);
    }

    function hidePanels() {
        complaintPanel.classList.add("hidden");
        historyPanel.classList.add("hidden");
        feedbackPanel.classList.add("hidden");
    }

    function showDashboardPanel(panel) {
        hidePanels();
        panel.classList.remove("hidden");

        panel.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    // ==========================================
    // AUTH TABS
    // ==========================================

    loginTab.addEventListener("click", showLogin);
    registerTab.addEventListener("click", showRegister);

    document.getElementById("open-register").addEventListener("click", showRegister);
    document.getElementById("open-login").addEventListener("click", showLogin);

    // ==========================================
    // ADMIN DIRECTORY
    // ==========================================

    async function loadAdminDirectory() {
        recipientAdminId.innerHTML = '<option value="">Select an Admin</option>';

        const { data, error } = await db.rpc("get_active_admin_directory");

        if (error) {
            console.error("Admin directory error:", error);
            return;
        }

        (data || []).forEach(admin => {
            const option = document.createElement("option");

            option.value = admin.id;
            option.textContent = admin.department
                ? `${admin.full_name} - ${admin.department}`
                : admin.full_name;

            recipientAdminId.appendChild(option);
        });
    }

    function updateRecipientFields() {
        const selected = recipientType.value;

        if (selected === "specific_admin") {
            recipientAdminWrap.classList.remove("hidden");
            recipientAdminId.required = true;
        } else {
            recipientAdminWrap.classList.add("hidden");
            recipientAdminId.required = false;
            recipientAdminId.value = "";
        }
    }

    recipientType.addEventListener("change", updateRecipientFields);

    // ==========================================
    // OPEN STUDENT DASHBOARD
    // ==========================================

    async function openDashboard(user) {
        currentUser = user;

        const { data: profile, error } = await db
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (error) {
            console.error("Profile loading error:", error);
            alert("Unable to load your student profile.");
            return;
        }

        currentProfile = profile;

        authSection.classList.add("hidden");
        dashboard.classList.remove("hidden");

        document.getElementById("dashboard-student-name").textContent =
            `Welcome, ${profile.full_name || "Student"}`;

        document.getElementById("complaint-course").value =
            profile.course || "";

        document.getElementById("complaint-semester").value =
            profile.semester || "";

        await loadAdminDirectory();

        hidePanels();

        dashboard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    // ==========================================
    // STUDENT REGISTRATION
    // ==========================================

    registerForm.addEventListener("submit", async event => {
        event.preventDefault();

        clearMessage(registerMessage);

        if (!db) {
            showMessage(registerMessage, "Supabase connection is unavailable.", "error");
            return;
        }

        const name = document.getElementById("student-name").value.trim();
        const email = document.getElementById("student-email").value.trim();
        const mobile = document.getElementById("student-mobile").value.trim();
        const course = document.getElementById("student-course").value.trim();
        const semester = document.getElementById("student-semester").value;

        const pin = document.getElementById("create-pin").value;
        const confirmPin = document.getElementById("confirm-pin").value;

        if (pin.length < 6) {
            showMessage(registerMessage, "PIN must contain at least 6 characters.", "error");
            return;
        }

        if (pin !== confirmPin) {
            showMessage(registerMessage, "PINs do not match.", "error");
            return;
        }

        showMessage(registerMessage, "Creating your account...", "info");

        try {
            const { data, error } = await db.auth.signUp({
                email,
                password: pin,
                options: {
                    data: {
                        full_name: name,
                        mobile,
                        course,
                        semester
                    }
                }
            });

            if (error) throw error;

            showMessage(
                registerMessage,
                "Registration submitted successfully. Please check your email if verification is required.",
                "success"
            );

            registerForm.reset();

        } catch (error) {
            console.error("Registration error:", error);

            showMessage(
                registerMessage,
                error.message || "Registration failed. Please try again.",
                "error"
            );
        }
    });

    // ==========================================
    // STUDENT LOGIN
    // ==========================================

    loginForm.addEventListener("submit", async event => {
        event.preventDefault();

        clearMessage(loginMessage);

        if (!db) {
            showMessage(loginMessage, "Supabase connection is unavailable.", "error");
            return;
        }

        const studentId = document.getElementById("login-student-id").value.trim();
        const pin = document.getElementById("login-pin").value;

        showMessage(loginMessage, "Logging in...", "info");

        try {
            const { data, error } = await db.functions.invoke("student-login", {
                body: {
                    student_id: studentId,
                    password: pin
                }
            });

            if (error) throw error;

            if (!data || !data.access_token || !data.refresh_token) {
                throw new Error("Invalid login response from server.");
            }

            const { error: sessionError } = await db.auth.setSession({
                access_token: data.access_token,
                refresh_token: data.refresh_token
            });

            if (sessionError) throw sessionError;

            const { data: userData, error: userError } = await db.auth.getUser();

            if (userError) throw userError;

            await openDashboard(userData.user);

        } catch (error) {
            console.error("Login error:", error);

            showMessage(
                loginMessage,
                error.message || "Login failed. Please check your Student ID and PIN.",
                "error"
            );
        }
    });

    // ==========================================
    // DASHBOARD NAVIGATION
    // ==========================================

    document.getElementById("show-complaint").addEventListener("click", () => {
        showDashboardPanel(complaintPanel);
    });

    document.getElementById("show-history").addEventListener("click", async () => {
        showDashboardPanel(historyPanel);
        await loadComplaintHistory();
    });

    document.getElementById("show-feedback").addEventListener("click", () => {
        showDashboardPanel(feedbackPanel);
    });

    // ==========================================
    // COMPLAINT MEDIA UPLOAD
    // ==========================================

    async function uploadComplaintMedia(file) {
        if (!file) return null;

        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        if (!isImage && !isVideo) {
            throw new Error("Only image and video files are allowed.");
        }

        if (isImage && file.size > 5 * 1024 * 1024) {
            throw new Error("Image size must not exceed 5 MB.");
        }

        if (isVideo && file.size > 25 * 1024 * 1024) {
            throw new Error("Video size must not exceed 25 MB.");
        }

        const extension = file.name.split(".").pop();
        const filePath = `${currentUser.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

        const { data, error } = await db.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file);

        if (error) throw error;

        return data.path;
    }

    // ==========================================
    // SUBMIT COMPLAINT
    // ==========================================

    complaintForm.addEventListener("submit", async event => {
        event.preventDefault();

        clearMessage(complaintMessage);

        if (!currentUser || !currentProfile) {
            showMessage(complaintMessage, "Please log in again.", "error");
            return;
        }

        const recipient = recipientType.value;
        const selectedAdmin = recipientAdminId.value;

        if (recipient === "specific_admin" && !selectedAdmin) {
            showMessage(complaintMessage, "Please select an Admin.", "error");
            return;
        }

        const file = document.getElementById("complaint-media").files[0];

        let uploadedPath = null;

        showMessage(complaintMessage, "Submitting your complaint...", "info");

        try {
            if (file) {
                uploadedPath = await uploadComplaintMedia(file);
            }

            const complaintData = {
                user_id: currentUser.id,
                course: document.getElementById("complaint-course").value.trim(),
                semester: document.getElementById("complaint-semester").value.trim(),
                location: document.getElementById("complaint-location").value.trim(),
                category: document.getElementById("problem-category").value,
                title: document.getElementById("problem-category").value,
                description: document.getElementById("problem-description").value.trim(),
                status: "Submitted",
                escalated: false,
                recipient_type: recipient,
                recipient_admin_id: recipient === "specific_admin" ? selectedAdmin : null,
                is_confidential: recipient !== "all_admins"
            };

            if (uploadedPath) {
                complaintData.media_path = uploadedPath;
            }

            const { error } = await db
                .from("complaints")
                .insert([complaintData]);

            if (error) throw error;

            showMessage(
                complaintMessage,
                "Your complaint has been submitted successfully!",
                "success"
            );

            complaintForm.reset();
            updateRecipientFields();

            document.getElementById("complaint-course").value =
                currentProfile.course || "";

            document.getElementById("complaint-semester").value =
                currentProfile.semester || "";

        } catch (error) {
            console.error("Complaint submission error:", error);

            if (uploadedPath) {
                await db.storage
                    .from(STORAGE_BUCKET)
                    .remove([uploadedPath]);
            }

            showMessage(
                complaintMessage,
                error.message || "Unable to submit complaint. Please try again.",
                "error"
            );
        }
    });

    // ==========================================
    // COMPLAINT HISTORY
    // ==========================================

    async function loadComplaintHistory() {
        complaintHistory.innerHTML = "<p>Loading your complaints...</p>";

        const { data, error } = await db
            .from("complaints")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Complaint history error:", error);
            complaintHistory.innerHTML = "<p>Unable to load complaint history.</p>";
            return;
        }

        if (!data || data.length === 0) {
            complaintHistory.innerHTML = "<p>No complaint records are available yet.</p>";
            return;
        }

        complaintHistory.innerHTML = "";

        for (const complaint of data) {
            const card = document.createElement("article");
            card.className = "complaint-history-card";

            let mediaHTML = "";

            if (complaint.media_path) {
                const { data: signedData } = await db.storage
                    .from(STORAGE_BUCKET)
                    .createSignedUrl(complaint.media_path, 3600);

                if (signedData?.signedUrl) {
                    mediaHTML = `
                        <p>
                            <a href="${escapeHTML(signedData.signedUrl)}"
                               target="_blank"
                               rel="noopener noreferrer">
                               View Uploaded Attachment
                            </a>
                        </p>
                    `;
                }
            }

            card.innerHTML = `
                <h3>${escapeHTML(complaint.category || "Complaint")}</h3>
                <p><strong>Complaint ID:</strong> ${escapeHTML(complaint.id)}</p>
                <p><strong>Location:</strong> ${escapeHTML(complaint.location || "Not specified")}</p>
                <p><strong>Status:</strong> ${escapeHTML(complaint.status || "Submitted")}</p>
                <p><strong>Recipient:</strong> ${escapeHTML(complaint.recipient_type || "All Admins")}</p>
                <p><strong>Description:</strong> ${escapeHTML(complaint.description || "")}</p>
                ${mediaHTML}
            `;

            complaintHistory.appendChild(card);
        }
    }

    // ==========================================
    // STUDENT FEEDBACK EMAIL
    // ==========================================

    const FEEDBACK_SCRIPT_URL =
        "https://script.google.com/macros/s/AKfycbwhM-icfed2rd2xA_aFwIFTpXGQourymAtY4xPnVV5eWFpk6yc5mDYv6_Dg3pXtLG_XTw/exec";

    feedbackForm.addEventListener("submit", async event => {
        event.preventDefault();

        clearMessage(feedbackMessageStatus);

        if (!currentUser || !currentProfile) {
            showMessage(feedbackMessageStatus, "Please log in again.", "error");
            return;
        }

        const complaintId = document.getElementById("feedback-complaint-id").value.trim();
        const rating = document.getElementById("feedback-rating").value;
        const feedback = document.getElementById("feedback-message").value.trim();

        showMessage(feedbackMessageStatus, "Sending your feedback...", "info");

        try {
            const response = await fetch(FEEDBACK_SCRIPT_URL, {
                method: "POST",
                redirect: "follow",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify({
                    type: "feedback",
                    complaintId,
                    studentId: currentProfile.student_id || "",
                    rating,
                    feedback
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || "Feedback email could not be sent.");
            }

            showMessage(
                feedbackMessageStatus,
                "Thank you! Your feedback has been submitted successfully.",
                "success"
            );

            feedbackForm.reset();

        } catch (error) {
            console.error("Feedback submission error:", error);

            showMessage(
                feedbackMessageStatus,
                error.message || "Unable to submit feedback. Please try again.",
                "error"
            );
        }
    });

    // ==========================================
    // LOGOUT
    // ==========================================

    logoutBtn.addEventListener("click", async () => {
        try {
            await db.auth.signOut();

            currentUser = null;
            currentProfile = null;

            dashboard.classList.add("hidden");
            authSection.classList.remove("hidden");

            loginForm.reset();
            registerForm.reset();
            complaintForm.reset();
            feedbackForm.reset();

            hidePanels();
            showLogin();

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

        } catch (error) {
            console.error("Logout error:", error);
            alert("Unable to logout. Please try again.");
        }
    });

    // ==========================================
    // RESTORE EXISTING SESSION
    // ==========================================

    async function restoreSession() {
        if (!db) {
            console.error("Supabase client not found. Check supabase-config.js.");
            return;
        }

        const { data, error } = await db.auth.getSession();

        if (error) {
            console.error("Session restore error:", error);
            return;
        }

        if (data.session?.user) {
            await openDashboard(data.session.user);
        }
    }

    // ==========================================
    // CURRENT YEAR
    // ==========================================

    document.getElementById("current-year").textContent =
        new Date().getFullYear();

    // ==========================================
    // INITIALIZE
    // ==========================================

    updateRecipientFields();
    restoreSession();
});
