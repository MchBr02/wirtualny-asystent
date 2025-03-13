const LOG_RETENTION_DAYS = 7;

export async function logMessage(message: string, filename?: string): Promise<void> {
  const logDir = "./logs";
  const date = new Date();
  const defaultLogFile = `${logDir}/${date.toISOString().split("T")[0]}.log`;
  const logFile = filename ? `${logDir}/${filename}.log` : defaultLogFile;

  try {
    await Deno.mkdir(logDir, { recursive: true });
    const logEntry = `[${date.toISOString()}] ${message}`;
    await Deno.writeTextFile(logFile, logEntry + "\n", { append: true });
    console.log(logEntry);
    await cleanupOldLogs(logDir, LOG_RETENTION_DAYS);
  } catch (error) {
    console.error("Logging error:", error);
  }
}

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
