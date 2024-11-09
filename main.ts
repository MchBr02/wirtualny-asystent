import { config } from "https://deno.land/x/dotenv/mod.ts";
import {
  Client,
  Message,
  event,
  CommandClient,
  command,
  CommandContext,
  GatewayIntents,
  MessageAttachment,
  Interaction
} from "./deps.ts";

// Ensure that the yt-dlp executable is in your PATH or specify the full path to yt-dlp in the command
const YT_DLP_PATH = "yt-dlp"; // Change this to the full path if yt-dlp is not in your PATH

// Load environment variables
const { DISCORD_TOKEN } = config();

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
  ready(): void {
    console.log(`Logged in as ${this.user?.tag}!`);
  }

  @command({ aliases: 'pong' })
  Ping(ctx: CommandContext): void {
    console.log(`!Ping Pong!`);
    ctx.message.reply('Pong!');
  }

  // Add file-sending functionality
  @event()
  async messageCreate(message: Message): Promise<void> {
    if (message.content.startsWith("https://www.instagram.com/reel")) {
      const link = message.content;
      try {
        // Download the video
        const videoPath = await downloadInstagramVideo(link);

        // Load the downloaded video as an attachment
        const attachment = await MessageAttachment.load(videoPath);

        // Send the video in response
        await message.reply({
          content: `Here's the video you requested:\nOriginal message:\n\`\`\`${message.content}\`\`\``,
          files: [attachment],
        });
        console.log("Video sent in response to Instagram link!");

        // Delete the downloaded video
        await Deno.remove(videoPath);
      } catch (error) {
        console.error("Error handling Instagram video:", error);
        await message.reply(`There was an error downloading or sending the video.\nOriginal message:\n\`\`\`${message.content}\`\`\``);
      }
      // Delete the original message
      await message.delete();
    }
  }
}

// Function to download an Instagram video using yt-dlp
async function downloadInstagramVideo(link: string): Promise<string> {
  // Create the output directory if it doesn't exist
  await Deno.mkdir("./videos", { recursive: true });

  // Define the fixed output file path
  const videoPath = "./videos/downloaded_video.mp4";

  // Set up the yt-dlp command to download the video
  const command = new Deno.Command(YT_DLP_PATH, {
    args: [link, "-o", videoPath],
    stdout: "piped",
    stderr: "piped",
  });

  // Run the command
  const { success, stderr } = await command.output();

  if (!success) {
    console.error("Failed to download video:", new TextDecoder().decode(stderr));
    throw new Error("Video download failed");
  }

  console.log("Video downloaded successfully:", videoPath);
  return videoPath;
}

new MyClient().connect();
