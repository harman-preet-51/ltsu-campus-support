document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const db = window.supabaseClient;
    const $ = (id) => document.getElementById(id);

    const STORAGE_BUCKET = "complaint-media";
    const AI_FUNCTION = "ltsucare-ai";

    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
    const MAX_AI_IMAGE_BYTES = 5 * 1024 * 1024;
    const MAX_AI_AUDIO_BYTES = 7 * 1024 * 1024;

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

    let mediaRecorder = null;
    let recordedChunks = [];
    let recordingStream = null;
    let recordingTimer = null;
    let selectedAIImage = null;

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

    // ---------------- AI ASSISTANT UI ----------------

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
            .ltsu-ai-msg{max-width:88%;padding:10px 12px;border-radius:13px;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.45}
            .ltsu-ai-user{margin-left:auto;background:#d9f2f2}
            .ltsu-ai-bot{margin-right:auto;background:white;border:1px solid #e2e8ee}
            #ltsu-ai-tools{padding:10px;border-top:1px solid #e3e8ed;background:white}
            #ltsu-ai-text{width:100%;min-height:65px;resize:vertical;box-sizing:border-box;border:1px solid #cbd5df;border-radius:10px;padding:9px;font:14px Arial}
            .ltsu-ai-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:8px}
            .ltsu-ai-actions button,.ltsu-ai-send{border:0;border-radius:8px;padding:9px 11px;cursor:pointer;background:#e7eff3;color:#18313b;font-weight:600}
            .ltsu-ai-send{background:#087f8c!important;color:white!important;margin-left:auto}
            .ltsu-ai-actions button:disabled{opacity:.5;cursor:not-allowed}
            #ltsu-ai-file{max-width:150px;font-size:11px}
            #ltsu-ai-status{font-size:12px;color:#586774;min-height:16px;margin-top:6px}
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
                Text, photo and voice help. Do not share passwords, PINs or sensitive personal data.
            </div>
            <div id="ltsu-ai-messages" aria-live="polite">
                <div class="ltsu-ai-msg ltsu-ai-bot">
                    Hello! I can help with campus complaints. Type a message, attach a photo, or record your voice.
                </div>
            </div>
            <div id="ltsu-ai-tools">
                <textarea id="ltsu-ai-text" placeholder="Type your question here..."></textarea>
                <div class="ltsu-ai-actions">
                    <input id="ltsu-ai-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="Attach a photo">
                    <button id="ltsu-ai-record" type="button">🎙 Record</button>
                    <button id="ltsu-ai-stop" type="button" disabled>Stop</button>
                    <button id="ltsu-ai-send" class="ltsu-ai-send" type="button">Send</button>
                </div>
                <div id="ltsu-ai-status" role="status"></div>
            </div>
        `;

        document.body.append(launcher, panel);

        $("ltsu-ai-close").addEventListener("click", () => {
            panel.classList.remove("open");
        });

        $("ltsu-ai-file").addEventListener("change", () => {
            const file = $("ltsu-ai-file").files[0] || null;

            selectedAIImage = null;

            if (!file) {
                $("ltsu-ai-status").textContent = "";
                return;
            }

            const mime = getImageMime(file);

            if (!mime || file.size > MAX_AI_IMAGE_BYTES) {
                $("ltsu-ai-status").textContent =
                    "Please choose a JPG, PNG, WEBP or GIF photo up to 5 MB.";
                $("ltsu-ai-file").value = "";
                return;
            }

            selectedAIImage = file;
            $("ltsu-ai-status").textContent =
                "Photo attached: " + file.name;
        });

        $("ltsu-ai-send").addEventListener("click", () => {
            sendAIMessage();
        });

        $("ltsu-ai-text").addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendAIMessage();
            }
        });

        $("ltsu-ai-record").addEventListener("click", startVoiceRecording);
        $("ltsu-ai-stop").addEventListener("click", stopVoiceRecording);
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

    // ---------------- AI FILE HELPERS ----------------

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                const result = String(reader.result || "");
                const comma = result.indexOf(",");

                resolve(comma >= 0 ? result.substring(comma + 1) : result);
            };

            reader.onerror = () => {
                reject(new Error("Could not read the selected file."));
            };

            reader.readAsDataURL(file);
        });
    }

    function getImageMime(file) {
        const type = (file.type || "").toLowerCase().split(";")[0].trim();

        if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)) {
            return type;
        }

        const name = (file.name || "").toLowerCase();

        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".webp")) return "image/webp";
        if (name.endsWith(".gif")) return "image/gif";

        return null;
    }

    function getAudioMime(blob) {
        let type = (blob.type || "").toLowerCase().split(";")[0].trim();

        if (type === "audio/x-m4a" || type === "audio/m4a") {
            type = "audio/mp4";
        }

        if (type === "audio/mp3") {
            type = "audio/mpeg";
        }

        const allowed = [
            "audio/webm",
            "audio/mp4",
            "audio/mpeg",
            "audio/wav",
            "audio/ogg",
            "audio/aac",
            "audio/flac"
        ];

        if (allowed.includes(type)) return type;

        if (!type) return "audio/webm";

        throw new Error(
            "Your browser created an unsupported audio format (" +
            type +
            "). Please try recording again in Chrome."
        );
    }

    // ---------------- SEND AI MESSAGE ----------------

    async function sendAIMessage(audioBlob = null) {
        if (!currentUser) {
            $("ltsu-ai-status").textContent = "Please log in first.";
            return;
        }

        const text = $("ltsu-ai-text").value.trim();
        const image = selectedAIImage;

        // Audio is included ONLY when a fresh recording is passed here.
        const hasAudio = audioBlob instanceof Blob && audioBlob.size > 0;

        if (!text && !image && !hasAudio) {
            $("ltsu-ai-status").textContent =
                "Type a message, attach a photo, or record your voice.";
            return;
        }

        const sendButton = $("ltsu-ai-send");
        const recordButton = $("ltsu-ai-record");
        const stopButton = $("ltsu-ai-stop");

        sendButton.disabled = true;
        recordButton.disabled = true;
        stopButton.disabled = true;

        $("ltsu-ai-status").textContent = "LTSUCare AI is thinking...";

        try {
            let imageBase64;
            let imageMimeType;
            let audioBase64;
            let audioMimeType;

            if (image) {
                if (image.size > MAX_AI_IMAGE_BYTES) {
                    throw new Error("Photo must be 5 MB or smaller.");
                }

                imageMimeType = getImageMime(image);

                if (!imageMimeType) {
                    throw new Error(
                        "Unsupported photo format. Please use JPG, PNG or WEBP."
                    );
                }

                imageBase64 = await fileToBase64(image);
            }

            if (hasAudio) {
                if (audioBlob.size > MAX_AI_AUDIO_BYTES) {
                    throw new Error(
                        "Voice recording is too large. Please record a shorter message."
                    );
                }

                audioMimeType = getAudioMime(audioBlob);
                audioBase64 = await fileToBase64(audioBlob);
            }

            let visibleText = text;

            if (!visibleText && image) {
                visibleText = "Please examine this campus problem photo and help me understand it.";
            }

            if (!visibleText && hasAudio) {
                visibleText = "Please understand my voice message and respond to it.";
            }

            if (!visibleText) {
                visibleText = "Hello";
            }

            addAIMessage(
                visibleText +
                (image ? "\n[Photo attached]" : "") +
                (hasAudio ? "\n[Voice recording attached]" : ""),
                "user"
            );

            // Build a clean payload. No audio fields are sent for text/photo-only messages.
            const requestBody = {
                text: visibleText
            };

            if (imageBase64) {
                requestBody.imageBase64 = imageBase64;
                requestBody.imageMimeType = imageMimeType;
            }

            if (hasAudio && audioBase64) {
                requestBody.audioBase64 = audioBase64;
                requestBody.audioMimeType = audioMimeType;
            }

            const { data, error } = await db.functions.invoke(AI_FUNCTION, {
                body: requestBody
            });

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
                    "AI did not return a response. Please check the AI Edge Function."
                );
            }

            addAIMessage(data.answer, "assistant");

            const listenButton = document.createElement("button");
            listenButton.type = "button";
            listenButton.textContent = "🔊 Listen";
            listenButton.style.cssText =
                "margin:0 0 8px 8px;border:0;border-radius:7px;padding:7px 10px;cursor:pointer;";

            listenButton.addEventListener("click", () => {
                if ("speechSynthesis" in window) {
                    window.speechSynthesis.cancel();

                    window.speechSynthesis.speak(
                        new SpeechSynthesisUtterance(data.answer)
                    );
                } else {
                    alert("Text-to-speech is not supported in this browser.");
                }
            });

            $("ltsu-ai-messages").appendChild(listenButton);
            $("ltsu-ai-messages").scrollTop =
                $("ltsu-ai-messages").scrollHeight;

            // Clear inputs only after a successful AI response.
            $("ltsu-ai-text").value = "";
            $("ltsu-ai-file").value = "";
            selectedAIImage = null;

            $("ltsu-ai-status").textContent = "Reply received.";
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unknown error.";

            addAIMessage(
                "Sorry, I could not complete that request: " + message,
                "assistant"
            );

            $("ltsu-ai-status").textContent = "Error: " + message;
        } finally {
            sendButton.disabled = false;
            recordButton.disabled = false;
            stopButton.disabled = true;
        }
    }

    // ---------------- VOICE RECORDING ----------------

    async function startVoiceRecording() {
        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia ||
            !window.MediaRecorder
        ) {
            $("ltsu-ai-status").textContent =
                "Voice recording is not supported in this browser. Please use Chrome.";
            return;
        }

        if (mediaRecorder && mediaRecorder.state === "recording") {
            return;
        }

        try {
            recordingStream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });

            recordedChunks = [];

            let options = {};

            if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
                options.mimeType = "audio/webm;codecs=opus";
            } else if (MediaRecorder.isTypeSupported("audio/webm")) {
                options.mimeType = "audio/webm";
            } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
                options.mimeType = "audio/mp4";
            }

            const recorder = new MediaRecorder(recordingStream, options);
            mediaRecorder = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            recorder.onerror = (event) => {
                $("ltsu-ai-status").textContent =
                    "Recording error: " +
                    (event.error ? event.error.message : "Please try again.");
            };

            recorder.onstop = async () => {
                if (recordingTimer) {
                    clearTimeout(recordingTimer);
                    recordingTimer = null;
                }

                const actualMime =
                    recorder.mimeType ||
                    (recordedChunks[0] && recordedChunks[0].type) ||
                    "audio/webm";

                const blob = new Blob(recordedChunks, {
                    type: actualMime
                });

                recordedChunks = [];

                if (recordingStream) {
                    recordingStream.getTracks().forEach(track => track.stop());
                    recordingStream = null;
                }

                mediaRecorder = null;

                $("ltsu-ai-record").disabled = false;
                $("ltsu-ai-stop").disabled = true;

                if (!blob.size) {
                    $("ltsu-ai-status").textContent =
                        "No audio was recorded. Please try again.";
                    return;
                }

                $("ltsu-ai-status").textContent =
                    "Sending voice recording to AI...";

                await sendAIMessage(blob);
            };

            recorder.start();

            $("ltsu-ai-record").disabled = true;
            $("ltsu-ai-stop").disabled = false;

            $("ltsu-ai-status").textContent =
                "Recording... Speak now. Press Stop when finished (maximum 45 seconds).";

            recordingTimer = window.setTimeout(() => {
                if (recorder.state === "recording") {
                    stopVoiceRecording();
                }
            }, 45000);

        } catch (error) {
            if (recordingStream) {
                recordingStream.getTracks().forEach(track => track.stop());
                recordingStream = null;
            }

            $("ltsu-ai-record").disabled = false;
            $("ltsu-ai-stop").disabled = true;

            $("ltsu-ai-status").textContent =
                "Microphone permission is needed: " +
                (error instanceof Error
                    ? error.message
                    : "Unable to start recording.");
        }
    }

    function stopVoiceRecording() {
        if (recordingTimer) {
            clearTimeout(recordingTimer);
            recordingTimer = null;
        }

        if (mediaRecorder && mediaRecorder.state === "recording") {
            $("ltsu-ai-stop").disabled = true;
            mediaRecorder.stop();

            $("ltsu-ai-status").textContent =
                "Processing recording...";
        }
    }

    // ---------------- LOGOUT ----------------

    $("logout-btn").addEventListener("click", async () => {
        if (recordingTimer) {
            clearTimeout(recordingTimer);
            recordingTimer = null;
        }

        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.onstop = null;
            mediaRecorder.stop();
            mediaRecorder = null;
        }

        if (recordingStream) {
            recordingStream.getTracks().forEach(track => track.stop());
            recordingStream = null;
        }

        recordedChunks = [];

        const { error } = await db.auth.signOut();

        if (error) {
            alert("Logout error: " + error.message);
            return;
        }

        currentUser = null;
        currentProfile = null;
        selectedAIImage = null;

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
