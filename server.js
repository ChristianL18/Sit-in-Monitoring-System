const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const session = require("express-session");

const app = express();
const PORT = 3000;

/* Built-in middleware instead of body-parser */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* Session middleware */
app.use(session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

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

function createTableAnnouncements(){
    db.run(`
        CREATE TABLE IF NOT EXISTS Annoucements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )       
    `)
}




/* Login route */
app.post("/login", (req, res) => {
    const { idNumber, password } = req.body;
    
    const sql = `SELECT * FROM users WHERE id_number = ? AND password = ?`;
    
    db.get(sql, [idNumber, password], (err, user) => {
        if (err) {
            console.log(err);
            res.json({ success: false, error: "Database error" });
        } else if (user) {
            req.session.userId = user.id;
            res.json({ success: true, redirectUrl: "/pages/main.html" });
        } else {
            res.json({ success: false, error: "Invalid ID Number or Password" });
        }
    });
});

// STUDENT INFO API ROUTE - Fetch current user only
app.get('/api/studentinfo', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    
    db.get(`
        SELECT first_name || ' ' || last_name AS name, course, course_level, email, address
        FROM users
        WHERE id = ?
    `, [req.session.userId], (err, row) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(row);
    });
});

// Logout route
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ success: true, message: 'Logged out successfully', redirectUrl: '/pages/Login.html' });
    });
});


app.get('/api/announcements', (req, res) => {
    db.all('SELECT title, description, created_at FROM Annoucements ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error' });
        }
        res.json(rows);
    });
});


app.get('/main.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});


createTableAnnouncements();

/* Start server */
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});