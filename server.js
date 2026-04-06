    const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 3000;

/* Built-in middleware instead of body-parser */
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));

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
    password TEXT,
    profile_picture TEXT
)
`);

/* Add profile_picture column if it doesn't exist (for existing databases) */
db.run(`ALTER TABLE users ADD COLUMN profile_picture TEXT`, (err) => {
    // Ignore error if column already exists
});

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
    db.all("SELECT id, id_number, first_name, last_name, middle_name, course_level, course, email, address, remaining_sessions FROM users ORDER BY last_name", [], (err, users) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        res.json(users);
    });
});

// Update a user
app.put('/api/users/:idNumber', (req, res) => {
    const { idNumber } = req.params;
    const { first_name, last_name, middle_name, course_level, course, email, address } = req.body;
    
    const sql = `UPDATE users SET first_name = ?, last_name = ?, middle_name = ?, course_level = ?, course = ?, email = ?, address = ? WHERE id_number = ?`;
    
    db.run(sql, [first_name, last_name, middle_name, course_level, course, email, address, idNumber], function(err) {
        if (err) {
            return res.status(500).json({ error: "Failed to update user" });
        }
        
        if (this.changes === 0) {
            return res.json({ success: false, error: "User not found" });
        }
        
        res.json({ success: true, message: "User updated successfully" });
    });
});

// Delete a user
app.delete('/api/users/:idNumber', (req, res) => {
    const { idNumber } = req.params;
    
    db.run("DELETE FROM users WHERE id_number = ?", [idNumber], function(err) {
        if (err) {
            return res.status(500).json({ error: "Failed to delete user" });
        }
        
        if (this.changes === 0) {
            return res.json({ success: false, error: "User not found" });
        }
        
        res.json({ success: true, message: "User deleted successfully" });
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
            status TEXT DEFAULT 'active',
            sessions INTEGER DEFAULT 30
        )
    `)
}

// Add sessions column if it doesn't exist (for existing databases)
db.run(`ALTER TABLE sitin ADD COLUMN sessions INTEGER DEFAULT 30`, (err) => {
    // Ignore error if column already exists
});

db.run(`ALTER TABLE users ADD COLUMN remaining_sessions INTEGER DEFAULT 30`, (err) => {
    // Ignore error if column already exists
});

// Get all sit-in records
app.get('/api/sitin', (req, res) => {
    db.all("SELECT s.*, u.course, u.course_level as year_level FROM sitin s LEFT JOIN users u ON s.student_id = u.id_number ORDER BY s.time_in DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching records' });
        }
        res.json(rows);
    });
});

// Time out a sit-in record - decrements session by 1
app.put('/api/sitin/:id/timeout', (req, res) => {
    const { id } = req.params;
    const timeOut = new Date().toISOString();
    
    db.get("SELECT sessions, student_id FROM sitin WHERE id = ?", [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Failed to time out" });
        }
        
        const currentSessions = row ? row.sessions : 30;
        const studentId = row ? row.student_id : null;
        const newSessions = Math.max(0, currentSessions - 1);
        
        const sql = `UPDATE sitin SET time_out = ?, status = 'completed', sessions = ? WHERE id = ?`;
        
        db.run(sql, [timeOut, newSessions, id], function(err) {
            if (err) {
                return res.status(500).json({ error: "Failed to time out" });
            }
            
            if (studentId) {
                db.run("UPDATE users SET remaining_sessions = ? WHERE id_number = ?", [newSessions, studentId], (err) => {
                    if (err) {
                        console.log("Failed to update remaining_sessions for student:", studentId);
                    }
                });
            }
            
            res.json({ success: true, message: "Student timed out successfully", remainingSessions: newSessions });
        });
    });
});

// Create sit-in
app.post('/api/sitin', (req, res) => {
    const { studentId, studentName, purpose, lab } = req.body;
    
    // Check if student already has an active sit-in
    db.get("SELECT id FROM sitin WHERE student_id = ? AND status = 'active'", [studentId], (err, existingSitIn) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        
        if (existingSitIn) {
            return res.json({ success: false, error: "Student already has an active sit-in session" });
        }
        
        db.get("SELECT remaining_sessions FROM users WHERE id_number = ?", [studentId], (err, row) => {
            if (err) {
                return res.status(500).json({ error: "Failed to fetch student sessions" });
            }
            
            const sessions = row && row.remaining_sessions !== undefined ? row.remaining_sessions : 30;
            
            const sql = `INSERT INTO sitin (student_id, student_name, purpose, lab, status, sessions) VALUES (?, ?, ?, ?, 'active', ?)`;
            
            db.run(sql, [studentId, studentName, purpose, lab, sessions], function(err) {
                if (err) {
                    return res.status(500).json({ error: "Failed to create sit-in" });
                }
                res.json({ success: true, sessions: sessions });
            });
        });
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

// Get student remaining sessions
app.get('/api/student-sessions/:idNumber', (req, res) => {
    db.get("SELECT remaining_sessions FROM users WHERE id_number = ?", [req.params.idNumber], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        const sessions = row && row.remaining_sessions !== undefined ? row.remaining_sessions : 30;
        res.json({ sessions: sessions });
    });
});

// Reset student sessions
app.put('/api/reset-sessions/:idNumber', (req, res) => {
    db.run("UPDATE users SET remaining_sessions = 30 WHERE id_number = ?", [req.params.idNumber], function(err) {
        if (err) {
            return res.status(500).json({ error: "Failed to reset sessions" });
        }
        res.json({ success: true });
    });
});

// Get student remaining sessions
app.get('/api/student-sessions/:idNumber', (req, res) => {
    db.get("SELECT remaining_sessions FROM users WHERE id_number = ?", [req.params.idNumber], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Database error" });
        }
        const sessions = row && row.remaining_sessions !== undefined ? row.remaining_sessions : 30;
        res.json({ sessions: sessions });
    });
});

