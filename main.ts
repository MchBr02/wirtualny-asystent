import { connectToDatabase, logMessageToDB } from "./utils/database.ts";
import { logMessage } from "./utils/logger.ts";
import { handleAIQuery } from "./utils/ai.ts";
import { downloadVideo } from "./utils/video.ts";
import { CommandClient, event, command, CommandContext, Message, MessageAttachment } from "./deps.ts";
import { startServer } from "./utils/server.ts";
// import { detectLanguage, translateText } from "./utils/translator.ts";

// const LLM_MODEL = "deepseek-r1:1.5b";

const db = await connectToDatabase();


class MyClient extends CommandClient {
  constructor() {
    super({ prefix: ['!', '!!'], caseSensitive: false, intents: ['GUILDS', 'DIRECT_MESSAGES', 'GUILD_MESSAGES'], token: Deno.env.get("DISCORD_TOKEN") });
  }

  @event()
  async ready(): Promise<void> {
    await logMessage(`Logged in as ${this.user?.tag}!`);
  }

  @command()
  ping(ctx: CommandContext): void {
    ctx.message.reply("Pong!");
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
          const result = await handleAIQuery(question);
          if (result.error) {
              await ctx.message.reply(result.error);
              return;
          }
          
          // Ensure message length does not exceed Discord limit
          const maxMessageLength = 2000;
          if (result.response.length > maxMessageLength) {
              const regex = new RegExp(`[\s\S]{1,${maxMessageLength}}`, 'g');
              const responseChunks = result.response.match(regex) || [];
              
              for (const chunk of responseChunks) {
                  if (chunk && chunk.trim().length > 0) {
                      await ctx.message.channel.send(chunk);
                  }
              }
          } else {
              await ctx.message.reply(result.response);
          }
          
          await logMessage(`Answered question from ${ctx.author.tag}`);
      } catch (error) {
          await logMessage(`Error in ask command: ${error}`);
          await ctx.message.reply("Sorry, there was an error processing your question.");
      }
  }

  @event()
  async messageCreate(message: Message): Promise<void> {
    await logMessage(`${message.author.username} said: "${message.content}"`);
    if (message.content.trim() !== "") {
      await logMessageToDB(db, {
        message_id: message.id,
        timestamp: new Date(),
        content: message.content,
        sender: message.author.username,
        receiver: message.channelID || "N/A",
        platform: "Discord",
      });
    }

    if (message.content.match(/^https:\/\/www\.instagram\.com\/.*?\/reel/) || message.content.match(/^https:\/\/www\.tiktok\.com\/@.+\/video/)) {
      const videoPath = await downloadVideo(message.content);
      const attachment = await MessageAttachment.load(videoPath);
      await message.reply({ content: `Requested video: ${message.content}`, files: [attachment] });
      await Deno.remove(videoPath);
      await message.delete();
    }
  }
}

new MyClient().connect();
startServer(db);