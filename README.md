# ConnectPro - Professional Networking Platform

ConnectPro is a professional networking platform designed to help users connect, collaborate, and grow their professional network.

## Features

- User registration and authentication
- Secure password storage with hashing and salting
- Professional profile creation
- Skills management

## Technical Implementation

- Frontend: HTML, CSS, JavaScript
- Backend: Python with HTTP server
- Database: SQLite

## Setup and Installation

1. Make sure you have Python 3.6+ installed
2. Clone this repository
3. Run the server:

```bash
python server.py
```

4. Open your browser and navigate to `http://localhost:8000`

## User Registration Flow

1. User fills out the sign-up form with personal and professional information
2. Data is sent to the server via AJAX
3. Server validates the data and creates a new user account
4. Password is securely hashed with a salt before storage
5. User receives confirmation and is redirected to the sign-in page

## Database Schema

### Users Table
- id (Primary Key)
- username (Unique)
- email (Unique)
- password_hash
- salt
- first_name
- last_name
- created_at

### Professional Info Table
- id (Primary Key)
- user_id (Foreign Key)
- work_experience
- company_name
- field_of_work

### Skills Table
- id (Primary Key)
- user_id (Foreign Key)
- skill

## Security Features

- Password hashing using PBKDF2 with SHA-256
- Unique salt for each user
- 100,000 iterations for password hashing
- Input validation on both client and server side

## Future Enhancements

- Profile page with user information
- Connection requests between users
- Messaging system
- Job posting and application system
- Advanced search functionality
