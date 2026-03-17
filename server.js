const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");

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

/* Create admin table if it doesn't exist */
db.run(`
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

/* Admin Registration Route */
app.post("/api/admin-register", async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.json({ success: false, error: "All fields are required" });
    }

    try {
        // Hash the password with bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Check if username or email already exists
        const checkSql = `SELECT * FROM admins WHERE username = ? OR email = ?`;
        db.get(checkSql, [username, email], async (err, existingAdmin) => {
            if (err) {
                console.log(err);
                return res.json({ success: false, error: "Database error" });
            }

            if (existingAdmin) {
                return res.json({ success: false, error: "Username or email already exists" });
            }

            // Insert new admin with hashed password
            const insertSql = `INSERT INTO admins (username, email, password) VALUES (?, ?, ?)`;
            db.run(insertSql, [username, email, hashedPassword], function(err) {
                if (err) {
                    console.log(err);
                    return res.json({ success: false, error: "Registration failed" });
                }
                res.json({ success: true, message: "Admin registered successfully!" });
            });
        });
    } catch (error) {
        console.log(error);
        res.json({ success: false, error: "Server error" });
    }
});

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

// Create/Add announcement
app.post('/api/announcements', (req, res) => {
    const { title, description } = req.body;
    
    const sql = `INSERT INTO Annoucements (title, description) VALUES (?, ?)`;
    
    db.run(sql, [title, description], function(err) {
        if (err) {
            return res.status(500).json({ error: "Failed to create announcement" });
        }
        res.json({ success: true });
    });
});


/* Login route */
app.post("/login", async (req, res) => {
    const { idNumber, password } = req.body;
    
    // First, check if the user is an admin in the admins table
    const adminSql = `SELECT * FROM admins WHERE username = ?`;
    
    db.get(adminSql, [idNumber], async (err, admin) => {
        if (err) {
            console.log(err);
            return res.json({ success: false, error: "Database error" });
        }
        
        if (admin) {
            // Verify password with bcrypt
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.userId = admin.id;
                req.session.isAdmin = true;
                return res.json({ success: true, redirectUrl: '/pages/admin.html' });
            }
        }
        
        // If not admin, check the users table
        const userSql = `SELECT * FROM users WHERE id_number = ? AND password = ?`;
        
        db.get(userSql, [idNumber, password], (err, user) => {
            if (err) {
                console.log(err);
                res.json({ success: false, error: "Database error" });
            } else if (user) {
                req.session.userId = user.id;
                // Check if user is admin (using id_number 'admin' for admin access)
                if (user.id_number === 'admin') {
                    res.json({ success: true, redirectUrl: '/pages/admin.html' });
                } else {
                    res.json({ success: true, redirectUrl: '/pages/main.html' });
                }
            } else {
                res.json({ success: false, error: "Invalid ID Number or Password" });
            }
        });
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

// Search user by ID
app.get('/api/search-user', (req, res) => {
    const idNumber = req.query.id;
    
    db.get("SELECT * FROM users WHERE id_number = ?", [idNumber], (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        if (user) {
            res.json({ success: true, user: user });
        } else {
            res.json({ success: false, error: "User not found" });
        }
    });
});

// Get all users (for student management)
app.get('/api/users', (req, res) => {
    db.all("SELECT id, id_number, first_name, last_name, course_level, course, email FROM users ORDER BY last_name", [], (err, users) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        res.json(users);
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

// Create sit-in table
function createTableSitIn(){
    db.run(`
        CREATE TABLE IF NOT EXISTS sitin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT,
            student_name TEXT,
            purpose TEXT,
            lab TEXT,
            time_in DATETIME DEFAULT CURRENT_TIMESTAMP,
            time_out DATETIME,
            status TEXT DEFAULT 'active'
        )
    `)
}

// Get all sit-in records
app.get('/api/sitin', (req, res) => {
    db.all("SELECT * FROM sitin ORDER BY time_in DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching records' });
        }
        res.json(rows);
    });
});

// Create sit-in
app.post('/api/sitin', (req, res) => {
    const { studentId, studentName, purpose, lab } = req.body;
    
    const sql = `INSERT INTO sitin (student_id, student_name, purpose, lab, status) VALUES (?, ?, ?, ?, 'active')`;
    
    db.run(sql, [studentId, studentName, purpose, lab], function(err) {
        if (err) {
            return res.status(500).json({ error: "Failed to create sit-in" });
        }
        res.json({ success: true });
    });
});

// Get statistics
app.get('/api/stats', (req, res) => {
    const stats = {};
    
    db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
        stats.totalStudents = row ? row.count : 0;
        
        db.get("SELECT COUNT(*) as count FROM sitin WHERE status = 'active'", [], (err, row) => {
            stats.currentSitIn = row ? row.count : 0;
            
            db.get("SELECT COUNT(*) as count FROM sitin", [], (err, row) => {
                stats.totalSitIn = row ? row.count : 0;
                res.json(stats);
            });
        });
    });
});

// Get language statistics
app.get('/api/language-stats', (req, res) => {
    const languages = { 'C#': 0, 'C': 0, 'Java': 0, 'ASP.NET': 0, 'PHP': 0 };
    
    db.all("SELECT lab, COUNT(*) as count FROM sitin GROUP BY lab", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error' });
        
        rows.forEach(row => {
            if (languages.hasOwnProperty(row.lab)) {
                languages[row.lab] = row.count;
            }
        });
        
        res.json({ 
            labels: Object.keys(languages), 
            data: Object.values(languages) 
        });
    });
});

createTableSitIn();


app.get('/pages/main.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/main.html'));
});

app.get('/pages/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/admin.html'));
});

app.get('/pages/admin-register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/admin-register.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/admin.html'));
});

app.get('/main.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/main.html'));
});


createTableAnnouncements();

/* Start server */
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});