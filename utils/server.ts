// server.ts

import { Database } from "https://deno.land/x/mongo@v0.34.0/mod.ts";

import { fetchMessages, findUserByDiscordId } from "./database.ts";
import { handleRegister, handleLogin, handleLogout, handlePostMessage, sessions } from "./handlers.ts";
import { logMessage } from "./logger.ts";

import { renderLoginPage } from "../src/loginPage.ts";
import { renderMessagesPage } from "../src/messagesPage.ts";
import { handleApiRequest } from "./api.ts";

function getClientIp(connInfo: Deno.ServeHandlerInfo): string {
  const addr = connInfo.remoteAddr;
  if (addr.transport === "tcp") {
    return addr.hostname;
  }
  return "Unknown";
}

export function startServer(db: Database) {
  const port = 8080;
  console.log(`✅ Web server running at http://localhost:${port}`);

  Deno.serve({ port }, async (req: Request, connInfo: Deno.ServeHandlerInfo) => {
    const ip = getClientIp(connInfo);
    const userAgent = req.headers.get("user-agent") || "Unknown";
    const cookies = req.headers.get("cookie");
    const method = req.method;
    const url = new URL(req.url);
    const headers = Object.fromEntries(req.headers.entries());
  
    logMessage(`📥 New request:
    ├─ IP: ${ip}
    ├─ Method: ${method}
    ├─ URL: ${req.url}
    ├─ User-Agent: ${userAgent}
    ├─ Cookies: ${cookies}
    └─ Headers: ${JSON.stringify(headers, null, 2)}
    `);


    // Handle /api
    if (url.pathname.startsWith("/api/")) {
      const apiResponse = await handleApiRequest(req);
      return apiResponse ?? new Response("API endpoint not found", { status: 404 });
    }
    
    // Handle routes
    if (req.method === "POST" && url.pathname === "/login") {
      logMessage(`handleLogin`);
      return await handleLogin(req, db);
    } else if (req.method === "POST" && url.pathname === "/logout") {
      logMessage(`handleLogout`);
      return await handleLogout(req);
    } else if (req.method === "POST" && url.pathname === "/register") {
      logMessage(`handleRegister`);
      return await handleRegister(req, db);
    } else if (req.method === "POST" && url.pathname === "/messages") {
      logMessage(`handlePostMessage`);
      return await handlePostMessage(req, db);
    }

    // Session handling
    const sessionToken = cookies?.match(/session=([^;]+)/)?.[1];

    if (sessionToken && sessions.has(sessionToken)) {
      logMessage(`sessionToken ✅: ${sessionToken}`);
      logMessage(`sessions.has(sessionToken) ✅: ${sessions.has(sessionToken)}`);

      const userId = sessions.get(sessionToken);
      logMessage(`sessions.get(sessionToken) ✅: ${sessions.get(sessionToken)}`);
      const usersCollection = db.collection("users");
      const user = await usersCollection.findOne({ user_id: userId });

      if (user) {
        logMessage(`🔗 Checking if user ${user.login} (User ID: ${user.user_id}) has linked accounts...`);
        if (user.links && user.links.discord) {
            logMessage(`✅ User ${user.login} is linked with Discord ID: ${user.links.discord}`);
        } else {
            logMessage(`🚫 User ${user.login} has no linked Discord ID.`);
        }
    
        const discordLinkedUser = await findUserByDiscordId(db, user.links?.discord);
        if (discordLinkedUser) {
            logMessage(`✅ User authenticated: ${user.login} (User ID: ${user.user_id}) is linked with Discord ID: ${user.links?.discord}`);
            // const messages = await fetchMessages(db);
            // return new Response(renderMessagesPage(messages, user.login), { headers: { "Content-Type": "text/html" } });
            const aiResponse = sessions.get(`response_${sessionToken}`) as string | undefined;
            const messages = await fetchMessages(db);
            return new Response(
              renderMessagesPage(messages, user.login, aiResponse),
              { headers: { "Content-Type": "text/html" } }
            );
        } else {
            logMessage(`❌ User ${user.login} (User ID: ${user.user_id}) does not have a linked Discord account.`);
            return new Response("❌ Discord account not linked. Please link your account using `!link your_login`.", { headers: { "Content-Type": "text/plain" } });
        }
      }
    }

    // Not logged in
    logMessage(`🔑 No valid session. Sending login/register page.`);
    return new Response(renderLoginPage(), {
      headers: { "Content-Type": "text/html" },
    });
  });

  console.log(`✅ Web server running at http://localhost:${port}`);
}