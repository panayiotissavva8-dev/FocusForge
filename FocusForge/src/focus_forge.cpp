#include <iostream>
#include <iomanip>
#include <fstream>
#include <sstream>
#include <vector>
#include <sqlite3.h>
#include <crow.h>
#include <asio.hpp>
#include <openssl/sha.h>
#include <unordered_map>
#include <string>
#include <ctime>
#include <cpr/cpr.h>
#include <nlohmann/json.hpp>


sqlite3* db_focus_forge = nullptr;
const std::string DB_PATH = "build/focus_forge.sqlite"; 

using namespace std;

struct UserData {
    int user_id;
    string owner;
    string username;
    string password_hash;
    string email;
    int termsAccepted;
    long long terms_accepted_at;
    int failed_count;
};

struct SubjectData {
    int subject_id;
    int user_id;
    string name;
    int difficulty;
    string deadline;
    int reminder;
    int reminder_sent = 0;
    int completed;
    string grade;  
};

struct SessionData {
    string username;
    int user_id;
};

std::unordered_map<std::string, SessionData> sessions;

// --- UTILITY FUNCTIONS ---
string hashPassword(const string& password){
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256  ((unsigned char*)password.c_str(), password.size(), hash);

    stringstream ss; 
    for(int i = 0; i < SHA256_DIGEST_LENGTH; i++)
       ss << hex << setw(2) << setfill('0') << (int)hash[i];
       return ss.str();
}

// Convert difficulty string to integer
int difficultyToInt(const string& diff) {
    string lower = diff;
    transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
    if(lower == "none") return 0;
    else if(lower == "low") return 1;
    else if(lower == "medium") return 2;
    else if(lower == "high") return 3;
    return 0; // default to none
}

// Convert difficulty integer to string
string difficultyToString(int diff) {
    if(diff == 0) return "none";
    else if(diff == 1) return "low";
    else if(diff == 2) return "medium";
    else if(diff == 3) return "high";
    return "none";
}

int reminderToInt(const string& remind) {
    string lower = remind;
    transform(lower.begin(), lower.end(), lower.begin(), ::tolower);
    if(lower == "none") return 0;
    else if(lower == "1_day") return 1;
    else if(lower == "3_days") return 2;
    else if(lower == "1_week") return 3;
    return 0; // default to none
}

string reminderToString(int remind) {
    if(remind == 0) return "none";
    else if(remind == 1) return "1_day";
    else if(remind == 2) return "3_days";
    else if(remind == 3) return "1_week";
    return "none";
}

//Culculate reminder time
time_t calculateReminders(const string& deadline, const int reminder) {
    struct tm tm_deadline = {};
    strptime(deadline.c_str(), "%Y-%m-%d", &tm_deadline);
    time_t deadline_time = mktime(&tm_deadline);

    if (reminder == 1) return deadline_time - 24 * 3600;
    else if (reminder == 2) return deadline_time - 3 * 24 * 3600;
    else if (reminder == 3) return deadline_time - 7 * 24 * 3600;
    
    return deadline_time; // no reminder
}

void loadEnv() {
    std::ifstream file("secret.env");
    std::string line;
    if(!file.is_open()){
        cerr<<"Failed to open API file"<<endl;
    }
    while (getline(file, line)) {
        auto pos = line.find('=');
        if (pos != std::string::npos) {
            std::string key = line.substr(0, pos);
            std::string value = line.substr(pos + 1);
            setenv(key.c_str(), value.c_str(), 1);
        }
    }
}

// Check for invalid characters in user input
bool containsInvalidChars(const std::string& str) {
    const std::string invalid = "'\";";
    return str.find_first_of(invalid) != std::string::npos;
}

// Check length
bool isLengthValid(const std::string& str, size_t minLen, size_t maxLen) {
    return str.length() >= minLen && str.length() <= maxLen;
}

