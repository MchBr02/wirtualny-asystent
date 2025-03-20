// server.ts


import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { Database } from "https://deno.land/x/mongo@v0.34.0/mod.ts";

import { fetchMessages } from "./database.ts";
import { handleRegister, handleLogin, handleLogout, handlePostMessage, sessions } from "./handlers.ts";
import { logMessage } from "./logger.ts";

export function startServer(db: Database) {

  async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    logMessage(`url.pathname: ${url.pathname}`);
    logMessage(`req.method: ${req.method}`);
    
    if ( req.method === "POST" && url.pathname === "/login" ) {
        logMessage(`handleLogin`);
        return handleLogin(req, db);
    } else if (/* req.method === "POST" && */url.pathname === "/logout" ) {
        logMessage(`handleLogout`);
        return handleLogout(req);
    } else if ( req.method === "POST" && url.pathname === "/register" ) {
        logMessage(`handleRegister`);
        return handleRegister(req, db);
    } else if ( req.method === "POST" && url.pathname === "/messages" ) {
        logMessage(`handlePostMessage`);
        return handlePostMessage(req, db);
    }

    // Check if the user is logged in (via session token)
    const cookies = req.headers.get("cookie");
    const sessionToken = cookies?.match(/session=([^;]+)/)?.[1];

    if (sessionToken && sessions.has(sessionToken)) {
        logMessage(`sessionToken ✅: ${sessionToken}`);
        logMessage(`sessions.has(sessionToken) ✅: ${sessions.has(sessionToken)}`);

        const userId = sessions.get(sessionToken);
        logMessage(`sessions.get(sessionToken) ✅: ${sessions.get(sessionToken)}`);
        const usersCollection = db.collection("users");
        const user = await usersCollection.findOne({ user_id: userId });

        if (user) {
            logMessage(`✅ User authenticated: ${user.login}. Serving messages page.`);
            const messages = await fetchMessages(db);
            return new Response(renderMessagesPage(messages, user.login), { headers: { "Content-Type": "text/html" } });
        }
    }

    // If not logged in, show login/register page
    logMessage(`📢 Sending login/register page.`);
    return new Response(renderLoginPage(), { headers: { "Content-Type": "text/html" } });
  }

  const port = 8080;
  serve(handler, { port: port });
  console.log(`✅ Web server running at http://localhost:${port}`);
}

/**
 * Returns the login/register page
 */
function renderLoginPage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login / Register</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; padding: 20px; }
    form { display: flex; flex-direction: column; max-width: 300px; margin: auto; }
    input, button { margin-top: 10px; padding: 10px; }
  </style>
</head>
<body>
  <h2>Login</h2>
  <form action="/login" method="POST">
    <input type="text" name="login" placeholder="Username" required>
    <input type="password" name="password" placeholder="Password" required>
    <button type="submit">Login</button>
  </form>

  <h2>Register</h2>
  <form action="/register" method="POST">
    <input type="text" name="login" placeholder="Username" required>
    <input type="password" name="password" placeholder="Password" required>
    <button type="submit">Register</button>
  </form>
</body>
</html>
  `;
}

/**
 * Returns the "Last 100 Messages" page
 */
function renderMessagesPage(messages: any[], username: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${username}'s messages</title>
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
  <form action="/logout" method="POST">
    <button type="submit">Logout</button>
  </form>
</body>
</html>
  `;
}
