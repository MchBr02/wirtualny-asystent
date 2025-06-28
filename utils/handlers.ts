// handlers.ts

import { Database } from "https://deno.land/x/mongo@v0.34.0/mod.ts";
import { crypto } from "jsr:@std/crypto";

import { logMessage } from "./logger.ts";
import { hashPassword } from "./encoding.ts";
import { messageHandler } from "../main.ts"; // na samej górze

// Simulating a session store
export const sessions = new Map();

/**
 * Handles user registration
 */
export async function handleRegister(req: Request, db: Database): Promise<Response> {
    try {
        const bodyText = await req.text();
        const params = new URLSearchParams(bodyText);
        const login = params.get("login");
        const password = params.get("password");

        if (!login || !password) {
            logMessage("❌ Registration failed: Missing credentials.");
            return new Response("Missing credentials", { status: 400 });
        }

        const usersCollection = db.collection("users");

        // Check if user already exists
        const existingUser = await usersCollection.findOne({ login });
        if (existingUser) {
            logMessage(`❌ Registration failed: User ${login} already exists.`);
            return new Response("User already exists", { status: 400 });
        }

        // Hash password and save user
        const hashedPassword = await hashPassword(password);
        await usersCollection.insertOne({
            user_id: crypto.randomUUID(),
            login,
            password: hashedPassword
        });

        logMessage(`✅ New user registered: ${login}`);

        return new Response("Registration successful! Redirecting to login page...", {
            status: 302,
            headers: { "Location": "/" }
        });
    } catch (error) {
        logMessage(`❌ Error processing registration: ${error}`);
        return new Response("Error processing registration", { status: 500 });
    }
}

/**
 * Handles user login
 */
export async function handleLogin(req: Request, db: Database): Promise<Response> {
    try {
        let login, password;
    
        // Check content type
        const contentType = req.headers.get("content-type") || "";
    
        if (contentType.includes("application/json")) {
          // Handle JSON request
          const body = await req.json();
          login = body.login;
          password = body.password;
          logMessage(`🔑 Received login request via JSON. Login: ${login}`);
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          // Handle form data
          const bodyText = await req.text();
          const params = new URLSearchParams(bodyText);
          login = params.get("login");
          password = params.get("password");
          logMessage(`🔑 Received login request via Form Data. Login: ${login}`);
        } else {
            logMessage("❌ Unsupported content type for login.");
            return new Response("Unsupported content type", { status: 400 });
        }
    
        if (!login || !password) {
            logMessage("❌ Missing credentials.");
            return new Response("Missing credentials", { status: 400 });
        }

        const usersCollection = db.collection("users");

        // Find user in the database
        const user = await usersCollection.findOne({ login });
        if (!user) {
            logMessage(`❌ User not found: ${login}`);
            return new Response("User not found", { status: 404 });
        }

        logMessage(`🔍 User found: ${login} (User ID: ${user.user_id})`);

        // Hash the provided password for comparison
        const hashedPassword = await hashPassword(password);
        if (user.password !== hashedPassword) {
            logMessage(`❌ Invalid password for user: ${login}`);
            return new Response("Invalid password", { status: 401 });
        }

        // Create a session token
        const sessionToken = crypto.randomUUID();
        sessions.set(sessionToken, user.user_id);

        
        const initialMessage = "Jaka jest pogoda w Warszawie?";
        const aiResponse = await messageHandler(initialMessage);
        if (aiResponse) {
            sessions.set(`response_${sessionToken}`, aiResponse);
            logMessage(`📥 Initial AI response saved for session: ${aiResponse}`);
        }

        logMessage(`✅ User logged in: ${login} (User ID: ${user.user_id}). Session token created: ${sessionToken}`);

        if (user.discord_id) {
            logMessage(`🔗 User ${login} is linked with Discord ID: ${user.discord_id}`);
        } else {
            logMessage(`🚫 User ${login} has no linked Discord ID.`);
        }

        return new Response("Redirecting...", {
            status: 302,
            headers: {
                "Location": "/",
                "Set-Cookie": `session=${sessionToken}; HttpOnly; Path=/`
            }
        });
    } catch (error) {
        logMessage(`Error processing login: ${error}`);
        return new Response("Error processing login", { status: 500 });
    }
}

/**
 * Handles user logout
 */
export async function handleLogout(req: Request): Promise<Response> {
    try {
      const cookieHeader = req.headers.get("cookie");
      const sessionToken = cookieHeader?.match(/session=([^;]+)/)?.[1];
  
      if (sessionToken && sessions.has(sessionToken)) {
        sessions.delete(sessionToken);
        logMessage(`✅ Session ended for token: ${sessionToken}`);
      } else {
        logMessage("❌ Invalid session logout attempt.");
      }
  
      return new Response("Logged out successfully", {
        status: 302,
        headers: {
          "Location": "/",
          "Set-Cookie": "session=; Max-Age=0; Path=/; HttpOnly",
        },
      });
    } catch (error) {
      logMessage(`❌ Error processing logout: ${error}`);
      return new Response("Error processing logout", { status: 500 });
    }
  }

/**
 * Handles posting messages
 */
export async function handlePostMessage(req: Request, db: Database): Promise<Response> {
  try {
    const { session, content, sender, receiver, platform } = await req.json();

    if (!sessions.has(session)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const messagesCollection = db.collection("messages");
    await messagesCollection.insertOne({
      message_id: crypto.randomUUID(),
      timestamp: Date.now(),
      content,
      sender,
      receiver,
      platform,
    });

    return new Response("Message stored", { status: 201 });
  } catch (error) {
    logMessage(`Error processing request: ${error}`);
    return new Response("Error processing request", { status: 500 });
  }
}