// Validate user input fields
std::string validateField(const std::string& field, const std::string& fieldName, size_t minLen, size_t maxLen, bool checkEmail = false) {
    if(field.empty()) return fieldName + " is required";
    if(!isLengthValid(field, minLen, maxLen)) return fieldName + " must be between " + std::to_string(minLen) + " and " + std::to_string(maxLen) + " characters";
    if(containsInvalidChars(field)) return fieldName + " cannot contain ' \" ; characters";
    
    if(checkEmail) {
        if(field.find('@') == std::string::npos || field.find('.') == std::string::npos) return "Invalid email format";
    }

    return ""; // valid
}

// --- DATABASE FUNCTIONS ---

void initializeDatabase(sqlite3* db){

    char* errMsg = nullptr;

    const char* users_table = R"(
    CREATE TABLE IF NOT EXISTS users(
           user_id INTEGER PRIMARY KEY AUTOINCREMENT,
           owner TEXT NOT NULL,
           username TEXT NOT NULL UNIQUE,
           password_hash TEXT NOT NULL,
           email TEXT NOT NULL,
           termsAccepted INTEGER NOT NULL DEFAULT 0,
           terms_accepted_at INTEGER NOT NULL DEFAULT 0
           );
)";


     const char* subject_table = R"(
     CREATE TABLE IF NOT EXISTS subjects(
            subject_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            difficulty INTEGER NOT NULL,
            deadline TEXT,
            reminder INTEGER NOT NULL DEFAULT 0,
            reminder_sent INTEGER NOT NULL DEFAULT 0,
            completed INTEGER,
            grade TEXT, 
            FOREIGN KEY(user_id) REFERENCES users(user_id)
            );
)";

sqlite3_exec(db, users_table, nullptr, nullptr, &errMsg);
sqlite3_exec(db, subject_table, nullptr, nullptr, &errMsg);


if(errMsg != nullptr){
    cerr<<"DB init error: "<<errMsg<<endl;
    sqlite3_free(errMsg);
}

}

// --- SUBJECT FUNCTIONS ---
void loadSubjects(sqlite3* db, vector<SubjectData>& subjects, const int user_id){
    sqlite3_stmt* stmt;
    const char* sql;

    subjects.clear();

    sql = "SELECT subject_id, user_id, name, difficulty, deadline, reminder, reminder_sent, completed, grade "
          "FROM subjects WHERE user_id = ?;";
    if(sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK){
        cerr<<"Prepare failed"<<endl;
        return;
    }
    sqlite3_bind_int(stmt, 1, user_id);

    while(sqlite3_step(stmt) == SQLITE_ROW){
        SubjectData s;
        s.subject_id = sqlite3_column_int(stmt, 0);
        s.user_id = sqlite3_column_int(stmt, 1);
        s.name = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
        s.difficulty = sqlite3_column_int(stmt, 3);
        const char* deadline = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4));
        s.deadline = deadline ? deadline : "";

        s.reminder = sqlite3_column_int(stmt, 5);
        s.reminder_sent = sqlite3_column_int(stmt, 6);
        
        
        s.completed = sqlite3_column_int(stmt, 7);
        
        const char* grade = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 8));
        s.grade = grade ? grade : "";

        subjects.push_back(s);
    }

    sqlite3_finalize(stmt);
}

void insertSubject(sqlite3* db, const SubjectData& s){
    sqlite3_stmt* stmt;
    const char* sql = "INSERT INTO subjects (user_id, name, difficulty, deadline, reminder, completed, grade) VALUES (?, ?, ?, ?, ?, ?, ?);";

    if(sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK){
        cerr<<"Prepare failed"<<endl;
        return;
    }

    sqlite3_bind_int(stmt, 1, s.user_id);
    sqlite3_bind_text(stmt, 2, s.name.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 3, s.difficulty);
    sqlite3_bind_text(stmt, 4, s.deadline.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 5, s.reminder);
    sqlite3_bind_int(stmt, 6, s.completed);
    sqlite3_bind_text(stmt, 7, s.grade.c_str(), -1, SQLITE_TRANSIENT);

    int rc = sqlite3_step(stmt);

    if(rc != SQLITE_DONE){
        cerr<<"Insert failed: "<<sqlite3_errmsg(db)<<endl; 
    }else {
        cout<<"Insert success"<<endl;
    }

    sqlite3_finalize(stmt);
}

