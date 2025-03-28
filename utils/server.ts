// server.ts

import { Database } from "https://deno.land/x/mongo@v0.34.0/mod.ts";

import { fetchMessages } from "./database.ts";
import { handleRegister, handleLogin, handleLogout, handlePostMessage, sessions } from "./handlers.ts";
import { logMessage } from "./logger.ts";

import { renderLoginPage } from "../src/loginPage.ts";
import { renderMessagesPage } from "../src/messagesPage.ts";

export function startServer(db: Database) {

  const port = 8080;
  Deno.serve({ port: port }, async (req: Request, connInfo) => {
    const ip = connInfo.remoteAddr.hostname;
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
    
    // Handle routes
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

    // Session handling
    // const cookies = req.headers.get("cookie");
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

    // Not logged in
    logMessage(`🔑 No valid session. Sending login/register page.`);
    return new Response(renderLoginPage(), {
      headers: { "Content-Type": "text/html" },
    });
  });

  console.log(`✅ Web server running at http://localhost:${port}`);
}