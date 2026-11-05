import express from 'express'
import cors from 'cors'
import { MongoClient, ObjectId } from 'mongodb'
import 'dotenv/config'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const PORT = process.env.PORT || 5000

const app = express()
app.use(cors())

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

const verifyApi = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Unauthorized: No token provided' })
  }
  const token = authHeader.split(' ')[1]

  const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
  )

  try {
    const { payload } = await jwtVerify(token, JWKS)
    next()
  } catch (error) {
    return res.status(401).send({ message: 'Unauthorized: Invalid token' })
  }
}

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
const borrowsCollection = db.collection('borrows')

app.post('/books', verifyApi, async (req, res) => {
  const books = {
    ...req.body,
    copies: Math.max(0, Number(req.body.copies) || 0)
  }
  const result = await allBooksCollection.insertOne(books)
  res.send(result)
})

app.get('/allBooks', async (req, res) => {
  const result = await allBooksCollection.find({}).toArray()
  res.send(result)
})

app.get('/', (req, res) => {
  res.send('BookNook Backend Server is running successfully! ')
})

app.get('/latest-books', async (req, res) => {
  const result = await allBooksCollection
    .find({})
    .sort({ addedDate: -1 })
    .limit(6)
    .toArray()
  res.send(result)
})

app.get('/books/:id', verifyApi, async (req, res) => {
  const id = req.params.id
  const query = { _id: new ObjectId(id) }
  const result = await allBooksCollection.findOne(query)
  res.send(result)
})

app.get('/books/category/:categoryName', async (req, res) => {
  const categoryName = req.params.categoryName
  const query = { category: categoryName }
  const result = await allBooksCollection.find(query).toArray()
  res.send(result)
})

app.get('/my-books', async (req, res) => {
  const email = req.query.email
  const query = { userEmail: email }
  const result = await allBooksCollection.find(query).toArray()
  res.send(result)
})

app.put('/books/:id', async (req, res) => {
  const id = req.params.id
  const updatedBook = req.body
  const filter = { _id: new ObjectId(id) }
  const updateDoc = {
    $set: {
      title: updatedBook.title,
      author: updatedBook.author,
      category: updatedBook.category,
      copies: updatedBook.copies,
      image: updatedBook.image,
      description: updatedBook.description
    }
  }
  const result = await allBooksCollection.updateOne(filter, updateDoc)
  res.send(result)
})

app.delete('/books/:id', verifyApi, async (req, res) => {
  const id = req.params.id
  const query = { _id: new ObjectId(id) }
  const result = await allBooksCollection.deleteOne(query)
  res.send(result)
})

app.post('/borrows', async (req, res) => {
  const borrowData = req.body
  if (!borrowData.bookId || !borrowData.userEmail) {
    return res.status(400).send({ message: 'Invalid borrow request' })
  }

  const existingBorrow = await borrowsCollection.findOne({
    bookId: borrowData.bookId,
    userEmail: borrowData.userEmail
  })
  if (existingBorrow) {
    return res
      .status(409)
      .send({ message: 'You have already borrowed this book' })
  }

  let bookObjectId
  try {
    bookObjectId = new ObjectId(borrowData.bookId)
  } catch {
    return res.status(400).send({ message: 'Invalid book' })
  }

  const availableBook = await allBooksCollection.findOneAndUpdate(
    { _id: bookObjectId, copies: { $gt: 0 } },
    { $inc: { copies: -1 } },
    { returnDocument: 'after' }
  )
  if (!availableBook) {
    return res.status(409).send({ message: 'This book is not available' })
  }

  const result = await borrowsCollection.insertOne(borrowData)
  res.send(result)
})

app.get('/borrows', async (req, res) => {
  const email = req.query.email
  const query = email ? { userEmail: email } : {}
  const result = await borrowsCollection.find(query).toArray()
  res.send(result)
})

app.delete('/borrows/:id', async (req, res) => {
  const id = req.params.id
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: 'Invalid borrow record' })
  }
  const query = { _id: new ObjectId(id) }
  const borrow = await borrowsCollection.findOne(query)
  if (!borrow) {
    return res.status(404).send({ message: 'Borrow record not found' })
  }

  const result = await borrowsCollection.deleteOne(query)
  if (result.deletedCount > 0 && borrow.bookId) {
    if (ObjectId.isValid(borrow.bookId)) {
      await allBooksCollection.updateOne(
        { _id: new ObjectId(borrow.bookId) },
        { $inc: { copies: 1 } }
      )
    }
  }
  res.send(result)
})

app.patch('/books/:id', verifyApi, async (req, res) => {
  const id = req.params.id
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: 'Invalid Book ID' })
  }

  const { type, rating, comment, quoteText, userName, userEmail } = req.body
  const filter = { _id: new ObjectId(id) }

  if (type === 'review') {
    const newReview = {
      rating: Number(rating) || 5,
      comment: String(comment || '').trim(),
      userName,
      userEmail,
      createdAt: new Date().toISOString()
    }
    const result = await allBooksCollection.updateOne(filter, {
      $push: { reviews: newReview }
    })
    return res.send({
      success: true,
      message: 'Review added successfully',
      result
    })
  }

  if (type === 'quote') {
    const newQuote = {
      quoteText: String(quoteText || '').trim(),
      userName,
      userEmail,
      createdAt: new Date().toISOString()
    }
    const result = await allBooksCollection.updateOne(filter, {
      $push: { quotes: newQuote }
    })
    return res.send({
      success: true,
      message: 'Quote added successfully',
      result
    })
  }

  res.status(400).send({ message: 'Invalid update type' })
})

app.listen(PORT, () => {
  console.log(`Server is running on the port ${PORT}`)
})

export default app
