#!/bin/bash

LOG_FILE="start.log"

# Load environment variables from .env file
if [[ -f .env ]]; then
    export $(grep -v '^#' .env | xargs)
else
    echo ".env file not found!"
    exit 1
fi

# Function to log messages to console and log file
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}
log "=====Start====="

# Function to check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Function to check if user has Docker permissions
ensure_docker_permissions() {
    if groups | grep "docker"; then
        log "User already has Docker permissions."
    else
        log "User does not have Docker permissions. Adding to docker group..."
        sudo usermod -aG docker $USER
        log "User added to docker group. Restarting shell..."
        exec su -l $USER
    fi
}

# Function to install Docker if not already installed
install_docker() {
    if command_exists docker; then
        log "Docker is already installed."
        ensure_docker_permissions
    else
        log "Docker not found. Installing..."
        
        sudo apt-get update && sudo apt-get install -y docker.io
        if [ $? -ne 0 ]; then
            log "Docker installation failed! Exiting."
            exit 1
        fi

        log "Docker installed successfully."

        # Ensure Docker starts on boot
        sudo systemctl start docker
        sudo systemctl enable docker
        ensure_docker_permissions
    fi
}

# Function to check if MongoDB is installed and install if necessary
install_mongodb() {
    if command_exists mongod; then
        log "MongoDB is already installed."
        return
    fi

    # Check if MongoDB is running in Docker
    if docker ps | grep -q mongodb; then
        log "MongoDB is already running inside Docker."
        return
    fi

    log "MongoDB not found. Installing..."

    # Check for ARM architecture
    ARCH=$(uname -m)
    if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
        log "ARM architecture detected. Installing MongoDB via Docker..."

        install_docker

        # Check if an old MongoDB container exists and remove it
        if docker ps -a --format '{{.Names}}' | grep -q "^mongodb$"; then
            log "Old MongoDB container found. Removing..."
            docker stop mongodb
            docker rm mongodb
        fi

        # Run MongoDB in Docker
        docker run -d \
            --name mongodb \
            -p 27017:27017 \
            -e MONGO_INITDB_ROOT_USERNAME=$MONGO_ADMIN_USER \
            -e MONGO_INITDB_ROOT_PASSWORD=$MONGO_ADMIN_PASS \
            -v ~/mongodb_data:/data/db \
            arm64v8/mongo:5.0

        if [ $? -ne 0 ]; then
            log "Failed to start MongoDB in Docker. Exiting."
            exit 1
        fi

        log "MongoDB installed and running in Docker."
    else
        log "Installing MongoDB via APT..."
        
        sudo apt-get update && sudo apt-get install -y gnupg curl
        if [ $? -ne 0 ]; then
            log "Failed to install dependencies (gnupg, curl). Exiting."
            exit 1
        fi

        log "Importing MongoDB public GPG key..."
        curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
            sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor

        log "Adding MongoDB repository..."
        echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/8.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
        
        sudo apt-get update && sudo apt-get install -y mongodb-org
        if [ $? -ne 0 ]; then
            log "MongoDB installation failed! Exiting."
            exit 1
        fi

        # Start and enable MongoDB
        sudo systemctl start mongod
        sudo systemctl enable mongod

        log "MongoDB installed and running."
    fi
}

# Function to check if MongoDB admin user exists and validate credentials
check_mongodb_admin() {
    local username="$MONGO_ADMIN_USER"
    local password="$MONGO_ADMIN_PASS"

    if [[ -z "$username" || -z "$password" ]]; then
        log "MongoDB admin credentials not found in .env file."
        exit 1
    fi

    # Check if using Docker
    if docker ps | grep -q mongodb; then
        log "Using MongoDB in Docker."
        mongosh_cmd="docker exec -i mongodb mongosh --quiet --username \"$username\" --password \"$password\" --authenticationDatabase \"admin\""
    else
        mongosh_cmd="mongosh --quiet --username \"$username\" --password \"$password\" --authenticationDatabase \"admin\""
    fi

    # Check if admin user exists
    local user_exists
    user_exists=$($mongosh_cmd --eval "db.getSiblingDB('admin').system.users.find({user: '$username'}).count()" | tail -n 1)
    
    if [[ "$user_exists" -eq 1 ]]; then
        log "MongoDB admin user exists. Verifying password..."
        auth_result=$($mongosh_cmd --eval "db.runCommand({ connectionStatus: 1 })" --quiet)

        if [[ "$auth_result" == *"ok: 1"* ]]; then
            log "Admin credentials are correct."
        else
            log "Incorrect password for MongoDB admin user."
            exit 1
        fi
    else
        log "Creating MongoDB admin user..."
        $mongosh_cmd <<EOF
use admin
db.createUser({
    user: "$username",
    pwd: "$password",
    roles: [{ role: "root", db: "admin" }]
})
EOF
        log "MongoDB admin user created."
    fi
}

