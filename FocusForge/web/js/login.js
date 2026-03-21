const signBtn = document.getElementById("sign");
const registerBtn = document.getElementById("register");

signBtn.addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) return alert("Enter username and password");

    try{
        const response = await fetch("/login", {
            method: "POST",
            headers: {"Content-Type": "aplication/json"},
            body: JSON.stringify({username,password})
        });

        if(response.ok){
            const data = await response.json();
            localStorage.setItem("sessionToken", data);
            localStorage.setItem("user_id", data.user_id);
            window.location.href = "/dashboard";
        }else{
            const text = await response.text();
            alert("Login failed " + text);
        }

    } catch(err) {
        console.log("Login error:", err);
        alert("Failed to connect to server");
    }
});

registerBtn.addEventListener("click", () =>{
    window.location.href = "/register";
});