# Docker Node Mongo Demo App

## Project Overview
This is a simple profile application built with Node.js, Express, MongoDB, and Mongo Express.

The app serves a web page at http://localhost:3000 and allows profile data to be read and updated in MongoDB.

## Attribution and Project History
This project was forked from:
https://gitlab.com/nanuchi/techworld-js-docker-demo-app

After forking, I changed a lot of things and implemented it according to latest requirements, including runtime compatibility updates and request handling improvements.

## Tech Stack
- Node.js
- Express
- MongoDB
- Mongo Express
- Docker

## Docker Setup Used
I used MongoDB and Mongo Express containers and ran them with the following steps.

1. Create Docker network:

   docker network create mongo-network

2. Verify the network is created:

   docker network ls

3. Start MongoDB container:

   docker run -d -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password --name mongodb --net mongo-network --env GLIBC_TUNABLES="glibc.cpu.hwcaps=-SHSTK" mongo

4. Start Mongo Express container:

   docker run -d --network mongo-network -e ME_CONFIG_MONGODB_SERVER=mongo -p 8081:8081 -e ME_CONFIG_MONGODB_ADMINUSERNAME=admin  -e ME_CONFIG_MONGODB_ADMINPASSWORD=password --name mongo-express mongo-express

5. Verify containers are created and running:

   docker ps

6. Open Mongo Express UI:

   http://localhost:8081

## Local App Run
1. Install dependencies:
   npm install
2. Start the app:
   npm start
3. Open:
   http://localhost:3000

## Difficulties Faced
### 1) Node.js and MongoDB driver compatibility issue
The earlier code used callback-style MongoDB operations that are no longer valid in the latest mongodb Node driver versions.

This caused request failures or hanging behavior on profile endpoints, which led to a blank page in the browser.

### 2) MongoDB crash on modern Ryzen hardware (CET Shadow Stack)
I had to use a special environment variable because of a CET Shadow Stack issue.

What is actually happening:
- The crash is caused by a hardware-enforced Control-flow Enforcement Technology (CET) trap, specifically AMD Shadow Stacks (user_shstk).
- The host CPU supports user_shstk.
- The container userland (Ubuntu 24.04) has a glibc that enables Shadow Stacks by default when the hardware supports it.
- Around the 30-second mark, MongoDB starts background threads, and C++ coroutine context switching can trigger a Shadow Stack hardware fault.
- Ryzen 7840HS (Zen 4) is in the affected hardware class.
- This issue was introduced in mongod 8.0.5.

Workaround used:
- GLIBC_TUNABLES="glibc.cpu.hwcaps=-SHSTK"

Reference:
https://www.findbugzero.com/operational-defect-database/vendors/mongodb/defects/3392546

## Application Endpoints
- GET / : Serves the profile page
- GET /get-profile : Returns the current user profile JSON
- POST /update-profile : Updates and upserts user profile JSON
- GET /profile-picture : Serves the profile image

## Why Data Persists After Restart
MongoDB data persists in this setup because Docker volumes are mounted to Mongo data directories.

- Stopping and starting containers does not remove container filesystems or volumes.
- The Mongo image uses data directories that are backed by Docker volumes.
- Even without an explicit -v flag, Docker can create anonymous volumes for image-declared volume paths.

Useful checks:

docker inspect mongo --format '{{range .Mounts}}{{.Type}}|{{.Name}}|{{.Source}}|{{.Destination}}{{println}}{{end}}'

docker volume ls

Data is removed only if you remove the container with attached volumes, or delete those volumes explicitly.

Example:

docker rm -v mongo

or

docker volume rm <volume-name>

## Notes
If you use a different MongoDB container name than the server value configured for Mongo Express, update the ME_CONFIG_MONGODB_SERVER value to match your MongoDB container name on the same Docker network.
