const YT_DLP_PATH = "yt-dlp";

export async function downloadVideo(link: string): Promise<string> {
  await Deno.mkdir("./videos", { recursive: true });
  const videoPath = "./videos/downloaded_video.mp4";

  const downloadVideo = new Deno.Command(YT_DLP_PATH, {
    args: [link, "-o", videoPath],
    stdout: "piped",
    stderr: "piped",
  });

  const { success, stderr } = await downloadVideo.output();

  if (!success) {
    console.error("Failed to download video:", new TextDecoder().decode(stderr));
    throw new Error("Video download failed");
  }

  console.log("Video downloaded successfully:", videoPath);
  return videoPath;
}
