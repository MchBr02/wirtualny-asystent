// translator.ts

import { logMessage } from "./logger.ts";

// export async function handleTranslation(message: string, defaultLanguage: string) {
//     try {
//         const detectedLanguage = await detectLanguage(message);
        
//         if (!detectedLanguage) {
//             logMessage("Error detecting language.");
//             return null;
//         }
        
//         logMessage(`Detected language: ${detectedLanguage}`);
        
//         if (detectedLanguage !== defaultLanguage) {
//             const translatedMessage = await translateText(message, defaultLanguage) || message;
//             logMessage(`Translated message: ${translatedMessage}`);
//             return translatedMessage;
//         }
        
//         return message;
//     } catch (err: unknown) {
//         if (err instanceof Error) {
//             logMessage(`Translation error: ${err.message}`);
//         } else {
//             logMessage("Translation error: Unknown error occurred.");
//         }
//         return null;
//     }
// }

const detectLanguage = async (text: string): Promise<string | null> => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // deno-lint-ignore no-explicit-any
        const data: { [key: string]: any } = await response.json();
        return data[2]; // Language detected
    } catch (error) {
        console.error("Error detecting language:", error);
        return null;
    }
};

const translateText = async (text: string, targetLang: string = "en"): Promise<string | null> => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // deno-lint-ignore no-explicit-any
        const data: { [key: string]: any } = await response.json();
        // deno-lint-ignore no-explicit-any
        return data[0].map((item: any) => item[0]).join(" ");
    } catch (error) {
        console.error("Error translating text:", error);
        return null;
    }
};

export { detectLanguage, translateText };