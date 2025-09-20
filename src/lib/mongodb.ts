import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache;
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;

// Game History Schema
const gameHistorySchema = new mongoose.Schema({
  matchId: { type: String, required: true },
  questions: [
    {
      id: String,
      text: String,
      option_a: String,
      option_b: String,
      option_c: String,
      option_d: String,
      correct_answer: String,
    },
  ],
  scores: [
    {
      userId: String,
      points: Number,
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

export const GameHistory =
  mongoose.models.GameHistory ||
  mongoose.model("GameHistory", gameHistorySchema);
