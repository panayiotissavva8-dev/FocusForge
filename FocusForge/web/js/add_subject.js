document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("sessionToken");

    if (!token) {
        console.error("No auth token: user not logged in.");
        alert("You must be logged in to use the dashboard.");
        window.location.href ="/login";
        return;
    }

document.getElementById("addBtn").onclick = async () => {
        const body = {
            name: document.getElementById("name").value.trim(),
            difficulty: parseInt(document.getElementById("difficulty").value, 10),
            deadline: document.getElementById("deadline").value,
            completed: 0,
            grade: parseFloat(document.getElementById("grade").value)
        };

        console.log("addBtn clicked", { body, token });

        if (!body.name) {
            alert("Subject name is required.");
            return;
        }

        try {
            const res = await fetch("/add_subject_api", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`API ${res.status}: ${text}`);
            }

            await loadSubjects();
            alert("Subject added successfully!");
        } catch (err) {
            console.error("Failed to add subject:", err);
            alert("Could not add subject. See console for details.");
        }
    };
});