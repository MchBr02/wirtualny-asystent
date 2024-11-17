#!/bin/bash

# Function to check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "Warning: Running as root. Ensuring normal user access for Deno installation."
    NORMAL_USER=$(logname)
    HOME_DIR=$(eval echo "~$NORMAL_USER")
else
    echo "Running as normal user: $(whoami)"
    HOME_DIR="$HOME"
    NORMAL_USER=$(logname)
fi

# Ensure yt-dlp is installed
if ! command_exists yt-dlp; then
    echo "yt-dlp not found. Installing yt-dlp..."
    sudo curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    if [ $? -ne 0 ]; then
        echo "Failed to download yt-dlp. Exiting."
        exit 1
    fi
    sudo chmod +x /usr/local/bin/yt-dlp
    echo "yt-dlp installed successfully."
else
    echo "yt-dlp is already installed. Checking for updates..."
    sudo curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp.new
    if [ $? -eq 0 ] && ! cmp -s /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp.new; then
        sudo mv /usr/local/bin/yt-dlp.new /usr/local/bin/yt-dlp
        sudo chmod +x /usr/local/bin/yt-dlp
        echo "yt-dlp updated successfully."
    else
        echo "yt-dlp is up-to-date."
        sudo rm -f /usr/local/bin/yt-dlp.new
    fi
fi

# Ensure Deno is installed
if ! command_exists deno; then
    echo "Deno not found. Installing Deno..."
    sudo -u $NORMAL_USER curl -fsSL https://deno.land/install.sh | sudo -u $NORMAL_USER bash
    if [ $? -ne 0 ]; then
        echo "Failed to install Deno. Exiting."
        exit 1
    fi
    echo "Deno installed successfully."
else
    echo "Deno is already installed."
fi

# Ensure Deno is in the PATH
if ! grep -q 'export PATH="$HOME/.deno/bin:$PATH"' "$HOME_DIR/.bashrc"; then
    echo 'export PATH="$HOME/.deno/bin:$PATH"' | sudo -u "$NORMAL_USER" tee -a "$HOME_DIR/.bashrc"
    echo "Added Deno to PATH in $HOME_DIR/.bashrc."
fi

# Reload PATH in the current session
if ! echo "$PATH" | grep -q "$HOME_DIR/.deno/bin"; then
    echo "Reloading .bashrc to update PATH..."
    source "$HOME_DIR/.bashrc"
fi

# Verify Deno PATH
if ! command_exists deno; then
    echo "Deno command still not found in PATH. Please restart your terminal and try again."
    exit 1
fi

# Install Deno dependencies if deno.json exists
if [ -f "deno.json" ]; then
    echo "Installing Deno dependencies..."
    deno cache main.ts
    if [ $? -ne 0 ]; then
        echo "Failed to install Deno dependencies. Exiting."
        exit 1
    fi
else
    echo "deno.json not found. Skipping Deno dependencies installation."
fi

# Check if .env file exists
if [ -f ".env" ]; then
    echo ".env file found. Checking for DISCORD_TOKEN..."
    if grep -q "DISCORD_TOKEN=" .env && [ -n "$(grep 'DISCORD_TOKEN=' .env | cut -d '=' -f2)" ]; then
        echo "DISCORD_TOKEN is set."
    else
        echo "DISCORD_TOKEN is missing or empty in .env. Exiting."
        exit 1
    fi
else
    echo ".env file not found. Exiting."
    exit 1
fi

# Start the Deno script with necessary permissions
echo "Starting the Deno script..."
deno run --allow-all main.ts
if [ $? -ne 0 ]; then
    echo "Failed to start the Deno script. Exiting."
    exit 1
fi

echo "Script completed successfully."
