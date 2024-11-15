#!/bin/bash

# Function to check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script as root or with sudo."
    exit 1
fi

# Ensure yt-dlp is installed
if ! command_exists yt-dlp; then
    echo "yt-dlp not found. Installing yt-dlp..."
    # Download yt-dlp to /usr/local/bin
    curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    if [ $? -ne 0 ]; then
        echo "Failed to download yt-dlp. Exiting."
        exit 1
    fi
    chmod +x /usr/local/bin/yt-dlp
    echo "yt-dlp installed successfully."
else
    echo "yt-dlp is already installed. Checking for updates..."
    curl -sL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp.new
    if [ $? -eq 0 ] && ! cmp -s /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp.new; then
        mv /usr/local/bin/yt-dlp.new /usr/local/bin/yt-dlp
        chmod +x /usr/local/bin/yt-dlp
        echo "yt-dlp updated successfully."
    else
        echo "yt-dlp is up-to-date."
        rm -f /usr/local/bin/yt-dlp.new
    fi
fi

# Ensure Deno is installed
if ! command_exists deno; then
    echo "Deno not found. Installing Deno..."
    curl -fsSL https://deno.land/install.sh | sh
    if [ $? -ne 0 ]; then
        echo "Failed to install Deno. Exiting."
        exit 1
    fi
    echo "Deno installed successfully. Ensure your PATH includes ~/.deno/bin."
    export PATH="$HOME/.deno/bin:$PATH"
else
    echo "Deno is already installed."
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

# Start the Deno script with necessary permissions
echo "Starting the Deno script..."
deno run --allow-all main.ts
if [ $? -ne 0 ]; then
    echo "Failed to start the Deno script. Exiting."
    exit 1
fi

echo "Script completed successfully."