# Determine user and home directory
if [ "$EUID" -eq 0 ]; then
    log "Running as root. Switching to normal user for Deno installation."
    NORMAL_USER=$(logname 2>/dev/null || whoami)
    HOME_DIR=$(eval echo "~$NORMAL_USER")
else
    NORMAL_USER=$(whoami)
    HOME_DIR="$HOME"
fi

echo "Current user is: $USER"

# Ensure yt-dlp is installed
if ! command_exists yt-dlp; then
    log "Installing yt-dlp..."
    sudo curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    sudo chmod +x /usr/local/bin/yt-dlp
    log "yt-dlp installed successfully."
else
    log "Updating yt-dlp..."
    sudo curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp.new
    if ! cmp -s /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp.new; then
        sudo mv /usr/local/bin/yt-dlp.new /usr/local/bin/yt-dlp
        sudo chmod +x /usr/local/bin/yt-dlp
        log "yt-dlp updated successfully."
    else
        sudo rm -f /usr/local/bin/yt-dlp.new
        log "yt-dlp is up-to-date."
    fi
fi

echo "Current user is: $USER"

# Ensure Deno is installed
if ! command_exists deno; then
    log "Installing Deno..."
    sudo -u "$NORMAL_USER" bash -c "curl -fsSL https://deno.land/install.sh | bash"
    if [ $? -ne 0 ]; then
        log "Failed to install Deno. Exiting."
        exit 1
    fi
    log "Deno installed successfully."
else
    log "Deno is already installed."
fi

# Add Deno to PATH
export PATH="$HOME_DIR/.deno/bin:/usr/local/bin:$PATH"

# Verify Deno
if ! command_exists deno; then
    log "Deno command not found in PATH. Exiting."
    exit 1
fi

# Check for deno.json and install dependencies
if [ -f "deno.json" ]; then
    log "Installing Deno dependencies..."
    deno cache main.ts || { log "Failed to install Deno dependencies. Exiting."; exit 1; }
else
    log "No deno.json found. Skipping dependencies."
fi

# Ensure Ollama is installed
if ! command_exists ollama; then
    log "Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    if [ $? -ne 0 ]; then
        log "Failed to install Ollama. Exiting."
        exit 1
    fi
    log "Ollama installed successfully."
else
    log "Ollama is already installed."
fi

# Verify .env file
if [ ! -f ".env" ]; then
    log ".env file not found. Exiting."
    exit 1
fi
if ! grep -q "DISCORD_TOKEN=" .env || [ -z "$(grep 'DISCORD_TOKEN=' .env | cut -d '=' -f2)" ]; then
    log "DISCORD_TOKEN is missing or empty in .env. Exiting."
    exit 1
fi

# Run functions
install_mongodb

# Wait for MongoDB to be ready
log "Waiting for MongoDB to start..."
for i in {1..10}; do
    if docker exec mongodb mongosh --eval "db.runCommand({ ping: 1 })" &>/dev/null; then
        log "MongoDB is now ready!"
        break
    fi
    log "MongoDB not ready yet. Retrying in 2 seconds..."
    sleep 2
done

check_mongodb_admin

# Start the application
log "Starting the application..."
deno run --allow-all main.ts
if [ $? -ne 0 ]; then
    log "Failed to start the application. Exiting."
    exit 1
fi

log "Application started successfully."
