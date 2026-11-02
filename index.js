import express from 'express'
import cors from 'cors'
import { MongoClient, ObjectId } from 'mongodb'
import 'dotenv/config'

const PORT = process.env.PORT || 5000
const app = express()
app.use(cors())
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

app.post('/books', async (req, res) => {
  const books = req.body
  const result = await allBooksCollection.insertOne(books)
  res.send(result)
})

app.get('/allBooks', async (req, res) => {
  const result = await allBooksCollection.find({}).toArray()
  res.send(result)
})

app.get('/latest-books', async (req, res) => {
  const result = await allBooksCollection
    .find({})
    .sort({ addedDate: -1 })
    .limit(6)
    .toArray()
  res.send(result)
})

app.get('/books/:id', async (req, res) => {
  const id = req.params.id
  const query = { _id: new ObjectId(id) }
  const result = await allBooksCollection.findOne(query)
  res.send(result)
})

app.listen(PORT, () => {
  console.log(`Server is running on the port ${PORT}`)
})
