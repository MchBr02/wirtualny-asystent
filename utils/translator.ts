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
