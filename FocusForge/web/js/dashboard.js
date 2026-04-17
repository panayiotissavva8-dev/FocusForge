
// State
let exams = [];
let editingExamId = null;
let authToken = null;

let translations = {};
let currentLang = 'en';

let generatedPlan = null;
let isGeneratingPlan = false;

let studyPreferences = {
    studyHoursPerDay: 4,
    sessionLength: 50,
    breakDuration: 15,
    startDate: new Date().toISOString().split("T")[0],
    includeWeekends: true,
};

const STUDY_TOPICS = [
    translations["topic-core-concepts-review"] || "Core Concepts Review",
    translations["topic-practice-questions"] || "Practice questions",
    translations["topic-weak-areas-reinforcement"] || "Weak areas reinforcement",
    translations["topic-timed-exercises"] || "Timed exercises",
    translations["topic-full-exam-simulation"] || "Full exam simulation"
];

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
         showConfirmButton: false,
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
function switchTab(event, tabName) {
    console.log("tabName:", tabName);
    console.log("looking for:", tabName + '-tab');
    console.log("found:", document.getElementById(tabName + '-tab'));
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

    if(tabName === 'study') {
        renderStudyPlanTab();
    }
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
    const res = await fetch(
        `/lang/${lang}.json`);
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

function translateTopic(topic) {
    if (!topic) return topic;
    const key = `topic-${topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, '')}`;
    return translations[key] || topic;
}

function getLocalizedWeekday(date) {
    if (!(date instanceof Date)) date = new Date(date);
    const days = [translations["weekday-sunday"] || "Sunday", translations["weekday-monday"] || "Monday", translations["weekday-tuesday"] || "Tuesday", translations["weekday-wednesday"] || "Wednesday", translations["weekday-thursday"] || "Thursday", translations["weekday-friday"] || "Friday", translations["weekday-saturday"] || "Saturday"];
    const key = `weekday-${days[date.getDay()]}`;
    return translations[key] || date.toLocaleDateString(undefined, { weekday: 'long' });
}

function getLocale() {
    return currentLang === 'gr' ? 'el-GR' : currentLang || undefined;
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




 function renderStudyPlanTab() {
    const el = document.getElementById("study-plan-root");
    if (!el) return;
 
    const upcoming = exams.filter(e => !e.completed);
 
    if (upcoming.length === 0) {
        el.innerHTML = `
            <div class="empty-state">
                <svg class="icon icon-xl empty-icon" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round">
                    <path d="M7 10H6a4 4 0 0 1-4-4 1 1 0 0 1 1-1h3.9a2 2 0 0 0 1.96 1.7L11 7h4l1.14-1.3a2 2 0 0 0 1.96-1.7H21a1 1 0 0 1 1 1 4 4 0 0 1-4 4h-1"/>
                    <path d="M10 10v10h4V10"/>
                    <path d="M8 20h8"/>
                    <path d="M15 3l1 1"/>
                    <path d="M9 3l-1 1"/>
                </svg>
                <h3>${translations["no-study-plan"] || "No study plan yet"}</h3>
                <p>${translations["no-study-plan-sub-text"] || "Add upcoming exams to generate an AI study plan"}</p>
            </div>`;
        return;
    }
 
    el.innerHTML = `
        <div style="max-width:48rem;margin:0 auto;display:flex;flex-direction:column;gap:1rem;">
 
            <!-- CARD 1: UPCOMING EXAMS -->
            <div class="exam-card">
                <div class="card-header">
                    <div class="card-title">
                        <h3 style="display:flex;align-items:center;gap:0.5rem;font-size:1rem;">
                            <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                            </svg>
                            ${translations["your-upcoming-exams"] || "Your Upcoming Exams"}
                        </h3>
                        <div class="card-date" style="margin-top:0.25rem;font-size:0.875rem;color:var(--color-gray-500);">
                            ${translations["ai-plan-description"] || "AI will create a personalized study plan for these exams"}
                        </div>
                    </div>
                </div>
                <div class="card-body" style="padding-top:0;">
                    <div style="display:flex;flex-direction:column;gap:0.75rem;">
                        ${upcoming.map(exam => `
                            <div style="display:flex;align-items:center;justify-content:space-between;
                                        padding:0.75rem 1rem;background:var(--color-gray-50);
                                        border:1px solid var(--color-gray-200);
                                        border-radius:var(--border-radius);">
                                <div>
                                    <div style="font-weight:600;color:var(--color-gray-900);font-size:0.938rem;">
                                        ${exam.subjectName}
                                    </div>
                                    <div class="card-date" style="margin-top:0.2rem;">
                                        <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none"
                                             stroke="currentColor" stroke-width="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                            <line x1="16" y1="2" x2="16" y2="6"/>
                                            <line x1="8"  y1="2" x2="8"  y2="6"/>
                                            <line x1="3"  y1="10" x2="21" y2="10"/>
                                        </svg>
                                        ${new Date(exam.date).toLocaleDateString("en-US", {
                                            weekday:"short", month:"short", day:"numeric", year:"numeric"
                                        })}
                                    </div>
                                </div>
                                <span class="badge badge-${exam.difficulty}">${exam.difficulty}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            </div>
 
            <!-- CARD 2: STUDY PREFERENCES -->
            <div class="exam-card">
                <div class="card-header">
                    <div class="card-title">
                        <h3 style="display:flex;align-items:center;gap:0.5rem;font-size:1rem;">
                            <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            ${translations["study-preferences"] || "Study Preferences"}
                        </h3>
                        <div class="card-date" style="margin-top:0.25rem;font-size:0.875rem;color:var(--color-gray-500);">
                            ${translations["study-preferences-sub"] || "Configure your study schedule and break times"}
                        </div>
                    </div>
                </div>
                <div class="card-body" style="padding-top:0;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
 
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="sp-hours" style="display:block;font-size:0.875rem;font-weight:500;
                                   color:var(--color-gray-700);margin-bottom:0.5rem;">
                                ${translations["study-hours"] || "Study Hours Per Day"}
                            </label>
                            <input id="sp-hours" type="number" class="input"
                                   min="1" max="12" value="${studyPreferences.studyHoursPerDay}"/>
                            <p style="font-size:0.75rem;color:var(--color-gray-500);margin-top:0.25rem;">
                                ${translations["study-hours-hint"] || "Recommended: 3-6 hours"}
                            </p>
                        </div>
 
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="sp-session" style="display:block;font-size:0.875rem;font-weight:500;
                                   color:var(--color-gray-700);margin-bottom:0.5rem;">
                                ${translations["session-length"] || "Study Session Length (minutes)"}
                            </label>
                            <input id="sp-session" type="number" class="input"
                                   min="15" max="120" value="${studyPreferences.sessionLength}"/>
                            <p style="font-size:0.75rem;color:var(--color-gray-500);margin-top:0.25rem;">
                                ${translations["session-hint"] || "Recommended: 25 or 50 minutes"}
                            </p>
                        </div>
 
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="sp-break" style="display:block;font-size:0.875rem;font-weight:500;
                                   color:var(--color-gray-700);margin-bottom:0.5rem;">
                                ${translations["break-duration"] || "Break Duration (minutes)"}
                            </label>
                            <input id="sp-break" type="number" class="input"
                                   min="5" max="60" value="${studyPreferences.breakDuration}"/>
                            <p style="font-size:0.75rem;color:var(--color-gray-500);margin-top:0.25rem;">
                                ${translations["break-hint"] || "Between study sessions"}
                            </p>
                        </div>
 
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="sp-start" style="display:block;font-size:0.875rem;font-weight:500;
                                   color:var(--color-gray-700);margin-bottom:0.5rem;">
                                ${translations["start-date"] || "Start Date"}
                            </label>
                            <input id="sp-start" type="date" class="input"
                                   min="${new Date().toISOString().split("T")[0]}"
                                   value="${studyPreferences.startDate}"/>
                        </div>
 
                    </div>
 
                    <div class="checkbox-group" style="margin-top:1rem;">
                        <input type="checkbox" id="sp-weekends" class="checkbox"
                               ${studyPreferences.includeWeekends ? "checked" : ""}/>
                        <label for="sp-weekends"
                               style="margin-bottom:0;cursor:pointer;font-weight:400;
                                      font-size:0.875rem;color:var(--color-gray-700);">
                            ${translations["include-weekends"] || "Include weekends in study plan"}
                        </label>
                    </div>
                </div>
            </div>
 
            <!-- GENERATE BUTTON -->
            <button id="sp-generate-btn"
                    class="btn btn-primary btn-full"
                    onclick="generateStudyPlan()"
                    style="height:3rem;font-size:1rem;border-radius:var(--border-radius);"
                    ${isGeneratingPlan ? "disabled" : ""}>
                ${isGeneratingPlan ? `
                    <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2"
                         style="animation:sp-spin 1s linear infinite;">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    ${translations["generating"] || "Generating AI Study Plan..."}
                ` : `
                    <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                    ${translations["generate-plan"] || "Generate AI Study Plan"}
                `}
            </button>
 
            <!-- GENERATED PLAN -->
            ${renderGeneratedPlan()}
 
        </div>
    `;
 
    if (!document.getElementById("sp-spin-style")) {
        const s = document.createElement("style");
        s.id = "sp-spin-style";
        s.textContent = `@keyframes sp-spin { to { transform: rotate(360deg); } }`;
        document.head.appendChild(s);
    }
 
    attachStudyPlanListeners();
}
 
// ─── Render generated day cards ────
function renderGeneratedPlan() {
    if (!generatedPlan || generatedPlan.length === 0) return "";
 
    return `
        <div class="exam-card" style="border:2px solid var(--color-primary-light);">
            <div class="card-header">
                <div class="card-title">
                    <h3 style="display:flex;align-items:center;gap:0.5rem;font-size:1rem;">
                        <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        ${translations["your-study-plan"] || "Your Personalized Study Plan"}
                    </h3>
                    <div class="card-date" style="margin-top:0.25rem;font-size:0.875rem;color:var(--color-gray-500);">
                        ${generatedPlan.length} ${translations["days"] || "days"} &bull;
                        ${studyPreferences.studyHoursPerDay}h ${translations["per-day"] || "per day"}
                    </div>
                </div>
                <button class="btn btn-outline" onclick="downloadStudyPlan()" style="flex-shrink:0;">
                    <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    ${translations["download"] || "Download"}
                </button>
            </div>
 
            <div class="card-body" style="padding-top:0;display:flex;flex-direction:column;gap:0.75rem;">
                ${generatedPlan.map((day, i) => `
                    <div style="border:1px solid var(--color-gray-200);
                                border-radius:var(--border-radius);overflow:hidden;">
 
                        <div style="background:var(--color-gray-50);
                                    padding:0.75rem 1rem;
                                    border-bottom:1px solid var(--color-gray-200);
                                    display:flex;align-items:center;justify-content:space-between;">
                            <div>
                                <div style="font-weight:600;color:var(--color-gray-900);font-size:0.938rem;">
                                    Day ${i + 1} &bull; ${getLocalizedWeekday(new Date(day.date))}
                                </div>
                                <div style="font-size:0.813rem;color:var(--color-gray-500);">
                                    ${new Date(day.date).toLocaleDateString(getLocale(),
                                        { month:"short", day:"numeric", year:"numeric" })}
                                </div>
                            </div>
                            <span class="badge badge-none">
                                ${day.sessions.filter(s => s.type === "study").length}
                                ${translations["sessions"] || "sessions"}
                            </span>
                        </div>
 
                        <div style="padding:0.75rem;display:flex;flex-direction:column;gap:0.5rem;">
                            ${day.sessions.map(s => s.type === "study" ? `
                                <div style="display:flex;gap:0.75rem;padding:0.75rem;
                                            background:var(--color-primary-light);
                                            border:1px solid #bfdbfe;
                                            border-radius:var(--border-radius);">
                                    <div style="min-width:70px;font-size:0.813rem;font-weight:600;
                                                color:var(--color-primary);">
                                        ${s.time}
                                    </div>
                                    <div>
                                        <div style="font-weight:600;color:var(--color-gray-900);font-size:0.875rem;">
                                            ${s.subject}
                                        </div>
                                        <div style="font-size:0.813rem;color:var(--color-gray-600);">
                                            ${translateTopic(s.topic)}
                                        </div>
                                        <div style="font-size:0.75rem;color:var(--color-gray-500);margin-top:2px;">
                                            ${s.duration} minutes
                                        </div>
                                    </div>
                                </div>
                            ` : `
                                <div style="display:flex;gap:0.75rem;padding:0.75rem;
                                            background:var(--color-gray-50);
                                            border:1px solid var(--color-gray-200);
                                            border-radius:var(--border-radius);">
                                    <div style="min-width:70px;font-size:0.813rem;color:var(--color-gray-500);">
                                        ${s.time}
                                    </div>
                                    <div style="display:flex;align-items:center;gap:0.375rem;
                                                font-size:0.813rem;color:var(--color-gray-600);">
                                        ☕ ${translations["break"] || "Break"} (${s.duration} min)
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}
 
// ─── Claude API call ───
async function generateStudyPlan() {
    isGeneratingPlan = true;
    generatedPlan    = null;
    renderStudyPlanTab();
 
    const upcoming = exams.filter(e => !e.completed);
    const examList = upcoming.map(e =>
        `- ${e.subjectName} | date: ${e.date} | difficulty: ${e.difficulty}`
    ).join("\n");
 
    const prompt = `
You are a study planner. Create a day-by-day study schedule as valid JSON only.
 
EXAMS:
${examList}
 
PREFERENCES:
- Study hours per day: ${studyPreferences.studyHoursPerDay}
- Session length: ${studyPreferences.sessionLength} minutes
- Break duration: ${studyPreferences.breakDuration} minutes
- Start date: ${studyPreferences.startDate}
- Include weekends: ${studyPreferences.includeWeekends}
 
Rules:
1. Cover every day from start date up to (but not including) the last exam date.
2. Skip weekends if includeWeekends is false.
3. Prioritise subjects whose exams are sooner.
4. Use realistic topic names per subject and proximity to exam.
5. Sessions alternate study then break. Sessions start at 09:00.
 
Return ONLY a JSON array, no markdown, no explanation:
[
  {
    "date": "YYYY-MM-DD",
    "dayName": "Monday",
    "sessions": [
      { "time": "09:00 AM", "subject": "Maths", "topic": "Review fundamentals", "duration": 50, "type": "study" },
      { "time": "09:50 AM", "subject": "", "topic": "", "duration": 15, "type": "break" }
    ]
  }
]`.trim();

// For testing without API, uncomment the line below to use the local fallback directly
  /*  try {
        const response = await fetch("/api/study-plan", { // if you have your own Claude API proxy, replace the URL here
            method : "POST",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify({prompt})
        });
        */

        /*
        if (!response.ok) throw new Error(`API Failed`);

        const parsed = await response.json();
 
        generatedPlan = parsed.map(day => ({ ...day, date: new Date(day.date) }));
 
    } catch (err) {
        console.error("Claude API failed, using local fallback:", err);
        generatedPlan = _localFallbackPlan(upcoming, studyPreferences);
    }
        */
     generatedPlan = _localFallbackPlan(upcoming, studyPreferences);
 
    isGeneratingPlan = false;
    renderStudyPlanTab();
}

function _localFallbackPlan(exams, prefs) {
    return buildWeightedStudyPlan(exams, prefs);
}
 
// ─── Download ──────
function downloadStudyPlan() {
    if (!generatedPlan) return;
 
    let text = "=== FOCUS FORGE — AI STUDY PLAN ===\n\n";
    text += `Generated : ${new Date().toLocaleDateString()}\n`;
    text += `Hours/day : ${studyPreferences.studyHoursPerDay}h\n`;
    text += `Session   : ${studyPreferences.sessionLength} min\n`;
    text += `Break     : ${studyPreferences.breakDuration} min\n\n`;
 
    generatedPlan.forEach((day, i) => {
        text += `━━━ DAY ${i + 1}: ${day.dayName}, ${new Date(day.date).toLocaleDateString()} ━━━\n\n`;
        day.sessions.forEach(s => {
            if (s.type === "study") {
                text += `${s.time}  ${s.subject}\n         Topic: ${s.topic}\n         Duration: ${s.duration} min\n\n`;
            } else {
                text += `${s.time}  ☕ Break (${s.duration} min)\n\n`;
            }
        });
    });
 
    const blob = new Blob([text], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `study-plan-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
 
// ─── Sync inputs ─────
function attachStudyPlanListeners() {
    const g = id => document.getElementById(id);
    const h = g("sp-hours"), s = g("sp-session"),
          b = g("sp-break"), d = g("sp-start"),  w = g("sp-weekends");
 
    if (h) h.oninput  = e => studyPreferences.studyHoursPerDay = +e.target.value || 4;
    if (s) s.oninput  = e => studyPreferences.sessionLength    = +e.target.value || 50;
    if (b) b.oninput  = e => studyPreferences.breakDuration    = +e.target.value || 15;
    if (d) d.onchange = e => studyPreferences.startDate        = e.target.value;
    if (w) w.onchange = e => studyPreferences.includeWeekends  = e.target.checked;
}


function _fmt(hour) {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    const normalizedHour = h % 24;
    const ampm = normalizedHour >= 12 ? "PM" : "AM";
    const displayHour = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
    return `${String(displayHour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Local fallback ────
/**
 * StudyPlanner - production-grade scheduling engine
 */
class StudyPlanner {
    constructor(upcomingExams, prefs) {
        this.exams = this._normalizeExams(upcomingExams, prefs.startDate);
        this.prefs = prefs;

        this.sessionBlock = prefs.sessionLength + prefs.breakDuration;
        this.dailyCapacity = prefs.studyHoursPerDay * 60;

        this.lastSubject = null;
        this.dayIndex = 0;

        this.quotaMap = new Map();
        this._initQuotas();

        this.srs = new SRSManager(this.exams);
        this.weightEngine = new WeightEngine(this.exams, this.quotaMap);
        this.capacity = new CapacityManager(this.dailyCapacity, prefs);
        this.slotGen = new TimeSlotGenerator(prefs);
    }

    /**
     * MAIN ENTRY
     */
    generatePlan() {
        const plan = [];
        const start = new Date(this.prefs.startDate);

        const lastExamTime = Math.max(
            ...this.exams.map(e => new Date(e.date).getTime())
        );

        while (true) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + this.dayIndex++);

            if (currentDate.getTime() >= lastExamTime) break;

            if (!this._isAllowedDay(currentDate)) continue;

            const dayPlan = this._generateDay(currentDate);
            if (dayPlan.sessions.length) plan.push(dayPlan);
        }

        return plan;
    }

    /**
     * ONE DAY SCHEDULING
     */
    _generateDay(date) {
        let remaining = this.dailyCapacity;
        let load = 0;
        let hour = 9;

        const sessions = [];

        const fatigue = new FatigueModel(this.prefs.studyHoursPerDay);

        const sessionCount = new Map();

        while (remaining >= this.sessionBlock) {

            const candidate = this.weightEngine.pickBest(
                this.dayIndex,
                this.lastSubject,
                this.srs,
                fatigue,
                sessionCount
            );

            if (!candidate) break;

            if (this.capacity.wouldOverload(load)) break;

            const topic = this.slotGen.pickTopic(candidate);

            sessions.push({
                time: this._fmt(hour),
                subject: candidate.subjectName,
                topic,
                duration: this.prefs.sessionLength,
                type: "study"
            });

            sessionCount.set(
                candidate.subjectName,
                (sessionCount.get(candidate.subjectName) || 0) + 1
            );

            hour += this.prefs.sessionLength / 60;
            remaining -= this.sessionBlock;
            load += this.prefs.sessionLength;

            this.lastSubject = candidate.subjectName;

            this.srs.update(candidate.subjectName);
            this._consumeQuota(candidate.subjectName);
        }

        this.slotGen.insertBreak(sessions, this.prefs.breakDuration);

        return {
            date,
            dayName: date.toLocaleDateString("en-US", { weekday: "long" }),
            sessions
        };
    }

    _normalizeExams(exams, startDate) {
        const start = new Date(startDate);

        return exams.map(e => {
            const daysLeft = Math.max(
                1,
                Math.ceil((new Date(e.date) - start) / 86400000)
            );

            const difficultyWeight = e.difficultyWeight ?? calculateExamWeight(e);

            return {
                ...e,
                daysLeft,
                difficultyWeight
            };
        });
    }

    _initQuotas() {
        for (const e of this.exams) {
            this.quotaMap.set(
                e.subjectName,
                e.difficultyWeight * 3
            );
        }
    }

    _consumeQuota(subject) {
        const q = this.quotaMap.get(subject);
        if (q > 0) this.quotaMap.set(subject, q - 1);
    }

    _isAllowedDay(date) {
        if (!this.prefs.includeWeekends) {
            const d = date.getDay();
            return d !== 0 && d !== 6;
        }
        return true;
    }

    _fmt(hour) {
        return `${String(Math.floor(hour)).padStart(2, "0")}:00`;
    }
}
class WeightEngine {
    constructor(exams, quotaMap) {
        this.exams = exams;
        this.quotaMap = quotaMap;
    }

    pickBest(dayIndex, lastSubject, srs, fatigue, sessionCount) {
        const crashMode = this._isCrashMode(dayIndex);

        let best = null;
        let bestScore = -Infinity;

        for (const e of this.exams) {
            const urgency = 1 / Math.max(e.daysLeft - dayIndex, 1);
            const quotaBoost = this.quotaMap.get(e.subjectName) > 0 ? 2 : 1;
            const srsBoost = srs.getBoost(e.subjectName);
            const fatiguePenalty = fatigue.getPenalty(dayIndex);

            const repeatPenalty =
                e.subjectName === lastSubject ? 4 : 0;

            const sameDayPenalty =
                (sessionCount.get(e.subjectName) || 0) * 5;

            const score =
                e.difficultyWeight * 4 +
                urgency * 12 +
                quotaBoost * 3 +
                srsBoost * 5 +
                (crashMode ? 5 : 0) -
                fatiguePenalty -
                repeatPenalty -
                sameDayPenalty;

            if (score > bestScore) {
                bestScore = score;
                best = e;
            }
        }

        return best;
    }

    _isCrashMode(dayIndex) {
        return this.exams.some(
            e => e.daysLeft - dayIndex <= 3
        );
    }
}

class SRSManager {
    constructor(exams) {
        this.map = new Map();

        for (const e of exams) {
            this.map.set(e.subjectName, {
                interval: 1,
                ease: 2.5
            });
        }
    }

    getBoost(subject) {
        const s = this.map.get(subject);
        return s.interval <= 1 ? 3 :
               s.interval === 2 ? 2 :
               1.5;
    }

    update(subject) {
        const s = this.map.get(subject);

        s.interval = Math.min(
            Math.ceil(s.interval * s.ease),
            10
        );

        s.ease = Math.max(1.3, s.ease - 0.05);
    }
}

class FatigueModel {
    constructor(dailyLimitMinutes) {
        this.limit = dailyLimitMinutes;
    }

    getPenalty(currentLoad) {
        const ratio = currentLoad / this.limit;

        return ratio < 0.5 ? 0 :
               ratio < 0.8 ? 2 :
               ratio < 1 ? 4 : 8;
    }
}

class CapacityManager {
    constructor(limit, prefs) {
        this.limit = limit;
        this.prefs = prefs;
    }

    wouldOverload(currentLoad) {
        return currentLoad >= this.limit * 0.9;
    }
}

class TimeSlotGenerator {
    constructor(prefs) {
        this.prefs = prefs;
    }

    pickTopic(candidate) {
        const intensity =
            candidate.daysLeft <= 2 ? 4 :
            candidate.daysLeft <= 5 ? 3 :
            candidate.daysLeft <= 10 ? 2 : 1;

        return STUDY_TOPICS[Math.min(intensity, STUDY_TOPICS.length - 1)];
    }

    insertBreak(sessions, duration) {
        if (!sessions.length) return;

        const breakStart = this._addMinutes(sessions[0].time, sessions[0].duration);
        sessions.splice(1, 0, {
            time: breakStart,
            subject: "",
            topic: translations["break"] || "Break",
            duration,
            type: "break"
        });
    }

    _addMinutes(timeStr, minutes) {
        const [timePart, ampm] = timeStr.split(" ");
        let [hour, min] = timePart.split(":").map(Number);

        if (ampm === "PM" && hour !== 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;

        let totalMinutes = hour * 60 + min + minutes;
        totalMinutes %= 24 * 60;

        const newHour = Math.floor(totalMinutes / 60);
        const newMin = totalMinutes % 60;
        const displayHour = newHour % 12 === 0 ? 12 : newHour % 12;
        const displayAmPm = newHour >= 12 ? "PM" : "AM";

        return `${String(displayHour).padStart(2, "0")}:${String(newMin).padStart(2, "0")} ${displayAmPm}`;
    }
}

function buildStudyPlan(exams, prefs) {
    if (!Array.isArray(exams)) {
        throw new Error("exams must be an array");
    }

    if (!prefs || typeof prefs !== "object") {
        throw new Error("prefs must be an object");
    }

    const planner = new StudyPlanner(exams, prefs);
    return planner.generatePlan();
}

function calculateExamWeight(exam) {
    return ({
        hard: 4,
        medium: 3,
        low: 2
    })[exam.difficulty] || 1;
}

function buildWeightedStudyPlan(exams, prefs) {
    const weightedExams = exams.map(e => ({
        ...e,
        difficultyWeight: calculateExamWeight(e)
    }));

    return buildStudyPlan(weightedExams, prefs);
}
 