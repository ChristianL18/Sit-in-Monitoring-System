const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");


const app = express();
const PORT = 3000;

/* Built-in middleware instead of body-parser */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* Serve static files */
app.use(express.static(__dirname));

/* Connect SQLite Database */
const db = new sqlite3.Database("./database.db", (err) => {
    if (err) {
        console.log("Database connection error");
    } else {
        console.log("Connected to SQLite database");
    }
});

/* Create table if it doesn't exist */
db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_number TEXT,
    first_name TEXT,
    last_name TEXT,
    middle_name TEXT,
    course_level TEXT,
    course TEXT,
    address TEXT,
    email TEXT,
    password TEXT
)
`);

/* Register route */
app.post("/register", (req, res) => {

    const {
        id_number,
        first_name,
        last_name,
        middle_name,
        course_level,
        course,
        address,
        email,
        password
    } = req.body;

    const sql = `
    INSERT INTO users 
    (id_number, first_name, last_name, middle_name, course_level, course, address, email, password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [
        id_number,
        first_name,
        last_name,
        middle_name,
        course_level,
        course,
        address,
        email,
        password
    ], function(err) {

        if (err) {
            console.log(err);
            res.send("Registration Failed");
        } else {
            res.send("Registration Successful!");
        }

    });

});

/* Login route */
app.post("/login", (req, res) => {
    const { idNumber, password } = req.body;
    
    const sql = `SELECT * FROM users WHERE id_number = ? AND password = ?`;
    
    db.get(sql, [idNumber, password], (err, user) => {
        if (err) {
            console.log(err);
            res.json({ success: false, error: "Database error" });
        } else if (user) {
            res.json({ success: true, redirectUrl: "/pages/main.html" });
        } else {
            res.json({ success: false, error: "Invalid ID Number or Password" });
        }
    });
});

/* Start server */
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});