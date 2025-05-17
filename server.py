import http.server
import socketserver
import json
import sqlite3
import os
import hashlib
import secrets
import urllib.parse
from http import HTTPStatus

# Database setup
DB_NAME = "users.db"

def init_database():
    """Initialize the database with the required tables"""
    if not os.path.exists(DB_NAME):
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        # Create users table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Create professional_info table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS professional_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            work_experience INTEGER,
            company_name TEXT,
            field_of_work TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
        ''')

        # Create skills table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS skills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            skill TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
        ''')

        conn.commit()
        conn.close()
        print("Database initialized successfully")

def hash_password(password, salt=None):
    """Hash a password with a salt for secure storage"""
    if salt is None:
        salt = secrets.token_hex(16)

    # Use a strong hashing algorithm (SHA-256)
    password_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000  # Number of iterations
    ).hex()

    return password_hash, salt

def register_user(user_data):
    """Register a new user in the database"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        # Check if username or email already exists
        cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?",
                      (user_data['username'], user_data['email']))
        if cursor.fetchone():
            conn.close()
            return {"success": False, "message": "Username or email already exists"}

        # Hash the password
        password_hash, salt = hash_password(user_data['password'])

        # Insert user data
        cursor.execute('''
        INSERT INTO users (username, email, password_hash, salt, first_name, last_name)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            user_data['username'],
            user_data['email'],
            password_hash,
            salt,
            user_data['firstName'],
            user_data['lastName']
        ))

        user_id = cursor.lastrowid

        # Insert professional info
        cursor.execute('''
        INSERT INTO professional_info (user_id, work_experience, company_name, field_of_work)
        VALUES (?, ?, ?, ?)
        ''', (
            user_id,
            user_data['workExperience'],
            user_data['companyName'],
            user_data['fieldOfWork']
        ))

        # Insert skills
        skills = [
            user_data.get('skill1', ''),
            user_data.get('skill2', ''),
            user_data.get('skill3', '')
        ]

        for skill in skills:
            if skill.strip():
                cursor.execute('''
                INSERT INTO skills (user_id, skill)
                VALUES (?, ?)
                ''', (user_id, skill))

        conn.commit()
        conn.close()

        return {"success": True, "message": "User registered successfully"}

    except Exception as e:
        print(f"Error registering user: {e}")
        return {"success": False, "message": f"Error: {str(e)}"}

def authenticate_user(email, password):
    """Authenticate a user with email and password"""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        # Get user by email
        cursor.execute("SELECT id, username, password_hash, salt FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        if not user:
            conn.close()
            return {"success": False, "message": "Invalid email or password"}

        # Verify password
        user_id, username, stored_hash, salt = user
        calculated_hash, _ = hash_password(password, salt)

        if calculated_hash != stored_hash:
            conn.close()
            return {"success": False, "message": "Invalid email or password"}

        # Get user details
        cursor.execute("SELECT first_name, last_name FROM users WHERE id = ?", (user_id,))
        first_name, last_name = cursor.fetchone()

        conn.close()

        return {
            "success": True,
            "message": "Authentication successful",
            "user": {
                "id": user_id,
                "username": username,
                "firstName": first_name,
                "lastName": last_name,
                "email": email
            }
        }

    except Exception as e:
        print(f"Error authenticating user: {e}")
        return {"success": False, "message": f"Error: {str(e)}"}

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        """Handle POST requests"""
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length).decode('utf-8')

        # Parse the form data
        request_data = {}
        if 'application/json' in self.headers.get('Content-Type', ''):
            request_data = json.loads(post_data)
        else:
            # Parse form data
            form_data = urllib.parse.parse_qs(post_data)
            for key, value in form_data.items():
                request_data[key] = value[0] if len(value) == 1 else value

        # Handle different API endpoints
        if self.path == '/api/register':
            # Register the user
            result = register_user(request_data)

            # Send response
            self.send_response(HTTPStatus.OK)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            return

        elif self.path == '/api/login':
            # Authenticate the user
            result = authenticate_user(request_data.get('email', ''), request_data.get('password', ''))

            # Send response
            self.send_response(HTTPStatus.OK)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            return

        return super().do_POST()

    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run_server():
    """Run the HTTP server"""
    PORT = 8080  # Changed from 8000 to 8080

    # Initialize the database
    init_database()

    # Create the server
    Handler = CustomHTTPRequestHandler

    # Allow reuse of the address to avoid "address already in use" errors
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Server running at http://localhost:{PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    run_server()
