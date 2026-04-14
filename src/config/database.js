import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDatabase = async () => {
  
  try {
    await mongoose.connect(env.mongodbUri);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

