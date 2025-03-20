// main.ts

// import { connectToDatabase, logMessageToDB, saveMessageToDB } from "./utils/database.ts";
import { connectToDatabase } from "./utils/database.ts";
import { logMessage } from "./utils/logger.ts";
import { queryOllamaModel } from "./utils/ai.ts";
import { downloadVideo } from "./utils/video.ts";
// import { CommandClient, event, command, CommandContext, Message, MessageAttachment } from "./deps.ts";
import { startServer } from "./utils/server.ts";
import { getWeather } from "./utils/weatherapi.ts";
import { discordClient } from "./utils/harmony.ts";
// import { translateText } from "./utils/translator.ts";
import { detectLanguage, translateText } from "./utils/translator.ts";

const db = await connectToDatabase();
const LLM_MODEL = "deepseek-r1:1.5b";



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

  const categoryQuestion = `Assign given question to the appropriate action:
  If the question concerns the weather, write: weather.
  If the question is directed towards assistant or 'WA'/'wa', write: assistant.
  If the question does not match the previous variables, write: other.
 
  Question: ${translatedMessage}`

  let llm_category = await queryOllamaModel(categoryQuestion, LLM_MODEL);
  // Extract the last word
  llm_category = llm_category.trim().split(/\s+/).pop() || "other";
  llm_category = llm_category.replace(/[^a-zA-Z]/g, ""); // Remove non-letter characters
  logMessage(`llm category: ${llm_category}`);

  let llm_reply: string = ""; //"I am not sure how to respond to that.";
  
  if(llm_category == "weather") {
    const locationQuestion = `Assign given question to the appropriate location if one is given:
    If location is not given than answer: unknown.
    If cityname is given than give it as the answer, for example answer: cityname.
    
    Question: ${translatedMessage}`;
    let location = await queryOllamaModel(locationQuestion, LLM_MODEL);
    location = location.trim().split(/\s+/).pop() || "unknown";
    location = location.replace(/[^a-zA-Z]/g, ""); // Remove non-letter characters

    if (location == "unknown") {
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

  if(llm_category == "assistant") {
    llm_reply = await queryOllamaModel(translatedMessage, LLM_MODEL);
  }

  if (LLM_MODEL == "deepseek-r1:1.5b")  llm_reply = llm_reply.replace(/^.*<\/think>/is, "").trim(); // Remove everything up to and including "</think>"
  let translatedReply = llm_reply;
  if (detectedLanguage !== defaultLanguage) {
    translatedReply = await translateText(llm_reply, detectedLanguage) || llm_reply;
    logMessage(`Translated reply: ${translatedReply}`);
  }

  return `${translatedReply}`;
}

export async function videoLinkHandler(message: string): Promise<string | null> {
  if (
    message.match(/^https:\/\/www\.instagram\.com\/(reel|reels)\/[^/]+\/?$/) || 
    message.match(/^https:\/\/www\.tiktok\.com\/@[^/]+\/video\/\d+\/?$/)
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




try {
  await discordClient.connect();
  logMessage("✅ Successfully connected to Discord!");
} catch (error) {
  const err = error as Error;
  console.error("❌ Discord API connection error:", error);
  logMessage(`❌ Discord API connection error: ${err.message}`);

  if (err.message.includes("401")) {
    console.error("❌ Invalid bot token. Check your DISCORD_TOKEN.");
  }

  Deno.exit(1); // Exit the process if the bot fails to connect
}

startServer(db);