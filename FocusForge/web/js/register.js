import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJzcI7xT5ZPEMUbK5WjAWYro5h0sGFbo",
  authDomain: "focusforge-f2293.firebaseapp.com",
  projectId: "focusforge-f2293",
  appId: "1:7861425292:web:279f9d6ffea07780b217a9"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();

document.addEventListener("DOMContentLoaded", () => {
    const registerBtn = document.getElementById("registerBtn");
    const loginBtn = document.getElementById("loginBtn");
    const termsCheckbox = document.getElementById("termsCheckbox");
    const googleLogin = document.getElementById("googleLogin");

    registerBtn.disabled=true;

    termsCheckbox.addEventListener("change", () => {
               registerBtn.disabled = !termsCheckbox.checked;
            });

    registerBtn.addEventListener("click", async (e) => {
        if(!termsCheckbox.checked) {
            e.preventDefault();
            Swal.fire({
                title: "Error!",
                text: "You must agree to the Terms and Conditions!",
                icon: "error"
            });
            return;
        }

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();
        const confirm_password = document.getElementById("confirmPassword").value.trim();
        const email = document.getElementById("email").value.trim();

        if(!username || !password){
            Swal.fire({
                title: "Error!",
                text: "Enter username and password!",
                icon: "error"
            });
            return;
        }
        
        if(password !== confirm_password){
            Swal.fire({
                title: "Error!",
                text: "Passwords do not match!",
                icon: "error"
            });
           return;
        }

        try{
            const response = await fetch("/register_api", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({username,password,confirm_password,email,termsAccepted: true}),
            });

            if(response.ok) {
                Swal.fire({
                    title: "Success",
                    text: "You register successufully!",
                    icon: "success"
                });
                window.location.href = "/login";
            }else if (response.status === 400){
                const text = await response.text();
                alert("Failed: " + text);
            } else {
                const text = await response.text();
                alert("Failed: " + text);
            }
        } catch (err) {
            console.error("Error registering user:", err);
            Swal.fire({
                title: "Error!",
                text: "Could not coonect to server!",
                icon: "error"
            });
        }
    });


    loginBtn.addEventListener("click", () => {
        window.location.href = "/login";
    });

    if (googleLogin) {
        googleLogin.addEventListener("click", async () => {
            if (!termsCheckbox.checked) {
                Swal.fire({
                    title: "Error!",
                    text: "You must agree to the Terms and Conditions before signing up with Google!",
                    icon: "error"
                });
                return;
            }

            try {
                const result = await signInWithPopup(auth, provider);
                const user = result.user;
                const payload = {
                    user: {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || user.email?.split("@")[0] || "GoogleUser"
                    }
                };

                const response = await fetch("/google_api", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
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
    }
});