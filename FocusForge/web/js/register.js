import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

// ─────────────────────────────────────────────
// Firebase INIT
// ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCJzcI7xT5ZPEMUbK5dWjAWYro5h0sGFbo",
  authDomain: "focusforge-f2293.firebaseapp.com",
  projectId: "focusforge-f2293",
  appId: "1:7861425292:web:279f9d6ffea07780b217a9"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "en";

const provider = new GoogleAuthProvider();

// ─────────────────────────────────────────────
// AUTH TRANSLATIONS
// ─────────────────────────────────────────────
const AUTH_STRINGS = {
  en: { title:"Create your account", subtitle:"Manage your upcoming exams",
        username:"Username", email:"Email", password:"Password",
        confirm:"Confirm Password", terms:"I agree to the",
        termsLink:"Terms and Conditions",
        register:"Create Account", login:"Back to Sign In",
        or:"or", google:"Continue with Google",
        userPh:"6–14 characters", emailPh:"you@example.com",
        passPh:"6–20 characters", confirmPh:"Repeat your password" },

  es: { title:"Crea tu cuenta", subtitle:"Gestiona tus próximos exámenes",
        username:"Usuario", email:"Correo electrónico", password:"Contraseña",
        confirm:"Confirmar contraseña", terms:"Acepto los",
        termsLink:"Términos y condiciones",
        register:"Crear cuenta", login:"Volver al inicio de sesión",
        or:"o", google:"Continuar con Google",
        userPh:"6–14 caracteres", emailPh:"tu@ejemplo.com",
        passPh:"6–20 caracteres", confirmPh:"Repite la contraseña" },

  fr: { title:"Créer votre compte", subtitle:"Gérez vos examens à venir",
        username:"Nom d'utilisateur", email:"E-mail", password:"Mot de passe",
        confirm:"Confirmer le mot de passe", terms:"J'accepte les",
        termsLink:"Conditions générales",
        register:"Créer un compte", login:"Retour à la connexion",
        or:"ou", google:"Continuer avec Google",
        userPh:"6–14 caractères", emailPh:"vous@exemple.fr",
        passPh:"6–20 caractères", confirmPh:"Répétez le mot de passe" },

  gr: { title:"Δημιουργία λογαριασμού", subtitle:"Διαχειρίσου τις επερχόμενες εξετάσεις",
        username:"Όνομα χρήστη", email:"Email", password:"Κωδικός",
        confirm:"Επιβεβαίωση κωδικού", terms:"Αποδέχομαι τους",
        termsLink:"Όρους και Προϋποθέσεις",
        register:"Δημιουργία λογαριασμού", login:"Πίσω στη σύνδεση",
        or:"ή", google:"Συνέχεια με Google",
        userPh:"6–14 χαρακτήρες", emailPh:"εσύ@παράδειγμα.gr",
        passPh:"6–20 χαρακτήρες", confirmPh:"Επανάληψη κωδικού" },

  it: { title:"Crea il tuo account", subtitle:"Gestisci i tuoi prossimi esami",
        username:"Nome utente", email:"Email", password:"Password",
        confirm:"Conferma password", terms:"Accetto i",
        termsLink:"Termini e condizioni",
        register:"Crea account", login:"Torna al login",
        or:"oppure", google:"Continua con Google",
        userPh:"6–14 caratteri", emailPh:"tu@esempio.it",
        passPh:"6–20 caratteri", confirmPh:"Ripeti la password" },
};

