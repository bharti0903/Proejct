# Digital Addiction Awareness System

A full-stack web application that helps users track screen time, view weekly usage reports, receive smart alerts, and join digital detox challenges.

## Features

- User signup, login, and logout
- Session-based authentication
- Protected routes
- Add, edit, and delete screen time entries
- Dashboard with live statistics
- Weekly report with category-wise analysis
- Smart alerts when daily screen-time limit is crossed
- Detox challenges with join and progress tracking
- Real-time updates using Socket.IO
- Responsive UI using Tailwind CSS and EJS

## Tech Stack

- Frontend: EJS, Tailwind CSS
- Backend: Node.js, Express.js
- Database: MongoDB, Mongoose
- Authentication: Express Session
- Real-time: Socket.IO

## Run Locally

```bash
npm install
cp .env.example .env
npm run tailwind
npm start
```

The app runs on `http://localhost:5002` by default.

## Deployment

Use `npm start` as the production start command. Set these environment variables on your hosting platform:

- `MONGO_URI`
- `SESSION_SECRET`
- `PORT` if the platform does not inject one automatically

The health check endpoint is `/health`.

## Project Structure

```bash
digital-addiction-awareness-main/
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── sockets/
├── utils/
├── views/
│   ├── auth/
│   ├── partials/
│   └── store/
├── public/
├── .env
├── app.js
├── package.json
└── README.md
