import mongoose from 'mongoose'

const resolveMongoUri = () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI

  if (typeof uri !== 'string' || uri.trim().length === 0) {
    throw new Error('MongoDB URI is missing. Set MONGODB_URI in backend/.env (or MONGO_URI).')
  }

  return uri.trim()
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(resolveMongoUri())

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    process.exit(1)
  }
}

export default connectDB
