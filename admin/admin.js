
document.addEventListener("DOMContentLoaded", async () => {
  const db = window.supabaseClient;
  const $ = id => document.getElementById(id);

  const RECOVERY_FUNCTION = "admin-account-recovery";
  const EMAIL_FUNCTION = "ltsu-campus-email";

  let currentUser = null;
  let currentProfile = null;
  let complaints = [];
  let selectedComplaint = null;

  if (!db) {
    alert("Supabase connection nahi mila. supabase-config.js check karo.");
    return;
  }

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
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

  // RECOVERY
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
        if ($("admin-email-login")) $("admin-email-login").value = email;
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
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,.78);display:flex;
      align-items:center;justify-content:center;padding:18px;
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
      const { data, error } = await db.auth.signInWithPassword({ email, password });
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

    if (!name || !email || !username || !mobile || !department || !reason || !password || !confirmPassword) {
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
          data: { full_name: name, username }
        }
      });

      if (error) {
        if (/already|registered/i.test(error.message)) {
          throw new Error("Is email ka account pehle se bana hua hai. Admin Login use karein.");
        }
        throw error;
      }

      if (!data.user) throw new Error("Account create nahi hua. Dobara try karo.");

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
    const tbody = $("complaints-table-body");
    if (tbody) tbody.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>";

    const { data, error } = await db
      .from("complaints")
      .select("id,complaint_id,user_id,category,title,location,description,status,notes,created_at,course,semester")
      .order("created_at", { ascending: false });

    if (error) {
      if (tbody) tbody.innerHTML = "<tr><td colspan='6'>Complaints load nahi hui.</td></tr>";
      showMessage("Complaints error: " + error.message);
      return;
    }

    complaints = data || [];
    updateStats();
    renderComplaints();
    renderEmailCentre();
  }

  function updateStats() {
    const status = c => String(c.status || "").toLowerCase();

    if ($("total-complaints")) $("total-complaints").textContent = complaints.length;

    if ($("pending-complaints")) {
      $("pending-complaints").textContent =
        complaints.filter(c => ["submitted", "under review"].includes(status(c))).length;
    }

    if ($("progress-complaints")) {
      $("progress-complaints").textContent =
        complaints.filter(c => status(c) === "work in progress").length;
    }

    if ($("resolved-complaints")) {
      $("resolved-complaints").textContent =
        complaints.filter(c => status(c) === "solved").length;
    }
  }

  function getFilteredComplaints() {
    const search = $("complaint-search")?.value.toLowerCase() || "";
    const selectedStatus = $("complaint-status-filter")?.value || "";
    const category = $("complaint-category-filter")?.value || "";

    return complaints.filter(c => {
      const text = [c.complaint_id, c.title, c.location, c.description, c.category]
        .join(" ").toLowerCase();

      const statusMatches = !selectedStatus ||
        selectedStatus.toLowerCase() === "all" ||
        String(c.status || "").toLowerCase() === selectedStatus.toLowerCase();

      return text.includes(search) && statusMatches &&
        (!category || category.toLowerCase() === "all" || c.category === category);
    });
  }

  function renderComplaints() {
    const tbody = $("complaints-table-body");
    if (!tbody) return;

    const rows = getFilteredComplaints();

    if (!rows.length) {
      tbody.innerHTML = "<tr><td colspan='6'>No complaints found.</td></tr>";
      return;
    }

    tbody.innerHTML = rows.map(c => {
      const solved = String(c.status || "").toLowerCase() === "solved";
      return `
        <tr>
          <td>${escapeHTML(c.complaint_id)}</td>
          <td>${escapeHTML(c.category)}</td>
          <td>${escapeHTML(c.location)}</td>
          <td>${escapeHTML(c.created_at ? new Date(c.created_at).toLocaleDateString() : "")}</td>
          <td>${solved ? "✓ " : ""}${escapeHTML(c.status)}</td>
          <td><button type="button" data-view="${escapeHTML(c.complaint_id)}">View</button></td>
        </tr>
      `;
    }).join("");
  }

  $("complaint-search")?.addEventListener("input", renderComplaints);
  $("complaint-status-filter")?.addEventListener("change", renderComplaints);
  $("complaint-category-filter")?.addEventListener("change", renderComplaints);

  $("complaints-table-body")?.addEventListener("click", event => {
    const button = event.target.closest("[data-view]");
    if (!button) return;

    selectedComplaint = complaints.find(c => c.complaint_id === button.dataset.view);
    if (!selectedComplaint) return;

    $("complaint-details")?.classList.remove("hidden");

    $("complaint-detail-content").innerHTML = `
      <p><b>Complaint ID:</b> ${escapeHTML(selectedComplaint.complaint_id)}</p>
      <p><b>Title:</b> ${escapeHTML(selectedComplaint.title)}</p>
      <p><b>Description:</b> ${escapeHTML(selectedComplaint.description)}</p>
      <p><b>Category:</b> ${escapeHTML(selectedComplaint.category)}</p>
      <p><b>Location:</b> ${escapeHTML(selectedComplaint.location)}</p>
      <p><b>Status:</b> ${escapeHTML(selectedComplaint.status)}</p>
    `;

    $("update-status").value = selectedComplaint.status || "Submitted";
    $("resolution-details").value = selectedComplaint.notes || "";
  });

  // UPDATE COMPLAINT STATUS
  $("complaint-update-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!selectedComplaint) {
      showMessage("Pehle complaint ke saamne View dabao.");
      return;
    }

    const status = $("update-status")?.value;
    const notes = $("resolution-details")?.value.trim();

    if (!["Submitted", "Under Review", "Work in Progress", "Solved"].includes(status)) {
      showMessage("Selected complaint status valid nahi hai.");
      return;
    }
    if (!notes) {
      showMessage("Progress ya resolution details likhna zaroori hai.");
      return;
    }

    const button = event.submitter;
    setButtonBusy(button, true, "Saving...");

    try {
      const { error } = await db
        .from("complaints")
        .update({
          status,
          notes,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedComplaint.id);

      if (error) throw error;

      showMessage("Complaint update ho gayi. Student ko email bhejne ke liye Email Centre open karein.");
      await loadComplaints();

      selectedComplaint = complaints.find(c => c.id === selectedComplaint?.id) || null;
    } catch (error) {
      showMessage("Complaint update error: " + error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });

  // EMAIL CENTRE
  function renderEmailCentre() {
    const area = $("admin-email-list-area");
    if (!area) return;

    area.innerHTML = `
      <h3>Student Complaint Email Centre</h3>
      <p>Select complaints and send their students an update. Student email addresses are fetched automatically.</p>

      <label for="mail-status-filter">Filter by status</label>
      <select id="mail-status-filter">
        <option value="">All statuses</option>
        <option value="Submitted">Submitted</option>
        <option value="Under Review">Under Review</option>
        <option value="Work in Progress">Work in Progress</option>
        <option value="Solved">Solved</option>
      </select>

      <div class="email-selection-actions">
        <button type="button" id="mail-select-all">Select All Visible</button>
        <button type="button" id="mail-clear-all">Clear Selection</button>
      </div>

      <div id="mail-complaint-list"></div>

      <label for="mail-common-remarks">Progress / Resolution Details</label>
      <textarea id="mail-common-remarks" rows="4"
        placeholder="Write the progress made or action taken for the selected complaints..."></textarea>

      <button type="button" id="mail-send-button" class="primary-btn">
        Send Email to Selected Students
      </button>
      <p id="mail-result" role="status" aria-live="polite"></p>
    `;

    renderEmailList();

    $("mail-status-filter")?.addEventListener("change", renderEmailList);

    $("mail-select-all")?.addEventListener("click", () => {
      document.querySelectorAll(".mail-complaint-check").forEach(item => {
        item.checked = true;
      });
    });

    $("mail-clear-all")?.addEventListener("click", () => {
      document.querySelectorAll(".mail-complaint-check").forEach(item => {
        item.checked = false;
      });
    });

    $("mail-send-button")?.addEventListener("click", sendSelectedEmails);
  }

  function renderEmailList() {
    const list = $("mail-complaint-list");
    if (!list) return;

    const status = $("mail-status-filter")?.value || "";
    const rows = complaints.filter(c => !status || c.status === status);

    list.innerHTML = rows.length ? rows.map(c => `
      <label class="mail-complaint-option">
        <input type="checkbox" class="mail-complaint-check"
          value="${escapeHTML(c.id)}">
        <span>
          <strong>${escapeHTML(c.complaint_id)}</strong> —
          ${escapeHTML(c.title || c.category || "Complaint")}
          <small>Status: ${escapeHTML(c.status)}</small>
        </span>
      </label>
    `).join("") : "<p>No complaints found.</p>";
  }

  // SEND EMAILS THROUGH SUPABASE EDGE FUNCTION
  async function sendSelectedEmails() {
    const selectedIds = [...document.querySelectorAll(".mail-complaint-check:checked")]
      .map(item => item.value);

    const resultElement = $("mail-result");
    const button = $("mail-send-button");
    const remarks = $("mail-common-remarks")?.value.trim() || "";

    if (!selectedIds.length) {
      showMessage("Kam se kam ek complaint select karo.");
      return;
    }

    if (!remarks) {
      showMessage("Email bhejne se pehle progress ya resolution details likho.");
      return;
    }

    const selectedComplaints = selectedIds
      .map(id => complaints.find(c => c.id === id))
      .filter(Boolean);

    if (!selectedComplaints.length) {
      showMessage("Selected complaint records nahi mile. Page refresh karke dobara try karo.");
      return;
    }

    if (!confirm(`${selectedComplaints.length} student(s) ko complaint update email bhejni hai?`)) {
      return;
    }

    setButtonBusy(button, true, "Sending emails...");
    if (resultElement) resultElement.textContent = "Email sending started...";

    let sent = 0;
    const failed = [];

    try {
      for (const complaint of selectedComplaints) {
        try {
          const response = await callFunction(EMAIL_FUNCTION, {
            action: "complaint_progress",
            complaint_uuid: complaint.id,
            progress_level: complaint.status || "Submitted",
            resolution_details: remarks
          });

          if (!response.success) {
            throw new Error(response.message || "Email sending failed.");
          }

          sent++;
        } catch (error) {
          failed.push(`${complaint.complaint_id}: ${error.message}`);
        }
      }

      let message = `${sent} email(s) successfully sent.`;

      if (failed.length) {
        message += ` ${failed.length} email(s) failed:\n${failed.join("\n")}`;
      }

      if (resultElement) resultElement.textContent = message;
      else showMessage(message);

    } finally {
      setButtonBusy(button, false);
    }
  }

  // PROFILE
  function loadProfile() {
    if (!currentProfile) return;

    if ($("profile-admin-id")) $("profile-admin-id").textContent = currentProfile.id;
    if ($("profile-admin-name")) $("profile-admin-name").textContent = currentProfile.full_name || "";
    if ($("profile-admin-email")) $("profile-admin-email").textContent = currentProfile.email || "";
    if ($("profile-admin-department")) $("profile-admin-department").textContent = currentProfile.department || "";
    if ($("profile-admin-status")) $("profile-admin-status").textContent = "Active";
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
