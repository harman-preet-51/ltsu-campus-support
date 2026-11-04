
document.addEventListener("DOMContentLoaded", async () => {
    const client = window.supabaseClient;
    const form = document.getElementById("reset-form");
    const message = document.getElementById("reset-message");
    const button = document.getElementById("reset-button");

    function showMessage(text, success = false) {
        message.textContent = text;
        message.style.color = success ? "#168c79" : "#d94b64";
    }

    if (!client) {
        showMessage("Supabase connection nahi mili.");
        form.style.display = "none";
        return;
    }

    const { data, error } = await client.auth.getSession();

    if (error || !data.session) {
        showMessage("Reset link invalid ya expire ho chuka hai. Naya reset link mangwayein.");
        form.style.display = "none";
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const password = document.getElementById("new-password").value;
        const confirmPassword = document.getElementById("confirm-password").value;

        if (password.length < 8) {
            showMessage("Password kam se kam 8 characters ka hona chahiye.");
            return;
        }

        if (password !== confirmPassword) {
            showMessage("Dono passwords match nahi kar rahe.");
            return;
        }

        button.disabled = true;
        button.textContent = "Updating...";

        const { error } = await client.auth.updateUser({
            password: password
        });

        if (error) {
            showMessage("Password update failed: " + error.message);
            button.disabled = false;
            button.textContent = "Update Password";
            return;
        }

        showMessage("Password successfully update ho gaya!", true);
        form.reset();

        await client.auth.signOut();
        button.textContent = "Password Updated";
    });
});
