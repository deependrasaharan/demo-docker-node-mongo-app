# Docker Node Mongo Demo App

A simple user profile application built with Node.js, Express, and MongoDB, containerized with Docker.

> **Note:** This README documents the steps followed on an **Arch Linux** setup. Commands for installing tools (AWS CLI, Docker, etc.) may differ on your distro or OS — the general flow and Docker/git commands remain the same regardless of platform.

---

## Tech Stack

- Node.js + Express
- MongoDB
- Mongo Express (MongoDB web UI)
- Docker + Docker Compose
- Amazon ECR (private image registry)

---

## Attribution

This project was forked from:
https://gitlab.com/nanuchi/techworld-js-docker-demo-app

After forking, significant changes were made including runtime compatibility updates and request handling improvements to align with the latest Node.js and MongoDB driver requirements.

---

## Project Structure

```
docker-node-mongo-project/
├── app/
│   ├── images/
│   ├── index.html
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── Dockerfile
├── docker-compose.yaml
├── .env                  ← created locally, never committed
├── .env.example          ← committed, no real values
└── .gitignore
```

---

## Environment Variables Setup

Sensitive values are stored in a `.env` file that is **never committed to git**. A template is provided in `.env.example`.

```bash
# Copy the template and fill in your values
cp .env.example .env
nano .env
```

`.env.example`:
```env
AWS_ACCOUNT_ID=your_aws_account_id_here
AWS_REGION=your_aws_region_here
```

> **Note on MongoDB credentials:** Since this is a demo project, MongoDB credentials (`admin`/`password`) are written directly in `docker-compose.yaml` rather than the `.env` file. For a production setup, these should also be moved to `.env` or a secrets manager.

Docker Compose automatically reads `.env` from the project root and substitutes variables. In `docker-compose.yaml`, the ECR image is referenced as:

```yaml
image: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/my-app:1.2
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

---

# Method 1: Running with Docker Compose (Recommended)

Docker Compose manages all containers, networking, and volumes automatically. This is the preferred way to run the project.

---

## Option A: Using the ECR image (requires AWS setup)

Follow the [AWS ECR Setup](#aws-ecr-setup) section first to configure credentials, then run:

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Start all services
docker-compose -f docker-compose.yaml up
```

---

## Option B: Running locally without a private registry

If you don't have AWS access or want to run without ECR, build the image locally first and update the Compose file to use it:

**1. Build the image locally:**
```bash
docker build -t my-app:1.0 .
```

**2. Edit `docker-compose.yaml` — change the `my-app` image line to:**
```yaml
my-app:
  build: .          # builds from local Dockerfile if image not found
  image: my-app:1.0
```

**3. Start all services:**
```bash
docker-compose -f docker-compose.yaml up --build
```

This approach requires no AWS account or ECR registry.

---

## Starting and Stopping

```bash
# Start all containers in detached mode
docker-compose -f docker-compose.yaml up -d

# Start and force rebuild the app image
docker-compose -f docker-compose.yaml up --build

# Stop all containers (data is preserved in volumes)
docker-compose -f docker-compose.yaml down

# Stop all containers AND delete volumes (data is lost)
docker-compose -f docker-compose.yaml down -v
```

## Accessing the Services

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Mongo Express UI | http://localhost:8081 |

Mongo Express default login: `admin` / `pass`

---

## Data Persistence with Docker Compose

The Compose file declares a named volume `mongo-data` that mounts to MongoDB's data directory:

```yaml
services:
  mongo:
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

**What this means:**
- `docker-compose down` → containers removed, **volume survives**, data intact on next `up`
- `docker-compose down -v` → containers **and** volume removed, data gone
- Named volumes are managed by Docker at `/var/lib/docker/volumes/` (or wherever your Docker data-root is configured)

The volume is only deleted if you explicitly pass `-v` or run `docker volume rm`.

---

---

# Method 2: Running with Individual Docker Commands

This is the manual approach — useful for understanding what Compose abstracts away.

---

## Step 1: Create a Docker network

Containers need to be on the same network to communicate by name:

```bash
docker network create mongo-network
```

Verify it was created:
```bash
docker network ls
```

---

## Step 2: Start MongoDB

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

---

## Step 3: Start Mongo Express

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

> If you named your MongoDB container something other than `mongodb`, update `ME_CONFIG_MONGODB_SERVER` to match.

---

## Step 4: Build the app image

```bash
docker build -t my-app:1.0 .
```

---

## Step 5: Run the app container

```bash
docker run -d \
  -p 3000:3000 \
  --name my-app \
  --network mongo-network \
  -e MONGO_URL=mongodb://admin:password@mongodb:27017/?authSource=admin \
  my-app:1.0
