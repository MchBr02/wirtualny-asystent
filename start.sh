#!/bin/bash

## Variables
LOG_FILE="start.log"







## Functions

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
    if groups "$USER" | grep -q "\bdocker\b"; then
        log "User already has Docker permissions."
    else
        log "User $USER does not have Docker permissions. Adding to docker group..."
        sudo usermod -aG docker "$USER"

        if [ $? -eq 0 ]; then
            log "User added to docker group successfully."
            log "⚠️ Please log out and log back in (or restart your system) for changes to take effect."
            log "Logging out the user in 5 seconds..."
            sleep 5
            pkill -KILL -u "$USER"
        else
            log "❌ Failed to add user to the docker group. Check sudo permissions."
            exit 1
        fi
    fi
}

# Function to install Docker if not already installed
install_docker() {
    if command_exists docker; then
        log "Docker is already installed."
    else
        log "Docker not found. Installing..."
        
        sudo apt-get update && sudo apt-get install -y docker.io
        if [ $? -ne 0 ]; then
            log "Docker installation failed! Exiting."
            exit 1
        fi
        # Ensure Docker starts on boot
        sudo systemctl start docker
        sudo systemctl enable docker
        log "Docker installed successfully."
    fi

    # Ensure user is in the Docker group (Will kill user if not in group)
    ensure_docker_permissions
}

# Function to install and run MongoDB in Docker
install_mongodb() {
    # Check if MongoDB container is already running
    if docker ps --format '{{.Names}}' | grep -q "^mongodb$"; then
        log "MongoDB is already running inside Docker."
    else
        log "MongoDB not found. Installing via Docker..."
        install_docker
    fi

    # Ensure volume directory exists
    mkdir -p ~/mongodb_data

    # Remove old MongoDB container if it exists
    if docker ps -a --format '{{.Names}}' | grep -q "^mongodb$"; then
        log "Removing old MongoDB container..."
        docker stop mongodb && docker rm mongodb
    fi

    # Run MongoDB in Docker
    docker run -d \
        --name mongodb \
        -p 27017:27017 \
        -e MONGO_INITDB_ROOT_USERNAME=$MONGO_ADMIN_USER \
        -e MONGO_INITDB_ROOT_PASSWORD=$MONGO_ADMIN_PASS \
        -v ~/mongodb_data:/data/db \
        mongo:5.0

    if [ $? -ne 0 ]; then
        log "Failed to start MongoDB in Docker. Exiting."
        exit 1
    fi

    log "MongoDB installed and running in Docker."
}

# Function to create MongoDB database if it does not exist
create_mongodb_database() {
    local db_name="$MONGO_DB_NAME"

    if [[ -z "$db_name" ]]; then
        log "MONGO_DB_NAME is not set in the environment. Exiting."
        exit 1
    fi

    log "Checking if MongoDB database '$db_name' exists..."

    # Determine MongoDB access method (Docker or local)
    if docker ps | grep -q mongodb; then
        mongosh_cmd="docker exec -i mongodb mongosh --quiet --username \"$MONGO_ADMIN_USER\" --password \"$MONGO_ADMIN_PASS\" --authenticationDatabase \"admin\""
    else
        mongosh_cmd="mongosh --quiet --username \"$MONGO_ADMIN_USER\" --password \"$MONGO_ADMIN_PASS\" --authenticationDatabase \"admin\""
    fi

    # Check if the database exists
    local db_exists=$($mongosh_cmd --eval "db.getSiblingDB('$db_name').getCollectionNames()" | tail -n 1)

    if [[ -z "$db_exists" ]]; then
        log "Database '$db_name' does not exist. Creating..."
        
        $mongosh_cmd <<EOF
use $db_name
db.createCollection("initCollection")
EOF

        if [ $? -eq 0 ]; then
            log "Database '$db_name' created successfully."
        else
            log "Failed to create database '$db_name'. Exiting."
            exit 1
        fi
    else
        log "Database '$db_name' already exists."
    fi
}

# Function to check if MongoDB admin user exists and validate credentials
check_mongodb_admin() {
    local username="$MONGO_ADMIN_USER"
    local password="$MONGO_ADMIN_PASS"
    local name="$MONGO_DB_NAME"

    if [[ -z "$username" || -z "$password" ]]; then
        log "MongoDB admin credentials not found in .env file."
        exit 1
    fi

    mongosh_cmd="docker exec -i mongodb mongosh --quiet --username \"$username\" --password \"$password\" --authenticationDatabase \"admin\""

    # Check if the database exists
    local db_exists=$($mongosh_cmd --eval "db.getSiblingDB('$name').getCollectionNames()" | tail -n 1)
    if [[ -z "$db_exists" ]]; then
        log "MongoDB database $name does not exist or is inaccessible."
        exit 1
    fi

    # Check if admin user exists
    local user_exists=$($mongosh_cmd --eval "db.getSiblingDB('admin').system.users.find({user: '$username'}).count()" | tail -n 1)
    
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

# Function to install yt-dlp
install_yt_dlp() {
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
}

install_deno() {
    if ! command_exists deno; then
        log "Installing Deno..."
        curl -fsSL https://deno.land/install.sh | bash
        log "✅ Deno installed successfully."

        # Ensure Deno is in PATH
        echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.bashrc
        echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.zshrc
        export PATH="$HOME/.deno/bin:$PATH"
    else
        log "✅ Deno is already installed."
    fi

    # Verify Deno
    if ! command_exists deno; then
        log "Deno command not found in PATH. Exiting."
        exit 1
    fi

    # Check for deno.json and install dependencies
    if [ -f "deno.json" ]; then
        log "Installing Deno dependencies..."
        deno cache main.ts || { log "Failed to install Deno dependencies. Exiting."; exit 1; }
        log "Deno dependencies installed :)"
    else
        log "No deno.json found. Skipping dependencies."
    fi
}

# Function to install Ollama
install_ollama() {
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
}






## Script


# Load environment variables from .env file
if [[ -f .env ]]; then
    export $(grep -v '^#' .env | xargs -d '\n')
else
    log "[ERROR] .env file not found!"
    exit 1
fi
# Checking DISCORD_TOKEN
if ! grep -q "DISCORD_TOKEN=" .env || [ -z "$(grep 'DISCORD_TOKEN=' .env | cut -d '=' -f2)" ]; then
    log "DISCORD_TOKEN is missing or empty in .env. Exiting."
    exit 1
fi
# Check MONGO_DB_NAME
if ! grep -q "MONGO_DB_NAME=" .env || [ -z "$(grep 'MONGO_DB_NAME=' .env | cut -d '=' -f2)" ]; then
    log "MONGO_DB_NAME is missing or empty in .env. Exiting."
    exit 1
fi

# Determine user and home directory
if [ "$EUID" -eq 0 ]; then
    log "Running as root. Switching to normal user for Deno installation."
    NORMAL_USER=$(logname 2>/dev/null || whoami)
    HOME_DIR=$(eval echo "~$NORMAL_USER")
else
    NORMAL_USER=$(whoami)
    HOME_DIR="$HOME"
fi

log "Current user is: $USER"





# Run functions
install_mongodb
install_yt_dlp
install_deno
install_ollama

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

create_mongodb_database
check_mongodb_admin

# Start the application
log "Starting the application..."
deno task run-all
if [ $? -ne 0 ]; then
    log "Failed to start the application. Exiting."
    exit 1
fi

log "Application started successfully."