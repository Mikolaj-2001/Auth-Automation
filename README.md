# Auth-automation

A web application for user registration and login, plus management of authorization data. Built with [NestJS](https://nestjs.com) (TypeScript), MongoDB, JWT authentication stored in a cookie, and Handlebars (`hbs`) views.

## Features

- User registration (`/user/register`), login (`/user/login`) and logout (`POST /user/logout`)
- JWT stored in the `jwt` cookie and verified by `AuthConfigMiddleware`
- Login attempt limit configured as 5 attempts per 20 minutes (`express-rate-limit`, see [src/main.ts](src/main.ts))
- Abuse detection (`LeakServiceGuard`) that records suspicious requests by IP and fingerprint
- Authorization record management under `/auth/user/*` (login required)
- Application-level encryption of data (`crypto-js`)

## Requirements

- Node.js 22+ and npm
- A running MongoDB instance (local or e.g. MongoDB Atlas)
- Docker (optional)

## Configuration

Create a `.env` file in the project directory (`auth-automation/`):

```env
# MongoDB connection string (default: mongodb://localhost:27017/auth-automation)
MONGODB_URI=mongodb://localhost:27017/auth-automation

# Secret used to sign JWTs - use a long, random string
JWT_AUTH_TOKEN=replace-with-a-long-random-secret

# Token lifetime, e.g. 15m, 1h, 7d
JWT_AUTH_TOKEN_EXPIRES_IN=1h

# HTTP port (default: 9800)
PORT=9800
```

Notes:

- The app reads the port from `PORT` (not `APP_PORT`). Without it, it listens on `9800`.
- Never commit `.env` - it contains secrets (it is listed in `.gitignore` and `.dockerignore`).
- `prisma/schema.prisma` (MongoDB) mirrors the same models and needs `DATABASE_URL`, but at runtime the app uses Mongoose, not Prisma. `DATABASE_URL` is only needed if you use [src/prismaDataManagement.ts](src/prismaDataManagement.ts) on its own.

## Running locally

```bash
npm install
npx prisma generate      # generates the Prisma client (required for compilation)

# development with auto-reload
npm run start:dev

# or production mode
npm run build
npm run start:prod
```

Once started, the app is available at `http://localhost:9800` (or the port set in `PORT`). The console prints `App has started successfully on port ...`.

Useful URLs:

| URL | Description |
|-----|-------------|
| `GET /user/register` | Registration form |
| `GET /user/login` | Login form |
| `GET /auth/user/user` | Authorization data panel (after login) |

## Running with Docker

Run the commands from the `auth-automation/` directory (where the `Dockerfile` is):

```bash
docker build -t auth-automation .

docker run --rm -p 3000:3000 --env-file .env \
  -e PORT=3000 \
  auth-automation
```

Important:

- The image does not contain `.env` - pass variables with `--env-file` or `-e`.
- The container runs with `NODE_ENV=production` and `PORT=3000` by default.
- In production mode the token cookie has the `secure` flag, so the browser only stores it over HTTPS. To test over plain HTTP, run the container with `-e NODE_ENV=development`, or put a TLS-terminating reverse proxy in front of it.
- If MongoDB runs on your host machine, use `host.docker.internal` instead of `localhost` in `MONGODB_URI`.

## Tests and linting

```bash
npm run test        # unit tests
npm run test:e2e    # e2e tests
npm run test:cov    # coverage
npm run lint        # oxlint
```

## Project structure

```
auth-automation/
├── prisma/                      Prisma schema (MongoDB)
├── public/                      static files (styles.css)
├── src/
│   ├── main.ts                  app bootstrap, hbs views, rate limit
│   ├── app.module.ts            root module, MongoDB connection
│   ├── user-controller/         registration, login, logout
│   ├── authentication/          controller, service and JWT guard
│   ├── auth-config-middelware/  token verification from the cookie
│   ├── authLeakDetection/       abuse detection
│   ├── *-schema/, *Dto/         Mongoose schemas and validated DTOs
│   └── views/                   Handlebars templates (copied to dist/views)
├── test/                        e2e tests
└── Dockerfile
```

## Troubleshooting

- **Database connection error** - check `MONGODB_URI` and that MongoDB is running.
- **Token errors / 401** - make sure `JWT_AUTH_TOKEN` is set and has not changed since the token was issued.
- **`Cannot find module '.prisma/client'`** - run `npx prisma generate`.
- **Still asked to log in after logging in under Docker** - the `secure` cookie does not work over HTTP (see the Docker section).
- **`Osiągnięto maksymalną ilość prób`** (maximum number of attempts reached) - login attempt limit (5 per 20 minutes); wait or restart the app.

## License

UNLICENSED (private project).
