# Use the official Deno image
FROM denoland/deno:alpine

# Set working directory inside the container
WORKDIR /app

# Copy everything
COPY . .

# Cache dependencies
RUN deno cache main.ts

# Run the app (you can adjust this to "task run-all" if you're using deno.json)
CMD ["run", "--allow-all", "main.ts"]
