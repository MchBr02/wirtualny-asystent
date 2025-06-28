// utils/api.ts

import { messageHandler } from "../main.ts";
import { sessions } from "./handlers.ts";

export async function handleApiRequest(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
  
    // CORS Preflight
    if (req.method === "OPTIONS" && url.pathname === "/api/message") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
  
    if (req.method === "POST" && url.pathname === "/api/message") {
      try {
        const body = await req.json();
        const { message, userId } = body;
  
        if (!message) {
          return new Response(
            JSON.stringify({ error: "Missing message" }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        }
  
        const response = await messageHandler(message);
  
        if (userId) {
          for (const [token, id] of sessions.entries()) {
            if (id === userId) {
              sessions.set(`response_${token}`, response);
              break;
            }
          }
        }
  
        return new Response(
          JSON.stringify({ response }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      } catch (err) {
        console.error("❌ API error:", err);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }
  
    return null;
  }
  