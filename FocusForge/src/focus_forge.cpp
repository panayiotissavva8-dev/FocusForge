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
};

struct SubjectData {
    int subject_id;
    int user_id;
    string name;
    int difficulty;
    string deadline;
    int completed;
    double grade;
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
            completed INTEGER,
            grade REAL, 
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

// --- USER FUNCTIONS ---
void loadSubjects(sqlite3* db, vector<SubjectData>& subjects, const int user_id){
    sqlite3_stmt* stmt;
    const char* sql;

    subjects.clear();

    sql = "SELECT subject_id, user_id, name, difficulty, deadline, completed, grade "
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
        s.deadline = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4));
        s.completed = sqlite3_column_int(stmt, 5);
        s.grade = sqlite3_column_double(stmt, 6);

        subjects.push_back(s);
    }

    sqlite3_finalize(stmt);
}

void insertSubject(sqlite3* db, const SubjectData& s){
    sqlite3_stmt* stmt;
    const char* sql = "INSERT INTO subjects (user_id, name, difficulty, deadline, completed, grade) VALUES (?, ?, ?, ?, ?, ?);";

    if(sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK){
        cerr<<"Prepare failed"<<endl;
        return;
    }

    sqlite3_bind_int(stmt, 1, s.user_id);
    sqlite3_bind_text(stmt, 2, s.name.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 3, s.difficulty);
    sqlite3_bind_text(stmt, 4, s.deadline.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 5, s.completed);
    sqlite3_bind_double(stmt, 6, s.grade);

    int rc = sqlite3_step(stmt);

    if(rc != SQLITE_DONE){
        cerr<<"Insert failed: "<<sqlite3_errmsg(db)<<endl; 
    }else {
        cout<<"Insert success"<<endl;
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

int main(){

    int rc = sqlite3_open(DB_PATH.c_str(), &db_focus_forge);

    if(rc){
        cerr<<"Cannot open DB: "<<sqlite3_errmsg(db_focus_forge) <<endl;
        return 1;
    }

    initializeDatabase(db_focus_forge);

    crow::SimpleApp app;

    CROW_ROUTE(app, "/")([]{
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
        string input_hash = hashPassword(password);

        vector<UserData> users;
        loadUsers(db_focus_forge, users, username);

        if(users.empty()){
            return crow::response(404, "User not found");
        }
        UserData u = users[0];
        if(u.password_hash == input_hash){
            string token = username + "-" + to_string(chrono::system_clock::now().time_since_epoch().count());
            sessions[token] = SessionData{username, u.user_id};

            crow::json::wvalue res;
            res["status"] = "success";
            res["username"] = username;
            res["user_id"] = u.user_id;
            res["token"] = token;

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
        string hashed = hashPassword(password);
        time_t terms_accepted_at = time(nullptr);

        if(password != confirm_password){
            return crow::response(400, "Passwords do not match");
        }

        if(!termsAccepted){
            return crow::response(400, "Terms must be accepted");
        }

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


    // --- SUBJECTS API ---
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

        int i =0;
        for(const auto& s : subjects){
            crow::json::wvalue obj;

            string diff;
            if(s.difficulty == 0) diff = "NONE";
            else if(s.difficulty == 1) diff = "LOW";
            else if(s.difficulty == 2) diff = "MEDIUM";
            else diff = "HIGH";

            obj["subject"] = s.name;
            obj["difficulty"] = diff;
            obj["deadline"] = s.deadline;
            obj["completed"] = s.completed;
            obj["grade"] = s.grade;

            out["subjects"][i++] = std::move(obj);
        }

        return crow::response(200, out);
    });


    // --- ADD SUBJECT API ---
    CROW_ROUTE(app, "/add_subject_api").methods(crow::HTTPMethod::POST)([](const crow::request& req){
        auto body = crow::json::load(req.body);
        if(!body) return crow::response(400);

        auto token = req.get_header_value("Authorization");
        if(token.empty() || sessions.find(token) == sessions.end())
           return crow::response(401, "Not logged in");
         string username = sessions[token].username;
         int user_id = sessions[token].user_id;

          SubjectData s;
          s.user_id = sessions[token].user_id;
          s.name = body["name"].s();
          s.difficulty = body["difficulty"].i();
          s.deadline = body["deadline"].s();
          s.completed = body["completed"].i();
          s.grade = body["grade"].d();

          insertSubject(db_focus_forge, s);

          return crow::response(200, "Subject added");

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

// IGNORE
// --- COMPILE COMMAND ---
/* g++ -std=c++17 src/focus_forge.cpp -o focusforge \
-I Crow/include \
-I /opt/homebrew/include \
-I /opt/homebrew/opt/openssl@3/include \
-L /opt/homebrew/opt/openssl@3/lib \
-lsqlite3 -lssl -lcrypto -lpthread
./focusforge
*/