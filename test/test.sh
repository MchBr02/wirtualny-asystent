#!/bin/bash

LOG_FILE="start.log"

# Function to log messages to console and log file
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}
log "===== Start ====="

# Check if the user is part of the docker group
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
    fi
fi