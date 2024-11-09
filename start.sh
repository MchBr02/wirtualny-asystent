#!/bin/bash

# Ensure yt-dlp is installed
if ! command -v yt-dlp &> /dev/null
then
    echo "yt-dlp not found. Installing yt-dlp..."
    # Install yt-dlp using the recommended installation method
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    chmod +x /usr/local/bin/yt-dlp
    echo "yt-dlp installed."
else
    echo "yt-dlp is already installed."
fi

# Install Deno dependencies (optional if dependencies are specified in a deno.json file)
if [ -f "deno.json" ]; then
    echo "Installing Deno dependencies..."
    deno cache main.ts
fi

# Start the Deno script with necessary permissions
echo "Starting the Deno script..."
deno run --allow-all main.ts
