// ai.ts

import { logMessage } from "./logger.ts";

const LLMS = [
  "deepseek-r1:1.5b", // Smallest deepseek model out there
  "llava"
]
export const LLM_MODEL = LLMS[1];

// Pull the LLM model before starting
// await pullLLMModel(`${LLM_MODEL}`);

export async function pullLLMModel(model: string): Promise<void> {
  try {
    const response = await fetch("http://wa-ollama:11434/api/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error("No response body");

    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) {
          // Skip non-JSON lines
          logMessage(`⚠️ Non-JSON line skipped: ${trimmed}`);
          continue;
        }

        logMessage(`📤 Raw chunk: ${decoder.decode(value)}`);

        try {
          const json = JSON.parse(trimmed);
          if (json.status) logMessage(`🔁 Ollama pull status: ${json.status}`);
          if (json.completed) logMessage(`✅ LLM model "${model}" pulled successfully.`);
        } catch (e) {
          logMessage(`❌ Invalid JSON line: ${trimmed}`);
        }
      }
    }
  } catch (error) {
    logMessage(`❌ Error pulling LLM model via Ollama API: ${error}`);
  }
}


export async function queryOllamaModel(prompt: string, model: string): Promise<string> {
  try {
    const response = await fetch("http://wa-ollama:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: true }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      logMessage(`❌ Ollama query failed: ${text}`);
      throw new Error(`Ollama model execution failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let output = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(line => line.trim() !== "");

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.response) {
            output += json.response;
          }
        } catch (e) {
          logMessage(`⚠️ Invalid JSON line from Ollama: ${line}`);
        }
      }
    }

    logMessage(`🧠 Final LLM response: ${output}`);
    return output.trim();

  } catch (error) {
    logMessage(`❌ Ollama Error: ${error}`);
    throw new Error(`Ollama Error: ${error}`);
  }
}

