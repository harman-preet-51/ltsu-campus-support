
document.addEventListener("DOMContentLoaded", async () => {
  const db = window.supabaseClient;
  const $ = id => document.getElementById(id);

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwhM-icfed2rd2xA_aFwIFTpXGQourymAtY4xPnVV5eWFpk6yc5mDYv6_Dg3pXtLG_XTw/exec";
  const RECOVERY_FUNCTION = "admin-account-recovery";

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

  async function callRecoveryFunction(payload) {
    const { data, error } = await db.functions.invoke(
      RECOVERY_FUNCTION,
      { body: payload }
    );

    if (error) {
      let message = error.message || "Recovery request failed.";
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

  // AUTH TABS
  const loginForm = $("admin-login-form");
  const registerForm = $("admin-register-form");
  const authSection = document.querySelector(".auth-section");

  function showAuthTab(tab) {
    const showLogin = tab === "login";

    if (loginForm) {
      loginForm.hidden = !showLogin;
      loginForm.classList.toggle("hidden", !showLogin);
    }

    if (registerForm) {
      registerForm.hidden = showLogin;
      registerForm.classList.toggle("hidden", showLogin);
    }

    const recoveryPanel = $("admin-recovery-panel");
    if (recoveryPanel) recoveryPanel.classList.add("hidden");

    document.querySelectorAll(".auth-tabs button, .auth-tabs [role='tab']").forEach(button => {
      const label = (button.textContent || "").toLowerCase();
      const isLogin = label.includes("login") || label.includes("sign in");
      const isRegister = label.includes("request") || label.includes("register") || label.includes("access");

      if (isLogin || isRegister) {
        button.classList.toggle("active", showLogin ? isLogin : isRegister);
        button.setAttribute("aria-selected", String(showLogin ? isLogin : isRegister));
      }
    });
  }

  showAuthTab("login");

  document.addEventListener("click", event => {
    const button = event.target.closest(".auth-tabs button, .auth-tabs [role='tab'], [data-auth-tab]");
    if (!button) return;

    const label = (
      (button.dataset.authTab || "") + " " +
      (button.dataset.tab || "") + " " +
      (button.textContent || "")
    ).toLowerCase();

    if (label.includes("request") || label.includes("register") || label.includes("access") || label.includes("sign up")) {
      event.preventDefault();
      showAuthTab("register");
    } else if (label.includes("login") || label.includes("sign in")) {
      event.preventDefault();
      showAuthTab("login");
    }
  });

  // ADD USERNAME FIELD TO REGISTRATION
  if (registerForm && !$("admin-username")) {
    const usernameWrap = document.createElement("div");
    usernameWrap.innerHTML = `
      <label for="admin-username">Username</label>
      <input
        type="text"
        id="admin-username"
        name="username"
        minlength="3"
        maxlength="30"
        autocomplete="username"
        placeholder="Choose a unique username"
        required
        style="width:100%;padding:11px;margin:6px 0 14px;box-sizing:border-box"
      >
      <small>Username mein letters, numbers aur underscore use kar sakte hain.</small>
    `;

    const emailField = $("admin-email");
    if (emailField?.parentElement) {
      emailField.parentElement.after(usernameWrap);
    } else {
      registerForm.prepend(usernameWrap);
    }
  }

  // FORGOT PASSWORD PANEL
  if (authSection && !$("admin-recovery-panel")) {
    const panel = document.createElement("section");
    panel.id = "admin-recovery-panel";
    panel.className = "hidden";
    panel.style.cssText = "max-width:480px;margin:20px auto;padding:22px;border:1px solid #ddd;border-radius:12px;background:white;color:#222";

    panel.innerHTML = `
      <h2>Admin Password Recovery</h2>
      <p>Apna registered username, email aur 6-digit Recovery PIN enter karein.</p>

      <form id="admin-recovery-form">
        <label for="recovery-username">Registered Username</label>
        <input id="recovery-username" type="text" autocomplete="username" required
          style="width:100%;padding:11px;margin:6px 0 14px;box-sizing:border-box">

        <label for="recovery-email">Registered Email</label>
        <input id="recovery-email" type="email" autocomplete="email" required
          style="width:100%;padding:11px;margin:6px 0 14px;box-sizing:border-box">

        <label for="recovery-pin">6-digit Recovery PIN</label>
        <input id="recovery-pin" type="password" inputmode="numeric" maxlength="6"
          pattern="[0-9]{6}" autocomplete="off" required
          style="width:100%;padding:11px;margin:6px 0 14px;box-sizing:border-box">

        <label for="recovery-new-password">New Password</label>
        <input id="recovery-new-password" type="password" minlength="8"
          autocomplete="new-password" required
          style="width:100%;padding:11px;margin:6px 0 14px;box-sizing:border-box">

        <label for="recovery-confirm-password">Confirm New Password</label>
        <input id="recovery-confirm-password" type="password" minlength="8"
          autocomplete="new-password" required
          style="width:100%;padding:11px;margin:6px 0 14px;box-sizing:border-box">

        <button type="submit" id="recovery-submit"
          style="width:100%;padding:12px;cursor:pointer">Reset Password</button>

        <button type="button" id="recovery-back"
          style="width:100%;padding:11px;margin-top:10px;cursor:pointer">Back to Login</button>

        <p id="recovery-result" role="status"></p>
      </form>
    `;

    authSection.appendChild(panel);
  }

  const loginPanel = $("admin-login-panel") || loginForm?.parentElement;

  if (loginPanel && !$("admin-forgot-password")) {
    const forgotButton = document.createElement("button");
    forgotButton.type = "button";
    forgotButton.id = "admin-forgot-password";
    forgotButton.textContent = "Forgot Password?";
    forgotButton.style.cssText = "display:block;margin:12px auto;padding:9px 14px;cursor:pointer";
    loginPanel.appendChild(forgotButton);
  }

  $("admin-forgot-password")?.addEventListener("click", () => {
    if (loginForm) {
      loginForm.hidden = true;
      loginForm.classList.add("hidden");
    }

    if (registerForm) {
      registerForm.hidden = true;
      registerForm.classList.add("hidden");
    }

    $("admin-recovery-panel")?.classList.remove("hidden");
  });

  $("recovery-back")?.addEventListener("click", () => {
    showAuthTab("login");
  });

  // RECOVER PASSWORD
  $("admin-recovery-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    const username = $("recovery-username").value.trim().toLowerCase();
    const email = $("recovery-email").value.trim().toLowerCase();
    const pin = $("recovery-pin").value.trim();
    const newPassword = $("recovery-new-password").value;
    const confirmPassword = $("recovery-confirm-password").value;
    const button = $("recovery-submit");
    const result = $("recovery-result");

    if (!username || !email || !pin || !newPassword || !confirmPassword) {
      showMessage("Saari details bharo.");
      return;
    }

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
      await callRecoveryFunction({
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

  // FIRST LOGIN: RECOVERY PIN SETUP
  async function showRecoveryPinSetup() {
    const existing = $("admin-pin-setup-panel");
    if (existing) existing.remove();

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
        <p>Account recovery ke liye apna 6-digit PIN set karein. Is PIN ko safe jagah yaad rakhein.</p>

        <form id="admin-pin-setup-form">
          <label for="admin-new-pin">Create 6-digit PIN</label>
          <input id="admin-new-pin" type="password" inputmode="numeric"
            maxlength="6" pattern="[0-9]{6}" autocomplete="off" required
            style="width:100%;padding:12px;margin:8px 0 15px;box-sizing:border-box">

          <label for="admin-confirm-pin">Confirm 6-digit PIN</label>
          <input id="admin-confirm-pin" type="password" inputmode="numeric"
            maxlength="6" pattern="[0-9]{6}" autocomplete="off" required
            style="width:100%;padding:12px;margin:8px 0 15px;box-sizing:border-box">

          <button id="admin-save-pin" type="submit"
            style="width:100%;padding:12px;cursor:pointer">Save Recovery PIN</button>

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
        await callRecoveryFunction({
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

  // VERIFY ADMIN ACCOUNT
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

    document.querySelector(".auth-section")?.classList.add("hidden");
    $("admin-dashboard")?.classList.remove("hidden");

    loadProfile();
    await loadComplaints();

    try {
      const pinStatus = await callRecoveryFunction({
        action: "check_pin_status"
      });

      if (pinStatus.pinConfigured !== true) {
        await showRecoveryPinSetup();
      }
    } catch (error) {
      showMessage(
        "Recovery PIN status check nahi ho saka: " + error.message +
        "\nDashboard open hai, lekin recovery setup verify nahi hua."
      );
    }

    return true;
  }

  // ADMIN LOGIN
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

    if (!name || !email || !username || !mobile || !department || !password || !confirmPassword) {
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
        if (error.message.toLowerCase().includes("already") ||
            error.message.toLowerCase().includes("registered")) {
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
        throw new Error(
          "Account create ho gaya, lekin Admin request submit nahi hui: " +
          requestError.message
        );
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

  // COMPLAINTS
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

    if ($("total-complaints")) {
      $("total-complaints").textContent = complaints.length;
    }

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
      const text = [
        c.complaint_id, c.title, c.location, c.description, c.category
      ].join(" ").toLowerCase();

      const statusMatches =
        !selectedStatus ||
        selectedStatus.toLowerCase() === "all" ||
        String(c.status || "").toLowerCase() === selectedStatus.toLowerCase();

      return text.includes(search) &&
        statusMatches &&
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

    if ($("complaint-detail-content")) {
      $("complaint-detail-content").innerHTML = `
        <p><b>Complaint ID:</b> ${escapeHTML(selectedComplaint.complaint_id)}</p>
        <p><b>Title:</b> ${escapeHTML(selectedComplaint.title)}</p>
        <p><b>Description:</b> ${escapeHTML(selectedComplaint.description)}</p>
        <p><b>Category:</b> ${escapeHTML(selectedComplaint.category)}</p>
        <p><b>Location:</b> ${escapeHTML(selectedComplaint.location)}</p>
        <p><b>Status:</b> ${escapeHTML(selectedComplaint.status)}</p>
      `;
    }

    if ($("update-status")) {
      $("update-status").value = selectedComplaint.status || "Submitted";
    }

    if ($("resolution-details")) {
      $("resolution-details").value = selectedComplaint.notes || "";
    }
  });

  // UPDATE COMPLAINT
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

    const { error } = await db
      .from("complaints")
      .update({
        status,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq("id", selectedComplaint.id);

    if (error) {
      showMessage("Complaint update error: " + error.message);
      return;
    }

    showMessage("Complaint update ho gayi.");
    await loadComplaints();
  });

  // EMAIL CENTRE
  function renderEmailCentre() {
    const section = $("email-section");
    if (!section) return;

    let area = $("admin-email-list-area");

    if (!area) {
      area = document.createElement("div");
      area.id = "admin-email-list-area";
      section.appendChild(area);
    }

    area.innerHTML = `
      <h2>Student Complaint Email Centre</h2>
      <p>Select complaints to send individual emails to students.</p>

      <label for="mail-status-filter">Filter by status</label>
      <select id="mail-status-filter">
        <option value="">All statuses</option>
        <option value="Submitted">Submitted</option>
        <option value="Under Review">Under Review</option>
        <option value="Work in Progress">Work in Progress</option>
        <option value="Solved">Solved</option>
      </select>

      <label for="mail-subject">Email subject</label>
      <input id="mail-subject" value="Update on your LTSUCare complaint">

      <div id="mail-complaint-list"></div>

      <label for="mail-common-remarks">Remarks</label>
      <textarea id="mail-common-remarks" rows="4"
        placeholder="Write update for selected students"></textarea>

      <button type="button" id="mail-send-button">Send Email to Selected Students</button>
      <p id="mail-result"></p>
    `;

    renderEmailList();
    $("mail-status-filter")?.addEventListener("change", renderEmailList);
    $("mail-send-button")?.addEventListener("click", sendSelectedEmails);
  }

  function renderEmailList() {
    const list = $("mail-complaint-list");
    if (!list) return;

    const status = $("mail-status-filter")?.value || "";
    const rows = complaints.filter(c => !status || c.status === status);

    list.innerHTML = rows.length ? rows.map(c => `
      <label style="display:block;padding:10px;border-bottom:1px solid #ddd">
        <input type="checkbox" class="mail-complaint-check"
          value="${escapeHTML(c.complaint_id)}">
        ${escapeHTML(c.complaint_id)} — ${escapeHTML(c.title || c.category)}
        (${escapeHTML(c.status)})
      </label>
    `).join("") : "<p>No complaints found.</p>";
  }

  async function sendSelectedEmails() {
    const selected = [...document.querySelectorAll(".mail-complaint-check:checked")]
      .map(item => item.value);

    if (!selected.length) {
      showMessage("Kam se kam ek complaint select karo.");
      return;
    }

    const { data } = await db.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      showMessage("Login session expire ho gaya. Dobara login karo.");
      return;
    }

    const remarksText = $("mail-common-remarks")?.value.trim() || "";
    const remarks = {};
    selected.forEach(id => remarks[id] = remarksText);

    const button = $("mail-send-button");
    button.disabled = true;
    button.textContent = "Sending...";

    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          type: "resolution_email",
          accessToken,
          complaintIds: selected,
          remarks,
          subject: $("mail-subject")?.value.trim()
        })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.message || "Email sending failed");

      $("mail-result").textContent = "Email request successful.";
    } catch (error) {
      $("mail-result").textContent = "Error: " + error.message;
    } finally {
      button.disabled = false;
      button.textContent = "Send Email to Selected Students";
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

  // SIDEBAR NAVIGATION
  document.querySelectorAll(".nav-btn[data-section]").forEach(button => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.section;

      document.querySelectorAll(".dashboard-panel, .page-section, .admin-section").forEach(section => {
        section.classList.add("hidden");
      });

      $(targetId)?.classList.remove("hidden");
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
