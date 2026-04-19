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
            document.getElementById("auth-title").textContent      = s.title;
            document.getElementById("auth-subtitle").textContent   = s.subtitle;
            document.getElementById("lbl-username").textContent    = s.username;
            document.getElementById("lbl-email").textContent       = s.email;
            document.getElementById("lbl-password").textContent    = s.password;
            document.getElementById("lbl-confirm").textContent     = s.confirm;
            document.getElementById("lbl-terms").childNodes[0].textContent = s.terms + " ";
            document.getElementById("lbl-terms-link").textContent  = s.termsLink;
            document.getElementById("btn-register-text").textContent = s.register;
            document.getElementById("btn-login-text").textContent  = s.login;
            document.getElementById("auth-or").textContent         = s.or;
            document.getElementById("auth-google").textContent     = s.google;
            document.getElementById("username").placeholder        = s.userPh;
            document.getElementById("email").placeholder           = s.emailPh;
            document.getElementById("password").placeholder        = s.passPh;
            document.getElementById("confirmPassword").placeholder = s.confirmPh;
        }
 
        // Enable register button only when terms are checked
        document.addEventListener("DOMContentLoaded", () => {
            const cb  = document.getElementById("termsCheckbox");
            const btn = document.getElementById("registerBtn");
            cb.addEventListener("change", () => btn.disabled = !cb.checked);
        });
 
        // Restore saved language
        const savedLang = localStorage.getItem("language") || "en";
        document.getElementById("auth-lang-select").value = savedLang;
        changeAuthLanguage(savedLang);
});