void updateSubject(sqlite3* db, const SubjectData& s){
    sqlite3_stmt* stmt;
    const char* sql = "UPDATE subjects SET name = ?, difficulty = ?, deadline = ?, reminder = ?, completed = ?, grade = ? WHERE subject_id = ? AND user_id = ?;";

    if(sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK){
        cerr<<"Prepare failed: "<<sqlite3_errmsg(db)<<endl;
        return;
    }

    sqlite3_bind_text(stmt, 1, s.name.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 2, s.difficulty);
    sqlite3_bind_text(stmt, 3, s.deadline.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 4, s.reminder);
    sqlite3_bind_int(stmt, 5, s.completed);
    sqlite3_bind_text(stmt, 6, s.grade.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 7, s.subject_id);
    sqlite3_bind_int(stmt, 8, s.user_id);

    int rc = sqlite3_step(stmt);

    if(rc != SQLITE_DONE){
        cerr<<"Update failed: "<<sqlite3_errmsg(db)<<endl; 
    }else {
        cout<<"Update success"<<endl;
    }

    sqlite3_finalize(stmt);
}

void deleteSubject(sqlite3* db, int subject_id, int user_id){
    sqlite3_stmt* stmt;
    const char* sql = "DELETE FROM subjects WHERE subject_id = ? AND user_id = ?;";

    if(sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK){
        cerr<<"Prepare failed: "<<sqlite3_errmsg(db)<<endl;
        return;
    }

    sqlite3_bind_int(stmt, 1, subject_id);
    sqlite3_bind_int(stmt, 2, user_id);

    int rc = sqlite3_step(stmt);

    if(rc != SQLITE_DONE){
        cerr<<"Delete failed: "<<sqlite3_errmsg(db)<<endl; 
    }else {
        cout<<"Delete success"<<endl;
    }

    sqlite3_finalize(stmt);
}


// --- USER FUNCTIONS ---
void loadUsers(sqlite3* db, vector<UserData>& users, const string username){
    sqlite3_stmt* stmt;
    const char* sql;

    sql = "SELECT user_id, password_hash, email, termsAccepted, terms_accepted_at FROM users WHERE username = ?;";

    if(sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK){
        cerr<<"Prepare failed"<<endl;
        return;
    }
    sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_TRANSIENT);

    while(sqlite3_step(stmt) == SQLITE_ROW){
        UserData u;
        u.user_id = sqlite3_column_int(stmt, 0);
        u.owner = username; 
        u.password_hash = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
        u.email = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
        u.termsAccepted = sqlite3_column_int(stmt, 3);
        u.terms_accepted_at = sqlite3_column_int(stmt, 4);

        users.push_back(u);
    }

    sqlite3_finalize(stmt);
}

void insertUser(sqlite3* db, const UserData& u){
    sqlite3_stmt* stmt;
    const char* sql = "INSERT INTO users (owner, username, password_hash, email, termsAccepted, terms_accepted_at) VALUES (?, ?, ?, ?, ?, ?);";

    if(sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK){
        cerr<<"Prepare failed"<<endl;
        return;
    }

    sqlite3_bind_text(stmt, 1, u.owner.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 2, u.username.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 3, u.password_hash.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 4, u.email.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 5, u.termsAccepted ? 1 : 0);
    sqlite3_bind_int64(stmt, 6, u.terms_accepted_at);

    int rc = sqlite3_step(stmt);

    if(rc != SQLITE_DONE){
        cerr<<"Insert failed: "<<sqlite3_errmsg(db)<<endl;
    }else {
        cout<<"Insert success"<<endl;
    }

    sqlite3_finalize(stmt);

}





