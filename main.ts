// main.ts

import { config } from "https://deno.land/x/dotenv/mod.ts";
import { MongoClient } from "https://deno.land/x/mongo/mod.ts";
import { startServer } from "./server.ts"; // Import the web server function
import {
  // Client,
  Message,
  event,
  CommandClient,
  command,
  CommandContext,
  // GatewayIntents,
  MessageAttachment,
  // Interaction
} from "./deps.ts";
// import { messageUpdate } from "https://deno.land/x/harmony@v2.9.1/src/gateway/handlers/messageUpdate.ts";

// Ensure that the yt-dlp executable is in your PATH or specify the full path to yt-dlp in the command
const YT_DLP_PATH = "yt-dlp"; // Change this to the full path if yt-dlp is not in your PATH
const LOG_RETENTION_DAYS = 7; // Set the number of days to retain logs
const LLM_MODEL = "deepseek-r1:1.5b";

// Load environment variables
const { DISCORD_TOKEN, MONGO_ADMIN_USER, MONGO_ADMIN_PASS, MONGO_DB_NAME } = config();

async function logMessage(message: string, filename?: string): Promise<void> {
  const logDir = "./logs";
  const date = new Date();
  const defaultLogFile = `${logDir}/${date.toISOString().split("T")[0]}.log`;
  const logFile = filename ? `${logDir}/${filename}.log` : defaultLogFile;

  try {
    // Ensure logs directory exists
    await Deno.mkdir(logDir, { recursive: true });

    // Format log entry
    const logEntry = `[${date.toISOString()}] ${message}`;

    // Write log to file
    await Deno.writeTextFile(logFile, logEntry + "\n", { append: true });

    // Print log to console
    console.log(logEntry);

    // Clean up old logs
    await cleanupOldLogs(logDir, LOG_RETENTION_DAYS);
  } catch (error) {
    console.error("Logging error:", error);
  }
}

// Function to delete old logs
async function cleanupOldLogs(logDir: string, retentionDays: number): Promise<void> {
  try {
    for await (const entry of Deno.readDir(logDir)) {
      if (entry.isFile && entry.name.endsWith(".log")) {
        const filePath = `${logDir}/${entry.name}`;
        const fileInfo = await Deno.stat(filePath);
        const fileAgeDays = (Date.now() - fileInfo.mtime!.getTime()) / (1000 * 60 * 60 * 24);

        if (fileAgeDays > retentionDays) {
          await Deno.remove(filePath);
          console.log(`Deleted old log file: ${entry.name}`);
        }
      }
    }
  } catch (error) {
    console.error("Error cleaning up old logs:", error);
  }
}

const pullLLMModel = async (model: string): Promise<void> => {
  try {
      const process = new Deno.Command("ollama", {
          args: ["pull", model],
          stdout: "piped",
          stderr: "piped",
      });
      const { success, stderr } = await process.output();

      if (!success) {
          console.error("Error pulling LLM model:", new TextDecoder().decode(stderr));
          throw new Error("Failed to pull LLM model");
      }

      console.log("Successfully pulled LLM model:", model);
  } catch (error) {
      console.error("Error executing ollama pull:", error);
  }
};

await pullLLMModel(LLM_MODEL);

const detectLanguage = async (text: string): Promise<string | null> => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // deno-lint-ignore no-explicit-any
        const data: { [key: string]: any } = await response.json();
        return data[2]; // Language detected
    } catch (error) {
        console.error("Error detecting language:", error);
        return null;
    }
};

const translateText = async (text: string, targetLang: string = "en"): Promise<string | null> => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // deno-lint-ignore no-explicit-any
        const data: { [key: string]: any } = await response.json();
        // deno-lint-ignore no-explicit-any
        return data[0].map((item: any) => item[0]).join(" ");
    } catch (error) {
        console.error("Error translating text:", error);
        return null;
    }
};

// MongoDB setup
const client = new MongoClient();
await client.connect(`mongodb://${MONGO_ADMIN_USER}:${MONGO_ADMIN_PASS}@localhost:27017/admin?authSource=admin`);
const db = client.database(MONGO_DB_NAME || "test");
const messagesCollection = db.collection("messages");

async function checkAndCreateMessagesCollection() {
  const collections = await db.listCollectionNames();
  if (!collections.includes("messages")) {
    console.log("Creating 'messages' collection...");
    await db.createCollection("messages");
  } else {
    console.log("Collection 'messages' already exists.");
  }
}

await checkAndCreateMessagesCollection();

class MyClient extends CommandClient {
  constructor() {
    super({
      prefix: ['!', '!!'],
      caseSensitive: false,
      intents: [
        'GUILDS',
        'DIRECT_MESSAGES',
        'GUILD_MESSAGES'
      ],
      token: DISCORD_TOKEN,
    });
  }

  @event()
  async ready(): Promise<void> {
    await logMessage(`Logged in as ${this.user?.tag}!`);
  }

  @command({ aliases: 'pong' })
  async Ping(ctx: CommandContext): Promise<void> {
    await logMessage(`!Ping Pong!`);
    ctx.message.reply('Pong!');
  }

