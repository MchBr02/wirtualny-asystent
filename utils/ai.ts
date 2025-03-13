import { detectLanguage, translateText } from "./translator.ts";
import { logMessage } from "./logger.ts";

const LLM_MODEL = "deepseek-r1:1.5b";

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
      console.error("Error pulling LLM model:", new TextDecoder().decode(stderr));
      throw new Error("Failed to pull LLM model");
    }

    console.log("Successfully pulled LLM model:", model);
  } catch (error) {
    console.error("Error executing ollama pull:", error);
  }
}

export async function queryOllamaModel(prompt: string, model: string): Promise<string> {
  try {
    const process = new Deno.Command("ollama", {
      args: ["run", model, prompt],
      stdout: "piped",
      stderr: "piped",
    });
    const { success, stdout, stderr } = await process.output();

    if (!success) {
      console.error("Ollama error:", new TextDecoder().decode(stderr));
      throw new Error("Ollama model execution failed");
    }

    return new TextDecoder().decode(stdout).trim();
  } catch (error) {
    throw new Error(`Ollama Error: ${error}`);
  }
}


export async function handleAIQuery(question: string): Promise<{ response: string; error?: string }> {
  const detectedLanguage = await detectLanguage(question);
  if (!detectedLanguage) {
    return { response: "Error detecting language." };
  }
  logMessage(`Detected language: ${detectedLanguage}`);

  let translatedQuestion = question;
  if (detectedLanguage !== "en") {
      translatedQuestion = await translateText(question, "en") || question;
      logMessage(`Translated question: ${translatedQuestion}`);
  }

  const llm_response = await queryOllamaModel(translatedQuestion, LLM_MODEL);
  
  // Formatting response
  let response = `**Question:** ${question}\n**Answer:** ${llm_response}`;
  if (detectedLanguage !== "en") {
      response = await translateText(response, detectedLanguage) || response;
  }
  
  return { response };
}