
document.addEventListener("DOMContentLoaded", () => {
    const db = window.supabaseClient;

    const $ = (id) => document.getElementById(id);

    const showMessage = (id, message, success = false) => {
        const el = $(id);
        if (!el) return;
        el.textContent = message;
        el.style.color = success ? "green" : "crimson";
    };

    if (!db) {
        alert("Supabase connection not ready. Please check supabase-config.js");
        return;
    }

    // Current user
    let currentUser = null;
    let currentProfile = null;

    // AUTH TABS
    function showLogin() {
        $("login-panel").classList.remove("hidden");
        $("register-panel").classList.add("hidden");
        $("login-tab").classList.add("active");
        $("register-tab").classList.remove("active");
    }

    function showRegister() {
        $("register-panel").classList.remove("hidden");
        $("login-panel").classList.add("hidden");
        $("register-tab").classList.add("active");
        $("login-tab").classList.remove("active");
    }

    $("login-tab").addEventListener("click", showLogin);
    $("register-tab").addEventListener("click", showRegister);
    $("open-register").addEventListener("click", showRegister);
    $("open-login").addEventListener("click", showLogin);

    // DASHBOARD PANELS
    function hidePanels() {
        ["complaint-panel", "history-panel", "feedback-panel"]
            .forEach(id => $(id).classList.add("hidden"));
    }

    $("show-complaint").addEventListener("click", () => {
        hidePanels();
        $("complaint-panel").classList.remove("hidden");
    });

    $("show-history").addEventListener("click", async () => {
        hidePanels();
        $("history-panel").classList.remove("hidden");
        await loadComplaints();
    });

    $("show-feedback").addEventListener("click", () => {
        hidePanels();
        $("feedback-panel").classList.remove("hidden");
    });

    // LOAD PROFILE AND SHOW DASHBOARD
    async function openDashboard(user) {
        currentUser = user;

        const { data, error } = await db
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (error) {
            alert("Profile could not be loaded: " + error.message);
            return;
        }

        currentProfile = data;

        $("auth-section").classList.add("hidden");
        $("student-dashboard").classList.remove("hidden");

        $("dashboard-student-name").textContent =
            "Welcome, " + (data.full_name || "Student") +
            (data.student_id ? " | " + data.student_id : "");

        if (data.course) $("complaint-course").value = data.course;
        if (data.semester) $("complaint-semester").value = data.semester;

        hidePanels();
    }

    // STUDENT REGISTRATION
    $("student-register-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = $("student-name").value.trim();
        const email = $("student-email").value.trim().toLowerCase();
        const mobile = $("student-mobile").value.trim();
        const course = $("student-course").value.trim();
        const semester = $("student-semester").value;
        const pin = $("create-pin").value;
        const confirmPin = $("confirm-pin").value;

        if (pin.length < 6) {
            showMessage("register-message", "PIN must be at least 6 characters.");
            return;
        }

        if (pin !== confirmPin) {
            showMessage("register-message", "PINs do not match.");
            return;
        }

        showMessage("register-message", "Creating your account...");

        const { data, error } = await db.auth.signUp({
            email: email,
            password: pin,
            options: {
                data: {
                    full_name: name,
                    mobile: mobile,
                    course: course,
                    semester: semester
                }
            }
        });

        if (error) {
            showMessage("register-message", error.message);
            return;
        }

        if (data.session && data.user) {
            showMessage(
                "register-message",
                "Registration successful!",
                true
            );
            await openDashboard(data.user);
        } else {
            showMessage(
                "register-message",
                "Account created. Please check your email if confirmation is required.",
                true
            );
        }
    });

    // STUDENT LOGIN
    // Student ID login will use a secure Supabase Edge Function.
    $("student-login-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        const studentId = $("login-student-id").value.trim();
        const pin = $("login-pin").value;

        showMessage("login-message", "Signing in...");

        const { data, error } = await db.functions.invoke(
            "student-login",
            {
                body: {
                    student_id: studentId,
                    password: pin
                }
            }
        );

        if (error || !data || !data.access_token || !data.refresh_token) {
            showMessage(
                "login-message",
                "Login service is not ready yet, or Student ID/PIN is incorrect."
            );
            return;
        }

        const { data: sessionData, error: sessionError } =
            await db.auth.setSession({
                access_token: data.access_token,
                refresh_token: data.refresh_token
            });

        if (sessionError) {
            showMessage("login-message", sessionError.message);
            return;
        }

        await openDashboard(sessionData.user);
    });

    // SUBMIT COMPLAINT
    $("complaint-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!currentUser) {
            showMessage("complaint-message", "Please login first.");
            return;
        }

        const media = $("complaint-media").files[0];

        if (media) {
            showMessage(
                "complaint-message",
                "File upload will be enabled after Storage setup. Please submit without a file for now."
            );
            return;
        }

        const complaint = {
            user_id: currentUser.id,
            course: $("complaint-course").value.trim(),
            semester: $("complaint-semester").value.trim(),
            location: $("complaint-location").value.trim(),
            category: $("problem-category").value,
            title: $("problem-category").value + " Complaint",
            description: $("problem-description").value.trim(),
            status: "Submitted",
            escalated: false
        };

        showMessage("complaint-message", "Submitting complaint...");

        const { data, error } = await db
            .from("complaints")
            .insert(complaint)
            .select()
            .single();

        if (error) {
            showMessage("complaint-message", error.message);
            return;
        }

        showMessage(
            "complaint-message",
            "Complaint submitted successfully! Complaint ID: " +
            (data.complaint_id || data.id),
            true
        );

        $("complaint-form").reset();

        if (currentProfile) {
            $("complaint-course").value = currentProfile.course || "";
            $("complaint-semester").value = currentProfile.semester || "";
        }
    });

    // LOAD COMPLAINT HISTORY
    async function loadComplaints() {
        if (!currentUser) return;

        const container = $("complaint-history");
        container.textContent = "Loading complaints...";

        const { data, error } = await db
            .from("complaints")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

        if (error) {
            container.textContent = "Could not load complaints: " + error.message;
            return;
        }

        container.innerHTML = "";

        if (!data || data.length === 0) {
            container.textContent = "You have not submitted any complaints yet.";
            return;
        }

        data.forEach(item => {
            const card = document.createElement("div");
            card.className = "complaint-history-card";

            const heading = document.createElement("h3");
            heading.textContent = item.complaint_id || item.id;

            const category = document.createElement("p");
            category.textContent = "Category: " + (item.category || "-");

            const location = document.createElement("p");
            location.textContent = "Location: " + (item.location || "-");

            const status = document.createElement("p");
            status.textContent = "Status: " + (item.status || "Submitted");

            const description = document.createElement("p");
            description.textContent = item.description || "";

            card.append(heading, category, location, status, description);
            container.appendChild(card);
        });
    }

    // SUBMIT FEEDBACK
    $("feedback-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!currentUser) {
            showMessage("feedback-message-status", "Please login first.");
            return;
        }

        const complaintId = $("feedback-complaint-id").value.trim();
        const rating = Number($("feedback-rating").value);

        if (!rating || rating < 1 || rating > 5) {
            showMessage("feedback-message-status", "Please select a rating.");
            return;
        }

        showMessage("feedback-message-status", "Submitting feedback...");

        const { error } = await db
            .from("feedback")
            .insert({
                complaint_id: complaintId,
                user_id: currentUser.id,
                rating: rating
            });

        if (error) {
            showMessage("feedback-message-status", error.message);
            return;
        }

        showMessage(
            "feedback-message-status",
            "Thank you! Your feedback has been submitted.",
            true
        );

        $("feedback-form").reset();
    });

    // LOGOUT
    $("logout-btn").addEventListener("click", async () => {
        const { error } = await db.auth.signOut();

        if (error) {
            alert("Logout error: " + error.message);
            return;
        }

        currentUser = null;
        currentProfile = null;

        $("student-dashboard").classList.add("hidden");
        $("auth-section").classList.remove("hidden");

        $("student-login-form").reset();
        $("student-register-form").reset();

        showLogin();
    });

    // RESTORE EXISTING SESSION
    async function checkSession() {
        const { data } = await db.auth.getSession();

        if (data.session && data.session.user) {
            await openDashboard(data.session.user);
        }
    }

    // CURRENT YEAR
    $("current-year").textContent = new Date().getFullYear();

    // INITIAL SETUP
    showLogin();
    checkSession();
});
