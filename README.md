# StudentDesk

StudentDesk is a student information system built with Node.js, Express, MongoDB, and a responsive browser interface.

## Features

- Administrator registration and login, with redirect to the dashboard after authentication
- Dashboard counts for total students, active students, students on leave, and courses represented
- Student database with searchable records and status filters
- Add, edit, and delete student records
- Individual student detail view with contact, course, enrollment, guardian, and notes fields
- Per-account record access, hashed passwords, and signed session tokens

## Run on Windows

1. Install Node.js (which includes npm) and start MongoDB locally, or configure a MongoDB Atlas database.
2. Double-click `start.bat`. It creates a private `.env` file with a random session secret the first time it runs, installs dependencies if needed, and starts the website.
3. Open `http://localhost:3000`, register an administrator account, and add students from the dashboard.

For MongoDB Atlas, the first run opens `.env` in Notepad. Replace the `MONGODB_URI` value with your Atlas connection string, save the file, and close Notepad. Keep the database username and password in this local file; do not commit or share it. Atlas must allow your current IP address and the database user must have read/write access. If you already created `.env`, edit its `MONGODB_URI` and run `start.bat` again.

You can also run `npm install` and `npm start` from this folder in a terminal.

MongoDB stores administrator accounts in `accounts` and student records in `students`. The API routes are under `/api/auth` and `/api/students`. Each student's unique ID is enforced per administrator account.
