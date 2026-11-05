document.addEventListener("DOMContentLoaded", async () => {
  const db = window.supabaseClient;
  const $ = id => document.getElementById(id);

  if (!db) {
    alert("Supabase connection missing. Check supabase-config.js");
    return;
  }

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwhM-icfed2rd2xA_aFwIFTpXGQourymAtY4xPnVV5eWFpk6yc5mDYv6_Dg3pXtLG_XTw/exec";

  let currentUser = null;
  let currentProfile = null;
  let complaints = [];
  let selectedComplaint = null;

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  })[char]);

  function message(text) {
    alert(text);
  }

  function showDashboard() {
    document.querySelector(".auth-section")?.classList.add("hidden");
    $("admin-dashboard")?.classList.remove("hidden");
    loadComplaints();
    loadProfile();
  }

  async function verifyAdmin(user) {
    const { data, error } = await db
      .from("profiles")
      .select("id,full_name,email,role,department,is_active")
      .eq("id", user.id)
      .single();

    if (error || !data || data.role !== "admin" || data.is_active !== true) {
      await db.auth.signOut();
      message("Admin account approved/active nahi hai. Super Admin se approval check karvao.");
      return false;
    }

    currentUser = user;
    currentProfile = data;
    showDashboard();
    return true;
  }

  // ADMIN LOGIN
  $("admin-login-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    const email = $("admin-email-login")?.value.trim();
    const password = $("admin-password-login")?.value;

    if (!email || !password) return message("Email aur password bharo.");

    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) return message(error.message);

    await verifyAdmin(data.user);
  });

  // ADMIN ACCESS REQUEST
  $("admin-register-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    const name = $("admin-name")?.value.trim();
    const email = $("admin-email")?.value.trim().toLowerCase();
    const mobile = $("admin-mobile")?.value.trim();
    const department = $("admin-department")?.value.trim();
    const reason = $("admin-reason")?.value.trim();
    const password = $("admin-create-password")?.value;
    const confirmPassword = $("admin-confirm-password")?.value;

    if (!name || !email || !mobile || !department || !password) {
      return message("Saari required details bharo.");
    }

    if (password !== confirmPassword) {
      return message("Passwords match nahi kar rahe.");
    }

    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name }
      }
    });

    if (error) return message(error.message);
    if (!data.user) return message("Registration complete nahi hui.");

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
      return message("Account bana, lekin request submit nahi hui: " + requestError.message);
    }

    message("Admin access request submit ho gayi. Super Admin approval ka wait karein.");
    $("admin-register-form").reset();
  });

  // LOAD COMPLAINTS
  async function loadComplaints() {
    const tbody = $("complaints-table-body");
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan='8'>Loading complaints...</td></tr>";

    const { data, error } = await db
      .from("complaints")
      .select("id,complaint_id,user_id,category,title,location,description,status,notes,created_at,course,semester")
      .order("created_at", { ascending: false });

    if (error) {
      tbody.innerHTML = "<tr><td colspan='8'>Unable to load complaints.</td></tr>";
      return message("Complaints load error: " + error.message);
    }

    complaints = data || [];
    updateStats();
    renderComplaints();
    renderEmailCentre();
  }

  function updateStats() {
    const total = complaints.length;
    const pending = complaints.filter(c => c.status?.toLowerCase() === "pending").length;
    const progress = complaints.filter(c => c.status?.toLowerCase() === "in progress").length;
    const resolved = complaints.filter(c => c.status?.toLowerCase() === "resolved").length;

    if ($("total-complaints")) $("total-complaints").textContent = total;
    if ($("pending-complaints")) $("pending-complaints").textContent = pending;
    if ($("progress-complaints")) $("progress-complaints").textContent = progress;
    if ($("resolved-complaints")) $("resolved-complaints").textContent = resolved;
  }

  function filteredComplaints() {
    const search = $("complaint-search")?.value.toLowerCase() || "";
    const status = $("complaint-status-filter")?.value || "";
    const category = $("complaint-category-filter")?.value || "";

    return complaints.filter(c => {
      const matchesSearch = [
        c.complaint_id, c.title, c.location, c.description
      ].join(" ").toLowerCase().includes(search);

      const matchesStatus = !status || c.status === status;
      const matchesCategory = !category || c.category === category;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }

  function renderComplaints() {
    const tbody = $("complaints-table-body");
    if (!tbody) return;

    const rows = filteredComplaints();

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

    if ($("complaint-details")) $("complaint-details").classList.remove("hidden");

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

  // UPDATE COMPLAINT STATUS
  $("complaint-update-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!selectedComplaint) return message("Pehle complaint select karo.");

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

    if (error) return message("Update error: " + error.message);

    message("Complaint update ho gayi.");
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
      <p>Select complaints and send an individual email to each student.</p>

      <label>Filter by status</label>
      <select id="mail-status-filter">
        <option value="">All statuses</option>
        <option value="Pending">Pending</option>
        <option value="In Progress">In Progress</option>
        <option value="Resolved">Resolved</option>
      </select>

      <label>Email subject</label>
      <input id="mail-subject" value="Update on your LTSUCare complaint">

      <div id="mail-complaint-list"></div>

      <label>Common remarks (optional)</label>
      <textarea id="mail-common-remarks" rows="4"
        placeholder="Write the update for selected students"></textarea>

      <button type="button" id="mail-send-button">Send Email to Selected Students</button>
      <p id="mail-result"></p>
    `;

    renderEmailList();

    $("mail-status-filter").addEventListener("change", renderEmailList);
    $("mail-send-button").addEventListener("click", sendSelectedEmails);
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
    const checks = [...document.querySelectorAll(".mail-complaint-check:checked")];
    const complaintIds = checks.map(item => item.value);

    if (!complaintIds.length) return message("Kam se kam ek complaint select karo.");

    const { data: sessionData } = await db.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) return message("Login session expired. Login again.");

    const remarksText = $("mail-common-remarks")?.value.trim() || "";
    const remarks = {};

    complaintIds.forEach(id => {
      remarks[id] = remarksText;
    });

    const button = $("mail-send-button");
    button.disabled = true;
    button.textContent = "Sending...";

    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          type: "resolution_email",
          accessToken,
          complaintIds,
          remarks,
          subject: $("mail-subject")?.value.trim()
        })
      });

      const result = await response.json();

      if (!result.success) throw new Error(result.message || "Email sending failed");

      $("mail-result").textContent =
        "Request accepted. Sent count: " + (result.sent ?? complaintIds.length);
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

  // NAVIGATION
  document.querySelectorAll(".nav-btn[data-section]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".page-section, .admin-section").forEach(section => {
        section.classList.add("hidden");
      });

      const target = $(button.dataset.section);
      target?.classList.remove("hidden");
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
