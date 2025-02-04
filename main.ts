// main.ts

import { config } from "https://deno.land/x/dotenv/mod.ts";
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

// Ensure that the yt-dlp executable is in your PATH or specify the full path to yt-dlp in the command
const YT_DLP_PATH = "yt-dlp"; // Change this to the full path if yt-dlp is not in your PATH
const LOG_RETENTION_DAYS = 7; // Set the number of days to retain logs

// Load environment variables
const { DISCORD_TOKEN } = config();

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
      
      const response = await this.queryOllamaLlava(question);
      await ctx.message.reply(`**Question:** ${question}\n**Answer:** ${response}`);
      
      await logMessage(`Answered question from ${ctx.author.tag}`);
    } catch (error) {
      await logMessage(`Error in ask command: ${error}`);
      await ctx.message.reply("Sorry, there was an error processing your question.");
    }
  }

  private async queryOllamaLlava(prompt: string): Promise<string> {
    try {
      const process = new Deno.Command("ollama", {
        args: ["run", "llava", prompt],
        stdout: "piped",
        stderr: "piped",
      });
      const { success, stdout, stderr } = await process.output();

      if (!success) {
        console.error("Ollama llava error:", new TextDecoder().decode(stderr));
        throw new Error("Ollama llava failed");
      }

      return new TextDecoder().decode(stdout).trim();
    } catch (error) {
      throw new Error(`Ollama llava Error: ${error}`);
    }
  }

  @event()
  async messageCreate(message: Message): Promise<void> {
    await logMessage(`${message.author.displayName} / ${message.author.username} said ${message.content}`);
    await this.processVideoLink(message);
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
