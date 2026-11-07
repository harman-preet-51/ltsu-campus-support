
document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const db = window.supabaseClient;
    const $ = id => document.getElementById(id);

    const STORAGE_BUCKET = "complaint-media";
    const AI_FUNCTION = "ltsucare-ai";
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

    const NO_NETWORK =
        "No network connection. Please check your internet and try again.";

    let currentUser = null;
    let currentProfile = null;
    let aiHistory = [];
    let aiSending = false;

    const showMessage = (id, message, success = false) => {
        const el = $(id);
        if (!el) return;

        el.textContent = message;
        el.style.color = success ? "#087b5b" : "#c03955";
    };

    if (!db) {
        alert("Supabase connection not ready. Please check supabase-config.js");
        return;
    }

    // ---------------- AUTH TABS ----------------

    function showLogin() {
        $("login-panel").classList.remove("hidden");
        $("register-panel").classList.add("hidden");
        $("login-tab").classList.add("active");
        $("register-tab").classList.remove("active");
        $("login-tab").setAttribute("aria-selected", "true");
        $("register-tab").setAttribute("aria-selected", "false");
    }

    function showRegister() {
        $("register-panel").classList.remove("hidden");
        $("login-panel").classList.add("hidden");
        $("register-tab").classList.add("active");
        $("login-tab").classList.remove("active");
        $("register-tab").setAttribute("aria-selected", "true");
        $("login-tab").setAttribute("aria-selected", "false");
    }

    $("login-tab").addEventListener("click", showLogin);
    $("register-tab").addEventListener("click", showRegister);
    $("open-register").addEventListener("click", showRegister);
    $("open-login").addEventListener("click", showLogin);

    // ---------------- DASHBOARD PANELS ----------------

    function hidePanels() {
        ["complaint-panel", "history-panel", "feedback-panel"]
            .forEach(id => $(id).classList.add("hidden"));
    }

    $("show-complaint").addEventListener("click", () => {
        hidePanels();
        $("complaint-panel").classList.remove("hidden");
        $("complaint-panel").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });

    $("show-history").addEventListener("click", async () => {
        hidePanels();
        $("history-panel").classList.remove("hidden");
        await loadComplaints();

        $("history-panel").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });

    $("show-feedback").addEventListener("click", () => {
        hidePanels();
        $("feedback-panel").classList.remove("hidden");
        $("feedback-panel").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });

    // ---------------- ADMIN RECIPIENT DIRECTORY ----------------

    async function loadAdminDirectory() {
        const recipientType = $("recipient-type");
        const adminSelect = $("recipient-admin-id");

        if (!recipientType || !adminSelect) return;

        adminSelect.innerHTML =
            '<option value="">Loading active admins...</option>';

        try {
            const { data, error } = await db.rpc(
                "get_active_admin_directory"
            );

            if (error) throw error;

            adminSelect.innerHTML =
                '<option value="">Select an Admin</option>';

            if (!Array.isArray(data) || data.length === 0) {
                adminSelect.innerHTML =
                    '<option value="">No active admins available</option>';

                showMessage(
                    "complaint-message",
                    "No active Admin is currently available. You can choose All Admins or Super Admin Direct."
                );

                return;
            }

            data.forEach(admin => {
                if (!admin.id) return;

                const option = document.createElement("option");
                option.value = admin.id;

                const name = admin.full_name || "Admin";
                const department = admin.department
                    ? " — " + admin.department
                    : "";

                option.textContent = name + department;
                adminSelect.appendChild(option);
            });

        } catch (error) {
            console.error("Admin directory error:", error);

            adminSelect.innerHTML =
                '<option value="">Could not load Admin list</option>';

            showMessage(
                "complaint-message",
                "Admin list could not load: " + error.message
            );
        }
    }

    function updateRecipientFields() {
        const type = $("recipient-type").value;
        const adminWrap = $("recipient-admin-wrap");
        const adminSelect = $("recipient-admin-id");

        if (type === "specific_admin") {
            adminWrap.classList.remove("hidden");
            adminSelect.required = true;
        } else {
            adminWrap.classList.add("hidden");
            adminSelect.required = false;
            adminSelect.value = "";
        }
    }

    $("recipient-type").addEventListener(
        "change",
        updateRecipientFields
    );

    // ---------------- PROFILE / DASHBOARD ----------------

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

        if (data.course) {
            $("complaint-course").value = data.course;
        }

        if (data.semester) {
            $("complaint-semester").value = data.semester;
        }

        hidePanels();
        updateRecipientFields();
        await loadAdminDirectory();
        createAIAssistant();
    }

    // ---------------- STUDENT REGISTRATION ----------------

    $("student-register-form").addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            if (!navigator.onLine) {
                showMessage("register-message", NO_NETWORK);
                return;
            }

            const name = $("student-name").value.trim();
            const email = $("student-email").value.trim().toLowerCase();
            const mobile = $("student-mobile").value.trim();
            const course = $("student-course").value.trim();
            const semester = $("student-semester").value;
            const pin = $("create-pin").value;
            const confirmPin = $("confirm-pin").value;

            if (pin.length < 6) {
                showMessage(
                    "register-message",
                    "PIN must be at least 6 characters."
                );
                return;
            }

            if (pin !== confirmPin) {
                showMessage(
                    "register-message",
                    "PINs do not match."
                );
                return;
            }

            showMessage(
                "register-message",
                "Creating your account..."
            );

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

            } catch (error) {
                showMessage(
                    "register-message",
                    !navigator.onLine
                        ? NO_NETWORK
                        : error.message || "Registration failed."
                );
            }
        }
    );

    // ---------------- STUDENT LOGIN ----------------

    $("student-login-form").addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            if (!navigator.onLine) {
                showMessage("login-message", NO_NETWORK);
                return;
            }

            const studentId = $("login-student-id").value.trim();
            const pin = $("login-pin").value;

            showMessage("login-message", "Signing in...");

            try {
                const { data, error } = await db.functions.invoke(
                    "student-login",
                    {
                        body: {
                            student_id: studentId,
                            password: pin
                        }
                    }
                );

                if (
                    error ||
                    !data ||
                    !data.access_token ||
                    !data.refresh_token
                ) {
                    throw new Error(
                        (data && data.error) ||
                        (error && error.message) ||
                        "Login service is not ready, or Student ID/PIN is incorrect."
                    );
                }

                const { data: sessionData, error: sessionError } =
                    await db.auth.setSession({
                        access_token: data.access_token,
                        refresh_token: data.refresh_token
                    });

                if (sessionError) throw sessionError;

                await openDashboard(sessionData.user);

            } catch (error) {
                showMessage(
                    "login-message",
                    !navigator.onLine
                        ? NO_NETWORK
                        : error.message || "Login failed."
                );
            }
        }
    );

    // ---------------- MEDIA UPLOAD ----------------

    function safeExtension(file) {
        const fromName = file.name.includes(".")
            ? file.name.split(".").pop()
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "")
            : "";

        if (fromName) return fromName;

        if (file.type === "image/jpeg") return "jpg";
        if (file.type === "image/png") return "png";
        if (file.type === "image/webp") return "webp";
        if (file.type === "video/mp4") return "mp4";
        if (file.type === "video/webm") return "webm";

        return "bin";
    }

    async function uploadComplaintMedia(file) {
        if (!file) return null;

        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        if (!isImage && !isVideo) {
            throw new Error("Only image and video files are allowed.");
        }

        if (isImage && file.size > MAX_IMAGE_BYTES) {
            throw new Error("Photo must be 5 MB or smaller.");
        }

        if (isVideo && file.size > MAX_VIDEO_BYTES) {
            throw new Error("Video must be 25 MB or smaller.");
        }

        const uniqueId = window.crypto &&
            typeof window.crypto.randomUUID === "function"
            ? window.crypto.randomUUID()
            : Date.now().toString();

        const path =
            `${currentUser.id}/${Date.now()}-${uniqueId}.${safeExtension(file)}`;

        const { data, error } = await db.storage
            .from(STORAGE_BUCKET)
            .upload(path, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type || "application/octet-stream"
            });

        if (error) {
            throw new Error(
                "Media upload failed: " + error.message
            );
        }

        return data.path;
    }

    // ---------------- SUBMIT COMPLAINT ----------------

    $("complaint-form").addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            if (!currentUser) {
                showMessage(
                    "complaint-message",
                    "Please login first."
                );
                return;
            }

            if (!navigator.onLine) {
                showMessage("complaint-message", NO_NETWORK);
                return;
            }

            const form = $("complaint-form");
            const submitButton =
                form.querySelector('button[type="submit"]');

            const recipientType = $("recipient-type").value;
            const selectedAdmin = $("recipient-admin-id").value;

            if (
                recipientType === "specific_admin" &&
                !selectedAdmin
            ) {
                showMessage(
                    "complaint-message",
                    "Please select an Admin for this confidential complaint."
                );
                $("recipient-admin-id").focus();
                return;
            }

            const mediaInput = $("complaint-media");
            const media = mediaInput.files[0] || null;

            const complaint = {
                user_id: currentUser.id,
                course: $("complaint-course").value.trim(),
                semester: $("complaint-semester").value.trim(),
                location: $("complaint-location").value.trim(),
                category: $("problem-category").value,
                title: $("problem-category").value + " Complaint",
                description: $("problem-description").value.trim(),
                status: "Submitted",
                escalated: false,

                // Complaint routing
                recipient_type: recipientType,
                recipient_admin_id:
                    recipientType === "specific_admin"
                        ? selectedAdmin
                        : null,

                is_confidential:
                    recipientType === "specific_admin" ||
                    recipientType === "super_admin"
            };

            let uploadedPath = null;

            if (submitButton) submitButton.disabled = true;

            try {
                if (media) {
                    showMessage(
                        "complaint-message",
                        "Uploading photo/video..."
                    );

                    uploadedPath = await uploadComplaintMedia(media);
                    complaint.media_path = uploadedPath;
                }

                showMessage(
                    "complaint-message",
                    "Submitting your complaint..."
                );

                const { data, error } = await db
                    .from("complaints")
                    .insert(complaint)
                    .select()
                    .single();

                if (error) {
                    if (uploadedPath) {
                        await db.storage
                            .from(STORAGE_BUCKET)
                            .remove([uploadedPath]);
                    }

                    throw new Error(error.message);
                }

                showMessage(
                    "complaint-message",
                    "Complaint submitted successfully! Complaint ID: " +
                    (data.complaint_id || data.id),
                    true
                );

                form.reset();

                if (currentProfile) {
                    $("complaint-course").value =
                        currentProfile.course || "";

                    $("complaint-semester").value =
                        currentProfile.semester || "";
                }

                updateRecipientFields();

                await loadAdminDirectory();

            } catch (error) {
                showMessage(
                    "complaint-message",
                    !navigator.onLine
                        ? NO_NETWORK
                        : error.message || "Complaint could not be submitted."
                );
            } finally {
                if (submitButton) submitButton.disabled = false;
            }
        }
    );

    // ---------------- COMPLAINT HISTORY ----------------

    async function loadComplaints() {
        if (!currentUser) return;

        const container = $("complaint-history");
        container.textContent = "Loading complaints...";

        if (!navigator.onLine) {
            container.textContent = NO_NETWORK;
            return;
        }

        const { data, error } = await db
            .from("complaints")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false });

        if (error) {
            container.textContent =
                "Could not load complaints: " + error.message;
            return;
        }

        container.innerHTML = "";

        if (!data || data.length === 0) {
            container.textContent =
                "You have not submitted any complaints yet.";
            return;
        }

        for (const item of data) {
            const card = document.createElement("div");
            card.className = "complaint-history-card";

            const heading = document.createElement("h3");
            heading.textContent =
                "Complaint ID: " + (item.complaint_id || item.id);

            const category = document.createElement("p");
            category.textContent =
                "Category: " + (item.category || "-");

            const location = document.createElement("p");
            location.textContent =
                "Location: " + (item.location || "-");

            const status = document.createElement("p");
            status.textContent =
                "Status: " + (item.status || "Submitted");

            const recipient = document.createElement("p");

            const recipientLabels = {
                all_admins: "All Admins",
                specific_admin: "Specific Admin (Confidential)",
                super_admin: "Super Admin Direct (Private)"
            };

            recipient.textContent =
                "Sent to: " +
                (recipientLabels[item.recipient_type] || "All Admins");

            const description = document.createElement("p");
            description.textContent = item.description || "";

            card.append(
                heading,
                category,
                location,
                status,
                recipient,
                description
            );

            if (item.media_path) {
                const mediaLink = document.createElement("a");
                mediaLink.textContent = "View attached photo/video";
                mediaLink.href = "#";
                mediaLink.target = "_blank";
                mediaLink.rel = "noopener noreferrer";

                mediaLink.addEventListener("click", async event => {
                    event.preventDefault();

                    if (!navigator.onLine) {
                        alert(NO_NETWORK);
                        return;
                    }

                    const { data: signed, error: signedError } =
                        await db.storage
                            .from(STORAGE_BUCKET)
                            .createSignedUrl(item.media_path, 300);

                    if (signedError) {
                        alert(
                            "Could not open attachment: " +
                            signedError.message
                        );
                        return;
                    }

                    window.open(
                        signed.signedUrl,
                        "_blank",
                        "noopener"
                    );
                });

                card.appendChild(mediaLink);
            }

            container.appendChild(card);
        }
    }

    // ---------------- FEEDBACK ----------------

    $("feedback-form").addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            if (!currentUser) {
                showMessage(
                    "feedback-message-status",
                    "Please login first."
                );
                return;
            }

            if (!navigator.onLine) {
                showMessage(
                    "feedback-message-status",
                    NO_NETWORK
                );
                return;
            }

            const complaintId =
                $("feedback-complaint-id").value.trim();

            const rating = Number($("feedback-rating").value);
            const feedbackText =
                $("feedback-message").value.trim();

            if (!rating || rating < 1 || rating > 5) {
                showMessage(
                    "feedback-message-status",
                    "Please select a rating."
                );
                return;
            }

            if (!feedbackText) {
                showMessage(
                    "feedback-message-status",
                    "Please enter your feedback."
                );
                return;
            }

            showMessage(
                "feedback-message-status",
                "Submitting feedback..."
            );

            try {
                const { error } = await db
                    .from("feedback")
                    .insert({
                        complaint_id: complaintId,
                        user_id: currentUser.id,
                        rating,
                        feedback: feedbackText
                    });

                if (error) throw error;

                showMessage(
                    "feedback-message-status",
                    "Thank you! Your feedback has been submitted.",
                    true
                );

                $("feedback-form").reset();

            } catch (error) {
                showMessage(
                    "feedback-message-status",
                    !navigator.onLine
                        ? NO_NETWORK
                        : error.message || "Feedback could not be submitted."
                );
            }
        }
    );

    // ---------------- AI ASSISTANT STYLES ----------------

    function addAssistantStyles() {
        if ($("ltsu-ai-styles")) return;

        const style = document.createElement("style");
        style.id = "ltsu-ai-styles";

        style.textContent = `
            #ltsu-ai-launcher {
                position: fixed;
                right: 22px;
                bottom: 22px;
                z-index: 9998;
                border: 0;
                border-radius: 999px;
                padding: 14px 19px;
                background: linear-gradient(135deg,#315efb,#10b981);
                color: white;
                font-weight: 800;
                box-shadow: 0 8px 28px #0003;
                cursor: pointer;
            }

            #ltsu-ai-panel {
                position: fixed;
                right: 22px;
                bottom: 82px;
                width: min(390px,calc(100vw - 28px));
                height: min(590px,calc(100vh - 115px));
                z-index: 9999;
                background: white;
                color: #17233f;
                border: 1px solid #e1e7f2;
                border-radius: 18px;
                box-shadow: 0 12px 40px #0003;
                display: none;
                overflow: hidden;
                font-family: Arial,sans-serif;
            }

            #ltsu-ai-panel.open {
                display: flex;
                flex-direction: column;
            }

            #ltsu-ai-head {
                background: linear-gradient(120deg,#101a35,#29477d);
                color: white;
                padding: 14px 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            #ltsu-ai-head strong {
                font-size: 16px;
            }

            #ltsu-ai-close {
                border: 0;
                background: transparent;
                color: white;
                font-size: 24px;
                cursor: pointer;
            }

            #ltsu-ai-notice {
                font-size: 11px;
                color: #64718a;
                padding: 7px 12px;
                background: #f0f4ff;
            }

            #ltsu-ai-messages {
                flex: 1;
                overflow: auto;
                padding: 12px;
                background: #f7f9ff;
            }

            .ltsu-ai-msg {
                max-width: 88%;
                padding: 10px 12px;
                border-radius: 13px;
                margin: 8px 0;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
                font-size: 14px;
                line-height: 1.5;
            }

            .ltsu-ai-user {
                margin-left: auto;
                color: white;
                background: #315efb;
            }

            .ltsu-ai-bot {
                margin-right: auto;
                color: #17233f;
                background: white;
                border: 1px solid #e1e7f2;
            }

            #ltsu-ai-tools {
                padding: 10px;
                border-top: 1px solid #e1e7f2;
                background: white;
            }

            #ltsu-ai-text {
                width: 100%;
                min-height: 65px;
                resize: vertical;
                box-sizing: border-box;
                border: 1px solid #dce4f2;
                border-radius: 10px;
                padding: 9px;
                color: #17233f;
                background: #f7f9ff;
                font: 14px Arial;
            }

            .ltsu-ai-actions {
                display: flex;
                gap: 7px;
                align-items: center;
                margin-top: 8px;
            }

            .ltsu-ai-send {
                border: 0;
                border-radius: 8px;
                padding: 10px 16px;
                cursor: pointer;
                background: linear-gradient(135deg,#315efb,#10b981);
                color: white;
                font-weight: 700;
                margin-left: auto;
            }

            .ltsu-ai-send:disabled {
                opacity: .5;
                cursor: not-allowed;
            }

            #ltsu-ai-status {
                font-size: 12px;
                color: #64718a;
                min-height: 16px;
                margin-top: 6px;
            }

            @media(max-width:480px) {
                #ltsu-ai-launcher {
                    right: 14px;
                    bottom: 14px;
                }

                #ltsu-ai-panel {
                    right: 8px;
                    bottom: 72px;
                    width: calc(100vw - 16px);
                    height: 70vh;
                }
            }
        `;

        document.head.appendChild(style);
    }

    // ---------------- AI ASSISTANT ----------------

    function createAIAssistant() {
        if ($("ltsu-ai-panel")) return;

        addAssistantStyles();

        const launcher = document.createElement("button");
        launcher.id = "ltsu-ai-launcher";
        launcher.type = "button";
        launcher.textContent = "✦ LTSUCare AI";

        const panel = document.createElement("section");
        panel.id = "ltsu-ai-panel";
        panel.setAttribute(
            "aria-label",
            "LTSUCare AI Assistant"
        );

        panel.innerHTML = `
            <div id="ltsu-ai-head">
                <strong>✦ LTSUCare AI Assistant</strong>
                <button id="ltsu-ai-close"
                    type="button"
                    aria-label="Close">×</button>
            </div>

            <div id="ltsu-ai-notice">
                Ask about campus support, complaints or anything you need help with.
                Do not share passwords or PINs.
            </div>

            <div id="ltsu-ai-messages" aria-live="polite">
                <div class="ltsu-ai-msg ltsu-ai-bot">
                    Hello! Welcome to LTSUCare. How can I help you today?
                </div>
            </div>

            <div id="ltsu-ai-tools">
                <textarea id="ltsu-ai-text"
                    maxlength="6000"
                    placeholder="Type your question here..."></textarea>

                <div class="ltsu-ai-actions">
                    <button id="ltsu-ai-send"
                        class="ltsu-ai-send"
                        type="button">Send</button>
                </div>

                <div id="ltsu-ai-status"
                    role="status"
                    aria-live="polite"></div>
            </div>
        `;

        document.body.append(launcher, panel);

        launcher.addEventListener("click", () => {
            panel.classList.toggle("open");
            $("ltsu-ai-text").focus();
        });

        $("ltsu-ai-close").addEventListener("click", () => {
            panel.classList.remove("open");
        });

        $("ltsu-ai-send").addEventListener(
            "click",
            sendAIMessage
        );

        $("ltsu-ai-text").addEventListener(
            "keydown",
            event => {
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendAIMessage();
                }
            }
        );

        updateAIConnectionStatus();
    }

    function updateAIConnectionStatus() {
        const status = $("ltsu-ai-status");
        if (!status) return;

        status.textContent = navigator.onLine
            ? "You are online. Ask your question."
            : NO_NETWORK;
    }

    window.addEventListener("offline", () => {
        const status = $("ltsu-ai-status");
        if (status) status.textContent = NO_NETWORK;
    });

    window.addEventListener("online", () => {
        const status = $("ltsu-ai-status");
        if (status) {
            status.textContent = "Internet connection restored.";
        }
    });

    function addAIMessage(message, type) {
        const list = $("ltsu-ai-messages");
        const bubble = document.createElement("div");

        bubble.className =
            "ltsu-ai-msg " +
            (type === "user"
                ? "ltsu-ai-user"
                : "ltsu-ai-bot");

        bubble.textContent = message;
        list.appendChild(bubble);
        list.scrollTop = list.scrollHeight;

        return bubble;
    }

    async function sendAIMessage() {
        if (aiSending) return;

        if (!currentUser) {
            $("ltsu-ai-status").textContent = "Please log in first.";
            return;
        }

        const textInput = $("ltsu-ai-text");
        const sendButton = $("ltsu-ai-send");
        const text = textInput.value.trim();

        if (!text) {
            $("ltsu-ai-status").textContent =
                "Please type a message first.";
            textInput.focus();
            return;
        }

        if (!navigator.onLine) {
            $("ltsu-ai-status").textContent = NO_NETWORK;
            return;
        }

        aiSending = true;
        sendButton.disabled = true;
        textInput.disabled = true;

        $("ltsu-ai-status").textContent =
            "Connecting to LTSUCare AI...";

        addAIMessage(text, "user");
        textInput.value = "";

        const requestHistory = aiHistory.slice(-8);
        let requestTimeout = null;

        try {
            const invokePromise = db.functions.invoke(
                AI_FUNCTION,
                {
                    body: {
                        text,
                        history: requestHistory
                    }
                }
            );

            const timeoutPromise = new Promise((_, reject) => {
                requestTimeout = window.setTimeout(
                    () => reject(new Error("AI_TIMEOUT")),
                    24000
                );
            });

            const { data, error } = await Promise.race([
                invokePromise,
                timeoutPromise
            ]);

            if (error) {
                let detail = error.message || "AI request failed.";

                try {
                    if (
                        error.context &&
                        typeof error.context.clone === "function"
                    ) {
                        const errorBody =
                            await error.context.clone().json();

                        if (errorBody && errorBody.error) {
                            detail = errorBody.error;
                        }
                    }
                } catch (_) {
                    // Keep original error message.
                }

                const lowerDetail = String(detail).toLowerCase();

                if (
                    !navigator.onLine ||
                    lowerDetail.includes("failed to fetch") ||
                    lowerDetail.includes("networkerror") ||
                    lowerDetail.includes("network request failed")
                ) {
                    throw new Error("NO_NETWORK");
                }

                throw new Error(detail);
            }

            if (!data || !data.success || !data.answer) {
                throw new Error(
                    (data && data.error) ||
                    "AI did not return a reply. Please try again."
                );
            }

            aiHistory.push(
                { role: "user", text },
                { role: "model", text: data.answer }
            );

            aiHistory = aiHistory.slice(-8);

            addAIMessage(data.answer, "assistant");
            $("ltsu-ai-status").textContent = "Reply received.";

        } catch (error) {
            let message = error instanceof Error
                ? error.message
                : "Something went wrong. Please try again.";

            if (message === "NO_NETWORK" || !navigator.onLine) {
                message = NO_NETWORK;
            } else if (message === "AI_TIMEOUT") {
                message =
                    "AI is taking too long to respond. Please try again.";
            }

            addAIMessage(message, "assistant");
            $("ltsu-ai-status").textContent = "Message not sent.";

            if (!textInput.value.trim()) {
                textInput.value = text;
            }

        } finally {
            if (requestTimeout !== null) {
                clearTimeout(requestTimeout);
            }

            aiSending = false;
            sendButton.disabled = false;
            textInput.disabled = false;
            textInput.focus();
        }
    }

    // ---------------- LOGOUT ----------------

    $("logout-btn").addEventListener("click", async () => {
        const { error } = await db.auth.signOut();

        if (error) {
            alert("Logout error: " + error.message);
            return;
        }

        currentUser = null;
        currentProfile = null;
        aiHistory = [];
        aiSending = false;

        $("student-dashboard").classList.add("hidden");
        $("auth-section").classList.remove("hidden");

        $("student-login-form").reset();
        $("student-register-form").reset();

        const assistantPanel = $("ltsu-ai-panel");
        const assistantLauncher = $("ltsu-ai-launcher");
        const assistantStyles = $("ltsu-ai-styles");

        if (assistantPanel) assistantPanel.remove();
        if (assistantLauncher) assistantLauncher.remove();
        if (assistantStyles) assistantStyles.remove();

        showLogin();
    });

    // ---------------- RESTORE EXISTING SESSION ----------------

    async function checkSession() {
        const { data, error } = await db.auth.getSession();

        if (error) {
            console.error("Session check error:", error.message);
            return;
        }

        if (data.session && data.session.user) {
            await openDashboard(data.session.user);
        }
    }

    // ---------------- INITIAL SETUP ----------------

    $("current-year").textContent = new Date().getFullYear();

    showLogin();
    updateRecipientFields();
    checkSession();
});
