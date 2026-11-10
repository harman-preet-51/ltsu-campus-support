
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("super-admin-register-form");
  const button = document.getElementById("register-button");
  const message = document.getElementById("register-message");

  if (!form || !button || !message) {
    return;
  }

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#dc2626" : "#15803d";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const db = window.supabaseClient;

    if (!db) {
      showMessage(
        "Supabase connection nahi mila. Configuration check karein.",
        true
      );
      return;
    }

    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim().toLowerCase();
    const phone = document.getElementById("register-phone").value.trim();
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("register-confirm-password").value;

    if (!name || !email || !phone || !password || !confirmPassword) {
      showMessage("Please saari details fill karein.", true);
      return;
    }

    if (name.length < 2) {
      showMessage("Please valid full name enter karein.", true);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage("Please valid email address enter karein.", true);
      return;
    }

    if (phone.length < 7 || phone.length > 20) {
      showMessage("Please valid phone number enter karein.", true);
      return;
    }

    if (password.length < 8 || password.length > 72) {
      showMessage("Password 8 se 72 characters ka hona chahiye.", true);
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Dono passwords match nahi kar rahe.", true);
      return;
    }

    button.disabled = true;
    button.textContent = "Submitting...";
    showMessage("");

    try {
      const { data, error } = await db.functions.invoke(
        "super-admin-register",
        {
          body: {
            name,
            email,
            phone,
            password
          }
        }
      );

      if (error) {
        let errorMessage = "Registration failed. Please try again.";

        if (error.context && typeof error.context.json === "function") {
          try {
            const details = await error.context.json();
            if (details && details.error) {
              errorMessage = details.error;
            }
          } catch (_) {
            // Keep the general error message.
          }
        }

        throw new Error(errorMessage);
      }

      if (!data || data.success !== true) {
        throw new Error(
          data?.error || "Registration could not be completed."
        );
      }

      showMessage(
        "Registration submitted successfully! Please wait for an existing Super Admin to approve your request."
      );

      form.reset();

    } catch (error) {
      console.error("Super Admin registration error:", error);
      showMessage(error.message || "Something went wrong.", true);

    } finally {
      button.disabled = false;
      button.textContent = "Submit Registration";
    }
  });
});
