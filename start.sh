#!/bin/bash

LOG_FILE="start.log"

# Function to log messages to console and log file
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}
log "=====Start====="

# Function to check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
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

# Start the application
log "Starting the application..."
deno run --allow-all main.ts
if [ $? -ne 0 ]; then
    log "Failed to start the application. Exiting."
    exit 1
fi

log "Application started successfully."
