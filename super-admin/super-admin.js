
document.addEventListener("DOMContentLoaded", async () => {
  const db = window.supabaseClient;
  const $ = id => document.getElementById(id);

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwhM-icfed2rd2xA_aFwIFTpXGQourymAtY4xPnVV5eWFpk6yc5mDYv6_Dg3pXtLG_XTw/exec";

  let currentUser = null;
  let currentProfile = null;
  let adminRequests = [];
  let complaints = [];
  let myPersonalComplaints = [];
  let selectedComplaint = null;
  let selectedPersonalComplaint = null;
  let emailCentreEventsBound = false;

  if (!db) {
    alert("Supabase connection missing. Check supabase-config.js");
    return;
  }

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);

  function showMessage(message) {
    alert(message);
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-IN");
  }

  // ================= SUPER ADMIN LOGIN =================

  async function verifySuperAdmin(user) {
    const { data, error } = await db
      .from("profiles")
      .select("id,full_name,email,role,is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data || data.role !== "super_admin" || data.is_active !== true) {
      await db.auth.signOut();
      showMessage("Super Admin access denied. Active Super Admin account required.");
      return false;
    }

    currentUser = user;
    currentProfile = data;

    $("login-page")?.classList.add("hidden");
    $("dashboard")?.classList.remove("hidden");

    document.querySelectorAll(".admin-label").forEach(element => {
      element.textContent = data.full_name || data.email;
    });

    await Promise.all([
      loadAdminRequests(),
      loadAdminCount(),
      loadStudentCount(),
      loadComplaints(),
      loadMyPersonalComplaints()
    ]);

    await loadActivityLogs();

    return true;
  }

  $("login-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    const email = $("admin-id")?.value.trim().toLowerCase();
    const password = $("admin-pin")?.value;
    const button = $("login-button");

    if (!email || !password) {
      showMessage("Email aur password bharo.");
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Logging in...";
    }

    try {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        showMessage("Login failed: " + error.message);
        return;
      }

      await verifySuperAdmin(data.user);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Login";
      }
    }
  });

  // ================= ADMIN MANAGEMENT =================

  async function loadAdminRequests() {
    const pending = $("pending-admin-list");

    if (pending) {
      pending.innerHTML = `<tr><td colspan="8">Loading admin requests...</td></tr>`;
    }

    const { data, error } = await db
      .from("admin_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (pending) {
        pending.innerHTML = `<tr><td colspan="8">Error: ${escapeHTML(error.message)}</td></tr>`;
      }
      console.error("Admin requests error:", error.message);
      return;
    }

    adminRequests = data || [];
    renderAdminRequests();
    updatePendingRequestCount();
    await loadApprovedAdmins();
  }

  function renderAdminRequests() {
    const pendingBody = $("pending-admin-list");
    const rejectedBody = $("rejected-admin-list");

    const pendingRequests = adminRequests.filter(request =>
      String(request.status || "").toLowerCase() === "pending"
    );

    const rejectedRequests = adminRequests.filter(request =>
      String(request.status || "").toLowerCase() === "rejected"
    );

    if (pendingBody) {
      pendingBody.innerHTML = pendingRequests.length
        ? pendingRequests.map(request => `
            <tr>
              <td>${escapeHTML(request.full_name)}</td>
              <td>${escapeHTML(request.username || "Missing")}</td>
              <td>${escapeHTML(request.email)}</td>
              <td>${escapeHTML(request.contact_number)}</td>
              <td>${escapeHTML(request.department)}</td>
              <td>${escapeHTML(request.reason)}</td>
              <td>${escapeHTML(formatDate(request.created_at))}</td>
              <td>
                <button type="button" data-approve="${escapeHTML(request.id)}">Approve</button>
                <button type="button" data-reject="${escapeHTML(request.id)}">Reject</button>
              </td>
            </tr>
          `).join("")
        : `<tr><td colspan="8">No pending admin requests.</td></tr>`;
    }

    if (rejectedBody) {
      rejectedBody.innerHTML = rejectedRequests.length
        ? rejectedRequests.map(request => `
            <tr>
              <td>${escapeHTML(request.full_name)}</td>
              <td>${escapeHTML(request.username || "—")}</td>
              <td>${escapeHTML(request.email)}</td>
              <td>${escapeHTML(request.department)}</td>
              <td>${escapeHTML(formatDate(request.reviewed_at || request.created_at))}</td>
            </tr>
          `).join("")
        : `<tr><td colspan="5">No rejected requests.</td></tr>`;
    }
  }

  async function loadApprovedAdmins() {
    const tbody = $("approved-admin-list");

    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5">Loading approved admins...</td></tr>`;
    }

    const { data, error } = await db
      .from("profiles")
      .select("id,full_name,username,email,department,is_active")
      .eq("role", "admin")
      .order("full_name", { ascending: true });

    if (error) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5">Error: ${escapeHTML(error.message)}</td></tr>`;
      }
      return;
    }

    if (!tbody) return;

    const admins = data || [];

    tbody.innerHTML = admins.length
      ? admins.map(admin => `
          <tr>
            <td>${escapeHTML(admin.full_name)}</td>
            <td>${escapeHTML(admin.username || "Not assigned")}</td>
            <td>${escapeHTML(admin.email)}</td>
            <td>${escapeHTML(admin.department)}</td>
            <td>${admin.is_active ? "Active" : "Inactive"}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="5">No approved admins found.</td></tr>`;
  }

  function updatePendingRequestCount() {
    const count = adminRequests.filter(request =>
      String(request.status || "").toLowerCase() === "pending"
    ).length;

    if ($("pending-admin-count")) {
      $("pending-admin-count").textContent = count;
    }
  }

  $("admins")?.addEventListener("click", async event => {
    const approveButton = event.target.closest("[data-approve]");
    const rejectButton = event.target.closest("[data-reject]");

    if (approveButton) {
      const request = adminRequests.find(item =>
        String(item.id) === approveButton.dataset.approve
      );

      if (!request) return;

      if (String(request.status).toLowerCase() !== "pending") {
        showMessage("Ye request ab pending nahi hai.");
        return;
      }

      if (!request.user_id) {
        showMessage("Request ke saath User ID nahi mili. Approval possible nahi hai.");
        return;
      }

      const username = String(request.username || "").trim().toLowerCase();

      if (!username) {
        showMessage("Username missing hai. Applicant se username ke saath dobara request submit karvao.");
        return;
      }

      if (!confirm("Kya aap is Admin request ko approve karna chahte hain?\n\nUsername: " + username)) {
        return;
      }

      approveButton.disabled = true;
      approveButton.textContent = "Approving...";

      try {
        const { error: profileError } = await db
          .from("profiles")
          .update({
            role: "admin",
            is_active: true,
            department: request.department,
            username
          })
          .eq("id", request.user_id);

        if (profileError) {
          showMessage("Profile approval error: " + profileError.message);
          return;
        }

        const { error: requestError } = await db
          .from("admin_requests")
          .update({
            status: "approved",
            reviewed_by: currentUser.id,
            reviewed_at: new Date().toISOString()
          })
          .eq("id", request.id);

        if (requestError) {
          showMessage("Profile activate ho gaya, lekin request status update nahi hua. Error: " + requestError.message);
          await loadAdminRequests();
          return;
        }

        showMessage("Admin successfully approved!\nUsername: " + username);
        await loadAdminRequests();
        await loadAdminCount();

      } finally {
        if (approveButton.isConnected) {
          approveButton.disabled = false;
          approveButton.textContent = "Approve";
        }
      }
    }

    if (rejectButton) {
      const request = adminRequests.find(item =>
        String(item.id) === rejectButton.dataset.reject
      );

      if (!request) return;

      if (String(request.status).toLowerCase() !== "pending") {
        showMessage("Ye request ab pending nahi hai.");
        return;
      }

      if (!confirm("Kya aap is Admin request ko reject karna chahte hain?")) {
        return;
      }

      rejectButton.disabled = true;
      rejectButton.textContent = "Rejecting...";

      try {
        const { error } = await db
          .from("admin_requests")
          .update({
            status: "rejected",
            reviewed_by: currentUser.id,
            reviewed_at: new Date().toISOString()
          })
          .eq("id", request.id);

        if (error) {
          showMessage("Reject error: " + error.message);
          return;
        }

        showMessage("Admin request rejected.");
        await loadAdminRequests();

      } finally {
        if (rejectButton.isConnected) {
          rejectButton.disabled = false;
          rejectButton.textContent = "Reject";
        }
      }
    }
  });

  // ================= COUNTS =================

  async function loadAdminCount() {
    const { count, error } = await db
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);

    if (!error && $("admin-count")) {
      $("admin-count").textContent = count ?? 0;
    }
  }

  async function loadStudentCount() {
    const { count, error } = await db
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "student");

    if (!error && $("student-count")) {
      $("student-count").textContent = count ?? 0;
    }
  }

  // ================= NORMAL COMPLAINTS =================

  async function loadComplaints() {
    const { data, error } = await db
      .from("complaints")
      .select("id,complaint_id,user_id,category,title,location,description,status,notes,created_at,recipient_type,is_confidential,forwarded_to_super_admin")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Complaints load error:", error.message);
      complaints = [];
    } else {
      // Personal Super Admin complaints are displayed separately.
      complaints = (data || []).filter(complaint =>
        !(
          complaint.recipient_type === "super_admin" &&
          complaint.is_confidential === true
        )
      );
    }

    renderComplaints();
    renderRecentComplaints();
    updateComplaintStats();
    renderEmailCentre();
  }

  function renderComplaints() {
    const tbody = $("complaint-list");
    if (!tbody) return;

    tbody.innerHTML = complaints.length
      ? complaints.map(complaint => `
          <tr>
            <td>${escapeHTML(complaint.complaint_id)}</td>
            <td>${escapeHTML(complaint.category)}</td>
            <td>${escapeHTML(complaint.title || complaint.description)}</td>
            <td>${escapeHTML(complaint.status)}</td>
            <td>${escapeHTML(formatDate(complaint.created_at))}</td>
            <td>
              <button type="button" data-super-view="${escapeHTML(complaint.id)}">View</button>
            </td>
          </tr>
        `).join("")
      : `<tr><td colspan="6">No complaints available.</td></tr>`;
  }

  function renderRecentComplaints() {
    const tbody = $("recent-complaints");
    if (!tbody) return;

    const recent = complaints.slice(0, 5);

    tbody.innerHTML = recent.length
      ? recent.map(complaint => `
          <tr>
            <td>${escapeHTML(complaint.complaint_id)}</td>
            <td>${escapeHTML(complaint.category)}</td>
            <td>${escapeHTML(complaint.status)}</td>
            <td>${escapeHTML(formatDate(complaint.created_at))}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="4">No complaints available yet.</td></tr>`;
  }

  function updateComplaintStats() {
    if ($("total-count")) {
      $("total-count").textContent = complaints.length;
    }

    if ($("pending-count")) {
      $("pending-count").textContent = complaints.filter(complaint => {
        const status = String(complaint.status || "").toLowerCase();
        return status === "pending" ||
          status === "submitted" ||
          status === "under review";
      }).length;
    }
  }

  $("complaint-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-super-view]");
    if (!button) return;

    selectedComplaint = complaints.find(complaint =>
      String(complaint.id) === button.dataset.superView
    );

    if (!selectedComplaint) return;

    $("super-complaint-details")?.classList.remove("hidden");

    if ($("super-complaint-detail-content")) {
      $("super-complaint-detail-content").innerHTML = `
        <p><b>Complaint ID:</b> ${escapeHTML(selectedComplaint.complaint_id)}</p>
        <p><b>Title:</b> ${escapeHTML(selectedComplaint.title)}</p>
        <p><b>Description:</b> ${escapeHTML(selectedComplaint.description)}</p>
        <p><b>Category:</b> ${escapeHTML(selectedComplaint.category)}</p>
        <p><b>Location:</b> ${escapeHTML(selectedComplaint.location)}</p>
        <p><b>Status:</b> ${escapeHTML(selectedComplaint.status)}</p>
      `;
    }

    if ($("super-update-status")) {
      $("super-update-status").value = selectedComplaint.status || "Submitted";
    }

    if ($("super-resolution-notes")) {
      $("super-resolution-notes").value = selectedComplaint.notes || "";
    }
  });

  $("super-complaint-update-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!selectedComplaint) {
      showMessage("Pehle complaint select karo.");
      return;
    }

    const status = $("super-update-status")?.value;
    const notes = $("super-resolution-notes")?.value.trim() || "";

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

    showMessage("Complaint successfully updated.");
    $("super-complaint-details")?.classList.add("hidden");
    selectedComplaint = null;
    await loadComplaints();
  });

  // ================= MY PERSONAL COMPLAINTS =================

  async function loadMyPersonalComplaints() {
    const tbody = $("my-personal-complaint-list");

    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6">Loading your personal complaints...</td></tr>`;
    }

    if (!currentUser) return;

    const { data, error } = await db
      .from("complaints")
      .select("id,complaint_id,user_id,category,title,location,description,status,notes,created_at,updated_at,recipient_type,is_confidential")
      .eq("user_id", currentUser.id)
      .eq("recipient_type", "super_admin")
      .eq("is_confidential", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Personal complaints error:", error.message);

      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6">Unable to load personal complaints. ${escapeHTML(error.message)}</td></tr>`;
      }

      myPersonalComplaints = [];
      return;
    }

    myPersonalComplaints = data || [];
    renderMyPersonalComplaints();
  }

  function renderMyPersonalComplaints() {
    const tbody = $("my-personal-complaint-list");
    if (!tbody) return;

    tbody.innerHTML = myPersonalComplaints.length
      ? myPersonalComplaints.map(complaint => `
          <tr>
            <td>${escapeHTML(complaint.complaint_id)}</td>
            <td>${escapeHTML(complaint.category)}</td>
            <td>${escapeHTML(complaint.title)}</td>
            <td>${escapeHTML(complaint.status)}</td>
            <td>${escapeHTML(formatDate(complaint.created_at))}</td>
            <td>
              <button
                type="button"
                data-my-personal-view="${escapeHTML(complaint.id)}"
              >View / Update</button>
            </td>
          </tr>
        `).join("")
      : `<tr><td colspan="6">You have no personal complaints.</td></tr>`;
  }

  $("my-personal-complaint-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-my-personal-view]");
    if (!button) return;

    selectedPersonalComplaint = myPersonalComplaints.find(complaint =>
      String(complaint.id) === button.dataset.myPersonalView
    );

    if (!selectedPersonalComplaint) return;

    $("my-personal-complaint-details")?.classList.remove("hidden");

    if ($("my-personal-detail-content")) {
      $("my-personal-detail-content").innerHTML = `
        <p><b>Complaint ID:</b> ${escapeHTML(selectedPersonalComplaint.complaint_id)}</p>
        <p><b>Title:</b> ${escapeHTML(selectedPersonalComplaint.title)}</p>
        <p><b>Category:</b> ${escapeHTML(selectedPersonalComplaint.category)}</p>
        <p><b>Location:</b> ${escapeHTML(selectedPersonalComplaint.location)}</p>
        <p><b>Description:</b> ${escapeHTML(selectedPersonalComplaint.description)}</p>
        <p><b>Status:</b> ${escapeHTML(selectedPersonalComplaint.status)}</p>
        <p><b>Submitted:</b> ${escapeHTML(formatDate(selectedPersonalComplaint.created_at))}</p>
      `;
    }

    if ($("my-personal-status")) {
      $("my-personal-status").value = selectedPersonalComplaint.status || "Submitted";
    }

    if ($("my-personal-notes")) {
      $("my-personal-notes").value = selectedPersonalComplaint.notes || "";
    }
  });

  $("my-personal-update-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!selectedPersonalComplaint || !currentUser) {
      showMessage("Pehle apni personal complaint select karo.");
      return;
    }

    const status = $("my-personal-status")?.value;
    const notes = $("my-personal-notes")?.value.trim() || "";
    const button = $("my-personal-update-form")?.querySelector('[type="submit"]');

    if (!status) {
      showMessage("Complaint status select karo.");
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Updating...";
    }

    try {
      const { data, error } = await db
        .from("complaints")
        .update({
          status,
          notes,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedPersonalComplaint.id)
        .eq("user_id", currentUser.id)
        .eq("recipient_type", "super_admin")
        .eq("is_confidential", true)
        .select("id");

      if (error) {
        showMessage("Personal complaint update error: " + error.message);
        return;
      }

      if (!data || data.length === 0) {
        showMessage("Complaint update nahi hui. Security permission ya complaint ownership check karo.");
        return;
      }

      showMessage("Your personal complaint has been updated.");
      $("my-personal-complaint-details")?.classList.add("hidden");
      selectedPersonalComplaint = null;
      await loadMyPersonalComplaints();

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Update Complaint";
      }
    }
  });

  // ================= EMAIL CENTRE =================

  function createEmailCentre() {
    let section = $("super-admin-email-section");

    if (!section) {
      section = document.createElement("section");
      section.id = "super-admin-email-section";
      section.className = "page-section hidden";

      section.innerHTML = `
        <div class="content-box">
          <h2>Student Complaint Email Centre</h2>
          <p>Select complaints to send individual emails to students.</p>

          <label for="sa-mail-status">Filter by status</label>
          <select id="sa-mail-status">
            <option value="">All statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="Work in Progress">Work in Progress</option>
            <option value="Solved">Solved</option>
          </select>

          <div id="sa-mail-complaints"></div>

          <label for="sa-mail-subject">Email subject</label>
          <input id="sa-mail-subject" value="Update on your LTSUCare complaint">

          <label for="sa-mail-remarks">Remarks for selected students</label>
          <textarea id="sa-mail-remarks" rows="4" placeholder="Write resolution details or update"></textarea>

          <button type="button" id="sa-mail-send">Send Email to Selected Students</button>
          <p id="sa-mail-result" role="status"></p>
        </div>
      `;

      $("dashboard")?.appendChild(section);
    }

    if (!document.querySelector('[data-page="super-admin-email-section"]')) {
      const nav = document.querySelector(".sidebar");

      if (nav) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nav-btn";
        button.dataset.page = "super-admin-email-section";
        button.textContent = "Student Emails";
        nav.insertBefore(button, $("logout-btn"));
      }
    }

    if (!emailCentreEventsBound) {
      $("sa-mail-status")?.addEventListener("change", renderEmailList);
      $("sa-mail-send")?.addEventListener("click", sendSelectedEmails);
      emailCentreEventsBound = true;
    }
  }

  function renderEmailCentre() {
    createEmailCentre();
    renderEmailList();
  }

  function renderEmailList() {
    const list = $("sa-mail-complaints");
    if (!list) return;

    const status = $("sa-mail-status")?.value || "";

    const filtered = complaints.filter(complaint =>
      !status || complaint.status === status
    );

    list.innerHTML = filtered.length
      ? filtered.map(complaint => `
          <label style="display:block;padding:10px;border-bottom:1px solid #ddd">
            <input
              type="checkbox"
              class="sa-mail-check"
              value="${escapeHTML(complaint.complaint_id)}"
            >
            ${escapeHTML(complaint.complaint_id)} —
            ${escapeHTML(complaint.title || complaint.category || "Complaint")}
            (${escapeHTML(complaint.status)})
          </label>
        `).join("")
      : "<p>No complaints found.</p>";
  }

  async function sendSelectedEmails() {
    const selected = [
      ...document.querySelectorAll(".sa-mail-check:checked")
    ].map(input => input.value);

    if (!selected.length) {
      showMessage("Kam se kam ek complaint select karo.");
      return;
    }

    const { data } = await db.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      showMessage("Login session expired. Dobara login karo.");
      return;
    }

    const remarksText = $("sa-mail-remarks")?.value.trim() || "";
    const remarks = {};

    selected.forEach(id => {
      remarks[id] = remarksText;
    });

    const button = $("sa-mail-send");
    const resultElement = $("sa-mail-result");

    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }

    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          type: "resolution_email",
          accessToken,
          complaintIds: selected,
          remarks,
          subject: $("sa-mail-subject")?.value.trim()
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Email sending failed");
      }

      if (resultElement) {
        resultElement.textContent =
          "Email request accepted. Selected complaints: " + selected.length;
      }

    } catch (error) {
      if (resultElement) {
        resultElement.textContent = "Error: " + error.message;
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Send Email to Selected Students";
      }
    }
  }

  // ================= ACTIVITY LOGS =================

  async function loadActivityLogs() {
    const tbody = $("activity-list");
    if (!tbody) return;

    const { data, error } = await db
      .from("activity_logs")
      .select("id,actor_id,action,target,created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      tbody.innerHTML = `<tr><td colspan="4">Activity logs unavailable.</td></tr>`;
      return;
    }

    tbody.innerHTML = data && data.length
      ? data.map(log => `
          <tr>
            <td>${escapeHTML(log.action)}</td>
            <td>${escapeHTML(log.actor_id)}</td>
            <td>${escapeHTML(log.target)}</td>
            <td>${escapeHTML(formatDate(log.created_at))}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="4">No activity records found.</td></tr>`;
  }

  // ================= NAVIGATION =================

  document.addEventListener("click", event => {
    const button = event.target.closest(".nav-btn");
    if (!button) return;

    const targetId = button.dataset.page || button.dataset.section;
    if (!targetId) return;

    document.querySelectorAll(".page-section").forEach(section => {
      section.classList.add("hidden");
      section.classList.remove("active");
    });

    $(targetId)?.classList.remove("hidden");
    $(targetId)?.classList.add("active");

    document.querySelectorAll(".nav-btn").forEach(navButton => {
      navButton.classList.remove("active");
    });

    button.classList.add("active");

    if (targetId === "my-personal-complaints") {
      loadMyPersonalComplaints();
    }
  });

  // ================= LOGOUT =================

  $("logout-btn")?.addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.reload();
  });

  // ================= FORGOT PASSWORD =================

  $("forgot-password-btn")?.addEventListener("click", () => {
    window.location.href =
      "/ltsu-campus-support/super-admin/reset-password.html";
  });

  // ================= AI HELPER =================

  $("ai-button")?.addEventListener("click", () => {
    $("ai-window")?.classList.remove("hidden");
  });

  $("ai-close")?.addEventListener("click", () => {
    $("ai-window")?.classList.add("hidden");
  });

  function sendAIMessage() {
    const input = $("ai-input");
    const messages = $("ai-messages");

    if (!input || !messages || !input.value.trim()) return;

    const question = input.value.trim();
    const lower = question.toLowerCase();

    let answer = "Please check the relevant section of your Super Admin dashboard.";

    if (lower.includes("request")) {
      answer = "Admin Management section mein pending requests check karein.";
    } else if (lower.includes("approve")) {
      answer = "Admin Management mein request ke saamne Approve button dabayein.";
    } else if (lower.includes("complaint")) {
      answer = "Complaints section mein available complaints check karein.";
    } else if (lower.includes("email")) {
      answer = "Student Emails section mein complaints select karke email bhejein.";
    } else if (lower.includes("student")) {
      answer = "Students section mein student records check karein.";
    } else if (lower.includes("personal")) {
      answer = "My Personal Complaints section mein apni confidential complaints check karein.";
    }

    const userMessage = document.createElement("p");
    userMessage.innerHTML = "<b>You:</b> " + escapeHTML(question);

    const botMessage = document.createElement("p");
    botMessage.innerHTML = "<b>Assistant:</b> " + escapeHTML(answer);

    messages.appendChild(userMessage);
    messages.appendChild(botMessage);

    input.value = "";
    messages.scrollTop = messages.scrollHeight;
  }

  $("ai-send")?.addEventListener("click", sendAIMessage);

  $("ai-input")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      sendAIMessage();
    }
  });

  // ================= RESTORE EXISTING SESSION =================

  const { data } = await db.auth.getSession();

  if (data.session?.user) {
    await verifySuperAdmin(data.session.user);
  }
});
