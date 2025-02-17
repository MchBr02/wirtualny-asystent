// server.ts

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { Database } from "https://deno.land/x/mongo@v0.31.2/mod.ts";

export function startServer(db: Database) {
  const messagesCollection = db.collection("messages");

  async function fetchMessages() {
    return await messagesCollection.find({}, { sort: { timestamp: -1 }, limit: 100 }).toArray();
  }

  async function handler(_req: Request): Promise<Response> {
    const messages = await fetchMessages();

    // Generate HTML with messages
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Last 100 Messages</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
        th { background-color: #f4f4f4; }
      </style>
    </head>
    <body>
      <h2>Last 100 Messages</h2>
      <table>
        <thead>
          <tr>
            <th>Message ID</th>
            <th>Timestamp</th>
            <th>Content</th>
            <th>Sender</th>
            <th>Receiver</th>
            <th>Platform</th>
          </tr>
        </thead>
        <tbody>
          ${messages.map(msg => `
            <tr>
              <td>${msg.message_id}</td>
              <td>${new Date(msg.timestamp).toLocaleString()}</td>
              <td>${msg.content}</td>
              <td>${msg.sender}</td>
              <td>${msg.receiver}</td>
              <td>${msg.platform}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </body>
    </html>
    `;

    return new Response(html, { headers: { "Content-Type": "text/html" } });
  }

  serve(handler, { port: 8080 });
  console.log("Web server running at http://localhost/");
}