function changeAuthLanguage(lang) {
  localStorage.setItem("language", lang);
  const s = AUTH_STRINGS[lang] || AUTH_STRINGS.en;

  document.getElementById("auth-title").textContent = s.title;
  document.getElementById("auth-subtitle").textContent = s.subtitle;
  document.getElementById("lbl-username").textContent = s.username;
  document.getElementById("lbl-email").textContent = s.email;
  document.getElementById("lbl-password").textContent = s.password;
  document.getElementById("lbl-confirm").textContent = s.confirm;

  document.getElementById("lbl-terms").childNodes[0].textContent = s.terms + " ";
  document.getElementById("lbl-terms-link").textContent = s.termsLink;

  document.getElementById("btn-register-text").textContent = s.register;
  document.getElementById("btn-login-text").textContent = s.login;
  document.getElementById("auth-or").textContent = s.or;
  document.getElementById("auth-google").textContent = s.google;

  document.getElementById("username").placeholder = s.userPh;
  document.getElementById("email").placeholder = s.emailPh;
  document.getElementById("password").placeholder = s.passPh;
  document.getElementById("confirmPassword").placeholder = s.confirmPh;
}

// ─────────────────────────────────────────────
// MAIN LOGIC (ONE DOM READY BLOCK)
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const registerBtn = document.getElementById("registerBtn");
  const loginBtn = document.getElementById("loginBtn");
  const termsCheckbox = document.getElementById("termsCheckbox");
  const googleBtn = document.getElementById("googleLogin");

  const langSelect = document.getElementById("auth-lang-select");
  const savedLang = localStorage.getItem("language") || "en";

  langSelect.value = savedLang;
  changeAuthLanguage(savedLang);

  langSelect.addEventListener("change", (e) => {
    changeAuthLanguage(e.target.value);
  });

  registerBtn.disabled = !termsCheckbox.checked;

  termsCheckbox.addEventListener("change", () => {
    registerBtn.disabled = !termsCheckbox.checked;
  });

  // ───────── REGISTER ─────────
  registerBtn.addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirm_password = document.getElementById("confirmPassword").value.trim();
    const email = document.getElementById("email").value.trim();

    if (!username || !password) return;
    if (password !== confirm_password) return;

    try {
      const response = await fetch("/register_api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          confirm_password,
          email,
          termsAccepted: true
        })
      });

      if (response.ok) {
        window.location.href = "/login";
      }
      if (!termsCheckbox.checked) {
        Swal.fire({ title:"Error!", text:"You must agree to the Terms and Conditions!", icon:"error" });
        return;
      }
    } catch (err) {
      console.error(err);
    }
  });

  // ───────── LOGIN PAGE BUTTON ─────────
  loginBtn.addEventListener("click", () => {
    window.location.href = "/login";
  });

  // ───────── GOOGLE LOGIN ─────────
  googleBtn?.addEventListener("click", async () => {

     if (!termsCheckbox.checked) {
                    const result = await Swal.fire({                        title: "Terms & Conditions",
                    text: "Please accept the Terms and Conditions to continue.",
                      icon: "warning",
                      showCancelButton: true,
                        confirmButtonText: "Accept & Continue",
                        cancelButtonText: "Cancel",
                        confirmButtonColor: "#2563eb"
                    });
                    if (!result.isConfirmed) return;
                    termsCheckbox.checked = true;
                    registerBtn.disabled = false;
                }

    try {
      const signInPromise = signInWithPopup(auth, provider);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000));
      const result = await Promise.race([signInPromise, timeoutPromise]);
      const user = result.user;

      const payload = {
        user: {
          uid: user.uid,
          email: user.email,
          displayName:
            user.displayName ||
            user.email?.split("@")[0] ||
            "GoogleUser"
        }
      };

      const response = await fetch("/google_api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.time("Google login flow");

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("sessionToken", data.token);
        localStorage.setItem("user_id", data.user_id);
        Swal.fire({ title:"Login successful", text: "You have been logged in.", icon:"success" });
        console.log("Google sign-in successful, session token stored.");
        console.timeLog("Google login flow");
        window.location.href = "/dashboard";
      } else {
        const text = await response.text();
        Swal.fire({ title:"Login failed", text, icon:"error" });
      }
    } catch (error) {
      if (error.message === 'Timeout') {
        Swal.fire({ title: "Timeout", text: "Sign-in took too long. Please try again.", icon: "error" });
      } else {
        console.error("Google sign-in failed", error);
        Swal.fire({ title:"Google sign-in failed", text: error.message || "Please try again.", icon:"error" });
      }
    }
  });
});