void sendExamReminder(const std::string& userEmail, const std::string& examName,  const std::string& examDate, const std::string& examDifficulty, const std::string& examReminder, const string username) 
{

    const char* key = getenv("SENDGRID_API_KEY");
    std::string SENDGRID_API_KEY = key ? key : "";
    const std::string FROM_EMAIL = "focusforgereminder@gmail.com";
    
    nlohmann::json body = {
        {"personalizations", {{
            {"to", {{{"email", userEmail}}}},
            {"subject", "Exam Reminder: " + examName}
        }}},
        {"from", {{"email", FROM_EMAIL}}},
        {"content", {{
            {"type", "text/plain"},
            {"value", "Hi " + username +",\n\nThis is a friendly reminder that you have an upcoming exam:\n\nSubject: " + examName + "\nDate: " + examDate + "\nDifficulty: " + examDifficulty + "\nReminder set for: " + examReminder + " before the exam" + "\n\n“Success is walking from failure to failure with no loss of enthusiasm.” - Winston Churchill" + "\n\nGood luck with your studies, \nFocusForge Team"}
        }}}
    };

    auto r = cpr::Post(
        cpr::Url{"https://api.sendgrid.com/v3/mail/send"},
        cpr::Header{
            {"Authorization", "Bearer " + SENDGRID_API_KEY},
            {"Content-Type", "application/json"}
        },
        cpr::Body{body.dump()}
    );

    if (r.status_code == 202) {
        std::cout << "Email sent successfully to " << userEmail << "\n";
    } else {
        std::cout << "Failed to send email. Status: " << r.status_code 
                  << " Response: " << r.text << "\n";
    }
}

void reminderLoop(sqlite3* db) {
    while(true) {
        try {
            cout << "[Reminder] Checking subjects..." << endl;
            
            // Load all subjects for all users
            sqlite3_stmt* stmt;
            const char* sql = "SELECT s.subject_id, s.user_id, s.name, s.deadline, s.reminder, s.reminder_sent, s.difficulty, u.email "
                              "FROM subjects s "
                              "JOIN users u ON s.user_id = u.user_id "
                              "WHERE s.reminder_sent = 0;";

            if(sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) {
                cerr << "[Reminder] DB prepare failed: " << sqlite3_errmsg(db) << endl;
                goto sleep_hour;
            }

            time_t now = time(nullptr);
            while(sqlite3_step(stmt) == SQLITE_ROW) {
                int subject_id = sqlite3_column_int(stmt, 0);
                int user_id = sqlite3_column_int(stmt, 1);
                string name = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
                string deadline = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
                int reminder = sqlite3_column_int(stmt, 4);
                int reminder_sent = sqlite3_column_int(stmt, 5);
                int difficulty = sqlite3_column_int(stmt, 6);
                string email = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 7));

                time_t reminder_time = calculateReminders(deadline, reminder);
                if(now >= reminder_time) {
                    sendExamReminder(email, name, deadline, difficultyToString(difficulty), reminderToString(reminder), sessions.find(email) != sessions.end() ? sessions[email].username : "Student");

                    // Mark reminder as sent
                    sqlite3_stmt* updateStmt;
                    const char* updateSql = "UPDATE subjects SET reminder_sent = 1 WHERE subject_id = ?;";
                    if(sqlite3_prepare_v2(db, updateSql, -1, &updateStmt, nullptr) == SQLITE_OK) {
                        sqlite3_bind_int(updateStmt, 1, subject_id);
                        sqlite3_step(updateStmt);
                        sqlite3_finalize(updateStmt);
                    }
                }
            }

            sqlite3_finalize(stmt);
        } catch(const std::exception& e) {
            cerr << "[Reminder] Exception: " << e.what() << endl;
        }

        sleep_hour:
        // Sleep for 1 hour
        std::this_thread::sleep_for(std::chrono::hours(1));
    }
}




