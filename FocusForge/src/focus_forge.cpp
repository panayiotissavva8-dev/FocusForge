#include <iostream>
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


sqlite3* db_prodexa = nullptr;
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

std::unordered_map<std::string, <SessionData> sessions;

// --- UTILITY FUNCTIONS ---
string hashPassword(const string& pasword){
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256  ((unsigned char*)password.c_str(), password.size(), hash);

    stringstream ss; 
    for(int i = 0; i < SHA256_DIGEST_LENGTH; i++)
       ss << hex << setw(2) << setfill('0' << (int)hash[i]);
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
    sqlite3_bind_int(stmt, 1, user_id,);

    while(sqlite3_step(stmt) == SQLITE_ROW){
        SubjectData s;
        s.subject_id = sqlite3_column_int(stmt, 0);
        s.user_id = sqlite3_column_int(stmt, 1);
        s.name = sqlite3_column_text(stmt, 2);
        s.difficulty = sqlite3_column_int(stmt, 3);
        s.deadline = sqlite3_column_text(stmt, 4);
        s.completed = sqlite3_column_int(stmt, 5);
        s.grade = sqlite3_column_double(stmt, 6);

        subjects.push_back(s);
    }

    sqlite3_finalize(stmt);
}

void isertSubject(sqlite3* db, const SubjectData& s){
    sqlite3_stmt* stmt;
    const char* sql = "INSERT INTO subjects (user_id, name, difficulty, deadline, completed, grade) VALUES (?, ?, ?, ?, ?, ?);";

    if(sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK){
        cerr<<"Prepare failed"<<endl;
        return;
    }

    sqlite3_bind_int(stmt, 1, s.user_id);
    sqlite3_bind_text(stmt, 2, s.name.c_str(), -1, SQLITE_TRANSIENT);
    sqite3_bind_int(stmt, 3, s.difficulty);
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
        u.user_id = sqlite_column_int(stmt, 0);
        u.owner = username; 
        u.password_hash =sqlite3_column_text(stmt, 1);
        u.email = sqlite3_column_text(stmt, 2);
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
        ifstream file("web/html/login.html")
        if(!file.is_open()) return crow::response(404);
        stringstream buffer;
        buffer << file.rdbuf();
        return crow::response(buffer.str());
    });

    // --- LOGIN API ---
    CROW_ROUTE(app, "/login").methods(crow::HTTPMethod::POST)([](const crow::request& req){
        auto body = crow::json::load(req.body);
        if(!body) return crow::response(400);

        string username = body["username"].s();
        string password = body["password"].s();
        string input_hash = hashPassword(password);

        loadUsers(db, username);

        if(db_hash == input_hash){
            string token = username + "-" + to_string(chrono::system_clock::now().time_since_epoch().count());
            sessions[token] = {username, user_id};

            res["status"] = "success";
            res["username"] = username;
            res["token"] = token;

            return crow::response(res);

        }
    });
    
}