// harmony.ts

import {
    Client,
    Message,
    MessageAttachment,
}   from "../deps.ts"; //'https://deno.land/x/harmony/mod.ts'

import { messageHandler, videoLinkHandler } from "../main.ts";
import { connectToDatabase, saveMessageToDB } from "./database.ts";
import { logMessage } from "./logger.ts";

const db = await connectToDatabase();

export const discordClient = new Client({
    intents: [
      'GUILDS',
      'DIRECT_MESSAGES',
      'GUILD_MESSAGES'
    ],
    // token: optionally specify, otherwise DISCORD_TOKEN from env is used
})

// Listen for event when client is ready (Identified through gateway / Resumed)
discordClient.on('ready', () => {
    logMessage(`Discord is ready! User: ${discordClient.user?.tag}`)
})
    
// Listen for event whenever a Message is sent
discordClient.on('messageCreate', async (msg: Message) => {



  // LOG ENTIRE MESSAGE CONTENT!!!
  let content = msg.content || ""; // Default to empty string if no content

  // Check if there are embeds and extract descriptions
  if (msg.embeds.length > 0) {
    const embedInfo = msg.embeds.map(embed => 
      `Title: ${embed.title || "N/A"}, Description: ${embed.description || "N/A"}`
    ).join("; ");
    content += ` | Embeds: [${embedInfo}]`;
  }
  
  // Check for attachments (e.g., images, files)
  if (msg.attachments.length > 0) { // FIX: Use .length instead of .size
    const attachmentUrls = msg.attachments.map(att => att.url).join(", ");
    content += ` | Attachments: ${attachmentUrls}`;
  }
  
  // Log the full message
  logMessage(`Discord message from: ${msg.author.username}, Message: ${content}`);








  // 📝 Save message to DB
  await saveMessageToDB(db, msg.id, new Date(), msg.content, msg.author.username, msg.channelID || "N/A", "Discord");

  // 🔍 Check for video link first
  const videoPath = await videoLinkHandler(msg.content);
  if (videoPath) { // 🎥 If a video was downloaded, send it as an attachment
  const attachment = await MessageAttachment.load(videoPath);

  await msg.reply({
      content: `🎬 Requested video: \`\`\`${msg.content}\`\`\``,
      files: [attachment],
  });

  Deno.remove(videoPath); // Clean up the file

  // Attempt to delete the original message
  try {
    await msg.delete();
  } catch (error) {
    console.warn("⚠️ Could not delete the message:", error);
    logMessage(`"⚠️ Could not delete the message: ${error}`);
  }

  return; // Skip message handling since it's a video link
  }

  if(msg.content == "!ping") {
    await msg.reply("Pong!"); return;
  }

  if(msg.author.bot != true) {
    // ✉️ Process text message if it's not a video link
    const response = await messageHandler(msg.content);
    if (response && response != "") {

    // Ensure message length does not exceed Discord limit
      const maxMessageLength = 1999;
      if (response.length > maxMessageLength) {
        logMessage(`Message is to long. cutting it into smaller pieces.`);
          const responseChunks = response.match(/.{1,1999}/g) || [];
          
          for (const chunk of responseChunks) {
              if (chunk && chunk.trim().length > 0) {
                logMessage(`Sending chunk: ${chunk}`);
                  await msg.channel.send(chunk);
              }
          }
      } else {
        await msg.reply({ content: response });
      }
    }
  }
});
