

// State
let exams = [];
let editingExamId = null;
let authToken = null;

let translations = {};
let currentLang = 'en';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    authToken = localStorage.getItem("sessionToken");
    
    if (!authToken) {
        console.error("No auth token: user not logged in.");
        alert("You must be logged in to use the dashboard.");
        window.location.href = "/login";
        return;
    }

     const user = result.user;
    const token = await user.getIdToken();

    fetch("/auth/firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
});

    const savedLang = localStorage.getItem("language") || "en";
    await loadLanguage(savedLang);
    
    // Load exams from backend
    loadExams();
    
    // Form submit handler
    document.getElementById('exam-form').addEventListener('submit', handleFormSubmit);
    
    // Checkbox change handler for completed
    document.getElementById('completed').addEventListener('change', (e) => {
        const gradeGroup = document.getElementById('grade-group');
        gradeGroup.style.display = e.target.checked ? 'block' : 'none';
    });
    
    // Close dialog when clicking overlay
    document.getElementById('exam-dialog').addEventListener('click', (e) => {
        if (e.target.classList.contains('dialog-overlay')) {
            closeDialog();
        }
    });


});

// Apply saved theme on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-theme', savedTheme === 'dark');

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = savedTheme;
});




// Load exams from backend API
async function loadExams() {
    try {
        const res = await fetch("/dashboard_api", {
            headers: { "Authorization": authToken }
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                alert("Session expired. Please login again.");
                window.location.href = "/login";
                return;
            }
            throw new Error(`Failed to load exams: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        
        // Map backend data to frontend format
        exams = data.subjects.map(s => ({
            id: Number(s.id), // Use backend ID if available, otherwise generate
            subjectName: s.subject,
            date: s.deadline,
            difficulty: s.difficulty.toLowerCase(),
            reminder: s.reminder || 'none',
            completed: s.grade && s.grade !== '' && s.grade !== 'N/A', // Consider completed if grade exists
            grade: s.grade && s.grade !== 'N/A' ? s.grade : undefined
        }));
        
        renderExams();
    } catch (err) {
        console.error("Failed to load exams:", err);
        alert("Could not load exams. Check console for details.");
    }
}

// Save exam to backend (add new)
async function saveExam(examData) {
    try {
        const res = await fetch("/dashboard_api", {
            method: "POST",
            headers: { 
                "Authorization": authToken,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                subject: examData.subjectName,
                deadline: examData.date,
                difficulty: examData.difficulty,
                reminder: examData.reminder || 'none',
                grade: examData.grade || ''
            })
        });

        if(res.ok) {
        Swal.fire({
            theme: "auto",
         position: "center",
         icon: "success",
         title:translations.alert['add-success'],
         howConfirmButton: false,
         timer: 1700
        });
    }

        if (!res.ok) {
            throw new Error(`Failed to save exam: ${res.status} ${res.statusText}`);
        }

        // Reload exams from backend
        await loadExams();
    } catch (err) {
        console.error("Failed to save exam:", err);
        alert("Could not save exam. Check console for details.");
        throw err;
    }
}

// Update exam on backend
async function updateExam(examId, examData) {
    try {
        const res = await fetch(`/dashboard_api/${examId}`, {
            method: "PUT",
            headers: { 
                "Authorization": authToken,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                subject: examData.subjectName,
                deadline: examData.date,
                difficulty: examData.difficulty,
                reminder : examData.reminder,
                grade: examData.grade || ''
            })
        });

        if(res.ok) {
             Swal.fire({
         position: "center",
         icon: "success",
         title: translations.alert['update-success'],
         howConfirmButton: false,
         timer: 1550
        });
        }

        if (!res.ok) {
            throw new Error(`Failed to update exam: ${res.status} ${res.statusText}`);
        }

        // Reload exams from backend
        await loadExams();
    } catch (err) {
        console.error("Failed to update exam:", err);
        alert("Could not update exam. Check console for details.");
        throw err;
    }
}


// Delete exam from backend
async function deleteExamFromBackend(examId) {
    try {
        const res = await fetch(`/dashboard_api/${examId}`, {
            method: "DELETE",
            headers: { 
                "Authorization": authToken
            }
        });

        if (!res.ok) {
            throw new Error(`Failed to delete exam: ${res.status} ${res.statusText}`);
        }

        // Reload exams from backend
        await loadExams();
    } catch (err) {
        console.error("Failed to delete exam:", err);
        alert("Could not delete exam. Check console for details.");
    }
}

// Generate unique ID (for local use if backend doesn't provide IDs)
function generateId() {
    return 'exam_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Format date
function formatDate(dateString) {
    if (!dateString || dateString === "none") return "No date";

    const date = new Date(dateString);
    console.log("RAW DATE:", dateString);
    if (isNaN(date)) return "Invalid date";

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}


// Check if exam is overdue
function isOverdue(dateString, completed) {
    if (completed) return false;
    const examDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return examDate < today;
}

// Switch tabs
function switchTab(tabName) {
    // Update tab triggers
    document.querySelectorAll('.tab-trigger').forEach(trigger => {
        trigger.classList.remove('active');
    });
    event.target.closest('.tab-trigger').classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName + '-tab').classList.add('active');
}

// Open dialog
function openDialog(examId = null) {
    const dialog = document.getElementById('exam-dialog');
    const form = document.getElementById('exam-form');
    const title = document.getElementById('dialog-title');
    const description = document.getElementById('dialog-description');
    const submitBtn = document.getElementById('submit-btn');
    const gradeGroup = document.getElementById('grade-group');
    
    editingExamId = examId;

    console.log("examId:", examId, typeof examId);
    
    if (examId) {
        // Edit mode
        const exam = exams.find(e => e.id === examId);
        if (exam) {
            document.getElementById('subject').value = exam.subjectName;
            document.getElementById('deadline').value = exam.date;
            document.getElementById('difficulty').value = exam.difficulty;
            document.getElementById('reminder').value = exam.reminder || 'none';
            document.getElementById('completed').checked = exam.completed;
            document.getElementById('grade').value = exam.grade || '';
            gradeGroup.style.display = exam.completed ? 'block' : 'none';
            
            title.textContent = translations["edit-exam"] || 'Edit Exam';
            description.textContent = translations["edit-exam-sub-text"] || 'Update your exam details below.';
            submitBtn.textContent = translations["update-exam-button"] || 'Update Exam';
        }
    } else {
        // Add mode
        form.reset();
        gradeGroup.style.display = 'none';
        title.textContent = translations["add-new-exam"] || 'Add New Exam';
        description.textContent = translations["add-new-exam-sub-text"] || 'Enter the details of your upcoming exam.';
        submitBtn.textContent = translations["add-exam-button"] || 'Add Exam';
    }
    
    dialog.classList.add('active');
}


// Close dialog
function closeDialog() {
    const dialog = document.getElementById('exam-dialog');
    dialog.classList.remove('active');
    editingExamId = null;
}

function openSettings() {
    document.getElementById('settings-dialog').classList.add('active');
    
}

function closeSettings() {
    const dialog = document.getElementById("settings-dialog");
    dialog.classList.remove("active");
}

function changeTheme(value) {
    document.body.classList.toggle('dark-theme', value === 'dark');
    localStorage.setItem('theme', value);
    

}

function changeLanguage(lang) {
    localStorage.setItem("language", lang);
    loadLanguage(lang);
}

async function loadLanguage(lang) {
    const res = await fetch(`/lang/${lang}.json`);
    translations = await res.json();
    currentLang = lang;

    localStorage.setItem("language", lang);

    applyTranslations();
}

function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        if (translations[key]) {
            el.textContent = translations[key];
        }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (translations[key]) {
            el.placeholder = translations[key];
        }
    });

    renderExams(); // Re-render exams to update any translated text
}


// Handle form submit
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const examData = {
        subjectName: document.getElementById('subject').value,
        date: document.getElementById('deadline').value,
        difficulty: document.getElementById('difficulty').value,
        reminder: document.getElementById('reminder').value,
        completed: document.getElementById('completed').checked,
        grade: document.getElementById('grade').value || undefined
    };
    
    try {
        if (editingExamId) {
            // Update existing exam
            await updateExam(editingExamId, examData);
        } else {
            // Add new exam
            await saveExam(examData);
        }
        
        closeDialog();
    } catch (err) {
        // Error already handled in save/update functions
        console.error("Form submit error:", err);
    }
}

// Delete exam
async function deleteExam(id) {
  const swalWithBootstrapButtons = Swal.mixin({
    customClass: {
      confirmButton: "btn btn-success",
      cancelButton: "btn btn-danger"
    },
    
  });

  const result = await swalWithBootstrapButtons.fire({
    title: translations.alert['delete-confirmation'],
    text: translations.alert['delete-warning'],
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: translations.alert['delete-yes'],
    cancelButtonText: translations.alert['delete-no'],
    reverseButtons: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#dc2626'
  });

  if (result.isConfirmed) {
    await deleteExamFromBackend(id);

    await swalWithBootstrapButtons.fire({
      title: translations.alert['delete-title'],
      text: translations.alert['delete-success'],
      icon: "success"
    });

  } else if (result.dismiss === Swal.DismissReason.cancel) {
    await swalWithBootstrapButtons.fire({
      title: translations.alert['cancel-title'],
      text: translations.alert['delete-cancel'],
      icon: "error"
    });
  }
}

// Mark as completed
function markAsCompleted(id) {
    openDialog(id);
    document.getElementById('completed').checked = true;
    document.getElementById('grade-group').style.display = 'block';
}

// Create exam card HTML
function createExamCard(exam) {
    const difficultyLabels = {
        none: translations['difficulty-none'] || 'None',
        low: translations['difficulty-low'] || 'Low',
        medium: translations['difficulty-medium'] || 'Medium',
        high: translations['difficulty-high'] || 'High'
    };
    
    const overdue = isOverdue(exam.date, exam.completed);
    
    return `
        <div class="exam-card">
            <div class="card-header">
                <div class="card-title">
                    <h3>${exam.subjectName}</h3>
                    <div class="card-date">
                        <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${formatDate(exam.date)}
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn btn-ghost" id="update-btn" onclick="openDialog(${exam.id})">
                        <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-ghost btn-danger" onclick="deleteExam('${exam.id}')">
                        <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="card-badges">
                    <span class="badge badge-${exam.difficulty}">${difficultyLabels[exam.difficulty]}</span>
                    ${overdue ? `
                        <span class="badge badge-overdue">
                            <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            <span>${translations["overdue"] || 'Overdue'}</span>
                        </span>
                    ` : ''}
                    ${exam.completed ? `
                        <span class="badge badge-completed">
                            <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            <span>${translations["completed"] || 'Completed'}</span>
                        </span>
                    ` : ''}
                </div>
                ${exam.grade ? `
                    <div class="grade-display">
                        <p>${translations["grade"] || 'Grade'}</p>
                        <p>${exam.grade}</p>
                    </div>
                ` : ''}
                ${!exam.completed ? `
                    <button class="btn btn-outline btn-full" onclick="markAsCompleted('${exam.id}')">
                        <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span>${translations["mark-as-completed"] || 'Mark as Completed'}</span>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// Render exams
function renderExams() {
    // Separate upcoming and completed exams
    const upcoming = exams
        .filter(e => !e.completed)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const completed = exams
        .filter(e => e.completed)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Update counts
    document.getElementById('upcoming-count').textContent = upcoming.length;
    document.getElementById('completed-count').textContent = completed.length;
    
    // Render upcoming exams
    const upcomingContainer = document.getElementById('upcoming-exams');
    if (upcoming.length === 0) {
        upcomingContainer.innerHTML = `
            <div class="empty-state">
                <svg class="icon icon-xl empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
               <h3>${translations["no-upcoming-exams"]}</h3>
               <p>${translations["no-upcoming-sub-text"]}</p>
            </div>
        `;
    } else {
        upcomingContainer.innerHTML = upcoming.map(exam => createExamCard(exam)).join('');
    }
    
    // Render completed exams
    const completedContainer = document.getElementById('completed-exams');
    if (completed.length === 0) {
        completedContainer.innerHTML = `
            <div class="empty-state">
                <svg class="icon icon-xl empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <h3>${translations["no-completed-exams"]}</h3>
                <p>${translations["no-completed-sub-text"]}</p>
            </div>
        `;
    } else {
        completedContainer.innerHTML = completed.map(exam => createExamCard(exam)).join('');
    }
}
