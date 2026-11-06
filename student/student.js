document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const db = window.supabaseClient;
    const $ = (id) => document.getElementById(id);

    const STORAGE_BUCKET = "complaint-media";
    const AI_FUNCTION = "ltsucare-ai";

    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

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

    let currentUser = null;
    let currentProfile = null;

    // AI conversation history for the current login session.
    let aiHistory = [];

    // ---------------- AUTH TABS ----------------

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

    // ---------------- DASHBOARD PANELS ----------------

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

        if (data.course) $("complaint-course").value = data.course;
        if (data.semester) $("complaint-semester").value = data.semester;

        hidePanels();
        createAIAssistant();
    }

    // ---------------- STUDENT REGISTRATION ----------------

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

        if (error) {
            showMessage("register-message", error.message);
            return;
        }

        if (data.session && data.user) {
            showMessage("register-message", "Registration successful!", true);
            await openDashboard(data.user);
        } else {
            showMessage(
                "register-message",
                "Account created. Please check your email if confirmation is required.",
                true
            );
        }
    });

    // ---------------- STUDENT LOGIN ----------------

    $("student-login-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        const studentId = $("login-student-id").value.trim();
        const pin = $("login-pin").value;

        showMessage("login-message", "Signing in...");

        const { data, error } = await db.functions.invoke("student-login", {
            body: {
                student_id: studentId,
                password: pin
            }
        });

        if (error || !data || !data.access_token || !data.refresh_token) {
            showMessage(
                "login-message",
                (data && data.error) ||
                (error && error.message) ||
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

    // ---------------- COMPLAINT PHOTO / VIDEO UPLOAD ----------------

    function safeExtension(file) {
        const fromName = file.name.includes(".")
            ? file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "")
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

        const path =
            `${currentUser.id}/${Date.now()}-${crypto.randomUUID()}.${safeExtension(file)}`;

        const { data, error } = await db.storage
            .from(STORAGE_BUCKET)
            .upload(path, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type || "application/octet-stream"
            });

        if (error) {
            throw new Error(
                "Media upload failed: " + error.message +
                ". Check complaint-media Storage bucket and its policies."
            );
        }

        return data.path;
    }

    // ---------------- SUBMIT COMPLAINT ----------------

    $("complaint-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!currentUser) {
            showMessage("complaint-message", "Please login first.");
            return;
        }

        const submitButton =
            $("complaint-form").querySelector('button[type="submit"]');

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
            escalated: false
        };

        let uploadedPath = null;

        if (submitButton) submitButton.disabled = true;

        try {
            if (media) {
                showMessage("complaint-message", "Uploading photo/video...");
                uploadedPath = await uploadComplaintMedia(media);
                complaint.media_path = uploadedPath;
            }

            showMessage("complaint-message", "Saving complaint...");

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
                (data.complaint_id || data.id) +
                (uploadedPath ? " (Photo/video attached)" : ""),
                true
            );

            $("complaint-form").reset();

            if (currentProfile) {
                $("complaint-course").value = currentProfile.course || "";
                $("complaint-semester").value = currentProfile.semester || "";
            }
        } catch (error) {
            showMessage(
                "complaint-message",
                error instanceof Error
                    ? error.message
                    : "Complaint could not be submitted."
            );
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });

    // ---------------- COMPLAINT HISTORY ----------------

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

            if (item.media_path) {
                const mediaLink = document.createElement("a");
                mediaLink.textContent = "View attached photo/video";
                mediaLink.href = "#";
                mediaLink.target = "_blank";
                mediaLink.rel = "noopener noreferrer";

                mediaLink.addEventListener("click", async (event) => {
                    event.preventDefault();

                    const { data: signed, error: signedError } = await db.storage
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
                rating
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

    // ---------------- AI ASSISTANT UI (TEXT ONLY) ----------------

    function addAssistantStyles() {
        if ($("ltsu-ai-styles")) return;

        const style = document.createElement("style");
        style.id = "ltsu-ai-styles";

        style.textContent = `
            #ltsu-ai-launcher{position:fixed;right:22px;bottom:22px;z-index:9998;border:0;border-radius:999px;padding:14px 19px;background:#087f8c;color:#fff;font-weight:700;box-shadow:0 5px 22px #0003;cursor:pointer}
            #ltsu-ai-panel{position:fixed;right:22px;bottom:82px;width:min(390px,calc(100vw - 28px));height:min(590px,calc(100vh - 115px));z-index:9999;background:#fff;color:#17212b;border:1px solid #d8e1e8;border-radius:18px;box-shadow:0 12px 40px #0003;display:none;overflow:hidden;font-family:Arial,sans-serif}
            #ltsu-ai-panel.open{display:flex;flex-direction:column}
            #ltsu-ai-head{background:#071827;color:white;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}
            #ltsu-ai-head strong{font-size:16px}
            #ltsu-ai-close{border:0;background:transparent;color:white;font-size:24px;cursor:pointer}
            #ltsu-ai-notice{font-size:11px;color:#667;padding:7px 12px;background:#f4f7f9}
            #ltsu-ai-messages{flex:1;overflow:auto;padding:12px;background:#f7fafc}
            .ltsu-ai-msg{max-width:88%;padding:10px 12px;border-radius:13px;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.5}
            .ltsu-ai-user{margin-left:auto;background:#d9f2f2}
            .ltsu-ai-bot{margin-right:auto;background:white;border:1px solid #e2e8ee}
            #ltsu-ai-tools{padding:10px;border-top:1px solid #e3e8ed;background:white}
            #ltsu-ai-text{width:100%;min-height:65px;resize:vertical;box-sizing:border-box;border:1px solid #cbd5df;border-radius:10px;padding:9px;font:14px Arial}
            .ltsu-ai-actions{display:flex;gap:7px;align-items:center;margin-top:8px}
            .ltsu-ai-send{border:0;border-radius:8px;padding:10px 16px;cursor:pointer;background:#087f8c;color:white;font-weight:600;margin-left:auto}
            .ltsu-ai-send:disabled{opacity:.5;cursor:not-allowed}
            #ltsu-ai-status{font-size:12px;color:#586774;min-height:16px;margin-top:6px}
            .ltsu-ai-listen{display:block;margin:0 0 8px 8px;border:0;border-radius:7px;padding:7px 10px;cursor:pointer;background:#e7eff3;color:#18313b}
            @media(max-width:480px){#ltsu-ai-launcher{right:14px;bottom:14px}#ltsu-ai-panel{right:8px;bottom:72px;width:calc(100vw - 16px);height:70vh}}
        `;

        document.head.appendChild(style);
    }

    function createAIAssistant() {
        if ($("ltsu-ai-panel")) return;

        addAssistantStyles();

        const launcher = document.createElement("button");
        launcher.id = "ltsu-ai-launcher";
        launcher.type = "button";
        launcher.textContent = "✦ LTSUCare AI";

        launcher.addEventListener("click", () => {
            $("ltsu-ai-panel").classList.toggle("open");
            $("ltsu-ai-text").focus();
        });

        const panel = document.createElement("section");
        panel.id = "ltsu-ai-panel";
        panel.setAttribute("aria-label", "LTSUCare AI Assistant");

        panel.innerHTML = `
            <div id="ltsu-ai-head">
                <strong>✦ LTSUCare AI Assistant</strong>
                <button id="ltsu-ai-close" type="button" aria-label="Close">×</button>
            </div>
            <div id="ltsu-ai-notice">
                Ask questions about campus support, complaints or anything you need help with. Please do not share passwords or PINs.
            </div>
            <div id="ltsu-ai-messages" aria-live="polite">
                <div class="ltsu-ai-msg ltsu-ai-bot">
                    Hello! Welcome to LTSUCare. You can ask me about campus support, complaints or any question. How can I help you today?
                </div>
            </div>
            <div id="ltsu-ai-tools">
                <textarea id="ltsu-ai-text" maxlength="8000" placeholder="Type your question here..."></textarea>
                <div class="ltsu-ai-actions">
                    <button id="ltsu-ai-send" class="ltsu-ai-send" type="button">Send</button>
                </div>
                <div id="ltsu-ai-status" role="status" aria-live="polite"></div>
            </div>
        `;

        document.body.append(launcher, panel);

        $("ltsu-ai-close").addEventListener("click", () => {
            panel.classList.remove("open");
        });

        $("ltsu-ai-send").addEventListener("click", sendAIMessage);

        $("ltsu-ai-text").addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendAIMessage();
            }
        });
    }

    function addAIMessage(message, type) {
        const list = $("ltsu-ai-messages");
        const bubble = document.createElement("div");

        bubble.className =
            "ltsu-ai-msg " +
            (type === "user" ? "ltsu-ai-user" : "ltsu-ai-bot");

        bubble.textContent = message;
        list.appendChild(bubble);
        list.scrollTop = list.scrollHeight;

        return bubble;
    }

    function addAIListenButton(answer) {
        if (!("speechSynthesis" in window)) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "ltsu-ai-listen";
        button.textContent = "🔊 Listen";

        button.addEventListener("click", () => {
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(
                new SpeechSynthesisUtterance(answer)
            );
        });

        $("ltsu-ai-messages").appendChild(button);
        $("ltsu-ai-messages").scrollTop =
            $("ltsu-ai-messages").scrollHeight;
    }

    // ---------------- SEND TEXT MESSAGE TO AI ----------------

    async function sendAIMessage() {
        if (!currentUser) {
            $("ltsu-ai-status").textContent = "Please log in first.";
            return;
        }

        const text = $("ltsu-ai-text").value.trim();

        if (!text) {
            $("ltsu-ai-status").textContent = "Please type a message first.";
            $("ltsu-ai-text").focus();
            return;
        }

        const sendButton = $("ltsu-ai-send");
        const textInput = $("ltsu-ai-text");

        sendButton.disabled = true;
        textInput.disabled = true;

        $("ltsu-ai-status").textContent =
            "LTSUCare AI is preparing your reply...";

        addAIMessage(text, "user");
        textInput.value = "";

        const requestHistory = aiHistory.slice(-12);

        let requestTimeout = null;

        try {
            // Frontend safety timeout.
            const invokePromise = db.functions.invoke(AI_FUNCTION, {
                body: {
                    text,
                    history: requestHistory
                }
            });

            const timeoutPromise = new Promise((_, reject) => {
                requestTimeout = window.setTimeout(() => {
                    reject(new Error(
                        "The reply is taking too long. Please try sending your message again."
                    ));
                }, 30000);
            });

            const { data, error } = await Promise.race([
                invokePromise,
                timeoutPromise
            ]);

            if (error) {
                let detail = error.message || "AI request failed.";

                try {
                    if (error.context && typeof error.context.json === "function") {
                        const errorBody = await error.context.json();

                        if (errorBody && errorBody.error) {
                            detail = errorBody.error;
                        }
                    }
                } catch (_) {
                    // Keep the original error message.
                }

                throw new Error(detail);
            }

            if (!data || !data.success || !data.answer) {
                throw new Error(
                    (data && data.error) ||
                    "AI did not return a reply. Please try again."
                );
            }

            // Save successful conversation turns for follow-up questions.
            aiHistory.push(
                { role: "user", text },
                { role: "model", text: data.answer }
            );

            aiHistory = aiHistory.slice(-12);

            addAIMessage(data.answer, "assistant");
            addAIListenButton(data.answer);

            $("ltsu-ai-status").textContent = "Reply received.";

        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Something went wrong. Please try again.";

            addAIMessage(
                "I'm sorry, I couldn't get a reply right now. " + message,
                "assistant"
            );

            $("ltsu-ai-status").textContent = "Please try again.";

            // Restore the message so the student can resend it.
            if (!textInput.value.trim()) {
                textInput.value = text;
            }

        } finally {
            if (requestTimeout !== null) {
                clearTimeout(requestTimeout);
            }

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

        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

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
    checkSession();
});
