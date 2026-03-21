document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("sessionToken");

    if (!token) {
        console.error("No auth token: user not logged in.");
        alert("You must be logged in to use the dashboard.");
        window.location.href ="/login";
        return;
    }

    async function loadSubjects() {
        try {
            const res = await fetch("/dashboard_api", {
                headers: { "Authorization": token }
            });

            if (!res.ok) {
                throw new Error(`loadSubjects failed: ${res.status} ${res.statusText}`);
            }

            const data = await res.json();
            const list = document.getElementById("subjectsList");
            if (!list) throw new Error("subjectsList element not found");
            list.innerHTML = "";

            data.subjects.forEach(s => {
                const div = document.createElement("div");
                div.className = "subject";
                div.innerHTML = `
                    <h3>${s.subject}</h3>
                    <p>Difficulty: ${s.difficulty}</p>
                    <p>Deadline: ${s.deadline}</p>
                    <p>Grade: ${s.grade}</p>
                `;
                list.appendChild(div);
            });
        } catch (err) {
            console.error("Failed to load subjects:", err);
            alert("Could not load subjects. Check console for details.");
        }
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

    loadSubjects();
});