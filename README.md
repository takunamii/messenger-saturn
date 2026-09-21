# Saturn Messenger

[![Demo](https://img.shields.io/badge/demo-live-success)](https://messenger-saturn.netlify.app/)

**Live Demo:** https://messenger-saturn.netlify.app/

A full-stack web messenger built with React, Express, JWT authentication, and SQLite.

Saturn provides user authentication, private conversations, user search, messaging, unread message indicators, pinned chats, user avatars, and image uploads.

The project is split into a React frontend and an Express REST API backend.

## Features

* User registration
* User authentication
* JWT-based authorization
* User search by username
* Private conversations
* Messaging
* Persistent message history
* Unread message indicators
* Chat pinning
* User avatars
* Image uploads
* SQLite database
* REST API
* Responsive interface
* Separate frontend and backend
* Production deployment

## Tech Stack

### Frontend

* React
* Vite
* JavaScript
* CSS
* React Hooks

### Backend

* Node.js
* Express
* JWT
* SQLite
* REST API

### Deployment

* Netlify
* Railway

## Architecture

```text
Browser
   │
   ▼
React + Vite
   │
   │ HTTP / REST API
   ▼
Express Server
   │
   ├── JWT Authentication
   ├── Users
   ├── Messages
   └── File Uploads
   │
   ▼
SQLite
```

## Project Structure

```text
messenger-saturn/
├── client/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.*
│
├── server/
│   ├── src/
│   ├── package.json
│   ├── saturn.db
│   └── uploads/
│
├── netlify.toml
└── README.md
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/takunamii/messenger-saturn.git
cd messenger-saturn
```

### 2. Start the server

```bash
cd server
npm install
npm start
```

The API will be available at:

```text
http://localhost:3000
```

### 3. Start the client

Open another terminal:

```bash
cd client
npm install
npm run dev
```

The development server will be available at:

```text
http://localhost:5173
```

## Environment Variables

### Server

| Variable      | Description                    | Default       |
| ------------- | ------------------------------ | ------------- |
| `PORT`        | API port                       | `3000`        |
| `JWT_SECRET`  | Secret used to sign JWT tokens | `dev-secret`  |
| `JWT_TTL`     | JWT lifetime                   | `7d`          |
| `DB_PATH`     | SQLite database path           | `./saturn.db` |
| `UPLOADS_DIR` | Uploaded files directory       | `./uploads`   |

Example:

```env
PORT=3000
JWT_SECRET=your-long-random-secret
JWT_TTL=7d
DB_PATH=./saturn.db
UPLOADS_DIR=./uploads
```

For production, use a strong randomly generated JWT secret.

### Client

```env
VITE_API_URL=http://localhost:3000
```

For production, set `VITE_API_URL` to the deployed backend URL.

## Deployment

The application can be deployed using:

* **Netlify** for the frontend;
* **Railway** for the backend.

### Backend

The backend should use the `server` directory as its root directory.

For a production deployment, configure:

```env
JWT_SECRET=your-production-secret
DB_PATH=/data/saturn.db
UPLOADS_DIR=/data/uploads
```

A persistent volume should be mounted to:

```text
/data
```

This allows the SQLite database and uploaded files to persist between deployments and restarts.

### Frontend

Set:

```env
VITE_API_URL=https://your-api-url
```

Build the frontend with:

```bash
npm run build
```

## Deployment Updates

After connecting the repository to Netlify and Railway, changes pushed to GitHub can trigger automatic deployments.

```bash
git add .
git commit -m "update"
git push
```

## Project Goals

Saturn was created as a full-stack project to practice:

* React application architecture;
* REST API development;
* JWT authentication;
* SQLite database integration;
* file uploads;
* frontend/backend communication;
* responsive UI development;
* automated testing;
* production deployment.

## License

This project is intended for educational and portfolio purposes.