```

> The `--network mongo-network` flag is what allows `my-app` to resolve `mongodb` as a hostname via Docker's internal DNS. Without it, the app cannot reach MongoDB regardless of port mappings.

---

## Step 6: Verify containers are running

```bash
docker ps
```

---

## Step 7: Access the services

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Mongo Express UI | http://localhost:8081 |

---

## Stopping and Cleaning Up

```bash
# Stop containers
docker stop my-app mongo-express mongodb

# Remove containers
docker rm my-app mongo-express mongodb

# Remove the network
docker network rm mongo-network

# List volumes
docker volume ls

# Remove a specific volume
docker volume rm <volume-name>

# Remove a container along with its volumes
docker rm -v mongodb
```

---

## Inspecting Mounts

```bash
docker inspect mongodb --format '{{range .Mounts}}{{.Type}}|{{.Name}}|{{.Source}}|{{.Destination}}{{println}}{{end}}'
```

---

---

# AWS ECR Setup

Amazon ECR is AWS's private Docker image registry. This section covers setting up the AWS CLI using browser-based login (no permanent keys stored on disk), creating a scoped IAM user, and pushing/pulling images.

> **Why not permanent access keys?**
> ```
> Root account        → unlimited power, never use for CLI
> IAM access keys     → permanent keys, dangerous if leaked to git
> aws login           → temporary tokens, auto-expire, browser-based ✓
> ```
> `aws login` is the correct modern approach. It issues short-lived tokens (15 min, auto-refreshed up to 12 hours). Nothing permanent sits on disk.

---

## 1. Install AWS CLI v2

**On Arch Linux:**
```bash
sudo pacman -S aws-cli-v2
```

Verify the version — `aws login` requires **2.32.0 or higher**:
```bash
aws --version
# aws-cli/2.x.x Python/3.x.x Linux/x86_64
```

---

## 2. Create a Scoped IAM User in AWS Console

Never use your root account for CLI operations. Create a dedicated IAM user with only the permissions you actually need.

**2a. Go to IAM**

AWS Console → search "IAM" → **Users** → **Create user**

**2b. Create the user**

- **User name:** something that identifies you and signals CLI-only use (e.g. `your-name-cli`)
- **Provide user access to AWS Management Console:** leave **unchecked** — this user is CLI-only

**2c. Attach permissions directly**

Choose **"Attach policies directly"** and attach:

| Policy | What it allows |
|---|---|
| `AmazonEC2ContainerRegistryFullAccess` | Push/pull ECR images |
| `SignInLocalDevelopmentAccess` | Required for `aws login` to work |

Add more policies later as you use more AWS services.

**2d. Finish**

Click through and create the user. **Do not create access keys** — you won't need them with `aws login`.

---

## 3. Configure AWS CLI Region

Tell the CLI your region and output format (leave keys blank — `aws login` handles auth):

```bash
aws configure
```

```
AWS Access Key ID [None]:        (press Enter — leave blank)
AWS Secret Access Key [None]:    (press Enter — leave blank)
Default region name [None]:      ap-south-1
Default output format [None]:    json
```

This writes only to `~/.aws/config` — no credentials file is created.

---

## 4. Authenticate with `aws login`

```bash
aws login
```

What happens:
1. CLI opens your browser automatically
2. AWS login page appears
3. Log in with your IAM user username + password
4. Browser confirms authentication
5. CLI receives temporary credentials (valid up to 12 hours)
6. Credentials cached at `~/.aws/login/cache/` (auto-managed)

The CLI auto-refreshes the token every 15 minutes in the background. After 12 hours, run `aws login` again.

**Verify it worked:**
```bash
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDA...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-name-cli"
}
```

If you see your account ID and user ARN — you're authenticated.

---

## 5. Fix the Docker Unencrypted Credentials Warning

After `docker login`, Docker shows:
```
WARNING! Your credentials are stored unencrypted in '/home/user/.docker/config.json'.
```

Docker stores registry credentials as base64 in `~/.docker/config.json` — which is essentially plaintext. Fix this by using a credential helper that stores them in your system keystore (gnome-keyring).

**5a. Install the credential helper**

Use the prebuilt binary (the source version has build failures on Arch):
```bash
yay -S docker-credential-secretservice-bin
```

Verify it's in PATH:
```bash
which docker-credential-secretservice
```

**5b. Edit `~/.docker/config.json`**

Replace the entire contents with:
```json
{
  "credsStore": "secretservice"
}
```

Remove any existing `auths` block with base64 credentials.

**5c. Re-login to ECR** (see next step) — credentials will now be stored securely in gnome-keyring.

**5d. Verify**
```bash
cat ~/.docker/config.json
```

Should look like:
```json
{
  "auths": {
    "<account-id>.dkr.ecr.<region>.amazonaws.com": {}
  },
  "credsStore": "secretservice"
}
```

The empty `{}` means credentials exist but are stored in the keystore — not in this file. Warning gone.

---

## 6. Create an ECR Repository

In the AWS Console:
1. Go to **ECR → Repositories → Create repository**
2. Set visibility to **Private**
3. Name it `my-app`
4. Create

Or via CLI:
```bash
aws ecr create-repository --repository-name my-app --region $AWS_REGION
```

---

## 7. Authenticate Docker to ECR

ECR uses temporary tokens (valid 12 hours). The AWS CLI fetches a token and pipes it directly into `docker login`:

```bash
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