int main(){

    loadEnv();
    

    int rc = sqlite3_open(DB_PATH.c_str(), &db_focus_forge);

    if(rc){
        cerr<<"Cannot open DB: "<<sqlite3_errmsg(db_focus_forge) <<endl;
        return 1;
    }

    initializeDatabase(db_focus_forge);

    


    // Start reminder background thread
    std::thread(reminderLoop, db_focus_forge).detach();

    crow::SimpleApp app;

    

    CROW_ROUTE(app, "/")([](){
        ifstream file("web/html/login.html");
        if(!file.is_open()) return crow::response(404);
        stringstream buffer;
        buffer << file.rdbuf();
        return crow::response(buffer.str());
    });

    // --- LOGIN API ---
    CROW_ROUTE(app, "/login_api").methods(crow::HTTPMethod::POST)([](const crow::request& req){
        auto body = crow::json::load(req.body);
        if(!body) return crow::response(400);

        string username = body["username"].s();
        string password = body["password"].s();
        int failed_count = body.has("failed_count") ? body["failed_count"].i() : 0;
        string input_hash = hashPassword(password);

        vector<UserData> users;
        loadUsers(db_focus_forge, users, username);

        if(users.empty()){
            return crow::response(404, "User not found");
        }

        if(failed_count >=5){
            return crow::response(403, "Too many failed attempts. Please try again later.");
        }

        cout<<"Failed count:"<<failed_count<<endl;

       // user input validation with helper function (line 130)
        std::string err;
        if(!(err = validateField(username, "Username", 6, 14)).empty()) return crow::response(400, err);
        if(!(err = validateField(password, "Password", 6, 20)).empty()) return crow::response(400, err);

        UserData u = users[0];
        if(u.password_hash == input_hash){
            string token = username + "-" + to_string(chrono::system_clock::now().time_since_epoch().count());
            sessions[token] = SessionData{username, u.user_id};

            crow::json::wvalue res;
            res["status"] = "success";
            res["username"] = username;
            res["user_id"] = u.user_id;
            res["token"] = token;
            res["failed_count"] = failed_count;

            return crow::response(res);
        }else{
            return crow::response(401, "Invalid password");
        }
    });

    // --- REGISTER API ---
    CROW_ROUTE(app, "/register_api").methods(crow::HTTPMethod::POST)([](const crow::request& req){
        auto body = crow::json::load(req.body);
        if(!body) return crow::response(400);

        string username = body["username"].s();
        string owner = username;
        string password = body["password"].s();
        string confirm_password = body["confirm_password"].s();
        string email = body["email"].s();
        bool termsAccepted = body["termsAccepted"].b();

        // Terms acceptence validation

        if(!termsAccepted){
            return crow::response(400, "Terms must be accepted");
        }

        // user input validation with helper function (line 130)
        std::string err;
        if(!(err = validateField(username, "Username", 6, 14)).empty()) return crow::response(400, err);
        if(!(err = validateField(password, "Password", 6, 20)).empty()) return crow::response(400, err);
        if(password != confirm_password) return crow::response(400, "Passwords do not match");
        if(!(err = validateField(email, "Email", 0, 40, true)).empty()) return crow::response(400, err);


        string hashed = hashPassword(password);
        time_t terms_accepted_at = time(nullptr);

        UserData u;
        u.owner = username;
        u.username = username;
        u.password_hash = hashed; 
        u.email = email;
        u.termsAccepted = termsAccepted;
        u.terms_accepted_at = terms_accepted_at;

        insertUser(db_focus_forge, u);

        return crow::response(200, "Register Successfully");
    });

// TODO 
    // --- FIREBASE AUTH --- 
    CROW_ROUTE(app, "/auth/firebase").methods("POST"_method)
([](const crow::request& req){
    auto body = crow::json::load(req.body);

    if (!body) {
        return crow::response(400, "Invalid JSON");
    }

    std::string token = body["token"].s();

    // STEP 1: verify token
    bool valid = verifyFirebaseToken(token);

    if (!valid) {
        return crow::response(401, "Invalid token");
    }

    // STEP 2: extract user info (uid/email)
    auto user = decodeFirebaseToken(token);

    crow::json::wvalue res;
    res["uid"] = user.uid;
    res["email"] = user.email;

    return crow::response(res);
});



    // --- GET ALL SUBJECTS API ---
    CROW_ROUTE(app, "/dashboard_api").methods(crow::HTTPMethod::GET)([](const crow::request& req){

        auto token = req.get_header_value("Authorization");
        if(token.empty() || sessions.find(token) == sessions.end())
           return crow::response(401, "Not logged in");
        string username = sessions[token].username;
        int user_id = sessions[token].user_id;

        vector<SubjectData> subjects;
        loadSubjects(db_focus_forge, subjects, user_id);

        crow::json::wvalue out;
        out["subjects"] = crow::json::wvalue::list();

        int i = 0;
        for(const auto& s : subjects){
            crow::json::wvalue obj;

            obj["id"] = s.subject_id;
            obj["subject"] = s.name;
            obj["difficulty"] = difficultyToString(s.difficulty);
            obj["deadline"] = s.deadline;
            obj["reminder"] = reminderToString(s.reminder);
            obj["completed"] = s.completed;
            obj["grade"] = s.grade;

            out["subjects"][i++] = std::move(obj);
        }

        return crow::response(200, out);
    });


    // --- ADD SUBJECT API (POST) ---
    CROW_ROUTE(app, "/dashboard_api").methods(crow::HTTPMethod::POST)([](const crow::request& req){
        auto body = crow::json::load(req.body);
        if(!body) return crow::response(400, "Invalid JSON");

        auto token = req.get_header_value("Authorization");
        if(token.empty() || sessions.find(token) == sessions.end())
           return crow::response(401, "Not logged in");
        
        int user_id = sessions[token].user_id;

        SubjectData s;
        s.user_id = user_id;
        s.name = body["subject"].s();
        s.difficulty = difficultyToInt(body["difficulty"].s());
        s.deadline = body["deadline"].s();
        s.reminder = reminderToInt(body["reminder"].s());
        if (body.has("grade")) {
            std::string grade = body["grade"].s();
            s.completed = grade.empty() ? 0 : 1;
        } else {
            s.completed = 0;
        }
        s.grade = body["grade"].s();

        insertSubject(db_focus_forge, s);

        return crow::response(200, "Subject added");
    });


    // --- UPDATE SUBJECT API (PUT) ---
    CROW_ROUTE(app, "/dashboard_api/<int>").methods(crow::HTTPMethod::PUT)([](const crow::request& req, int subject_id){
        auto body = crow::json::load(req.body);
        if(!body) return crow::response(400, "Invalid JSON");

        auto token = req.get_header_value("Authorization");
        if(token.empty() || sessions.find(token) == sessions.end())
           return crow::response(401, "Not logged in");
        
        int user_id = sessions[token].user_id;

        SubjectData s;
        s.subject_id = subject_id;
        s.user_id = user_id;
        s.name = body["subject"].s();
        s.difficulty = difficultyToInt(body["difficulty"].s());
        s.deadline = body["deadline"].s();
        s.reminder = reminderToInt(body["reminder"].s());
        if (body.has("grade")) {
           std::string grade = body["grade"].s();
           s.completed = grade.empty() ? 0 : 1;
        } else {
           s.completed = 0;
        }
        s.grade = body["grade"].s();

        updateSubject(db_focus_forge, s);

        return crow::response(200, "Subject updated");
    });


    // --- DELETE SUBJECT API (DELETE) ---
    CROW_ROUTE(app, "/dashboard_api/<int>").methods(crow::HTTPMethod::DELETE)([](const crow::request& req, int subject_id){
        auto token = req.get_header_value("Authorization");
        if(token.empty() || sessions.find(token) == sessions.end())
           return crow::response(401, "Not logged in");
        
        int user_id = sessions[token].user_id;

        deleteSubject(db_focus_forge, subject_id, user_id);

        return crow::response(200, "Subject deleted");
    });


    // --- PATHS --- 

    // --- LOGIN PAGE ---
    CROW_ROUTE(app, "/login")([](){
        ifstream file("web/html/login.html", ios::binary);
        if(!file.is_open()) return crow::response(404, "Cannot open login.html");

        stringstream buffer;
        buffer<<file.rdbuf();
        crow::response res(buffer.str());
        res.add_header("Content-Type", "text/html");
        return res;
    });


    // --- REGISTER PAGE ---
    CROW_ROUTE(app, "/register")([](){
        ifstream file("web/html/register.html", ios::binary);
        if(!file.is_open()) return crow::response(404, "Cannot open register.html");

        stringstream buffer;
        buffer<<file.rdbuf();
        crow::response res(buffer.str());
        res.add_header("Content-Type", "text/html");
        return res;
    });

    // --- DASHBOARD PAGE ---
    CROW_ROUTE(app, "/dashboard")([](){
        ifstream file("web/html/dashboard.html", ios::binary);
        if(!file.is_open()) return crow::response(404, "Cannot open dashboard.html");

        stringstream buffer;
        buffer<<file.rdbuf();
        crow::response res(buffer.str());
        res.add_header("Content-Type", "text/html");
        return res;
    });

    // --- ADD SUBJECT PAGE ---
    CROW_ROUTE(app, "/add_subject")([](){
        ifstream file("web/html/add_subject.html", ios::binary);
        if(!file.is_open()) return crow::response(404, "Cannot open add_subject.html");

        stringstream buffer;
        buffer<<file.rdbuf();
        crow::response res(buffer.str());
        res.add_header("Content-Type", "text/html");
        return res;
    });

    CROW_ROUTE(app, "/lang/<string>")
([](const crow::request&, std::string file){
    std::ifstream in("lang/" + file);

    if (!in.is_open()) {
        return crow::response(404, "Language file not found");
    }

    std::stringstream buffer;
    buffer << in.rdbuf();

    crow::response res;
    res.set_header("Content-Type", "application/json");
    res.write(buffer.str());
    return res;
});


    // --- STATIC FILES ---
    app.route_dynamic("/web/<path>")([](const crow::request& req, std::string path){

    std::string full_path = "web/" + path;

    std::ifstream file(full_path, std::ios::binary);
    if (!file)
        return crow::response(404, "File not found");

    std::ostringstream contents;
    contents << file.rdbuf();

    crow::response res(contents.str());

    std::string mime_type = "application/octet-stream";
    size_t dot_pos = path.rfind('.');

    if (dot_pos != std::string::npos) {
        std::string ext = path.substr(dot_pos);

        if (ext == ".html") mime_type = "text/html";
        else if (ext == ".css") mime_type = "text/css";
        else if (ext == ".js") mime_type = "application/javascript";
        else if (ext == ".png") mime_type = "image/png";
        else if (ext == ".jpg" || ext == ".jpeg") mime_type = "image/jpeg";
        else if (ext == ".gif") mime_type = "image/gif";
    }

    res.add_header("Content-Type", mime_type);
    return res;
});



    // --- RUN SERVER --- 
    int port = 5001;
    if(const char* env_p = getenv("PORT")){
        port = stoi(env_p);
    }

    app.bindaddr("0.0.0.0").port(port).multithreaded().run();

    sqlite3_close(db_focus_forge);

    return 0;
    
}

// --- COMPILE COMMAND ---
/*
 g++ -std=c++17 src/focus_forge.cpp -o focusforge \
-I Crow/include \
-I /opt/homebrew/include \
-I /opt/homebrew/opt/openssl@3/include \
-L /opt/homebrew/Cellar/cpr/1.14.2/lib \
-L /opt/homebrew/opt/openssl@3/lib \
-lcpr -lcurl -lssl -lcrypto -lsqlite3 -lpthread \
-Wl,-rpath,/opt/homebrew/Cellar/cpr/1.14.2/lib
./focusforge

*/
