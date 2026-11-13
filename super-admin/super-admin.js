
document.addEventListener("DOMContentLoaded", async () => {
  const db = window.supabaseClient;
  const $ = id => document.getElementById(id);
  const EMAIL_FUNCTION = "ltsu-campus-email";

  let currentUser = null;
  let currentProfile = null;
  let adminRequests = [];
  let superAdminRequests = [];
  let complaints = [];
  let myPersonalComplaints = [];
  let confidentialComplaints = [];
  let students = [];
  let selectedComplaint = null;
  let selectedPersonalComplaint = null;
  let selectedConfidentialComplaint = null;

  let emailStats = { accepted: 0, failed: 0 };

  // Track whether the email draft is still an automatically generated template.
  let emailTemplateIsDefault = true;

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
    return date.toLocaleString("en-IN");
  }

  function setText(id, value) {
    if ($(id)) $(id).textContent = value ?? "—";
  }

  function setStatus(id, message, success = false) {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.style.color = success ? "#16865b" : "#c0392b";
  }

  function setButtonLoading(button, loading, loadingText, normalText) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? loadingText : normalText;
  }

  async function invokeEmailFunction(payload) {
    const { data, error } = await db.functions.invoke(
      EMAIL_FUNCTION,
      { body: payload }
    );

    if (error) {
      let message = error.message || "Email request failed.";

      if (error.context && typeof error.context.json === "function") {
        try {
          const details = await error.context.json();
          if (details?.error) message = details.error;
        } catch (_) {}
      }

      throw new Error(message);
    }

    if (!data || data.success !== true) {
      throw new Error(data?.error || data?.message || "Email request failed.");
    }

    return data;
  }

  // =====================================================
  // EMAIL STATISTICS
  // =====================================================

  function updateEmailStats() {
    setText("email-sent-count", emailStats.accepted);
    setText("super-email-sent", emailStats.accepted);
    setText("analytics-total-sent", emailStats.accepted);
    setText("analytics-successful", emailStats.accepted);
    setText("super-email-failed", emailStats.failed);
    setText("analytics-failed", emailStats.failed);

    setText("super-email-delivered", "Not available");
    setText("analytics-remaining-quota", "Not available");

    const history = $("email-analytics-list");

    if (history && !history.children.length) {
      history.innerHTML = `
        <tr>
          <td colspan="5">
            Session email counts only. Persistent Brevo delivery analytics
            are not connected yet.
          </td>
        </tr>
      `;
    }
  }

  // =====================================================
  // REGISTRATION LINK
  // =====================================================

  function addRegistrationLink() {
    const forgotButton = $("forgot-password-btn");

    if (!forgotButton || $("super-admin-register-link")) return;

    const link = document.createElement("a");
    link.id = "super-admin-register-link";
    link.href = "register.html";
    link.textContent = "New Super Admin? Register Here";

    link.style.display = "block";
    link.style.marginTop = "12px";
    link.style.textAlign = "center";
    link.style.color = "#16865b";
    link.style.fontWeight = "600";

    forgotButton.insertAdjacentElement("afterend", link);
  }

  addRegistrationLink();

  // =====================================================
  // NAVIGATION SYSTEM
  // =====================================================

  function openPage(targetId, clickedButton = null) {
    if (!targetId) return;

    const targetSection = $(targetId);

    if (!targetSection) {
      console.warn("Navigation section not found:", targetId);
      return;
    }

    document.querySelectorAll(".page-section").forEach(section => {
      section.classList.add("hidden");
      section.classList.remove("active");
    });

    targetSection.classList.remove("hidden");
    targetSection.classList.add("active");

    document.querySelectorAll(".nav-btn").forEach(button => {
      button.classList.remove("active");
      button.setAttribute("aria-current", "false");
    });

    if (clickedButton) {
      clickedButton.classList.add("active");
      clickedButton.setAttribute("aria-current", "page");
    } else {
      const matchingButton = document.querySelector(
        `.nav-btn[data-page="${CSS.escape(targetId)}"], .nav-btn[data-section="${CSS.escape(targetId)}"]`
      );

      if (matchingButton) {
        matchingButton.classList.add("active");
        matchingButton.setAttribute("aria-current", "page");
      }
    }

    if (targetId === "my-personal-complaints") {
      loadMyPersonalComplaints();
    }

    if (targetId === "super-admin-requests") {
      loadSuperAdminRegistrationRequests();
    }

    if (targetId === "confidential-email") {
      loadConfidentialInbox();
    }

    if (targetId === "students") {
      loadStudents();
    }

    if (targetId === "email-analytics") {
      renderEmailAnalytics();
    }

    if (targetId === "complaints") {
      loadComplaints();
    }

    if (targetId === "admins") {
      loadAdminRequests();
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest(".nav-btn");
    if (!button) return;

    const targetId = button.dataset.page || button.dataset.section;
    if (!targetId) return;

    event.preventDefault();
    openPage(targetId, button);
  });

  // =====================================================
  // SUPER ADMIN REGISTRATION REQUESTS
  // =====================================================

  function createSuperAdminRequestsSection() {
    const dashboard = $("dashboard");
    const sidebar = document.querySelector(".sidebar");

    if (!dashboard || !sidebar) return;

    if (!document.querySelector('[data-page="super-admin-requests"]')) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "nav-btn";
      button.dataset.page = "super-admin-requests";
      button.textContent = "Super Admin Requests";

      sidebar.insertBefore(button, $("logout-btn") || null);
    }

    if (!$("super-admin-requests")) {
      const section = document.createElement("section");

      section.id = "super-admin-requests";
      section.className = "page-section hidden";

      section.innerHTML = `
        <div class="content-box">
          <h2>Super Admin Registration Requests</h2>
          <p>Review new Super Admin applications.</p>

          <h3>Pending Requests</h3>

          <div style="overflow-x:auto">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Applied</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="sa-registration-pending">
                <tr><td colspan="5">Loading...</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Approved Requests</h3>

          <div style="overflow-x:auto">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Reviewed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="sa-registration-approved"></tbody>
            </table>
          </div>

          <h3>Rejected Requests</h3>

          <div style="overflow-x:auto">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Reviewed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="sa-registration-rejected"></tbody>
            </table>
          </div>

          <p id="sa-registration-message" role="status"></p>
        </div>
      `;

      dashboard.appendChild(section);
    }
  }

  function renderSuperAdminRegistrationRequests() {
    const pending = superAdminRequests.filter(x => x.status === "pending");
    const approved = superAdminRequests.filter(x => x.status === "approved");
    const rejected = superAdminRequests.filter(x => x.status === "rejected");

    const renderRows = (items, actions = false) => items.length
      ? items.map(item => `
          <tr>
            <td>${escapeHTML(item.full_name)}</td>
            <td>${escapeHTML(item.email)}</td>
            <td>${escapeHTML(item.phone)}</td>
            <td>${escapeHTML(formatDate(actions ? item.created_at : item.reviewed_at))}</td>
            <td>
              ${actions ? `
                <button type="button"
                  data-sa-action="approve"
                  data-request-id="${escapeHTML(item.id)}">
                  Approve
                </button>

                <button type="button"
                  data-sa-action="reject"
                  data-request-id="${escapeHTML(item.id)}">
                  Reject
                </button>
              ` : escapeHTML(item.status)}
            </td>
          </tr>
        `).join("")
      : `<tr><td colspan="5">No requests found.</td></tr>`;

    if ($("sa-registration-pending")) {
      $("sa-registration-pending").innerHTML = renderRows(pending, true);
    }

    if ($("sa-registration-approved")) {
      $("sa-registration-approved").innerHTML = renderRows(approved);
    }

    if ($("sa-registration-rejected")) {
      $("sa-registration-rejected").innerHTML = renderRows(rejected);
    }

    const nav = document.querySelector('[data-page="super-admin-requests"]');

    if (nav) {
      nav.textContent = `Super Admin Requests (${pending.length})`;
    }
  }

  async function loadSuperAdminRegistrationRequests() {
    const { data, error } = await db
      .from("super_admin_requests")
      .select("id,user_id,full_name,email,phone,status,created_at,reviewed_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Super Admin requests:", error.message);
      setStatus("sa-registration-message", error.message);
      return;
    }

    superAdminRequests = data || [];
    renderSuperAdminRegistrationRequests();
  }

  $("dashboard")?.addEventListener("click", async event => {
    const button = event.target.closest("[data-sa-action]");
    if (!button) return;

    const action = button.dataset.saAction;
    const requestId = button.dataset.requestId;

    if (!["approve", "reject"].includes(action)) return;

    const request = superAdminRequests.find(
      x => String(x.id) === String(requestId)
    );

    if (!request || request.status !== "pending") {
      showMessage("This request is no longer pending.");
      await loadSuperAdminRegistrationRequests();
      return;
    }

    if (!confirm(
      `Are you sure you want to ${action} this registration?\n\n` +
      `${request.full_name}\n${request.email}`
    )) return;

    button.disabled = true;

    try {
      const { data, error } = await db.functions.invoke(
        "super-admin-approval",
        {
          body: { request_id: requestId, action }
        }
      );

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Request failed.");

      setStatus(
        "sa-registration-message",
        data.message || `Request ${action}d successfully.`,
        true
      );

      await loadSuperAdminRegistrationRequests();
    } catch (error) {
      setStatus("sa-registration-message", error.message);
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });

  // =====================================================
  // LOGIN AND SESSION
  // =====================================================

  async function verifySuperAdmin(user) {
    const { data, error } = await db
      .from("profiles")
      .select("id,full_name,email,role,is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (
      error ||
      !data ||
      data.role !== "super_admin" ||
      data.is_active !== true
    ) {
      await db.auth.signOut();

      showMessage(
        "Super Admin access denied. Active Super Admin account required."
      );

      return false;
    }

    currentUser = user;
    currentProfile = data;

    $("login-page")?.classList.add("hidden");
    $("dashboard")?.classList.remove("hidden");

    document.querySelectorAll(".admin-label").forEach(element => {
      element.textContent = data.full_name || data.email;
    });

    createSuperAdminRequestsSection();

    await Promise.all([
      loadAdminRequests(),
      loadSuperAdminRegistrationRequests(),
      loadAdminCount(),
      loadStudentCount(),
      loadComplaints(),
      loadMyPersonalComplaints(),
      loadStudents(),
      loadConfidentialInbox()
    ]);

    await loadActivityLogs();

    loadSuperAdminProfile();
    updateEmailStats();

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

    setButtonLoading(button, true, "Logging in...", "Login");

    try {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      await verifySuperAdmin(data.user);
    } catch (error) {
      showMessage("Login failed: " + error.message);
    } finally {
      setButtonLoading(button, false, "Logging in...", "Login");
    }
  });

  // =====================================================
  // ADMIN MANAGEMENT
  // =====================================================

  async function loadAdminRequests() {
    const tbody = $("pending-admin-list");

    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8">Loading...</td></tr>`;
    }

    const { data, error } = await db
      .from("admin_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (tbody) {
        tbody.innerHTML =
          `<tr><td colspan="8">${escapeHTML(error.message)}</td></tr>`;
      }

      console.error(error);
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

    const pending = adminRequests.filter(
      x => String(x.status).toLowerCase() === "pending"
    );

    const rejected = adminRequests.filter(
      x => String(x.status).toLowerCase() === "rejected"
    );

    if (pendingBody) {
      pendingBody.innerHTML = pending.length
        ? pending.map(request => `
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
      rejectedBody.innerHTML = rejected.length
        ? rejected.map(request => `
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
    if (!tbody) return;

    const { data, error } = await db
      .from("profiles")
      .select("id,full_name,username,email,department,is_active")
      .eq("role", "admin")
      .order("full_name", { ascending: true });

    if (error) {
      tbody.innerHTML =
        `<tr><td colspan="5">${escapeHTML(error.message)}</td></tr>`;
      return;
    }

    tbody.innerHTML = data?.length
      ? data.map(admin => `
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
    setText(
      "pending-admin-count",
      adminRequests.filter(
        x => String(x.status).toLowerCase() === "pending"
      ).length
    );
  }

  $("admins")?.addEventListener("click", async event => {
    const approveButton = event.target.closest("[data-approve]");
    const rejectButton = event.target.closest("[data-reject]");

    if (approveButton) {
      const request = adminRequests.find(
        x => String(x.id) === approveButton.dataset.approve
      );

      if (!request) return;

      if (String(request.status).toLowerCase() !== "pending") {
        showMessage("This request is no longer pending.");
        return;
      }

      if (!request.user_id) {
        showMessage("Request ke saath User ID nahi mili.");
        return;
      }

      const username = String(request.username || "").trim().toLowerCase();

      if (!username) {
        showMessage("Username missing hai.");
        return;
      }

      if (!confirm(`Approve this Admin?\nUsername: ${username}`)) return;

      approveButton.disabled = true;

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

        if (profileError) throw profileError;

        const { error: requestError } = await db
          .from("admin_requests")
          .update({
            status: "approved",
            reviewed_by: currentUser.id,
            reviewed_at: new Date().toISOString()
          })
          .eq("id", request.id);

        if (requestError) throw requestError;

        showMessage("Admin successfully approved.");
        await loadAdminRequests();
        await loadAdminCount();
      } catch (error) {
        showMessage("Approval error: " + error.message);
      } finally {
        if (approveButton.isConnected) approveButton.disabled = false;
      }
    }

    if (rejectButton) {
      const request = adminRequests.find(
        x => String(x.id) === rejectButton.dataset.reject
      );

      if (!request) return;

      if (String(request.status).toLowerCase() !== "pending") {
        showMessage("This request is no longer pending.");
        return;
      }

      if (!confirm("Reject this Admin request?")) return;

      rejectButton.disabled = true;

      try {
        const { error } = await db
          .from("admin_requests")
          .update({
            status: "rejected",
            reviewed_by: currentUser.id,
            reviewed_at: new Date().toISOString()
          })
          .eq("id", request.id);

        if (error) throw error;

        showMessage("Admin request rejected.");
        await loadAdminRequests();
      } catch (error) {
        showMessage("Reject error: " + error.message);
      } finally {
        if (rejectButton.isConnected) rejectButton.disabled = false;
      }
    }
  });

  // =====================================================
  // DASHBOARD COUNTS
  // =====================================================

  async function loadAdminCount() {
    const { count, error } = await db
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);

    if (!error) setText("admin-count", count ?? 0);
  }

  async function loadStudentCount() {
    const { count, error } = await db
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "student");

    if (!error) setText("student-count", count ?? 0);
  }

  // =====================================================
  // STUDENTS AND EMAIL RECIPIENT DROPDOWN
  // =====================================================

  function populateStudentEmailOptions() {
    const select = $("student-email-address");
    if (!select) return;

    const previousValue = String(select.value || "").toLowerCase();

    const availableStudents = students.filter(student =>
      String(student.email || "").trim()
    );

    select.innerHTML = `
      <option value="">Select a registered student</option>
      ${availableStudents.map(student => {
        const email = String(student.email).trim().toLowerCase();
        const name = student.full_name || "Student";
        const studentId = student.student_id || "ID unavailable";

        return `
          <option value="${escapeHTML(email)}">
            ${escapeHTML(name)} — ${escapeHTML(studentId)} — ${escapeHTML(email)}
          </option>
        `;
      }).join("")}
    `;

    if (
      previousValue &&
      availableStudents.some(student =>
        String(student.email).trim().toLowerCase() === previousValue
      )
    ) {
      select.value = previousValue;
    }

    if (!availableStudents.length) {
      select.innerHTML =
        `<option value="">No registered student emails found</option>`;
    }
  }

  function populateDepartmentOptions() {
    const select = $("student-email-department");
    if (!select) return;

    const previous = select.value;

    const departments = [...new Set(
      students
        .map(x => String(x.department || "").trim())
        .filter(Boolean)
    )].sort();

    select.innerHTML =
      `<option value="">Select department</option>` +
      departments.map(department => `
        <option value="${escapeHTML(department)}">
          ${escapeHTML(department)}
        </option>
      `).join("");

    if (departments.includes(previous)) {
      select.value = previous;
    }
  }

  async function loadStudents() {
    const tbody = $("student-list");

    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6">Loading students...</td></tr>`;
    }

    const emailSelect = $("student-email-address");

    if (emailSelect && !emailSelect.options.length) {
      emailSelect.innerHTML =
        `<option value="">Loading registered students...</option>`;
    }

    const { data, error } = await db
      .from("profiles")
      .select("id,full_name,email,student_id,department,role")
      .eq("role", "student")
      .order("full_name", { ascending: true })
      .limit(1000);

    if (error) {
      console.error("Student list:", error.message);

      if (tbody) {
        tbody.innerHTML =
          `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`;
      }

      if (emailSelect) {
        emailSelect.innerHTML =
          `<option value="">Unable to load students</option>`;
      }

      students = [];
      return;
    }

    students = data || [];

    if (tbody) {
      tbody.innerHTML = students.length
        ? students.map(student => `
          <tr>
            <td>${escapeHTML(student.student_id || "—")}</td>
            <td>${escapeHTML(student.full_name || "—")}</td>
            <td>${escapeHTML(student.email || "—")}</td>
            <td>${escapeHTML(student.department || "—")}</td>
          </tr>
        `).join("")
        : `<tr><td colspan="6">No students found.</td></tr>`;
    }

    populateDepartmentOptions();
    populateStudentEmailOptions();
    updateStudentEmailTemplate();
  }

  // =====================================================
  // EMAIL TEMPLATE AUTO-FILL
  // =====================================================

  function getSelectedEmailStudent() {
    const email = String($("student-email-address")?.value || "")
      .trim()
      .toLowerCase();

    if (!email) return null;

    return students.find(student =>
      String(student.email || "").trim().toLowerCase() === email
    ) || null;
  }

  function buildStudentEmailTemplate() {
    const mode = $("student-email-recipient")?.value || "all";
    const student = mode === "individual"
      ? getSelectedEmailStudent()
      : null;

    const subject = mode === "individual" && student
      ? "Important Update from LTSUCare"
      : "Important Update from LTSUCare";

    const greeting = student
      ? `Dear ${student.full_name || "Student"},`
      : "Dear Student,";

    const studentDetails = student
      ? `
Student Name: ${student.full_name || "Not available"}
Student ID: ${student.student_id || "Not available"}
Registered Email: ${student.email || "Not available"}

`
      : "";

    const message =
`${greeting}

${studentDetails}We hope you are doing well.

[Write your announcement or update here.]

For any assistance, please contact the appropriate university office.

Regards,
Super Admin Office
LTSUCare
Lamrin Tech Skills University Punjab`;

    return { subject, message };
  }

  function updateStudentEmailTemplate(force = false) {
    const subjectInput = $("student-email-subject");
    const messageInput = $("student-email-message");

    if (!subjectInput || !messageInput) return;

    // Do not overwrite a draft the Super Admin has started editing.
    if (!force && !emailTemplateIsDefault) return;

    const template = buildStudentEmailTemplate();

    subjectInput.value = template.subject;
    messageInput.value = template.message;
    emailTemplateIsDefault = true;
  }

  $("student-email-subject")?.addEventListener("input", () => {
    emailTemplateIsDefault = false;
  });

  $("student-email-message")?.addEventListener("input", () => {
    emailTemplateIsDefault = false;
  });

  $("student-email-address")?.addEventListener("change", () => {
    emailTemplateIsDefault = true;
    updateStudentEmailTemplate(true);
  });

  // =====================================================
  // NORMAL COMPLAINTS
  // =====================================================

  async function loadComplaints() {
    const { data, error } = await db
      .from("complaints")
      .select("id,complaint_id,user_id,category,title,location,description,status,notes,created_at,recipient_type,is_confidential,forwarded_to_super_admin")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Complaints load error:", error.message);
      complaints = [];
    } else {
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
    renderComplaintEmailList();
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
            <button type="button" data-super-view="${escapeHTML(complaint.id)}">
              View
            </button>
          </td>
        </tr>
      `).join("")
      : `<tr><td colspan="6">No complaints available.</td></tr>`;
  }

  function renderRecentComplaints() {
    const tbody = $("recent-complaints");
    if (!tbody) return;

    tbody.innerHTML = complaints.slice(0, 5).length
      ? complaints.slice(0, 5).map(complaint => `
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
    setText("total-count", complaints.length);

    setText(
      "pending-count",
      complaints.filter(complaint => {
        const status = String(complaint.status || "").toLowerCase();

        return ["pending", "submitted", "under review"].includes(status);
      }).length
    );
  }

  $("complaint-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-super-view]");
    if (!button) return;

    selectedComplaint = complaints.find(
      x => String(x.id) === button.dataset.superView
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
      $("super-update-status").value =
        selectedComplaint.status || "Submitted";
    }

    if ($("super-resolution-notes")) {
      $("super-resolution-notes").value =
        selectedComplaint.notes || "";
    }
  });

  $("super-complaint-update-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!selectedComplaint) {
      return showMessage("Pehle complaint select karo.");
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
      return showMessage("Complaint update error: " + error.message);
    }

    showMessage("Complaint successfully updated.");
    $("super-complaint-details")?.classList.add("hidden");
    selectedComplaint = null;

    await loadComplaints();
  });

  // =====================================================
  // MY PERSONAL COMPLAINTS
  // =====================================================

  async function loadMyPersonalComplaints() {
    const tbody = $("my-personal-complaint-list");

    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6">Loading...</td></tr>`;
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
      console.error("Personal complaints:", error.message);

      if (tbody) {
        tbody.innerHTML =
          `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`;
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
            <button type="button" data-my-personal-view="${escapeHTML(complaint.id)}">
              View / Update
            </button>
          </td>
        </tr>
      `).join("")
      : `<tr><td colspan="6">You have no personal complaints.</td></tr>`;
  }

  $("my-personal-complaint-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-my-personal-view]");
    if (!button) return;

    selectedPersonalComplaint = myPersonalComplaints.find(
      x => String(x.id) === button.dataset.myPersonalView
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
      $("my-personal-status").value =
        selectedPersonalComplaint.status || "Submitted";
    }

    if ($("my-personal-notes")) {
      $("my-personal-notes").value =
        selectedPersonalComplaint.notes || "";
    }
  });

  $("my-personal-update-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!selectedPersonalComplaint || !currentUser) {
      return showMessage("Pehle apni personal complaint select karo.");
    }

    const status = $("my-personal-status")?.value;
    const notes = $("my-personal-notes")?.value.trim() || "";

    const button = $("my-personal-update-form")
      ?.querySelector('[type="submit"]');

    setButtonLoading(button, true, "Updating...", "Update Complaint");

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

      if (error) throw error;

      if (!data?.length) {
        throw new Error(
          "Security permission ya complaint ownership check failed."
        );
      }

      showMessage("Your personal complaint has been updated.");

      $("my-personal-complaint-details")?.classList.add("hidden");
      selectedPersonalComplaint = null;

      await loadMyPersonalComplaints();
    } catch (error) {
      showMessage("Update error: " + error.message);
    } finally {
      setButtonLoading(button, false, "Updating...", "Update Complaint");
    }
  });

  // =====================================================
  // STUDENT EMAIL CENTRE
  // =====================================================

  function updateRecipientGroups() {
    const mode = $("student-email-recipient")?.value;

    if ($("student-email-department-group")) {
      $("student-email-department-group").style.display =
        mode === "department" ? "" : "none";
    }

    if ($("student-email-individual-group")) {
      $("student-email-individual-group").style.display =
        mode === "individual" ? "" : "none";
    }

    updateStudentEmailTemplate();
  }

  $("student-email-recipient")?.addEventListener(
    "change",
    () => {
      emailTemplateIsDefault = true;
      updateRecipientGroups();
    }
  );

  $("student-email-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    const mode = $("student-email-recipient")?.value;
    const subject = $("student-email-subject")?.value.trim();
    const message = $("student-email-message")?.value.trim();
    const department = $("student-email-department")?.value;
    const studentEmail = String($("student-email-address")?.value || "")
      .trim()
      .toLowerCase();

    const button = $("student-email-send-btn");

    if (!subject || !message) {
      return setStatus(
        "student-email-message-status",
        "Subject aur message required hain."
      );
    }

    if (mode === "department" && !department) {
      return setStatus(
        "student-email-message-status",
        "Department select karo."
      );
    }

    if (mode === "individual" && !studentEmail) {
      return setStatus(
        "student-email-message-status",
        "Student dropdown se student select karo."
      );
    }

    if (
      mode === "individual" &&
      !students.some(student =>
        String(student.email || "").trim().toLowerCase() === studentEmail
      )
    ) {
      return setStatus(
        "student-email-message-status",
        "Selected email registered student list mein nahi mila."
      );
    }

    if (!confirm(
      "Kya aap selected student recipient(s) ko email bhejna chahte hain?"
    )) return;

    setButtonLoading(button, true, "Sending...", "Send Email");

    try {
      // Keep the existing Edge Function payload and action unchanged.
      const result = await invokeEmailFunction({
        action: "send_student_email",
        recipient_mode: mode,
        department: mode === "department" ? department : undefined,
        student_email: mode === "individual" ? studentEmail : undefined,
        subject,
        message
      });

      emailStats.accepted += Number(result.sent || 0);
      emailStats.failed += Number(result.failed || 0);

      updateEmailStats();

      const summary =
        `Process completed. Total: ${result.total}, accepted by Brevo: ${result.sent}, failed: ${result.failed}.`;

      setStatus(
        "student-email-message-status",
        summary,
        Number(result.failed || 0) === 0
      );

      const history = $("student-email-history");

      if (history) {
        const row = document.createElement("tr");

        row.innerHTML = `
          <td>${escapeHTML(formatDate(new Date().toISOString()))}</td>
          <td>${escapeHTML(mode)}</td>
          <td>${escapeHTML(subject)}</td>
          <td>${escapeHTML(result.sent)}</td>
          <td>${escapeHTML(result.failed)}</td>
        `;

        history.prepend(row);
      }

      $("student-email-form")?.reset();

      emailTemplateIsDefault = true;
      updateRecipientGroups();
      updateStudentEmailTemplate(true);
    } catch (error) {
      emailStats.failed++;
      updateEmailStats();
      setStatus("student-email-message-status", error.message);
    } finally {
      setButtonLoading(button, false, "Sending...", "Send Email");
    }
  });

  updateRecipientGroups();

  // =====================================================
  // COMPLAINT EMAIL CENTRE
  // =====================================================

  function createComplaintEmailCentre() {
    if (!$("super-admin-email-section")) {
      const section = document.createElement("section");

      section.id = "super-admin-email-section";
      section.className = "page-section hidden";

      section.innerHTML = `
        <div class="content-box">
          <h2>Complaint Update Email Centre</h2>
          <p>Select complaints to send status updates to students.</p>

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
          <textarea id="sa-mail-remarks" rows="4"></textarea>

          <button type="button" id="sa-mail-send">Send Complaint Updates</button>
          <p id="sa-mail-result" role="status"></p>
        </div>
      `;

      $("dashboard")?.appendChild(section);
    }

    if (!document.querySelector('[data-page="super-admin-email-section"]')) {
      const sidebar = document.querySelector(".sidebar");

      if (sidebar) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "nav-btn";
        button.dataset.page = "super-admin-email-section";
        button.textContent = "Complaint Email Centre";

        sidebar.insertBefore(button, $("logout-btn") || null);
      }
    }

    $("sa-mail-status")?.addEventListener("change", renderComplaintEmailList);
    $("sa-mail-send")?.addEventListener("click", sendSelectedComplaintEmails);
  }

  function renderComplaintEmailList() {
    const list = $("sa-mail-complaints");
    if (!list) return;

    const status = $("sa-mail-status")?.value || "";

    const filtered = complaints.filter(
      x => !status || x.status === status
    );

    list.innerHTML = filtered.length
      ? filtered.map(complaint => `
        <label style="display:block;padding:10px;border-bottom:1px solid #ddd">
          <input type="checkbox" class="sa-mail-check" value="${escapeHTML(complaint.id)}">
          ${escapeHTML(complaint.complaint_id)} —
          ${escapeHTML(complaint.title || complaint.category || "Complaint")}
          (${escapeHTML(complaint.status)})
        </label>
      `).join("")
      : "<p>No complaints found.</p>";
  }

  async function sendSelectedComplaintEmails() {
    const selected = [
      ...document.querySelectorAll(".sa-mail-check:checked")
    ].map(input => input.value);

    if (!selected.length) {
      return setStatus("sa-mail-result", "Kam se kam ek complaint select karo.");
    }

    const remarks = $("sa-mail-remarks")?.value.trim() || "";
    const button = $("sa-mail-send");

    if (!confirm(
      `Selected ${selected.length} complaint update emails bhejne hain?`
    )) return;

    setButtonLoading(button, true, "Sending...", "Send Complaint Updates");

    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    try {
      for (const complaintUuid of selected) {
        const complaint = complaints.find(
          x => String(x.id) === String(complaintUuid)
        );

        if (!complaint) {
          failedCount++;
          continue;
        }

        try {
          await invokeEmailFunction({
            action: "complaint_progress",
            complaint_uuid: complaint.id,
            progress_level: complaint.status || "Submitted",
            resolution_details: remarks
          });

          successCount++;
        } catch (error) {
          failedCount++;
          errors.push(`${complaint.complaint_id}: ${error.message}`);
        }
      }

      emailStats.accepted += successCount;
      emailStats.failed += failedCount;
      updateEmailStats();

      setStatus(
        "sa-mail-result",
        `Brevo accepted: ${successCount}. Failed: ${failedCount}.` +
          (errors.length ? " " + errors.slice(0, 3).join(" | ") : ""),
        failedCount === 0
      );
    } finally {
      setButtonLoading(button, false, "Sending...", "Send Complaint Updates");
    }
  }

  createComplaintEmailCentre();
  renderComplaintEmailList();

  // =====================================================
  // CONFIDENTIAL INBOX
  // =====================================================

  async function loadConfidentialInbox() {
    const tbody = $("confidential-message-list");

    if (tbody) {
      tbody.innerHTML =
        `<tr><td colspan="5">Loading confidential messages...</td></tr>`;
    }

    const { data, error } = await db
      .from("complaints")
      .select("id,complaint_id,user_id,category,title,location,description,status,notes,created_at,updated_at,recipient_type,is_confidential")
      .eq("recipient_type", "super_admin")
      .eq("is_confidential", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Confidential inbox error:", error.message);

      if (tbody) {
        tbody.innerHTML =
          `<tr><td colspan="5">Unable to load inbox: ${escapeHTML(error.message)}</td></tr>`;
      }

      confidentialComplaints = [];
      updateConfidentialStats();
      return;
    }

    confidentialComplaints = data || [];
    renderConfidentialInbox();
    updateConfidentialStats();
  }

  function updateConfidentialStats() {
    setText("confidential-total-count", confidentialComplaints.length);

    setText(
      "confidential-unread-count",
      confidentialComplaints.filter(x =>
        String(x.status || "").toLowerCase() === "submitted"
      ).length
    );

    setText(
      "confidential-resolved-count",
      confidentialComplaints.filter(x => {
        const status = String(x.status || "").toLowerCase();
        return status === "solved" || status === "resolved";
      }).length
    );
  }

  function renderConfidentialInbox() {
    const tbody = $("confidential-message-list");
    if (!tbody) return;

    tbody.innerHTML = confidentialComplaints.length
      ? confidentialComplaints.map(complaint => `
        <tr>
          <td>${escapeHTML(complaint.complaint_id || complaint.id)}</td>
          <td>${escapeHTML(complaint.title || complaint.category)}</td>
          <td>${escapeHTML(complaint.status || "Submitted")}</td>
          <td>${escapeHTML(formatDate(complaint.created_at))}</td>
          <td>
            <button type="button" data-confidential-view="${escapeHTML(complaint.id)}">
              Open
            </button>
          </td>
        </tr>
      `).join("")
      : `<tr><td colspan="5">No confidential messages found.</td></tr>`;
  }

  $("confidential-message-list")?.addEventListener("click", async event => {
    const button = event.target.closest("[data-confidential-view]");
    if (!button) return;

    selectedConfidentialComplaint = confidentialComplaints.find(
      x => String(x.id) === button.dataset.confidentialView
    );

    if (!selectedConfidentialComplaint) return;

    const complaint = selectedConfidentialComplaint;
    let sender = null;

    if (complaint.user_id) {
      const { data } = await db
        .from("profiles")
        .select("full_name,email,student_id,department")
        .eq("id", complaint.user_id)
        .maybeSingle();

      sender = data;
    }

    $("confidential-message-details")?.classList.remove("hidden");

    if ($("confidential-message-content")) {
      $("confidential-message-content").innerHTML = `
        <p><b>Complaint ID:</b> ${escapeHTML(complaint.complaint_id || complaint.id)}</p>
        <p><b>Student:</b> ${escapeHTML(sender?.full_name || "Student")}</p>
        <p><b>Email:</b> ${escapeHTML(sender?.email || "Not available")}</p>
        <p><b>Student ID:</b> ${escapeHTML(sender?.student_id || "—")}</p>
        <p><b>Department:</b> ${escapeHTML(sender?.department || "—")}</p>
        <p><b>Title:</b> ${escapeHTML(complaint.title)}</p>
        <p><b>Category:</b> ${escapeHTML(complaint.category)}</p>
        <p><b>Location:</b> ${escapeHTML(complaint.location)}</p>
        <p><b>Description:</b></p>
        <p style="white-space:pre-wrap">${escapeHTML(complaint.description)}</p>
        <p><b>Status:</b> ${escapeHTML(complaint.status)}</p>
        <p><b>Submitted:</b> ${escapeHTML(formatDate(complaint.created_at))}</p>
      `;
    }

    if ($("confidential-reply-subject")) {
      $("confidential-reply-subject").value =
        `Private response - ${complaint.complaint_id || "LTSUCare complaint"}`;
    }

    if ($("confidential-reply-message")) {
      $("confidential-reply-message").value = "";
    }

    setStatus("confidential-reply-status", "");
  });

  $("confidential-message-reply-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!selectedConfidentialComplaint) {
      return setStatus(
        "confidential-reply-status",
        "Pehle inbox se complaint open karo."
      );
    }

    const subject = $("confidential-reply-subject")?.value.trim();
    const message = $("confidential-reply-message")?.value.trim();

    const button = $("confidential-message-reply-form")
      ?.querySelector('[type="submit"]');

    if (!subject || !message) {
      return setStatus(
        "confidential-reply-status",
        "Subject aur reply message required hain."
      );
    }

    if (!confirm(
      "Kya aap is confidential message ka private email reply bhejna chahte hain?"
    )) return;

    setButtonLoading(button, true, "Sending reply...", "Send Reply");

    try {
      const result = await invokeEmailFunction({
        action: "confidential_reply",
        complaint_uuid: selectedConfidentialComplaint.id,
        subject,
        message
      });

      emailStats.accepted++;
      updateEmailStats();

      setStatus(
        "confidential-reply-status",
        result.message || "Reply accepted by Brevo.",
        true
      );
    } catch (error) {
      emailStats.failed++;
      updateEmailStats();
      setStatus("confidential-reply-status", error.message);
    } finally {
      setButtonLoading(button, false, "Sending reply...", "Send Reply");
    }
  });

  // =====================================================
  // EMAIL ANALYTICS
  // =====================================================

  function renderEmailAnalytics() {
    updateEmailStats();

    const chart = $("email-performance-chart");
    if (!chart) return;

    const total = emailStats.accepted + emailStats.failed;

    const acceptedPercent = total
      ? Math.round(emailStats.accepted / total * 100)
      : 0;

    const failedPercent = total
      ? 100 - acceptedPercent
      : 0;

    chart.innerHTML = `
      <div style="padding:12px 0">
        <p>Brevo accepted in this session: ${emailStats.accepted}</p>

        <div style="height:12px;background:#e8eee9;border-radius:20px;overflow:hidden">
          <div style="height:100%;width:${acceptedPercent}%;background:#20a36b"></div>
        </div>

        <p>Failed in this session: ${emailStats.failed}</p>

        <div style="height:12px;background:#e8eee9;border-radius:20px;overflow:hidden">
          <div style="height:100%;width:${failedPercent}%;background:#d97777"></div>
        </div>

        <small>
          Session-only statistics. Not confirmed delivery or daily quota.
        </small>
      </div>
    `;
  }

  // =====================================================
  // ACTIVITY LOGS
  // =====================================================

  async function loadActivityLogs() {
    const tbody = $("activity-list");
    if (!tbody) return;

    const { data, error } = await db
      .from("activity_logs")
      .select("id,actor_id,action,target,created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      tbody.innerHTML =
        `<tr><td colspan="4">Activity logs unavailable.</td></tr>`;
      return;
    }

    tbody.innerHTML = data?.length
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

  // =====================================================
  // PROFILE / SETTINGS
  // =====================================================

  function loadSuperAdminProfile() {
    if (!$("super-admin-profile") || !currentProfile) return;

    $("super-admin-profile").innerHTML = `
      <p><b>Name:</b> ${escapeHTML(currentProfile.full_name || "—")}</p>
      <p><b>Email:</b> ${escapeHTML(currentProfile.email || "—")}</p>
      <p><b>Role:</b> Super Admin</p>
      <p><b>Account Status:</b> Active</p>
    `;
  }

  // =====================================================
  // LOGOUT / FORGOT PASSWORD
  // =====================================================

  $("logout-btn")?.addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.reload();
  });

  $("forgot-password-btn")?.addEventListener("click", () => {
    window.location.href =
      "/ltsu-campus-support/super-admin/reset-password.html";
  });

  // =====================================================
  // RESTORE SESSION
  // =====================================================

  try {
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    if (data.session?.user) {
      await verifySuperAdmin(data.session.user);
    }
  } catch (error) {
    console.error("Session restore error:", error);
  }
});