  @command({ aliases: 'AI' })
  async ask(ctx: CommandContext): Promise<void> {
      await logMessage(`Command: ${ctx.message.content}`);
      try {
          const question = ctx.message.content.replace(/^!ask\s*/, "").trim();
          if (!question) {
              await ctx.message.reply("Please provide a question!");
              return;
          }

          await logMessage(`Question from ${ctx.author.tag}: ${question}`);
          const detectedLanguage = await detectLanguage(question);
          if (!detectedLanguage) {
              await ctx.message.reply("Error detecting language.");
              return;
          }

          let translatedQuestion = question;
          if (detectedLanguage !== "en") {
              translatedQuestion = await translateText(question, "en") || question;
          }
          
          const response = await this.queryOllamaModel(translatedQuestion, LLM_MODEL);
          let translatedResponse = response;
          if (detectedLanguage !== "en") {
              translatedResponse = await translateText(response, detectedLanguage) || response;
          }

          // Ensure message length does not exceed Discord limit
          const maxMessageLength = 2000;
          if (translatedResponse.length > maxMessageLength) {
              const responseChunks = translatedResponse.match(/.{1,3900}/g) || [];
              await ctx.message.reply(`**Question:** ${question}\n**Answer:** ${responseChunks[0]}`);
              for (let i = 1; i < responseChunks.length; i++) {
                  await ctx.message.channel.send(responseChunks[i]);
              }
          } else {
              await ctx.message.reply(`**Question:** ${question}\n**Answer:** ${translatedResponse}`);
          }

          await logMessage(`Answered question from ${ctx.author.tag}`);
      } catch (error) {
          await logMessage(`Error in ask command: ${error}`);
          await ctx.message.reply("Sorry, there was an error processing your question.");
      }
  }

  private async queryOllamaModel(prompt: string, model: string): Promise<string> {
      try {
          const process = new Deno.Command("ollama", {
              args: ["run", model, prompt],
              stdout: "piped",
              stderr: "piped",
          });
          const { success, stdout, stderr } = await process.output();

          if (!success) {
              console.error("Ollama error:", new TextDecoder().decode(stderr));
              throw new Error("Ollama model execution failed");
          }

          return new TextDecoder().decode(stdout).trim();
      } catch (error) {
          throw new Error(`Ollama Error: ${error}`);
      }
  }

  @event()
  async messageCreate(message: Message): Promise<void> {
    if (message.content != "") {await logMessage(`${message.author.displayName} / ${message.author.username} said: "${message.content}"`);}
    if (message.embeds.length > 0) { // Check if embeds exist and prevent accessing undefined properties
      if (message.embeds[0].title != "" && message.embeds[0].title != undefined) {await logMessage(`${message.author.displayName} / ${message.author.username} embed title: "${message.embeds[0].title}"`);} 
      if (message.embeds[0].description != "" && message.embeds[0].description != undefined) {await logMessage(`${message.author.displayName} / ${message.author.username} embed description: "${message.embeds[0].description}"`);}
    }
    await this.processVideoLink(message);

    if (message.content.trim() !== "") {
      await this.logMessageToMongoDB(message);
    }
  }

  async logMessageToMongoDB(message: Message): Promise<void> {
    try {
      const doc = {
        message_id: message.id,
        timestamp: new Date(),
        content: message.content,
        sender: message.author.username,
        receiver: message.channelID ? message.channelID : "N/A",
        platform: "Discord",
      };
      await messagesCollection.insertOne(doc);
      console.log("Message logged to MongoDB.");
    } catch (error) {
      console.error("Error logging message to MongoDB:", error);
    }
  }

  async processVideoLink(message: Message): Promise<void> {
    const instagramPattern = /^https:\/\/www\.instagram\.com\/.*?\/reel/;
    const tiktokPattern = /^https:\/\/www\.tiktok\.com\/@.+\/video/;
    
    if (instagramPattern.test(message.content) || tiktokPattern.test(message.content)) {
      await logMessage("Message with link detected!");
      const link = message.content;
      try {
        // Download the video
        const videoPath = await this.downloadVideo(link);

        // Load the downloaded video as an attachment
        const attachment = await MessageAttachment.load(videoPath);

        // Send the video in response
        await message.reply({
          content: `Requested video:\n\`\`\`${message.content}\`\`\``,
          files: [attachment],
        });
        await logMessage("Video sent in response to a link!");

        // Delete the downloaded video
        await Deno.remove(videoPath);
      } catch (error) {
        console.error("Error handling the video:", error);
        await logMessage("Error handling the video: ${error}");
        await message.reply(`Error downloading or sending the video.\n\`\`\`${message.content}\`\`\``);
      }
      // Delete the original message
      await message.delete();
    }
  }

  // Function to download video using yt-dlp
  async downloadVideo(link: string): Promise<string> {
    // Create the output directory if it doesn't exist
    await Deno.mkdir("./videos", { recursive: true });

    // Define the fixed output file path
    const videoPath = "./videos/downloaded_video.mp4";

    // Set up the yt-dlp command to download the video
    const downloadVideo = new Deno.Command(YT_DLP_PATH, {
      args: [link, "-o", videoPath],
      stdout: "piped",
      stderr: "piped",
    });

    // Run the command
    const { success, stderr } = await downloadVideo.output();

    if (!success) {
      console.error("Failed to download video:", new TextDecoder().decode(stderr));
      throw new Error("Video download failed");
    }

    console.log("Video downloaded successfully:", videoPath);
    return videoPath;
  }

}

new MyClient().connect();

// Start the web server on port 80
startServer(db);
