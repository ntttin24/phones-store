import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function connectDB() {

  const url =
    "mongodb+srv://tin3519237:tin3519237@cluster0.1dmqphg.mongodb.net/shop?retryWrites=true&w=majority&appName=Cluster0";
  try {
    await mongoose.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
    });
    console.log("connected to db");
  } catch (error) {
    console.log(error);
  }
}

export default connectDB;
