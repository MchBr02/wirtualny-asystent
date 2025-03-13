import { MongoClient, Database } from "https://deno.land/x/mongo/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";

const { MONGO_ADMIN_USER, MONGO_ADMIN_PASS, MONGO_DB_NAME } = config();

export async function connectToDatabase(): Promise<Database> {
  const client = new MongoClient();
  await client.connect(`mongodb://${MONGO_ADMIN_USER}:${MONGO_ADMIN_PASS}@localhost:27017/admin?authSource=admin`);
  return client.database(MONGO_DB_NAME || "test");
}

export async function logMessageToDB(db: Database, message: any): Promise<void> {
  try {
    const messagesCollection = db.collection("messages");
    await messagesCollection.insertOne(message);
    console.log("Message logged to MongoDB.");
  } catch (error) {
    console.error("Error logging message to MongoDB:", error);
  }
}