// Reset student sessions
app.put('/api/reset-sessions/:idNumber', (req, res) => {
    db.run("UPDATE users SET remaining_sessions = 30 WHERE id_number = ?", [req.params.idNumber], function(err) {
        if (err) {
            return res.status(500).json({ error: "Failed to reset sessions" });
        }
        res.json({ success: true });
    });
});

// Get language/purpose statistics
app.get('/api/language-stats', (req, res) => {
    db.all("SELECT purpose, COUNT(*) as count FROM sitin WHERE status = 'active' GROUP BY purpose ORDER BY count DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error' });
        
        const labels = rows.map(row => row.purpose);
        const data = rows.map(row => row.count);
        
        res.json({ 
            labels: labels, 
            data: data 
        });
    });
});

createTableSitIn();


app.get('/SitIn.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/SitIn.html'));
});

app.get('/pages/SitIn.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/SitIn.html'));
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

// Create feedback table
function createTableFeedback() {
    db.run(`
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            user_type TEXT,
            user_name TEXT,
            feedback_text TEXT,
            rating INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

// Submit feedback
app.post('/api/feedback', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    const { feedback_text, rating } = req.body;
    const userId = req.session.userId;
    const userType = req.session.isAdmin ? 'admin' : 'user';

    if (!feedback_text || !rating) {
        return res.json({ success: false, error: "Feedback text and rating are required" });
    }

    let userName = 'Anonymous';
    if (req.session.isAdmin) {
        db.get("SELECT username FROM admins WHERE id = ?", [userId], (err, row) => {
            if (row) userName = row.username;
            insertFeedback();
        });
    } else {
        db.get("SELECT first_name, last_name FROM users WHERE id = ?", [userId], (err, row) => {
            if (row) userName = row.first_name + ' ' + row.last_name;
            insertFeedback();
        });
    }

    function insertFeedback() {
        const sql = `INSERT INTO feedback (user_id, user_type, user_name, feedback_text, rating) VALUES (?, ?, ?, ?, ?)`;
        db.run(sql, [userId, userType, userName, feedback_text, rating], function(err) {
            if (err) {
                console.log(err);
                return res.status(500).json({ success: false, error: "Failed to submit feedback" });
            }
            res.json({ success: true, message: "Feedback submitted successfully" });
        });
    }
});

// Get all feedback (for admin)
app.get('/api/feedback', (req, res) => {
    db.all("SELECT * FROM feedback ORDER BY created_at DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Failed to fetch feedback" });
        }
        res.json(rows);
    });
});

// Delete feedback (for admin)
app.delete('/api/feedback/:id', (req, res) => {
    db.run("DELETE FROM feedback WHERE id = ?", [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: "Failed to delete feedback" });
        }
        res.json({ success: true });
    });
});

createTableFeedback();

/* Get user profile */
app.get("/api/profile", (req, res) => {
    if (!req.session.userId || req.session.isAdmin) {
        return res.json({ success: false, error: "Not authenticated" });
    }
    
    const sql = `SELECT id, id_number, first_name, last_name, middle_name, 
                 course_level, course, address, email, profile_picture 
                 FROM users WHERE id = ?`;
    
    db.get(sql, [req.session.userId], (err, user) => {
        if (err) {
            console.log(err);
            return res.json({ success: false, error: "Database error" });
        }
        
        if (!user) {
            return res.json({ success: false, error: "User not found" });
        }
        
        res.json({ success: true, user });
    });
});

/* Update user profile */
app.put("/api/profile", (req, res) => {
    if (!req.session.userId || req.session.isAdmin) {
        return res.json({ success: false, error: "Not authenticated" });
    }
    
    const { first_name, last_name, middle_name, course_level, course, address, email, profile_picture } = req.body;
    
    const sql = `UPDATE users SET 
                 first_name = ?, last_name = ?, middle_name = ?, 
                 course_level = ?, course = ?, address = ?, email = ?, 
                 profile_picture = ? 
                 WHERE id = ?`;
    
    db.run(sql, [
        first_name, last_name, middle_name,
        course_level, course, address, email,
        profile_picture || null,
        req.session.userId
    ], function(err) {
        if (err) {
            console.log(err);
            return res.json({ success: false, error: "Failed to update profile" });
        }
        
        res.json({ success: true, message: "Profile updated successfully" });
    });
});

/* Start server */
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});