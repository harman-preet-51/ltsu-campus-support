
document.addEventListener("DOMContentLoaded", async () => {
  const db = window.supabaseClient;
  const $ = id => document.getElementById(id);

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwhM-icfed2rd2xA_aFwIFTpXGQourymAtY4xPnVV5eWFpk6yc5mDYv6_Dg3pXtLG_XTw/exec";

  let currentUser = null;
  let currentProfile = null;
  let adminRequests = [];
  let complaints = [];

  if (!db) {
    alert("Supabase connection missing. Check supabase-config.js");
    return;
  }

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  })[char]);

  // SUPER ADMIN LOGIN VERIFICATION
  async function verifySuperAdmin(user) {
    const { data, error } = await db
      .from("profiles")
      .select("id,full_name,email,role,is_active")
      .eq("id", user.id)
      .single();

    if (error || !data || data.role !== "super_admin" || data.is_active !== true) {
      await db.auth.signOut();
      alert("Super Admin access denied.");
      return false;
    }

    currentUser = user;
    currentProfile = data;

    $("login-page")?.classList.add("hidden");
    $("dashboard")?.classList.remove("hidden");

    document.querySelectorAll(".admin-label").forEach(el => {
      el.textContent = data.full_name || data.email;
    });

    await loadAdminRequests();
    await loadAdminCount();
    await loadComplaints();

    return true;
  }

  // LOGIN
  $("login-form")?.addEventListener("submit", async event => {
    event.preventDefault();

    const email = $("admin-id")?.value.trim();
    const password = $("admin-pin")?.value;

    if (!email || !password) {
      alert("Email aur password bharo.");
      return;
    }

    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      alert(error.message);
      return;
    }

    await verifySuperAdmin(data.user);
  });

  // LOAD ADMIN REQUESTS
  async function loadAdminRequests() {
    const container = $("admins");
    if (!container) return;

    const { data, error } = await db
      .from("admin_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      container.innerHTML = "<p>Admin requests load nahi hui: " +
        escapeHTML(error.message) + "</p>";
      return;
    }

    adminRequests = data || [];
    renderAdminRequests();
  }

  function renderAdminRequests() {
    const container = $("admins");
    if (!container) return;

    if (!adminRequests.length) {
      container.innerHTML = "<h2>Admin Management</h2><p>Abhi koi admin request nahi hai.</p>";
      return;
    }

    container.innerHTML = `
      <h2>Admin Management</h2>
      ${adminRequests.map(request => `
        <div style="border:1px solid #ddd;padding:15px;margin:12px 0;border-radius:8px">
          <h3>${escapeHTML(request.full_name)}</h3>
          <p><b>Email:</b> ${escapeHTML(request.email)}</p>
          <p><b>Contact:</b> ${escapeHTML(request.contact_number)}</p>
          <p><b>Department:</b> ${escapeHTML(request.department)}</p>
          <p><b>Reason:</b> ${escapeHTML(request.reason)}</p>
          <p><b>Status:</b> ${escapeHTML(request.status)}</p>
          ${request.status === "pending" ? `
            <button type="button" data-approve="${escapeHTML(request.id)}">Approve</button>
            <button type="button" data-reject="${escapeHTML(request.id)}">Reject</button>
          ` : ""}
        </div>
      `).join("")}
    `;
  }

  // APPROVE / REJECT REQUESTS
  $("admins")?.addEventListener("click", async event => {
    const approveButton = event.target.closest("[data-approve]");
    const rejectButton = event.target.closest("[data-reject]");

    if (approveButton) {
      const request = adminRequests.find(r => r.id === approveButton.dataset.approve);
      if (!request) return;

      if (!confirm("Is Admin request ko approve karna hai?")) return;

      if (!request.user_id) {
        alert("Is request ke saath user ID nahi mili. Approval nahi ho sakta.");
        return;
      }

      const { error: profileError } = await db
        .from("profiles")
        .update({
          role: "admin",
          is_active: true,
          department: request.department
        })
        .eq("id", request.user_id);

      if (profileError) {
        alert("Profile approval error: " + profileError.message);
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
        alert("Request status update error: " + requestError.message);
        return;
      }

      alert("Admin request approved successfully. Department assigned: " + (request.department || "Not specified"));
      await loadAdminRequests();
      await loadAdminCount();
    }

    if (rejectButton) {
      const request = adminRequests.find(r => r.id === rejectButton.dataset.reject);
      if (!request) return;

      if (!confirm("Is Admin request ko reject karna hai?")) return;

      const { error } = await db
        .from("admin_requests")
        .update({
          status: "rejected",
          reviewed_by: currentUser.id,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", request.id);

      if (error) {
        alert("Reject error: " + error.message);
        return;
      }

      alert("Request rejected.");
      await loadAdminRequests();
    }
  });

  // ACTIVE ADMIN COUNT
  async function loadAdminCount() {
    const { count, error } = await db
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);

    if (!error) {
      const target = $("admin-count");
      if (target) target.textContent = count ?? 0;
    }
  }

  // LOAD COMPLAINTS FOR EMAIL CENTRE
  async function loadComplaints() {
    const { data, error } = await db
      .from("complaints")
      .select("id,complaint_id,user_id,category,title,location,description,status,notes,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Complaints load error:", error.message);
      complaints = [];
    } else {
      complaints = data || [];
    }

    renderEmailCentre();
  }

  // CREATE EMAIL CENTRE
  function createEmailCentre() {
    let section = $("super-admin-email-section");

    if (!section) {
      section = document.createElement("section");
      section.id = "super-admin-email-section";
      section.className = "page-section hidden";
      section.innerHTML = `
        <h2>Student Complaint Email Centre</h2>
        <p>Select complaints. Each student will receive an individual email.</p>

        <label for="sa-mail-status">Filter by status</label>
        <select id="sa-mail-status">
          <option value="">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
        </select>

        <p id="sa-mail-complaints"></p>

        <label for="sa-mail-subject">Email subject</label>
        <input id="sa-mail-subject"
          value="Update on your LTSUCare complaint">

        <label for="sa-mail-remarks">Remarks for selected students</label>
        <textarea id="sa-mail-remarks" rows="4"
          placeholder="Write resolution details or update"></textarea>

        <button type="button" id="sa-mail-send">
          Send Email to Selected Students
        </button>

        <p id="sa-mail-result"></p>
      `;

      $("dashboard")?.appendChild(section);
    }

    // Add navigation button if not already present
    if (!document.querySelector('[data-page="super-admin-email-section"]')) {
      const nav = document.querySelector(".dashboard-navigation") ||
                  document.querySelector(".sidebar") ||
                  $("dashboard");

      if (nav) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nav-btn";
        button.dataset.page = "super-admin-email-section";
        button.textContent = "Student Emails";
        nav.appendChild(button);
      }
    }

    $("sa-mail-status")?.addEventListener("change", renderEmailCentre);
    $("sa-mail-send")?.addEventListener("click", sendSelectedEmails);
  }

  function renderEmailCentre() {
    createEmailCentre();

    const list = $("sa-mail-complaints");
    if (!list) return;

    const status = $("sa-mail-status")?.value || "";
    const filtered = complaints.filter(c => !status || c.status === status);

    if (!filtered.length) {
      list.innerHTML = "<p>No complaints found.</p>";
      return;
    }

    list.innerHTML = filtered.map(c => `
      <label style="display:block;padding:10px;border-bottom:1px solid #ddd">
        <input type="checkbox" class="sa-mail-check"
          value="${escapeHTML(c.complaint_id)}">
        ${escapeHTML(c.complaint_id)} —
        ${escapeHTML(c.title || c.category || "Complaint")}
        (${escapeHTML(c.status)})
      </label>
    `).join("");
  }

  // SEND INDIVIDUAL EMAILS
  async function sendSelectedEmails() {
    const selected = [
      ...document.querySelectorAll(".sa-mail-check:checked")
    ].map(input => input.value);

    if (!selected.length) {
      alert("Kam se kam ek complaint select karo.");
      return;
    }

    const { data } = await db.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      alert("Login session expired. Dobara login karo.");
      return;
    }

    const remarksText = $("sa-mail-remarks")?.value.trim() || "";
    const remarks = {};

    selected.forEach(id => {
      remarks[id] = remarksText;
    });

    const button = $("sa-mail-send");
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
          complaintIds: selected,
          remarks,
          subject: $("sa-mail-subject")?.value.trim()
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Email sending failed");
      }

      $("sa-mail-result").textContent =
        "Email request accepted. Selected complaints: " + selected.length;

    } catch (error) {
      $("sa-mail-result").textContent = "Error: " + error.message;
    } finally {
      button.disabled = false;
      button.textContent = "Send Email to Selected Students";
    }
  }

  // NAVIGATION
  document.addEventListener("click", event => {
    const button = event.target.closest(".nav-btn");
    if (!button) return;

    const targetId = button.dataset.page || button.dataset.section;
    if (!targetId) return;

    document.querySelectorAll(".page-section").forEach(section => {
      section.classList.add("hidden");
    });

    $(targetId)?.classList.remove("hidden");
  });

  // LOGOUT
  $("logout-btn")?.addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.reload();
  });

  // FORGOT PASSWORD
  $("forgot-password-btn")?.addEventListener("click", () => {
    window.location.href = "/ltsu-campus-support/super-admin/reset-password.html";
  });

  // BASIC AI HELPER - LEFT UNCHANGED FOR NOW
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

    let answer = "Please check the Admin Management and Complaints sections.";

    if (lower.includes("request")) {
      answer = "Admin Management section mein pending requests check karein.";
    } else if (lower.includes("approve")) {
      answer = "Admin Management mein request ke saamne Approve button dabayein.";
    } else if (lower.includes("complaint")) {
      answer = "Student complaint emails ke liye Student Emails section kholein.";
    } else if (lower.includes("email")) {
      answer = "Student Emails section mein complaints select karke email bhejein.";
    }

    messages.innerHTML += `
      <p><b>You:</b> ${escapeHTML(question)}</p>
      <p><b>Assistant:</b> ${escapeHTML(answer)}</p>
    `;

    input.value = "";
  }

  $("ai-send")?.addEventListener("click", sendAIMessage);

  $("ai-input")?.addEventListener("keydown", event => {
    if (event.key === "Enter") sendAIMessage();
  });

  // RESTORE EXISTING SESSION
  const { data } = await db.auth.getSession();

  if (data.session?.user) {
    await verifySuperAdmin(data.session.user);
  }
});