**What this does step by step:**
1. `aws ecr get-login-password` — uses your `aws login` token to call AWS's `GetAuthorizationToken` API and returns a Docker password
2. `|` — pipes it directly into `docker login` (never touches shell history)
3. `docker login --username AWS --password-stdin` — logs Docker into ECR; username is always literally `AWS`

The ECR token is valid for **12 hours**. After expiry, re-run this command.

---

## 8. Build, Tag, and Push an Image

```bash
# Build the image
docker build -t my-app .

# Tag with the full ECR path
# Docker uses the image name as the push destination
docker tag my-app:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/my-app:latest

# Push to ECR
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/my-app:latest
```

**Why tagging is needed:** If the image name doesn't start with a registry URL, Docker assumes Docker Hub. Tagging with the ECR URL tells Docker where to push — no data is duplicated, it's just an alias.

---

## 9. Pull an Image from ECR

```bash
# Authenticate first if token has expired
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Pull
docker pull $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/my-app:latest
```

---

## 10. List Images in your ECR Repository

```bash
aws ecr list-images --repository-name my-app --region $AWS_REGION
```

---

---

# Difficulties Faced

## 1. MongoDB driver compatibility

The original code used callback-style MongoDB operations that are no longer valid in the latest `mongodb` Node.js driver (v4+). This caused requests to hang or fail silently, resulting in a blank page in the browser. All MongoDB operations were updated to use the current async/await driver API.

---

## 2. MongoDB crash on modern Ryzen hardware (CET Shadow Stack)

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

## 3. Accidentally committed AWS account ID to git history

While testing the ECR push workflow, the AWS account ID was hardcoded directly in `docker-compose.yaml` and committed to the repository. Even after fixing the file with environment variables, the account ID remained visible in the git commit history.

**Why this matters:** An AWS account ID isn't a credential, but it can be used to craft targeted attacks, enumerate public resources, and combined with other leaked info for social engineering. AWS recommends treating it as sensitive.

**What was done to fix it:**

**Step 1 — Fix the live file first**

Replaced the hardcoded account ID with env variable references in `docker-compose.yaml`, committed and pushed that change:
```bash
git commit -m "fix: move AWS account ID to .env file"
git push
```

**Step 2 — Install git-filter-repo**

```bash
sudo pacman -S git-filter-repo
```

**Step 3 — Create a fresh clone**

`git-filter-repo` requires a fresh clone for safety — this acts as the backup. The `--no-local` flag ensures a true copy rather than hardlinks:

```bash
cd ..
git clone --no-local docker-node-mongo-project docker-node-mongo-project-clean
cd docker-node-mongo-project-clean
```

**Step 4 — Scrub the account ID from all history**

```bash
git filter-repo --replace-text <(echo 'YOUR_ACCOUNT_ID==>AWS_ACCOUNT_ID')
```

This rewrites every commit in history, replacing the account ID with a placeholder string.

**Step 5 — Verify it's gone**

```bash
git log --all -p | grep "YOUR_ACCOUNT_ID"
# returned nothing
```

**Step 6 — Re-add remote and force push**

`git-filter-repo` removes the remote after rewriting as a safety measure. Re-add it and force push:

```bash
git remote add origin https://github.com/yourusername/your-repo.git
git push origin --force --all
git push origin --force --tags
```

**Step 7 — Clean up**

```bash
cd ..
rm -rf docker-node-mongo-project-clean
```

**Lesson learned:** Always use `.env` files for anything that looks like an identifier or credential. Add `.env` to `.gitignore` before writing the first line of configuration. A `.env.example` with placeholder values should be committed instead so others know what variables are needed.

---

## 4. Docker data filling root partition

Docker stores images, containers, and volumes under `/var/lib/docker/` by default, which sits on the root partition. With 8+ images and 26 volumes accumulated during development, this started consuming significant space on the root partition.

**Fix:** Moved Docker's data root to the `/home` partition (which had 748G available) by editing `/etc/docker/daemon.json`:

```json
{
  "features": {"buildkit": true},
  "data-root": "/home/username/docker-data"
}
```

Then migrated existing data and restarted Docker:

```bash
sudo systemctl stop docker docker.socket
sudo mv /var/lib/docker /home/username/docker-data
sudo systemctl start docker

# Verify
docker info | grep "Docker Root Dir"
```