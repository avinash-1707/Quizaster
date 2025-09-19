import mongoose from "mongoose";

const gameHistorySchema = new mongoose.Schema({
  matchId: { type: String, required: true },
  questions: [
    {
      id: String,
      text: String,
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
