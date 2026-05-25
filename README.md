# Child Missing Tracker System

Child Missing Tracker System is a full-stack web application used to register children at crowded places, generate a unique 6 digit code for each child, search child details at the help centre, and mark the child as safely exited after handover to parents.

This project is useful for places like exhibitions, fairs, events, temples, malls, and other crowded areas where children can get separated from parents.

## Project Idea

When a family enters a crowded place, the worker collects parent and child details. The system generates a unique 6 digit code for every child. This code can be written on the child.

If the child exits safely, the worker checks the code and marks safe exit.

If the child is missing and reaches the help centre, the finder searches using the code, gets parent details, contacts the parents, and marks the child safe after handover.

## Features

- Three login portals: Admin, Worker, and Finder
- Worker can add family entry details
- Worker can add multiple children for one family
- Every child gets a separate 6 digit unique code
- Parent details, child details, and photos can be stored
- Worker can verify safe exit using the child code
- Finder can search child details using the code
- Finder can mark child found and safely handed over
- Admin can view total records, active children, found children, and safe exits
- Admin can view worker activity and finder follow-up activity
- Admin can view previous entry records for future reference
- Responsive design for desktop and mobile
- Local backend and JSON database

## Portals

### Admin

Admin can see:

- Total child records
- Active children
- Found children
- Safe exits
- Today entries
- Today exits
- Worker work count
- Finder follow-up count
- All previous records

### Worker

Worker can:

- Enter parent details
- Enter child details
- Upload parent and child photos
- Generate 6 digit child codes
- Check child code at exit
- Mark safe exit

### Finder

Finder can:

- Search child details using 6 digit code
- View parent details
- View child details
- Mark child as found
- Mark child as safely handed over

## Login Details

Use these demo login details:

### Admin Login

```text
Email: admin@gmail.com
Password: 123
```

### Worker Login

```text
Email: worker@gmail.com
Password: 123
```

### Finder Login

```text
Email: finder@gmail.com
Password: 123
```

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the backend server and opens the website through the local server.

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

If port 3000 is already busy, run:

```bash
PORT=3100 npm start
```

Then open:

[http://localhost:3100](http://localhost:3100)

## How To Run This Project

1. Download or clone the repository.
2. Open the project folder in VS Code.
3. Open terminal in VS Code.
4. Run:

```bash
npm start
```

5. Open the shown localhost link in your browser.
6. Select Admin, Worker, or Finder portal.
7. Login using the demo login details.

## Project Flow

### Normal Safe Exit Flow

```text
Entry details -> Generate unique code -> Code given to child -> Exit code check -> Safe exit
```

### Missing Child Flow

```text
Entry details -> Generate unique code -> Child missing -> Help centre search by code -> Inform parents -> Safe handover
```

## Technologies Used

- HTML
- CSS
- JavaScript
- Node.js
- JSON file database

## Project Files

```text
index.html      Portal selection page
login.html      Login page
worker.html     Worker dashboard
finder.html     Finder dashboard
admin.html      Admin dashboard
style.css       Website styling
script.js       Frontend logic
server.js       Backend server and API
data/           Local database folder
uploads/        Uploaded photo storage
```

## Important Note

This project uses a local JSON database for beginner-friendly development. For real-world production use, it should be upgraded with a secure database, encrypted passwords, stronger authentication, and proper server deployment.

## About

A child safety tracking system for crowded places with entry registration, 6 digit child codes, help centre search, safe exit verification, admin records, and staff activity tracking.
