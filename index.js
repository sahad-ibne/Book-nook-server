import express from 'express'
import cors from 'cors'

const PORT = process.env.PORT || 5000
const app = express()
// app.use(cors());
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Book nook server is running')
})

app.listen(PORT, () => {
  console.log(`Server is running on the port ${PORT}`)
})
