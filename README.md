# Docker Node Mongo Demo App

A simple user profile application built with Node.js, Express, and MongoDB, containerized with Docker.

---

## Tech Stack

- Node.js + Express
- MongoDB
- Mongo Express
- Docker

---

## Attribution

This project was forked from:
https://gitlab.com/nanuchi/techworld-js-docker-demo-app

After forking, significant changes were made including runtime compatibility updates and request handling improvements to align with the latest Node.js and MongoDB driver requirements.

---

## Docker Setup

### 1. Create the Docker network

```bash
docker network create mongo-network
```

### 2. Verify the network was created

```bash
docker network ls
```

### 3. Start the MongoDB container

> **Note for AMD Ryzen Zen 4/5 users:** The `GLIBC_TUNABLES` flag is required to prevent a hardware-level CET Shadow Stack crash. See [Difficulties Faced](#difficulties-faced) for details.

```bash
docker run -d \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  --name mongodb \
  --net mongo-network \
  --env GLIBC_TUNABLES="glibc.cpu.hwcaps=-SHSTK" \
  mongo
```

### 4. Start the Mongo Express container

```bash
docker run -d \
  --network mongo-network \
  -e ME_CONFIG_MONGODB_SERVER=mongodb \
  -e ME_CONFIG_MONGODB_ADMINUSERNAME=admin \
  -e ME_CONFIG_MONGODB_ADMINPASSWORD=password \
  -p 8081:8081 \
  --name mongo-express \
  mongo-express
```

### 5. Verify containers are running

```bash
docker ps
```

### 6. Open Mongo Express UI

```
http://localhost:8081
```

---

## Running the App Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Start the server

```bash
npm start
```

### 3. Open in browser

```
http://localhost:3000
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serves the profile page |
| `GET` | `/get-profile` | Returns the current user profile as JSON |
| `POST` | `/update-profile` | Updates or upserts the user profile |
| `GET` | `/profile-picture` | Serves the profile image |

---

## Why Data Persists After Restart

MongoDB data persists across container restarts because Docker mounts volumes to the Mongo data directory.

- Stopping and starting containers does not remove container filesystems or volumes.
- Even without an explicit `-v` flag, Docker creates anonymous volumes for image-declared volume paths.
- Data is only lost if you explicitly remove the container with its volumes.

**Inspect mounts on a running container:**

```bash
docker inspect mongodb --format '{{range .Mounts}}{{.Type}}|{{.Name}}|{{.Source}}|{{.Destination}}{{println}}{{end}}'
```

**List all Docker volumes:**

```bash
docker volume ls
```

**Remove a container and its data:**

```bash
docker rm -v mongodb
```

**Remove a named volume explicitly:**

```bash
docker volume rm <volume-name>
```

---

## Difficulties Faced

### 1. MongoDB driver compatibility

The original code used callback-style MongoDB operations that are no longer valid in the latest `mongodb` Node.js driver (v4+). This caused requests to hang or fail silently, resulting in a blank page in the browser. All MongoDB operations were updated to use the current driver API.

### 2. MongoDB crash on modern Ryzen hardware (CET Shadow Stack)

MongoDB 8.0.5 and above crash with exit code `139` (SIGSEGV) on AMD Zen 4/5 CPUs approximately 30 seconds after startup.

**Root cause:**

- AMD Zen 4/5 CPUs support hardware-enforced Control-flow Enforcement Technology (CET), specifically Shadow Stacks (`user_shstk`).
- Ubuntu 24.04's glibc enables Shadow Stacks by default when the hardware supports it.
- MongoDB uses C++ coroutines that perform stack pivoting during context switches.
- The CPU interprets this as a Return-Oriented Programming (ROP) attack and raises a hardware SIGSEGV.
- Because the crash handler itself uses the stack, it double-faults and produces no stack trace — the process simply vanishes silently.
- This issue was introduced in `mongod 8.0.5`.

**Workaround:**

Pass the following environment variable when starting the MongoDB container to disable Shadow Stack enforcement in glibc:

```bash
--env GLIBC_TUNABLES="glibc.cpu.hwcaps=-SHSTK"
```

**Reference:** https://www.findbugzero.com/operational-defect-database/vendors/mongodb/defects/3392546

---

## Notes

- If you use a MongoDB container name other than `mongodb`, update the `ME_CONFIG_MONGODB_SERVER` value in the Mongo Express run command to match the container name on the same Docker network.
- The Mongo Express web UI uses its own Basic Auth credentials (default: `admin` / `pass`), which are separate from the MongoDB database credentials.
