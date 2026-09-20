# DevEx Workshop Lab: Containerized Development Environment

A reproducible, isolated development environment powered by [Canonical Workshop](https://github.com/canonical/workshop) and [LXD](https://ubuntu.com/lxd) containers. This lab demonstrates a multi-tier Node.js application (Frontend + Backend), host filesystem mounting, and secure SSH agent forwarding.

---

## Table of Contents

1. [Overview & Lab Architecture](#overview--lab-architecture)
2. [Why Canonical Workshop? (Developer Use Cases)](#why-canonical-workshop-developer-use-cases)
3. [Prerequisites & System Setup (Ubuntu > 24)](#prerequisites--system-setup-ubuntu--24)
   - [1. Install & Initialize LXD](#1-install--initialize-lxd)
   - [2. Install Canonical Workshop CLI](#2-install-canonical-workshop-cli)
   - [3. Configure Environment Variables](#3-configure-environment-variables)
4. [Configuration Breakdown](#configuration-breakdown)
5. [Host Commands Reference](#host-commands-reference)
   - [Workshop Lifecycle Management](#workshop-lifecycle-management)
   - [Interface Connections (Plugs & Slots)](#interface-connections-plugs--slots)
   - [Executing Commands & Running Actions](#executing-commands--running-actions)
6. [Running the Fullstack Application](#running-the-fullstack-application)
7. [Troubleshooting & Common Tips](#troubleshooting--common-tips)

---

## Overview & Lab Architecture

Canonical Workshop provides lightweight, reproducible, and secure development environments using unprivileged LXD system containers. This workspace defines:

- **Base OS**: Ubuntu 24.04 LTS (`ubuntu@24.04`).
- **SDKs**:
  - `node`: Node.js runtime for JavaScript development.
  - `project-ssh-share-sdk`: Local in-project SDK forwarding the host SSH agent to authenticate Git commands without leaking private keys.
- **Plugs & Interfaces**:
  - `my-data` (`mount` interface): Mounts a directory from the host into `/mnt/my-data` inside the container.
  - `ssh-agent` (`ssh-agent` interface): Forwards the host SSH authentication socket into the container.
- **Application Components**:
  - **Backend API** (`backend/server.js`): Node.js HTTP service listening on port `5000` (exposing `/api/data`).
  - **Frontend UI** (`frontend/server.js`): Node.js HTTP server serving an interactive dashboard on port `3000`.

---

## Why Canonical Workshop? (Developer Use Cases)

Canonical Workshop bridges the gap between single-process container engines (Docker/Podman) and full virtual machines by providing lightweight, unprivileged, systemd-enabled system containers specifically crafted for developer productivity.

### 1. Host-Clean Isolated Workspaces ("Works on My Machine" Solved)
- **Zero Host Pollution**: Keep programming language runtimes (Node.js, Python, Go, Rust), SDKs, compilers, and dependencies confined strictly within the container. Your host workstation remains clean without polluting `/usr/local` or `$HOME`.
- **Reproducible Onboarding**: Environments are codified declaratively in `.workshop/dev.yaml` and committed to your repository. New teammates or contributors run `workshop launch` to instantly receive an identical development workspace.

### 2. Conflict-Free Multi-Project Workflows
- **Parallel Language Runtimes**: Seamlessly work across multiple projects requiring conflicting runtime versions (e.g., Node 18 vs Node 22, Python 3.10 vs 3.12) without fragile version managers (`nvm`, `pyenv`, `asdf`) polluting global `$PATH` and environment variables.
- **Full Systemd & Daemon Support**: Unlike application containers designed to run single processes, Workshop containers run full systemd user spaces—allowing background daemons, system services, and process managers to run natively.

### 3. Secure Credential Sharing via Plugs & Slots
- **SSH Agent Forwarding**: Forward host SSH authentication sockets via the `ssh-agent` plug (`workshop connect dev/ssh-share-sdk:ssh-agent`). Developers can clone, fetch, and push to private Git repositories without copying sensitive private SSH keys into container filesystems or `.env` files.
- **Selective Host Mounts**: Bind-mount project code, caches, or persistent volumes into the workshop container using the `mount` interface (`workshop remount`) with granular access control.

### 4. Native Linux Performance with Minimal Overhead
- **Bare-Metal Speed**: Backed by LXD system containers directly on the host Linux kernel, Workshop eliminates hypervisor virtualization penalties (common with VirtualBox, Vagrant, or VM-based Docker engines).
- **Fast Startup & Low Resource Usage**: Containers start up in seconds, conserving CPU and memory resources for development workloads.

### 5. Safe Sandboxing & Prototyping (Sketch SDKs)
- **Interactive Experimentation**: Safely experiment with new tools, dependencies, or system configurations using `workshop sketch-sdk` without risking broken system states.
- **Disposability & Clean Resets**: Stash, restore, or completely tear down and recreate containers (`workshop remove` / `workshop launch`) at any time.

### 6. Workflow Automation & Action Execution
- **Codified Lifecycle Actions**: Define repeatable workflows directly in `.workshop/dev.yaml` (such as `actions.setup` in this lab) that run via `workshop run <action>` for automated setup and validation.
- **Seamless Host Control**: Execute commands inside the container from your host terminal (`workshop exec dev -- <cmd>`) or drop into an interactive session (`workshop shell dev`).

---

## Prerequisites & System Setup (Ubuntu > 24)

Workshop runs on Ubuntu 24.04 LTS (Noble Numbat) and newer releases (such as Ubuntu 24.10+). It requires **LXD 6.8 or newer**.

### 1. Install & Initialize LXD

LXD must be installed via snap from the `6/stable` track:

```bash
# 1. Install LXD snap
sudo snap install --channel=6/stable lxd

# 2. Add your host user to the 'lxd' group
sudo usermod -aG lxd $USER

# 3. Apply group membership to your current shell session (or log out and back in)
newgrp lxd

# 4. Initialize LXD with default parameters
lxd init --auto
```

> **Note**: Verify LXD is working properly without `sudo`:
> ```bash
> lxd --version
> lxc list
> ```

### 2. Install Canonical Workshop CLI

Install the `workshop` CLI using classic confinement:

```bash
# Install Workshop CLI
sudo snap install --classic workshop

# Verify installation
workshop --version
```

*(Optional)* Enable tab completion for Bash:
```bash
source <(workshop completion bash)
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Ensure your host SSH key is accessible if you plan to authenticate to GitHub or remote Git remotes from inside the container:
```bash
# Check existing SSH keys on the host
ls -la ~/.ssh/id_ed25519.pub ~/.ssh/id_rsa.pub
```

---

## Configuration Breakdown

The project contains the following workshop definitions in `.workshop/`:

```text
devex-workshop-lab/
├── .env.example
├── .workshop/
│   ├── dev.yaml                  # Main workshop definition
│   └── ssh-share-sdk/
│       └── sdk.yaml              # Local SDK definition for SSH agent forwarding
├── backend/
│   ├── package.json
│   └── server.js                 # API server (port 5000)
└── frontend/
    ├── package.json
    └── server.js                 # Frontend web UI (port 3000)
```

- **`.workshop/dev.yaml`**: Specifies container name (`dev`), base image (`ubuntu@24.04`), SDK dependencies (`node`, `project-ssh-share-sdk`), mounts, and automation scripts under `actions.setup`.
- **`.workshop/ssh-share-sdk/sdk.yaml`**: Declares the `ssh-agent` plug (under internal SDK name `ssh-share-sdk`) which allows the container to hook into the host's SSH authentication socket.

---

## Host Commands Reference

All workshop lifecycle and interaction commands are run from the **host system** within the project directory.

### Workshop Lifecycle Management

| Task | Command | Description |
| :--- | :--- | :--- |
| **Launch environment** | `workshop launch` | Creates, provisions, and starts the `dev` container. |
| **List workshops** | `workshop list` | Displays all workshops and their status (`Ready`, `Off`, etc.). |
| **Inspect details** | `workshop info dev` | Shows base OS, container IP, status, and plug details. |
| **Stop environment** | `workshop stop dev` | Halts the container while preserving container state. |
| **Resume environment** | `workshop start dev` | Restarts a stopped workshop. |
| **Apply config changes** | `workshop refresh` | Re-evaluates `.workshop/dev.yaml` and updates SDKs. |
| **Destroy environment** | `workshop remove dev` | Destroys the container (project files on host remain intact). |

### Interface Connections (Plugs & Slots)

Workshop restricts access to host devices and services using an interface model (similar to snapd). Some interfaces require manual connection for security.

#### 1. Inspect Current Connections
```bash
workshop connections dev
```

#### 2. Connect SSH Agent Forwarding
Forward your host's active SSH agent into the container:

```bash
# 1. Ensure ssh-agent is running on your host (start it if not active)
[ -z "$SSH_AUTH_SOCK" ] && eval $(ssh-agent -s)

# 2. Check loaded identities; add your private key if none are loaded
ssh-add -l || ssh-add ~/.ssh/id_ed25519 # or your private key

# 3. Connect the ssh-agent interface to the workshop
workshop connect dev/ssh-share-sdk:ssh-agent
```

> **Note**: While `.workshop/dev.yaml` declares the local SDK dependency as `project-ssh-share-sdk`, interface connections reference the SDK name declared in `.workshop/ssh-share-sdk/sdk.yaml` (`dev/ssh-share-sdk:<plug>`).

Verify that the connection is active:
```bash
workshop connections dev
```
*(The status will display `manual` under the connection column).*

#### 3. Manage Mount Interfaces
Bind a host directory to the `my-data` plug defined in `dev.yaml` (target: `/mnt/my-data`):

```bash
# Remount a host path into the workshop's /mnt/my-data target
workshop remount dev/node:my-data /absolute/path/to/host/directory

# Example using a sibling directory:
workshop remount dev/node:my-data $(pwd)/../mount
```

### Executing Commands & Running Actions

#### 1. Run Predefined Actions
Actions defined in the `actions:` section of `.workshop/dev.yaml` can be executed directly:

```bash
# Run the 'setup' action to configure SSH keys and test github.com connectivity
workshop run setup
```

#### 2. Open an Interactive Shell
Enter the container shell as the default unprivileged workshop user:

```bash
workshop shell dev
```

#### 3. Run Ad-Hoc Commands from the Host (`workshop exec`)
Run one-off commands inside the workshop without opening an interactive shell session:

```bash
# Check runtime versions inside the container
workshop exec dev -- node -v
workshop exec dev -- npm -v

# List files inside the mounted directory
workshop exec dev -- ls -la /mnt/my-data

# Test Git SSH authentication inside the container
workshop exec dev -- ssh -T git@github.com
```

---

## Running the Fullstack Application

You can start and interact with the backend API and frontend web UI from the host using `workshop exec` or inside `workshop shell`.

### 1. Start the Backend API (Port 5000)

Run the backend service inside the workshop:

```bash
workshop exec dev -- node backend/server.js
```

The API will listen on `http://0.0.0.0:5000`.

### 2. Start the Frontend UI (Port 3000)

In a separate terminal on the host, start the frontend server:

```bash
workshop exec dev -- node frontend/server.js
```

The frontend server will listen on `http://0.0.0.0:3000`.

### 3. Access the Application from Host

To connect from your host's web browser:

1. **Find the workshop container's IP address**:
   ```bash
   workshop info dev
   ```
   *Look for the network IP address (e.g., `10.x.x.x` allocated by `lxdbr0`).*

2. **Open the services**:
   - **Frontend UI**: Open `http://<CONTAINER_IP>:3000` in your host browser.
   - **Backend API**: Open `http://<CONTAINER_IP>:5000/api/data` or test with curl:
     ```bash
     curl http://<CONTAINER_IP>:5000/api/data
     ```
   - Click **"Fetch from Backend"** in the web UI to verify communication between services across the container network.

---

## Troubleshooting & Common Tips

### 1. `permission denied while attempting to connect to the LXD socket`
If running `workshop` or `lxc` commands returns permission errors:
- Ensure your host user is in the `lxd` group: `sudo usermod -aG lxd $USER`.
- Reload your current shell groups: `newgrp lxd` or restart your terminal session.

### 2. SSH Agent Forwarding is Not Working Inside the Container
- Ensure `ssh-agent` is actively running on your host: `[ -z "$SSH_AUTH_SOCK" ] && eval $(ssh-agent -s)`.
- Make sure your SSH identity is loaded into the agent: `ssh-add -l` (if no identities are loaded, add your key: `ssh-add ~/.ssh/id_ed25519`).
- Verify the interface connection on the host: `workshop connect dev/ssh-share-sdk:ssh-agent`.

### 3. Rebuilding / Resetting After Changes
If you modify `.workshop/dev.yaml` or SDK configuration:
- Use `workshop refresh` to update the existing workshop.
- If you want a fresh, clean container:
  ```bash
  workshop remove dev
  workshop launch
  ```

