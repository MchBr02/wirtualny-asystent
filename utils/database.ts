// database.ts

import { MongoClient, Database } from "https://deno.land/x/mongo/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";
import { hashPassword } from "./encoding.ts";

import { logMessage } from "./logger.ts";

const { MONGO_ADMIN_USER, MONGO_ADMIN_PASS, MONGO_DB_NAME } = config();

export async function connectToDatabase(): Promise<Database> {
  try {
    const client = new MongoClient();
    await client.connect(`mongodb://${MONGO_ADMIN_USER}:${MONGO_ADMIN_PASS}@localhost:27017/admin?authSource=admin`);

    const db = client.database(MONGO_DB_NAME || "test");

    logMessage("✅ Connected to MongoDB.");

    // ✅ Check if 'users' collection exists, create it if missing
    await checkUsersDatabase(db);

    return db;
  } catch (error) {
    logMessage(`❌ Error connecting to database: ${error}`);
    throw new Error("Database connection failed.");
  }
}

export async function logMessageToDB(db: Database, message: object): Promise<void> {
  try {
    const messagesCollection = db.collection("messages");
    await messagesCollection.insertOne(message);
    logMessage(`✅ Message logged to MongoDB.`);
    // console.log("✅ Message logged to MongoDB.");
  } catch (error) {
    logMessage(`❌ Error logging message to MongoDB: ${error}`);
    // console.error("❌ Error logging message to MongoDB:", error);
  }
}

export async function saveMessageToDB(
  db: Database,
  id: string,
  timestamp: Date,
  content: string,
  sender: string,
  receiver: string,
  platform: string
): Promise<void> {
  if (!content.trim()) return; // Ignore empty messages

  const messageData = {
    message_id: id,
    timestamp,
    content,
    sender,
    receiver,
    platform,
  };

  await logMessageToDB(db, messageData);
}

export async function fetchMessages(db: Database) {
  const messagesCollection = db.collection("messages");
  return await messagesCollection.find({}, { sort: { timestamp: -1 }, limit: 100 }).toArray();
}


/**
 * Checks if the 'users' collection exists and ensures it's properly set up.
 * Additionally, checks if an admin user exists and creates one if not.
 */
export async function checkUsersDatabase(db: Database): Promise<void> {
  try {
    // Check if the 'users' collection exists
    const collections = await db.listCollections().toArray();
    const usersCollectionExists = collections.some(col => col.name === "users");

    if (!usersCollectionExists) {
      logMessage("⚠️ 'users' collection not found. Creating...");
      await db.createCollection("users");
      logMessage("✅ 'users' collection created successfully.");
    } else {
      logMessage("✅ 'users' collection exists.");
    }

    // Check if the admin user exists
    const usersCollection = db.collection("users");
    const adminUser = await usersCollection.findOne({ login: "admin" });

    if (!adminUser) {
      logMessage("⚠️ Admin user not found. Creating default admin user...");
      await usersCollection.insertOne({
        user_id: crypto.randomUUID(),
        login: "admin",
        password: await hashPassword("admin123"), // Default admin password (hashed)
        email: "admin@example.com",
        links: {} // Initialize as an empty object for future flexibility
      });
      logMessage("🔹 Default admin user created: login: 'admin', password: 'admin123'.");
    } else {
      logMessage("✅ Admin user already exists.");
    }
  } catch (error) {
    logMessage(`❌ Error checking or creating 'users' collection or admin user: ${error}`);
    throw new Error("Database check failed.");
  }
}


export async function linkDiscordToUser(db: Database, userId: string, discordId: string) {
  const usersCollection = db.collection("users");
  await usersCollection.updateOne({ user_id: userId }, { $set: { discord_id: discordId } });
}

export async function findUserByDiscordId(db: Database, discordId: string) {
  const usersCollection = db.collection("users");
  return await usersCollection.findOne({ discord_id: discordId });
}
