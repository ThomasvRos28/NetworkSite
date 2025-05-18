# ConnectPro - Professional Networking Platform

ConnectPro is a professional networking platform designed to help users connect, collaborate, and grow their professional network.

## Features

- User registration and authentication
- Secure password storage with hashing and salting
- Professional profile creation
- Skills management

## Technical Implementation

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js with Express
- Database: MongoDB with Mongoose

## Setup and Installation

1. Make sure you have Node.js (v14+) and MongoDB installed
2. Clone this repository
3. Install dependencies:

```bash
npm install
```

4. Create a `.env` file with your MongoDB connection string:

```
MONGODB_URI=mongodb://localhost:27017/connectpro
PORT=8080
```

5. Run the server:

```bash
npm start
```

6. Open your browser and navigate to `http://localhost:8080`

## User Registration Flow

1. User fills out the sign-up form with personal and professional information
2. Data is sent to the server via AJAX
3. Server validates the data and creates a new user account
4. Password is securely hashed with a salt before storage
5. User receives confirmation and is redirected to the sign-in page

## Database Schema (MongoDB)

### User Model
- _id (MongoDB ObjectId)
- username (Unique)
- email (Unique)
- password (Hashed)
- firstName
- lastName
- createdAt

### ProfessionalInfo Model
- _id (MongoDB ObjectId)
- user (Reference to User)
- workExperience
- companyName
- fieldOfWork

### Skill Model
- _id (MongoDB ObjectId)
- user (Reference to User)
- skill

## Security Features

- Password hashing using bcrypt
- Mongoose middleware for automatic password hashing
- MongoDB document validation
- Input validation on both client and server side

## Future Enhancements

- Profile page with user information
- Connection requests between users
- Messaging system
- Job posting and application system
- Advanced search functionality
