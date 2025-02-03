import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
// import { config } from "https://deno.land/x/dotenv/mod.ts";
import {
  // Client,
  Message,
  event,
  CommandClient,
  command,
  CommandContext,
  // GatewayIntents,
  // Interaction,
  MessageAttachment
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
      token: DISCORD_TOKEN, // Use the token from .env
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
    if ( (message.content.startsWith("https://www.instagram.com/reel/")) || (message.content.startsWith("https://www.instagram.com/share/reel/")) ) {
      try {
        // Load the file as an attachment
        const attachment = await MessageAttachment.load("./test.txt", "test.txt");

        await message.reply({
          content: "Here's the file you requested:",
          files: [attachment],
        });
        console.log("File sent in response to Instagram link!");
      } catch (error) {
        console.error("Error sending file:", error);
      }
    }
  }
}


// Function to download an Instagram video using yt-dlp
async function downloadInstagramVideo(link: string) {
  // Create the output directory if it doesn't exist
  await Deno.mkdir("./videos", { recursive: true });

  // Set up the yt-dlp command to download the video
  const command = new Deno.Command(YT_DLP_PATH, {
    args: [link, "-o", "./videos/%(title)s.%(ext)s"],
    stdout: "piped",
    stderr: "piped",
  });

  // Run the command
  const { success, stdout, stderr } = await command.output();

  if (success) {
    console.log("Video downloaded successfully:", new TextDecoder().decode(stdout));
  } else {
    console.error("Failed to download video:", new TextDecoder().decode(stderr));
  }
}



new MyClient().connect();
