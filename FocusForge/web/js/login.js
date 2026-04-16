import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup 
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJzcI7xT5ZPEMUbK5dWjAWYro5h0sGFbo",
  authDomain: "focusforge-f2293.firebaseapp.com",
  projectId: "focusforge-f2293",
  appId: "1:7861425292:web:279f9d6ffea07780b217a9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
auth.languageCode = 'en'


document.addEventListener("DOMContentLoaded", () => {
    const signBtn = document.getElementById("sign");
    const registerBtn = document.getElementById("register");

    let failed_count = parseInt(localStorage.getItem("failed_count") || "0", 10);
    let cooldown_until = parseInt(localStorage.getItem("cooldown_until") || "0", 10);

    const resetCooldown = () => {
        failed_count = 0;
        cooldown_until = 0;
        localStorage.removeItem("failed_count");
        localStorage.removeItem("cooldown_until");
    };

    const updateLoginState = () => {
        const now = Date.now();

        // Reset cooldown if expired
        if (cooldown_until && now >= cooldown_until) {
            resetCooldown();
        }

        if (failed_count >= 5 && cooldown_until) {
            const remainingMs = Math.max(cooldown_until - now, 0);
            const minutes = Math.floor(remainingMs / 60000);
            const seconds = Math.floor((remainingMs % 60000) / 1000);
            signBtn.disabled = true;
            signBtn.textContent = `Try again in ${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
        } else {
            signBtn.disabled = false;
            signBtn.textContent = "Sign In";
        }
    };

    updateLoginState();

    signBtn.addEventListener("click", async () => {
        updateLoginState(); // make sure cooldown is checked first

        if (signBtn.disabled) {
            // Button is disabled, just return
            return;
        }

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();

        if (!username || !password) {
            Swal.fire({
                title: "Error!",
                text: "Enter username and password!",
                icon: "error"
            });
            return;
        }

        try {
            const response = await fetch("/login_api", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({username, password, failed_count})
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem("sessionToken", data.token);
                localStorage.setItem("user_id", data.user_id);
                resetCooldown();
                window.location.href = "/dashboard";
            } else {
                const text = await response.text();
                alert("Login failed: " + text);

                failed_count++;
                localStorage.setItem("failed_count", failed_count);

                if (failed_count >= 5) {
                    cooldown_until = Date.now() + 10 * 60 * 1000;
                    localStorage.setItem("cooldown_until", cooldown_until);
                    Swal.fire({
                        title: "Error!",
                        text: "Too many attempts,Try again in 10 minutes!",
                        icon: "error"
                    });
                }

                updateLoginState();
            }
        } catch (err) {
            console.log("Login error:", err);
            alert("Failed to connect to server");
        }
    });

    registerBtn.addEventListener("click", () => {
        window.location.href = "/register";
    });

    // Update countdown every second
    setInterval(updateLoginState, 1000);

    const googleLogin = document.getElementById("googleLogin");
    googleLogin.addEventListener("click", async function(){
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const payload = { user: { uid: user.uid, email: user.email, displayName: user.displayName || user.email?.split("@")[0] || "GoogleUser" } };

            const response = await fetch("/google_api", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload)
            });

            if(response.ok) {
                const data = await response.json();
                localStorage.setItem("sessionToken", data.token);
                localStorage.setItem("user_id", data.user_id);
                window.location.href = "/dashboard";
            } else {
                const text = await response.text();
                Swal.fire({
                    title: "Login failed",
                    text: text,
                    icon: "error"
                });
            }
        } catch (error) {
            console.error("Google sign-in failed", error);
            Swal.fire({
                title: "Google sign-in failed",
                text: error.message || "Please try again.",
                icon: "error"
            });
        }
    });

});
        