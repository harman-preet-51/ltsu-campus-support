document.addEventListener("DOMContentLoaded", async () => {
  const db = window.supabaseClient;
  const $ = id => document.getElementById(id);

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwhM-icfed2rd2xA_aFwIFTpXGQourymAtY4xPnVV5eWFpk6yc5mDYv6_Dg3pXtLG_XTw/exec";

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

  function showMessage(text) {
    alert(text);
  }

  // LOGIN / REQUEST ACCESS TABS
  const loginForm = $("admin-login-form");
  const registerForm = $("admin-register-form");

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

  // VERIFY ADMIN ACCOUNT
  async function verifyAdmin(user) {
    const { data: profile, error } = await db
      .from("profiles")
      .select("id,full_name,email,role,department,is_active")
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

    const submitButton = loginForm.querySelector("[type='submit']");
    if (submitButton) submitButton.disabled = true;

    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (submitButton) submitButton.disabled = false;

    if (error) {
      showMessage("Login nahi hua: " + error.message + "\nEmail aur password check karo.");
      return;
    }

    await verifyAdmin(data.user);
  });

  // REQUEST ADMIN ACCESS
  registerForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const name = $("admin-name")?.value.trim();
    const email = $("admin-email")?.value.trim().toLowerCase();
    const mobile = $("admin-mobile")?.value.trim();
    const department = $("admin-department")?.value.trim();
    const reason = $("admin-reason")?.value.trim();
    const password = $("admin-create-password")?.value;
    const confirmPassword = $("admin-confirm-password")?.value;

    if (!name || !email || !mobile || !department || !password || !confirmPassword) {
      showMessage("Saari details bharo.");
      return;
    }

    if (password.length < 6) {
      showMessage("Password kam se kam 6 characters ka hona chahiye.");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Dono passwords match nahi kar rahe.");
      return;
    }

    const submitButton = registerForm.querySelector("[type='submit']");
    if (submitButton) submitButton.disabled = true;

    try {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name }
        }
      });

      if (error) {
        if (error.message.toLowerCase().includes("already") ||
            error.message.toLowerCase().includes("registered")) {
          showMessage("Is email ka account pehle se bana hua hai. Nayi request banane ke bajay Admin Login karo. Password yaad nahi hai to password reset karna hoga.");
        } else {
          showMessage("Registration error: " + error.message);
        }
        return;
      }

      if (!data.user) {
        showMessage("Account create nahi hua. Dobara try karo.");
        return;
      }

      const { error: requestError } = await db
        .from("admin_requests")
        .insert({
          user_id: data.user.id,
          full_name: name,
          email,
          contact_number: mobile,
          department,
          reason,
          status: "pending"
        });

      if (requestError) {
        showMessage("Account ban gaya, lekin request submit nahi hui: " + requestError.message);
        return;
      }

      showMessage("Admin access request submit ho gayi. Super Admin approval ka wait karein.");
      registerForm.reset();
      showAuthTab("login");

    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  // LOAD COMPLAINTS
  async function loadComplaints() {
    const tbody = $("complaints-table-body");
    if (tbody) tbody.innerHTML = "<tr><td colspan='8'>Loading...</td></tr>";

    const { data, error } = await db
      .from("complaints")
      .select("id,complaint_id,user_id,category,title,location,description,status,notes,created_at,course,semester")
      .order("created_at", { ascending: false });

    if (error) {
      if (tbody) tbody.innerHTML = "<tr><td colspan='8'>Complaints load nahi hui.</td></tr>";
      showMessage("Complaints error: " + error.message);
      return;
    }

    complaints = data || [];
    updateStats();
    renderComplaints();
    renderEmailCentre();
  }

  function updateStats() {
    if ($("total-complaints")) $("total-complaints").textContent = complaints.length;
    if ($("pending-complaints")) $("pending-complaints").textContent =
      complaints.filter(c => (c.status || "").toLowerCase() === "pending").length;
    if ($("progress-complaints")) $("progress-complaints").textContent =
      complaints.filter(c => (c.status || "").toLowerCase() === "in progress").length;
    if ($("resolved-complaints")) $("resolved-complaints").textContent =
      complaints.filter(c => (c.status || "").toLowerCase() === "resolved").length;
  }

  function getFilteredComplaints() {
    const search = $("complaint-search")?.value.toLowerCase() || "";
    const status = $("complaint-status-filter")?.value || "";
    const category = $("complaint-category-filter")?.value || "";

    return complaints.filter(c => {
      const text = [c.complaint_id, c.title, c.location, c.description]
        .join(" ").toLowerCase();

      return text.includes(search) &&
        (!status || c.status === status) &&
        (!category || c.category === category);
    });
  }

  function renderComplaints() {
    const tbody = $("complaints-table-body");
    if (!tbody) return;

    const rows = getFilteredComplaints();

    if (!rows.length) {
      tbody.innerHTML = "<tr><td colspan='8'>No complaints found.</td></tr>";
      return;
    }

    tbody.innerHTML = rows.map(c => `
      <tr>
        <td>${escapeHTML(c.complaint_id)}</td>
        <td>${escapeHTML(c.title || c.description)}</td>
        <td>${escapeHTML(c.category)}</td>
        <td>${escapeHTML(c.location)}</td>
        <td>${escapeHTML(c.status)}</td>
        <td>${escapeHTML(c.created_at ? new Date(c.created_at).toLocaleDateString() : "")}</td>
        <td><button type="button" data-view="${escapeHTML(c.complaint_id)}">View</button></td>
      </tr>
    `).join("");
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

    if ($("update-status")) $("update-status").value = selectedComplaint.status || "Pending";
    if ($("resolution-details")) $("resolution-details").value = selectedComplaint.notes || "";
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
        <option value="Pending">Pending</option>
        <option value="In Progress">In Progress</option>
        <option value="Resolved">Resolved</option>
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

      document.querySelectorAll(".page-section, .admin-section").forEach(section => {
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
