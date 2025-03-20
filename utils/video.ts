// video.ts

const YT_DLP_PATH = "yt-dlp";

export async function downloadVideo(link: string): Promise<string> {
  await Deno.mkdir("./videos", { recursive: true });
  
  const timestamp = Date.now();
  const videoPath = `./videos/video_${timestamp}.mp4`;

  const downloadProcess = new Deno.Command(YT_DLP_PATH, {
    args: [
      link,
      "-o", videoPath,  // Output file path
      "-f", "bestvideo+bestaudio/best",  // Best quality format selection
      "--merge-output-format", "mp4",  // Ensure the output is in MP4
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const { success, stderr } = await downloadProcess.output();

  if (!success) {
    console.error("❌ Failed to download video:", new TextDecoder().decode(stderr));
    throw new Error("Video download failed");
  }

  console.log("✅ Video downloaded successfully:", videoPath);
  return videoPath;
}

