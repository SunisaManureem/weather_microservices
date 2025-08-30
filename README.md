Weather Microservices Project
=============================
Components:
  - mongodb (mongo:6.0)
  - crud (Node.js + Express)
  - fetcher (polls open-meteo and POSTs to crud)
  - display (static UI + proxy to crud)

How to run (requires Docker + Docker Compose):
  1. cp .env.example .env
  2. docker compose up --build
  3. open http://localhost:8080 to see dashboard
  4. check crud API at http://localhost:3000/weather

Notes:
  - For production, enable authentication for MongoDB, do not expose DB port.
  - Adjust fetch interval in .env SCHEDULE (cron format).
