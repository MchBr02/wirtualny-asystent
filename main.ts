// main.ts

// import { connectToDatabase, logMessageToDB, saveMessageToDB } from "./utils/database.ts";
import { connectToDatabase } from "./utils/database.ts";
import { logMessage } from "./utils/logger.ts";
import { queryOllamaModel, LLM_MODEL, pullLLMModel } from "./utils/ai.ts";
import { downloadVideo } from "./utils/video.ts";
// import { CommandClient, event, command, CommandContext, Message, MessageAttachment } from "./deps.ts";
import { startServer } from "./utils/server.ts";
import { getWeather } from "./utils/weatherapi.ts";
import { discordClient } from "./utils/harmony.ts";
// import { translateText } from "./utils/translator.ts";
import { detectLanguage, translateText } from "./utils/translator.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";

const db = await connectToDatabase();



export async function messageHandler(message: string): Promise<string | null> {
  await logMessage(`💬 Message received: "${message}"`);

  const defaultLanguage = "en";

  // const translatedMessage = handleTranslation(message, defaultLanguage);

  const detectedLanguage = await detectLanguage(message);

  if (!detectedLanguage) {
    logMessage("Error detecting language.");
    return null; //'Error detecting language :(';
  } else {
    logMessage(`Detected language: ${detectedLanguage}`);
  }

  let translatedMessage = message;
  if (detectedLanguage !== defaultLanguage) {
      translatedMessage = await translateText(message, defaultLanguage) || message;
      logMessage(`Translated message: ${translatedMessage}`);
  }

  const categoryQuestion = `
  You are a classifier. Assign the given question to one of the following categories:
  
  - "weather" if the question is about the weather
  - "assistant" if the question is directed at an assistant, WA, or 'wa'
  - "other" for everything else
  
  Only respond with one word: weather, assistant, or other.
  
  Question: ${translatedMessage}
  `.trim();

  let llm_category = await queryOllamaModel(categoryQuestion, LLM_MODEL);
  // Extract the last word
  llm_category = llm_category.trim().split(/\s+/).pop() || "other";
  llm_category = llm_category.replace(/[^a-zA-Z]/g, ""); // Remove non-letter characters
  llm_category = llm_category.toLowerCase();
  logMessage(`llm category: ${llm_category}`);

  let llm_reply: string = ""; //"I am not sure how to respond to that.";
  
  if(llm_category == "weather") {
    logMessage(`logic for llm_category weather...`);
    const locationQuestion = `Extract the city name from the following question for weather purposes.
    - If a city is mentioned, respond only with the city name (e.g., answer: Paris).
    - If no city is mentioned, respond with: unknown.
    
    Question: ${translatedMessage}`;
    let location = await queryOllamaModel(locationQuestion, LLM_MODEL);
    location = location.trim().split(/\s+/).pop() || "unknown";
    location = location.replace(/[^a-zA-Z]/g, ""); // Remove non-letter characters
    location = replacePolishChars(location);
    logMessage(`location: ${location}`);

    if (location.toLowerCase() == "unknown") {
      return "Please provide city or country name.";
    }

    const weatherData = await getWeather(`${location}`);
    logMessage(JSON.stringify(weatherData));
          
    if (weatherData.error) {
      logMessage(weatherData.error);
      return null; //weatherData.error; // 'błąd :(';
    }

    const weatherQuestion = `Answer to this message: ${translatedMessage},
    Use following data to answer:
    🌍 **Location:** ${weatherData.location}
    🌡 **Temperature:** ${weatherData.temperature}
    🌥 **Condition:** ${weatherData.condition}
    💨 **Wind:** ${weatherData.wind}
    💧 **Humidity:** ${weatherData.humidity}
    Answer as if you were talking to a friend. Make it short but keep inportant data.`;
    
    llm_reply = await queryOllamaModel(weatherQuestion, LLM_MODEL);
  }

  if(llm_category == "assistant" || llm_category == "other") {
    llm_reply = await queryOllamaModel(translatedMessage, LLM_MODEL);
  }

  if (LLM_MODEL == "deepseek-r1:1.5b")  {llm_reply = llm_reply.replace(/^.*<\/think>/is, "").trim();} // Remove everything up to and including "</think>"
  logMessage(`llm_reply: " ${llm_reply} "`);
  let translatedReply = llm_reply;
  if (detectedLanguage !== defaultLanguage) {
    translatedReply = await translateText(llm_reply, detectedLanguage) || llm_reply;
    await logMessage(`Translated reply: " ${translatedReply} "`);
  }

  return `${translatedReply}`;
}

export async function videoLinkHandler(message: string): Promise<string | null> {
  if (
    message.match(/^https:\/\/www\.instagram\.com\/(reel|reels)\/[^/]+\/?$/) || 
    message.match(/^https:\/\/www\.tiktok\.com\/@[^/]+\/video\/\d+\/?$/) ||
    message.match(/^https:\/\/www\.facebook\.com\/share\/r\/[^/]+\/?$/)
  ) {
    await logMessage(`🎥 Video link detected. Downloading: ${message}`);

    try {
      const videoPath = await downloadVideo(message);
      return videoPath; // Return the downloaded file path
    } catch (error) {
      console.error("❌ Video download failed:", error);
      return null; // Return null if the download fails
    }
  }

  return null; // No video link detected
}


function replacePolishChars(str: string): string {
  const map: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l',
    'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L',
    'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
  };

  return str.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (c: string): string => map[c] ?? c);
}



async function connectDiscordWithRetry() {
  let previousToken = Deno.env.get("DISCORD_TOKEN") ?? config().DISCORD_TOKEN;

  while (true) {
    try {
      await discordClient.connect();
      logMessage("✅ Successfully connected to Discord!");
      break; // Exit loop on success
    } catch (error) {
      const err = error as Error;
      console.error("❌ Discord API connection error:", error);
      logMessage(`❌ Discord API connection error: ${err.message}`);

      if (err.message.includes("401")) {
        console.error("❌ Invalid bot token. Will retry in 30 seconds...");

        // Wait 30 seconds
        await new Promise((resolve) => setTimeout(resolve, 30000));

        // Reload .env and compare tokens
        const newEnv = config();
        const newToken = newEnv.DISCORD_TOKEN;

        if (newToken && newToken !== previousToken) {
          console.log("🔄 New DISCORD_TOKEN detected, retrying with updated token.");
          Deno.env.set("DISCORD_TOKEN", newToken);
          previousToken = newToken;
        } else {
          console.log("🔁 Retrying Discord connection with same token...");
        }

        continue;
      }

      // Unknown error — retry after delay anyway
      console.error("⚠️ Unexpected error. Retrying in 30 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }
}

await pullLLMModel(`${LLM_MODEL}`);
connectDiscordWithRetry();
startServer(db);
