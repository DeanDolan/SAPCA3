# SAPCA3 — Secure vs Insecure Web App (Node + Express + MySQL)

A teaching demo that shows **insecure** vs **secure** approaches to user authentication and note-taking. The insecure side deliberately uses bad practices (SQL string concatenation, plaintext passwords, raw HTML rendering). The secure side uses prepared statements, **bcrypt** hashing, session-based auth, output encoding, and basic rate limiting.

## Quick Start

### 1) Prerequisites
- Node.js 18+ (works on 20/22 as well)
- MySQL 8+ running locally

### 2) Clone and Install 

# bash
git clone https://github.com/DeanDolan/SAPCA3.git
cd SAPCA3
npm install

### 3) Create .env file in project root folder

# Web server
PORT=3000

# MySQL connection
DB_HOST=localhost
DB_USER=secureapp
DB_PASSWORD=change-me
DB_NAME=secureapp

### 4) Create database and tables (use code below)

# Use MySQL Shell or mysql CLI to run the following:

CREATE DATABASE IF NOT EXISTS secureapp;
USE secureapp;

-- Users table (keeps plaintext in insecure flow; hash in secure flow)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password_plain VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notes table (shared by both flows)
CREATE TABLE IF NOT EXISTS notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner VARCHAR(255) NOT NULL,
  heading VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

### 5) Run the app 

# bash

npm start

### 6) How to use the app

Go to the home page (/index.html) and choose the Insecure or Secure path

# Insecure flow

Register/Login via /insecure.html

After login, you’ll be redirected to insecurenotes.html

Post notes (no auth checks, no output encoding, vulnerable by design)

# Secure flow

Register/Login via /secure.html

After login, you will be redirected to securenotes.html

Create, list, edit, and delete your notes (scoped by session user; output encoded)

### 7) Project structure

SAPCA3/
|- public/
|  |- index.html               # Landing with Secure/Insecure buttons
|  |- insecure.html            # Insecure login/register page (AJAX)
|  |- secure.html              # Secure login/register page (AJAX)
|  |- insecurenotes.html       # Insecure notes UI (AJAX, raw rendering)
|  |- securenotes.html         # Secure notes UI (AJAX, edit/delete)
|  |- styles/
|  |   - styles.css            # Shared styles
|  |- app-insecure.js          # Insecure login/register client
|  |- app-secure.js            # Secure login/register client
|  |- notes-insecure.js        # Insecure notes client (raw innerHTML)
|   - notes-secure.js          # Secure notes client (encode + edit/delete)
|- logs/
|   - app.log                  # JSON request & app logs
|- server.js                   # Express server (APIs + static)
|- schema.sql                  # MySQL code
|- .env                        # Environment variables (you create this)
|- package.json
|- package-lock.json

### 8) Features (Secure Side)

bcrypt password hashing (never stores plaintext)

Prepared statements using mysql2/promise

Session auth with express-session

Output encoding to mitigate reflected/stored XSS

Rate limiting on login with express-rate-limit

Per-user scoping of notes (owner = session user)

Edit/Delete notes via RESTful endpoints

Basic logging to logs/app.log

/health and /metrics endpoints for diagnostics

### 9) API Reference
 
# Insecure (Intentionally bad practices in place)

POST /api/insecure/register — Body: username, password, confirm

POST /api/insecure/login — Body: username, password

GET /api/insecure/notes — List all notes (public, no auth)

POST /api/insecure/notes — Body: owner, heading, content

# Secure (Mitigations of the insecure side)

POST /api/secure/register — Body: username, password, confirm

POST /api/secure/login — Body: username, password

GET /api/secure/notes — List notes for logged-in user

POST /api/secure/notes — Body: heading, content

PUT /api/secure/notes/:id — Body: heading, content

DELETE /api/secure/notes/:id

GET /secure/logout

# Diagnostics

GET /health — { status, uptime, timestamp }

GET /metrics — simple counters for screenshots

### 11) Branch Model 

# main
Full teaching repo with both Secure and Insecure flows side-by-side
Contains everything in this README

# secure
Only secure endpoints, pages, and clients (no insecure code or pages)

# insecure
Only insecure endpoints, pages, and clients (no secure code or pages)

# Note:
Because server.js was the first file uploaded to main it would not allow me to name my secure and insecure file "server.js" so 
I had to change the name to "insecure-server.js" and "secure-server.js" so if any issues revolve around this please change the file
(once downloaded) to "server.js" if needed for testing each side individually

### 12) Troubleshooting

# EADDRINUSE: 3000 in use
Another process is using the port

Stop the other server OR set PORT=3001 in .env

# DB error

Confirm MySQL is running

Verify credentials in .env

Ensure you ran the SQL schema above

Check logs/app.log for the error code

# Login required on secure pages

You must log in via /secure.html first

Cookies must be enabled (session-based auth)
