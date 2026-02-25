# BrightPath Tutoring

## Project Overview
BrightPath Tutoring helps middle- and high-school Associates with math and science through an online app where Associates log in, watch videos, take quizzes, and track progress. The product solves three core business problems:

- The app behaves differently on different computers ("works on my machine").
- Updates sometimes break the system, causing regressions.
- The team lacks fast detection for failures after changes.

When these issues occur, Associates can’t finish homework, teachers can’t track grades, support tickets increase, and the company risks reputational and financial loss. This project uses containerization and automated build practices to ensure consistent deployments, safer updates, and faster failure detection.

## Quick Start
Build and run the application using Docker (one-line):

```bash
# Build the image and run it on port 3000
docker build -t brightpath-app . && docker run -p 3000:3000 brightpath-app
```

If you prefer separate steps:

```bash
docker build -t brightpath-app .
docker run -p 3000:3000 brightpath-app
```

Open http://localhost:3000 in your browser.

## Architecture (Docker setup)
- Multi-stage `Dockerfile` build:
  - `builder` stage: uses `node:20-alpine` to install dependencies, copy project files, and run `npm run build` to produce a standalone Next.js output.
  - `production` stage: copies the standalone app artifacts (`.next/standalone`, `.next/static`, and `public`) into a smaller runtime image based on `node:20-alpine`, exposes port 3000, and runs the standalone server.
- Why this setup:
  - Multi-stage builds keep the final image small and free of build-time dependencies.
  - Building the standalone output produces a deterministic artifact that can be run in CI and production consistently.
  - Copying `public` and `.next/static` ensures static assets are available to the runtime.

Note: The repository includes a `Dockerfile` at the project root. If a `public` directory is missing, the `COPY --from=builder /app/public ./public` step will fail; this project includes an empty `public` placeholder to avoid that error.

## Business Value of Containerization for Educational Technology
- Environment parity: Containers package the OS, runtime, and app together so the same image runs locally, in CI, and in production. This eliminates "it works on my machine" problems that disrupt students and teachers.
- Safer updates: Image-based deployments and immutable artifacts make rollbacks straightforward and reduce the risk of cascading failures when releasing updates.
- Faster detection: Containers integrate well with CI/CD pipelines; automated builds and tests can run on every PR, surfacing regressions before they reach Associates.
- Predictable scaling: Container images can be deployed across orchestrators (Docker Compose, Kubernetes) for predictable performance under load, important for classroom spikes.

For a student-facing app, even short downtime harms learning outcomes and trust—containerization significantly reduces that risk.

## Tech Stack
- Next.js (frontend + server)  
- Node.js (runtime)  
- Docker (container builds and runtime)  
- Prisma (DB layer)  
- npm (package management)  
- (Optional) Docker Compose or CI (GitHub Actions) for multi-service orchestration and automated tests

## Running Locally (development)
To run in development without Docker:

```bash
# Install dependencies
npm install
# Start development server
npm run dev
```

## Contributing
- Open issues or PRs for bugs and features.
- Keep changes small and add tests where applicable.

## Business Context (BrightPath)
BrightPath Tutoring helps Associates complete homework and improve skills. The business problems addressed by this project include inconsistent behavior across machines, updates that break functionality, and slow detection of failures. By standardizing builds and deployments with Docker and CI, this project helps ensure Associates can access lessons reliably, teachers can track progress, and the company maintains trust and revenue.

