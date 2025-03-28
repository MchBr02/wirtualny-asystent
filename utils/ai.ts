// ai.ts

import { logMessage } from "./logger.ts";
const LLMS = [
  "deepseek-r1:1.5b", // Smallest deepseek model out there
  "llava"
]
export const LLM_MODEL = LLMS[1];

// Pull the LLM model before starting
await pullLLMModel(`${LLM_MODEL}`);

export async function pullLLMModel(model: string): Promise<void> {
  try {
    const process = new Deno.Command("ollama", {
      args: ["pull", model],
      stdout: "piped",
      stderr: "piped",
    });
    const { success, stderr } = await process.output();

    if (!success) {
      // console.error(`Error pulling LLM model: ${new TextDecoder().decode(stderr)}`);
      logMessage(`Error pulling LLM model: ${new TextDecoder().decode(stderr)}`);
      throw new Error("Failed to pull LLM model");
    }

    logMessage(`Successfully pulled LLM model: ${model}`);
  } catch (error) {
    // console.error(`Error executing ollama pull: ${error}`);
    logMessage(`Error executing ollama pull: ${error}`);
  }
}

export async function queryOllamaModel(prompt: string, model: string): Promise<string> {
  logMessage(`queryOllamaModel model: ${model}`);
  logMessage(`prompt: ${prompt}`);
  try {
    const process = new Deno.Command("ollama", {
      args: ["run", model, prompt],
      stdout: "piped",
      stderr: "piped",
    });
    const { success, stdout, stderr } = await process.output();

    if (!success) {
      // console.error("Ollama error:", new TextDecoder().decode(stderr));
      logMessage(`Ollama error: ${new TextDecoder().decode(stderr)}`);
      throw new Error("Ollama model execution failed");
    }

    console.log(`Ollama response: ${new TextDecoder().decode(stdout).trim()}`);
    return new TextDecoder().decode(stdout).trim();
  } catch (error) {
    // console.log(`Ollama Error: ${error}`);
    logMessage(`Ollama Error: ${error}`);
    throw new Error(`Ollama Error: ${error}`);
  }
}

