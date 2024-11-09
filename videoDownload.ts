// Ensure that the yt-dlp executable is in your PATH or specify the full path to yt-dlp in the command
const YT_DLP_PATH = "yt-dlp"; // Change this to the full path if yt-dlp is not in your PATH

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

// Example usage
await downloadInstagramVideo("https://www.instagram.com/reel/C7UGBWxSHdG/");
