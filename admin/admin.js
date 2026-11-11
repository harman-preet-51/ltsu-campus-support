
document.addEventListener("DOMContentLoaded", async () => {
  const db = window.supabaseClient;
  const $ = id => document.getElementById(id);

  const RECOVERY_FUNCTION = "admin-account-recovery";
  const EMAIL_FUNCTION = "ltsu-campus-email";

  let currentUser = null;
  let currentProfile = null;

  let complaints = [];
  let generalComplaints = [];
  let confidentialComplaints = [];

  let selectedComplaint = null;
  let selectedConfidentialComplaint = null;

  if (!db) {
    alert("Supabase connection nahi mila. supabase-config.js check karo.");
    return;
  }

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[c]);

  function showMessage(message) {
    alert(message);
  }

  function setButtonBusy(button, busy, busyText) {
    if (!button) return;

    if (busy) {
      button.dataset.originalText = button.textContent;
      button.disabled = true;
      button.textContent = busyText || "Please wait...";
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
    }
  }

  async function callFunction(name, payload) {
    const { data, error } = await db.functions.invoke(name, {
      body: payload
    });

    if (error) {
      let message = error.message || "Request failed.";

      try {
        const details = await error.context?.json?.();
        if (details?.error || details?.message) {
          message = details.error || details.message;
        }
      } catch (_) {}

      throw new Error(message);
    }

    if (!data?.success) {
      throw new Error(data?.message || data?.error || "Request complete nahi hui.");
    }

    return data;
  }

  // AUTH PANELS
  const loginForm = $("admin-login-form");
  const registerForm = $("admin-register-form");

  function showAuthTab(tab) {
    const loginPanel = $("admin-login-panel");
    const registerPanel = $("admin-register-panel");
    const recoveryPanel = $("admin-recovery-panel");
    const showLogin = tab === "login";

    loginPanel?.classList.toggle("hidden", !showLogin);
    registerPanel?.classList.toggle("hidden", showLogin);
    recoveryPanel?.classList.add("hidden");

    $("admin-login-tab")?.classList.toggle("active", showLogin);
    $("admin-register-tab")?.classList.toggle("active", !showLogin);
  }

  function showRecoveryPanel() {
    $("admin-login-panel")?.classList.add("hidden");
    $("admin-register-panel")?.classList.add("hidden");
    $("admin-recovery-panel")?.classList.remove("hidden");

    $("admin-login-tab")?.classList.remove("active");
    $("admin-register-tab")?.classList.remove("active");
  }

  showAuthTab("login");

  $("admin-login-tab")?.addEventListener("click", () => showAuthTab("login"));
  $("admin-register-tab")?.addEventListener("click", () => showAuthTab("register"));

  $("open-admin-register")?.addEventListener("click", event => {
    event.preventDefault();
    showAuthTab("register");
  });

  $("open-admin-login")?.addEventListener("click", event => {
    event.preventDefault();
    showAuthTab("login");
  });

  $("admin-forgot-password")?.addEventListener("click", showRecoveryPanel);
  $("recovery-back")?.addEventListener("click", () => showAuthTab("login"));

  // PASSWORD RECOVERY
  $("admin-recovery-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    const username = $("recovery-username").value.trim().toLowerCase();
    const email = $("recovery-email").value.trim().toLowerCase();
    const pin = $("recovery-pin").value.trim();
    const newPassword = $("recovery-new-password").value;
    const confirmPassword = $("recovery-confirm-password").value;

    const button = $("recovery-submit");
    const result = $("recovery-result");

    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      showMessage("Username format sahi nahi hai.");
      return;
    }

    if (!/^[0-9]{6}$/.test(pin)) {
      showMessage("Recovery PIN exactly 6 digits ka hona chahiye.");
      return;
    }

    if (newPassword.length < 8) {
      showMessage("New password kam se kam 8 characters ka hona chahiye.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage("Dono passwords match nahi kar rahe.");
      return;
    }

    setButtonBusy(button, true, "Resetting...");
    if (result) result.textContent = "";

    try {
      await callFunction(RECOVERY_FUNCTION, {
        action: "reset_password",
        username,
        email,
        pin,
        newPassword
      });

      if (result) {
        result.textContent = "Password successfully reset ho gaya. Ab naye password se login karein.";
      }

      $("admin-recovery-form").reset();

      setTimeout(() => {
        showAuthTab("login");
        if ($("admin-email-login")) {
          $("admin-email-login").value = email;
        }
      }, 1200);

    } catch (error) {
      if (result) result.textContent = error.message;
      else showMessage(error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });

  // FIRST LOGIN RECOVERY PIN SETUP
  async function showRecoveryPinSetup() {
    $("admin-pin-setup-panel")?.remove();

    const panel = document.createElement("div");
    panel.id = "admin-pin-setup-panel";

    panel.style.cssText = `
      position:fixed;
      inset:0;
      z-index:99999;
      background:rgba(0,0,0,.78);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:18px;
    `;

    panel.innerHTML = `
      <div style="background:white;color:#222;padding:25px;border-radius:14px;width:100%;max-width:430px">
        <h2>Set Your Recovery PIN</h2>
        <p>Account recovery ke liye apna 6-digit PIN set karein. Is PIN ko safe rakhein.</p>

        <form id="admin-pin-setup-form">
          <label>Create 6-digit PIN</label>
          <input id="admin-new-pin" type="password" inputmode="numeric"
            maxlength="6" pattern="[0-9]{6}" required>

          <label>Confirm 6-digit PIN</label>
          <input id="admin-confirm-pin" type="password" inputmode="numeric"
            maxlength="6" pattern="[0-9]{6}" required>

          <button id="admin-save-pin" type="submit">Save Recovery PIN</button>
          <p id="admin-pin-message" role="status"></p>
        </form>
      </div>
    `;

    document.body.appendChild(panel);

    $("admin-pin-setup-form").addEventListener("submit", async event => {
      event.preventDefault();

      const pin = $("admin-new-pin").value.trim();
      const confirmPin = $("admin-confirm-pin").value.trim();
      const button = $("admin-save-pin");
      const message = $("admin-pin-message");

      if (!/^[0-9]{6}$/.test(pin)) {
        message.textContent = "PIN exactly 6 digits ka hona chahiye.";
        return;
      }

      if (pin !== confirmPin) {
        message.textContent = "Dono PIN match nahi kar rahe.";
        return;
      }

      setButtonBusy(button, true, "Saving PIN...");

      try {
        await callFunction(RECOVERY_FUNCTION, {
          action: "setup_pin",
          pin
        });

        message.textContent = "Recovery PIN successfully save ho gaya.";
        setTimeout(() => panel.remove(), 900);

      } catch (error) {
        message.textContent = error.message;
      } finally {
        setButtonBusy(button, false);
      }
    });
  }

  // VERIFY ADMIN
  async function verifyAdmin(user) {
    const { data: profile, error } = await db
      .from("profiles")
      .select("id,full_name,email,username,role,department,is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      await db.auth.signOut();
      showMessage("Profile check error: " + error.message);
      return false;
    }

    if (!profile || profile.role !== "admin" || profile.is_active !== true) {
      await db.auth.signOut();
      showMessage("Yeh account active approved Admin account nahi hai. Super Admin se approval check karvao.");
      return false;
    }

    currentUser = user;
    currentProfile = profile;

    $("admin-auth-section")?.classList.add("hidden");
    $("admin-dashboard")?.classList.remove("hidden");

    loadProfile();
    await loadComplaints();

    try {
      const pinStatus = await callFunction(RECOVERY_FUNCTION, {
        action: "check_pin_status"
      });

      if (pinStatus.pinConfigured !== true) {
        await showRecoveryPinSetup();
      }
    } catch (error) {
      showMessage("Recovery PIN status check nahi ho saka: " + error.message);
    }

    return true;
  }

  // LOGIN
  loginForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const email = $("admin-email-login")?.value.trim().toLowerCase();
    const password = $("admin-password-login")?.value;

    if (!email || !password) {
      showMessage("Email aur password dono bharo.");
      return;
    }

    const button = loginForm.querySelector("[type='submit']");
    setButtonBusy(button, true, "Logging in...");

    try {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      await verifyAdmin(data.user);

    } catch (error) {
      showMessage("Login nahi hua: " + error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });

  // REQUEST ADMIN ACCESS
  registerForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const name = $("admin-name")?.value.trim();
    const email = $("admin-email")?.value.trim().toLowerCase();
    const username = $("admin-username")?.value.trim().toLowerCase();
    const mobile = $("admin-mobile")?.value.trim();
    const department = $("admin-department")?.value.trim();
    const reason = $("admin-reason")?.value.trim();
    const password = $("admin-create-password")?.value;
    const confirmPassword = $("admin-confirm-password")?.value;

    if (!name || !email || !username || !mobile || !department ||
        !reason || !password || !confirmPassword) {
      showMessage("Saari required details bharo.");
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      showMessage("Username 3-30 characters ka hona chahiye. Sirf small letters, numbers aur underscore use karo.");
      return;
    }

    if (password.length < 8) {
      showMessage("Password kam se kam 8 characters ka hona chahiye.");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Dono passwords match nahi kar rahe.");
      return;
    }

    const button = registerForm.querySelector("[type='submit']");
    setButtonBusy(button, true, "Submitting...");

    try {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            username
          }
        }
      });

      if (error) {
        if (/already|registered/i.test(error.message)) {
          throw new Error("Is email ka account pehle se bana hua hai. Admin Login use karein.");
        }
        throw error;
      }

      if (!data.user) {
        throw new Error("Account create nahi hua. Dobara try karo.");
      }

      const { error: requestError } = await db
        .from("admin_requests")
        .insert({
          user_id: data.user.id,
          full_name: name,
          email,
          username,
          contact_number: mobile,
          department,
          reason,
          status: "pending"
        });

      if (requestError) {
        throw new Error("Account create ho gaya, lekin Admin request submit nahi hui: " + requestError.message);
      }

      showMessage("Admin access request submit ho gayi. Super Admin approval ka wait karein.");

      registerForm.reset();
      showAuthTab("login");

    } catch (error) {
      showMessage("Registration error: " + error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });

  // LOAD COMPLAINTS
  async function loadComplaints() {
    const generalBody = $("complaints-table-body");
    const confidentialBody = $("confidential-complaints-table-body");

    if (generalBody) {
      generalBody.innerHTML = "<tr><td colspan='6'>Loading complaints...</td></tr>";
    }

    if (confidentialBody) {
      confidentialBody.innerHTML = "<tr><td colspan='6'>Loading confidential complaints...</td></tr>";
    }

    const { data, error } = await db
      .from("complaints")
      .select(`
        id,
        complaint_id,
        user_id,
        category,
        title,
        location,
        description,
        status,
        notes,
        created_at,
        updated_at,
        course,
        semester,
        recipient_type,
        recipient_admin_id,
        is_confidential,
        assigned_to
      `)
      .order("created_at", { ascending: false });

    if (error) {
      if (generalBody) {
        generalBody.innerHTML = "<tr><td colspan='6'>Complaints load nahi hui.</td></tr>";
      }

      if (confidentialBody) {
        confidentialBody.innerHTML = "<tr><td colspan='6'>Confidential complaints load nahi hui.</td></tr>";
      }

      showMessage("Complaints error: " + error.message);
      return;
    }

    complaints = data || [];

    // General complaints: visible to every active Admin
    generalComplaints = complaints.filter(c =>
      c.recipient_type === "all_admins" &&
      c.is_confidential === false &&
      !c.recipient_admin_id
    );

    // Confidential complaints: only the selected Admin
    confidentialComplaints = complaints.filter(c =>
      c.recipient_type === "specific_admin" &&
      c.is_confidential === true &&
      c.recipient_admin_id === currentUser?.id
    );

    updateStats();
    renderComplaints();
    renderConfidentialComplaints();

    renderEmailCentre("general");
    renderEmailCentre("confidential");
  }

  // DASHBOARD STATISTICS
  function updateStats() {
    const visibleComplaints = [
      ...generalComplaints,
      ...confidentialComplaints
    ];

    const status = c => String(c.status || "").toLowerCase();

    if ($("total-complaints")) {
      $("total-complaints").textContent = visibleComplaints.length;
    }

    if ($("pending-complaints")) {
      $("pending-complaints").textContent = visibleComplaints.filter(c =>
        ["submitted", "under review"].includes(status(c))
      ).length;
    }

    if ($("progress-complaints")) {
      $("progress-complaints").textContent = visibleComplaints.filter(c =>
        status(c) === "work in progress"
      ).length;
    }

    if ($("resolved-complaints")) {
      $("resolved-complaints").textContent = visibleComplaints.filter(c =>
        status(c) === "solved"
      ).length;
    }
  }

  // GENERAL COMPLAINT FILTERS
  function getFilteredComplaints() {
    const search = $("complaint-search")?.value.toLowerCase() || "";
    const selectedStatus = $("complaint-status-filter")?.value || "all";
    const category = $("complaint-category-filter")?.value || "all";

    return generalComplaints.filter(c => {
      const text = [
        c.complaint_id,
        c.title,
        c.location,
        c.description,
        c.category
      ].join(" ").toLowerCase();

      const statusMatches =
        selectedStatus === "all" ||
        String(c.status || "").toLowerCase() === selectedStatus.toLowerCase();

      const categoryMatches =
        category === "all" || c.category === category;

      return text.includes(search) && statusMatches && categoryMatches;
    });
  }

  // TABLE ROW
  function complaintRow(c) {
    const solved = String(c.status || "").toLowerCase() === "solved";

    return `
      <tr>
        <td>${escapeHTML(c.complaint_id)}</td>
        <td>${escapeHTML(c.category)}</td>
        <td>${escapeHTML(c.location)}</td>
        <td>${escapeHTML(c.created_at ? new Date(c.created_at).toLocaleDateString() : "")}</td>
        <td>${solved ? "✓ " : ""}${escapeHTML(c.status)}</td>
        <td>
          <button type="button" data-view="${escapeHTML(c.id)}">View</button>
        </td>
      </tr>
    `;
  }

  // RENDER GENERAL COMPLAINTS
  function renderComplaints() {
    const tbody = $("complaints-table-body");
    if (!tbody) return;

    const rows = getFilteredComplaints();

    tbody.innerHTML = rows.length
      ? rows.map(complaintRow).join("")
      : "<tr><td colspan='6'>No general complaints found.</td></tr>";
  }

  // RENDER CONFIDENTIAL COMPLAINTS
  function renderConfidentialComplaints() {
    const tbody = $("confidential-complaints-table-body");
    if (!tbody) return;

    tbody.innerHTML = confidentialComplaints.length
      ? confidentialComplaints.map(complaintRow).join("")
      : "<tr><td colspan='6'>No confidential complaints have been sent to your account.</td></tr>";
  }

  $("complaint-search")?.addEventListener("input", renderComplaints);
  $("complaint-status-filter")?.addEventListener("change", renderComplaints);
  $("complaint-category-filter")?.addEventListener("change", renderComplaints);

  // GENERAL COMPLAINT DETAILS
  $("complaints-table-body")?.addEventListener("click", event => {
    const button = event.target.closest("[data-view]");
    if (!button) return;

    selectedComplaint = generalComplaints.find(c => c.id === button.dataset.view);
    if (!selectedComplaint) return;

    $("complaint-details")?.classList.remove("hidden");

    $("complaint-detail-content").innerHTML = `
      <p><strong>Complaint ID:</strong> ${escapeHTML(selectedComplaint.complaint_id)}</p>
      <p><strong>Title:</strong> ${escapeHTML(selectedComplaint.title)}</p>
      <p><strong>Description:</strong> ${escapeHTML(selectedComplaint.description)}</p>
      <p><strong>Category:</strong> ${escapeHTML(selectedComplaint.category)}</p>
      <p><strong>Location:</strong> ${escapeHTML(selectedComplaint.location)}</p>
      <p><strong>Course:</strong> ${escapeHTML(selectedComplaint.course)}</p>
      <p><strong>Semester:</strong> ${escapeHTML(selectedComplaint.semester)}</p>
      <p><strong>Status:</strong> ${escapeHTML(selectedComplaint.status)}</p>
      <p><strong>Type:</strong> General complaint — All Admins</p>
    `;

    $("update-status").value = selectedComplaint.status || "Submitted";
    $("resolution-details").value = selectedComplaint.notes || "";
  });

  // CONFIDENTIAL COMPLAINT DETAILS
  $("confidential-complaints-table-body")?.addEventListener("click", event => {
    const button = event.target.closest("[data-view]");
    if (!button) return;

    selectedConfidentialComplaint = confidentialComplaints.find(
      c => c.id === button.dataset.view
    );

    if (!selectedConfidentialComplaint) return;

    $("confidential-complaint-details")?.classList.remove("hidden");

    $("confidential-complaint-detail-content").innerHTML = `
      <p><strong>Complaint ID:</strong> ${escapeHTML(selectedConfidentialComplaint.complaint_id)}</p>
      <p><strong>Title:</strong> ${escapeHTML(selectedConfidentialComplaint.title)}</p>
      <p><strong>Description:</strong> ${escapeHTML(selectedConfidentialComplaint.description)}</p>
      <p><strong>Category:</strong> ${escapeHTML(selectedConfidentialComplaint.category)}</p>
      <p><strong>Location:</strong> ${escapeHTML(selectedConfidentialComplaint.location)}</p>
      <p><strong>Course:</strong> ${escapeHTML(selectedConfidentialComplaint.course)}</p>
      <p><strong>Semester:</strong> ${escapeHTML(selectedConfidentialComplaint.semester)}</p>
      <p><strong>Status:</strong> ${escapeHTML(selectedConfidentialComplaint.status)}</p>
      <p><strong>Type:</strong> Personal / Confidential complaint</p>
    `;

    $("confidential-update-status").value =
      selectedConfidentialComplaint.status || "Submitted";

    $("confidential-resolution-details").value =
      selectedConfidentialComplaint.notes || "";
  });

  // SAVE COMPLAINT UPDATE
  async function saveComplaintUpdate(complaint, status, notes, button, isConfidential) {
    if (!complaint) {
      showMessage("Pehle complaint ke saamne View dabao.");
      return false;
    }

    if (!["Submitted", "Under Review", "Work in Progress", "Solved"].includes(status)) {
      showMessage("Selected complaint status valid nahi hai.");
      return false;
    }

    if (!notes) {
      showMessage("Progress ya resolution details likhna zaroori hai.");
      return false;
    }

    // Extra client-side ownership check. RLS remains the real security layer.
    if (
      isConfidential &&
      complaint.recipient_admin_id !== currentUser?.id
    ) {
      showMessage("Yeh confidential complaint tumhare Admin account ko assign nahi hai.");
      return false;
    }

    setButtonBusy(button, true, "Saving...");

    try {
      const { error } = await db
        .from("complaints")
        .update({
          status,
          notes,
          updated_at: new Date().toISOString()
        })
        .eq("id", complaint.id);

      if (error) throw error;

      showMessage("Complaint successfully update ho gayi.");
      await loadComplaints();

      if (isConfidential) {
        selectedConfidentialComplaint =
          confidentialComplaints.find(c => c.id === complaint.id) || null;
      } else {
        selectedComplaint =
          generalComplaints.find(c => c.id === complaint.id) || null;
      }

      return true;

    } catch (error) {
      showMessage("Complaint update error: " + error.message);
      return false;
    } finally {
      setButtonBusy(button, false);
    }
  }

  // GENERAL UPDATE FORM
  $("complaint-update-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    await saveComplaintUpdate(
      selectedComplaint,
      $("update-status")?.value,
      $("resolution-details")?.value.trim(),
      event.submitter,
      false
    );
  });

  // CONFIDENTIAL UPDATE FORM
  $("confidential-complaint-update-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    await saveComplaintUpdate(
      selectedConfidentialComplaint,
      $("confidential-update-status")?.value,
      $("confidential-resolution-details")?.value.trim(),
      event.submitter,
      true
    );
  });

  // EMAIL CENTRE
  function renderEmailCentre(type) {
    const isConfidential = type === "confidential";

    const area = $(
      isConfidential
        ? "admin-confidential-email-list-area"
        : "admin-email-list-area"
    );

    if (!area) return;

    const prefix = isConfidential ? "conf-mail" : "mail";
    const heading = isConfidential
      ? "Confidential Complaint Email Centre"
      : "General Complaint Email Centre";

    const description = isConfidential
      ? "Send progress and resolution emails for personal complaints assigned to your Admin account."
      : "All active Admins can send progress and resolution emails for general complaints.";

    area.innerHTML = `
      <div class="email-centre-block">
        <h3>${heading}</h3>
        <p>${description}</p>

        <label for="${prefix}-status-filter">Filter by status</label>
        <select id="${prefix}-status-filter">
          <option value="">All statuses</option>
          <option value="Submitted">Submitted</option>
          <option value="Under Review">Under Review</option>
          <option value="Work in Progress">Work in Progress</option>
          <option value="Solved">Solved</option>
        </select>

        <div class="email-selection-actions">
          <button type="button" id="${prefix}-select-all">Select All Visible</button>
          <button type="button" id="${prefix}-clear-all">Clear Selection</button>
        </div>

        <div id="${prefix}-complaint-list"></div>

        <label for="${prefix}-common-remarks">Progress / Resolution Details</label>
        <textarea id="${prefix}-common-remarks" rows="4"
          placeholder="Write the progress made or action taken..."></textarea>

        <button type="button" id="${prefix}-send-button" class="primary-btn">
          Send Email to Selected Students
        </button>

        <p id="${prefix}-result" role="status" aria-live="polite"></p>
      </div>
    `;

    renderEmailList(type);

    $(`${prefix}-status-filter`)?.addEventListener("change", () => {
      renderEmailList(type);
    });

    $(`${prefix}-select-all`)?.addEventListener("click", () => {
      area.querySelectorAll(".mail-complaint-check").forEach(item => {
        item.checked = true;
      });
    });

    $(`${prefix}-clear-all`)?.addEventListener("click", () => {
      area.querySelectorAll(".mail-complaint-check").forEach(item => {
        item.checked = false;
      });
    });

    $(`${prefix}-send-button`)?.addEventListener("click", () => {
      sendSelectedEmails(type);
    });
  }

  function renderEmailList(type) {
    const isConfidential = type === "confidential";
    const prefix = isConfidential ? "conf-mail" : "mail";

    const area = $(
      isConfidential
        ? "admin-confidential-email-list-area"
        : "admin-email-list-area"
    );

    const list = $(`${prefix}-complaint-list`);
    if (!list || !area) return;

    const status = $(`${prefix}-status-filter`)?.value || "";

    const source = isConfidential
      ? confidentialComplaints
      : generalComplaints;

    const rows = source.filter(c =>
      !status || c.status === status
    );

    list.innerHTML = rows.length
      ? rows.map(c => `
          <label class="mail-complaint-option">
            <input type="checkbox"
              class="mail-complaint-check"
              value="${escapeHTML(c.id)}">

            <span>
              <strong>${escapeHTML(c.complaint_id)}</strong> —
              ${escapeHTML(c.title || c.category || "Complaint")}
              <small>Status: ${escapeHTML(c.status)}</small>
            </span>
          </label>
        `).join("")
      : "<p>No complaints found.</p>";
  }

  // SEND EMAILS
  async function sendSelectedEmails(type) {
    const isConfidential = type === "confidential";
    const prefix = isConfidential ? "conf-mail" : "mail";

    const area = $(
      isConfidential
        ? "admin-confidential-email-list-area"
        : "admin-email-list-area"
    );

    const resultElement = $(`${prefix}-result`);
    const button = $(`${prefix}-send-button`);
    const remarks = $(`${prefix}-common-remarks`)?.value.trim() || "";

    const selectedIds = [
      ...(area?.querySelectorAll(".mail-complaint-check:checked") || [])
    ].map(item => item.value);

    if (!selectedIds.length) {
      showMessage("Kam se kam ek complaint select karo.");
      return;
    }

    if (!remarks) {
      showMessage("Email bhejne se pehle progress ya resolution details likho.");
      return;
    }

    const source = isConfidential
      ? confidentialComplaints
      : generalComplaints;

    const selectedComplaints = selectedIds
      .map(id => source.find(c => c.id === id))
      .filter(Boolean);

    if (!selectedComplaints.length) {
      showMessage("Selected complaint records nahi mile. Page refresh karke dobara try karo.");
      return;
    }

    // Prevent sending a confidential complaint through the general section.
    if (
      isConfidential &&
      selectedComplaints.some(c => c.recipient_admin_id !== currentUser?.id)
    ) {
      showMessage("Confidential complaint ownership verification failed.");
      return;
    }

    if (
      !isConfidential &&
      selectedComplaints.some(c =>
        c.recipient_type !== "all_admins" ||
        c.is_confidential !== false ||
        c.recipient_admin_id
      )
    ) {
      showMessage("General complaint verification failed.");
      return;
    }

    if (!confirm(
      `${selectedComplaints.length} student(s) ko ${isConfidential ? "confidential" : "general"} complaint update email bhejni hai?`
    )) {
      return;
    }

    setButtonBusy(button, true, "Sending emails...");

    if (resultElement) {
      resultElement.textContent = "Email sending started...";
    }

    let sent = 0;
    const failed = [];

    try {
      for (const complaint of selectedComplaints) {
        try {
          await callFunction(EMAIL_FUNCTION, {
            action: "complaint_progress",
            complaint_uuid: complaint.id,
            progress_level: complaint.status || "Submitted",
            resolution_details: remarks
          });

          sent++;

        } catch (error) {
          failed.push(`${complaint.complaint_id}: ${error.message}`);
        }
      }

      let message = `${sent} email(s) successfully sent.`;

      if (failed.length) {
        message += ` ${failed.length} email(s) failed:\n${failed.join("\n")}`;
      }

      if (resultElement) {
        resultElement.textContent = message;
      } else {
        showMessage(message);
      }

    } finally {
      setButtonBusy(button, false);
    }
  }

  // ADMIN PROFILE
  function loadProfile() {
    if (!currentProfile) return;

    if ($("profile-admin-id")) {
      $("profile-admin-id").textContent = currentProfile.id;
    }

    if ($("profile-admin-name")) {
      $("profile-admin-name").textContent = currentProfile.full_name || "";
    }

    if ($("profile-admin-email")) {
      $("profile-admin-email").textContent = currentProfile.email || "";
    }

    if ($("profile-admin-department")) {
      $("profile-admin-department").textContent = currentProfile.department || "";
    }

    if ($("profile-admin-status")) {
      $("profile-admin-status").textContent = "Active";
    }
  }

  // DASHBOARD NAVIGATION
  document.querySelectorAll(".nav-btn[data-section]").forEach(button => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.section;

      document.querySelectorAll(".dashboard-panel").forEach(section => {
        section.classList.add("hidden");
      });

      $(targetId)?.classList.remove("hidden");

      document.querySelectorAll(".nav-btn").forEach(nav => {
        nav.classList.toggle("active", nav === button);
      });
    });
  });

  // LOGOUT
  $("admin-logout")?.addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.reload();
  });

  // RESTORE SESSION
  const { data } = await db.auth.getSession();

  if (data.session?.user) {
    await verifyAdmin(data.session.user);
  }
});
