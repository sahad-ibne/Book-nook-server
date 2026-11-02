import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import 'dotenv/config'

const PORT = process.env.PORT || 5000
const app = express()
// app.use(cors());
app.use(express.json())

const client = new MongoClient(process.env.MONGO_URI)
export async function connectToMongoDB () {
  try {
    await client.connect()
    console.log('You successfully connected to MongoDB!')
    return client
  } catch (err) {
    console.dir(err)
  }
}

const connectClient = await connectToMongoDB()
const db = connectClient.db('Book-nook-server')
const allBooksCollection = db.collection('allBooks')

app.get('/allBooks', async (req, res) => {
  const result = await allBooksCollection.find({}).toArray()
  res.send(result)
})

app.listen(PORT, () => {
  console.log(`Server is running on the port ${PORT}`)
})
