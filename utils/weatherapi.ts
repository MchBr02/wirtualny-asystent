export async function getWeather(location: string): Promise<any> {
    const API_KEY = Deno.env.get("WEATHERAPI_KEY");
    if (!API_KEY) {
        throw new Error("WeatherAPI key is missing. Set WEATHERAPI_KEY in environment variables.");
    }

    const url = `https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${encodeURIComponent(location)}&aqi=no`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
            location: `${data.location.name}, ${data.location.country}`,
            temperature: `${data.current.temp_c}°C`,
            condition: data.current.condition.text,
            icon: data.current.condition.icon,
            wind: `${data.current.wind_kph} km/h`,
            humidity: `${data.current.humidity}%`,
        };
    } catch (error) {
        console.error("Error fetching weather data:", error);
        return { error: "Failed to fetch weather data." };
    }
}
