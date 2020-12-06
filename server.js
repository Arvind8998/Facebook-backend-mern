import express from 'express';
import cors from 'cors';
import multer from 'multer';
import GridFsStorage from 'multer-gridfs-storage';
import Grid from 'gridfs-stream';
import bodyParser from 'body-parser';
import path from 'path';
import Pusher from 'pusher';
import mongoose from 'mongoose';

import mongoPosts from './postModel.js';

Grid.mongo = mongoose.mongo

// app config
const app = express();
const port = process.env.PORT || 9000
const pusher = new Pusher({
    appId: "1118658",
    key: "ca1418f90778bb8f1d38",
    secret: "89d4de1622e66034f0b9",
    cluster: "ap2",
    useTLS: true
  });

//middlewares
app.use(bodyParser.json());
app.use(cors())

//db config
const  mongoUri = 'mongodb+srv://admin:K5xFKwjmOciYCW68@cluster0.zlzg9.mongodb.net/facebook-db?retryWrites=true&w=majority'

const conn = mongoose.createConnection(mongoUri, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
})

let gfs;
mongoose.connection.once('open',()=>{
    const changeStream  = mongoose.connection.collection('posts').watch();
    changeStream.on('change',(change)=>{
        console.log(change)
        if(change.operationType === 'insert'){
            console.log('Triggering Pusher')
            pusher.trigger('posts','inserted',{
                change:change
            })
        }
        else{
            console.log('Error trigerring pusher')
        }
    })
})

conn.once('open',()=>{
    console.log('DB Connected')

    gfs =  Grid(conn.db, mongoose.mongo)
    gfs.collection('images')
})

const storage = new GridFsStorage({
    url: mongoUri,
    file: (req,file)=>{
        return new Promise((resolve,reject)=>{
            const filename = `image-${Date.now()}${path.extname(file.originalname)}`

            const fileInfo = {
                filename: filename,
                bucketName: 'images'
            };

            resolve(fileInfo)
        })
    }
})

const upload = multer({storage});

mongoose.connect(mongoUri,{
    useCreateIndex: true,
    useNewUrlParser:true,
    useUnifiedTopology:true
})

//api routes
app.get('/',(req,res)=>{
    return res.status(200).send('hello world')
})

app.post('/upload/image',upload.single('file'), (req,res)=>{
    return res.status(201).send(req.file)
})

app.post('/upload/post',(req,res)=>{
    const dbPost = req.body

    mongoPosts.create(dbPost, (err,data)=>{
        if(err){
            res.status(500).send(err)
        }
        else{
            res.status(201).send(data)
        }
    })
})

app.get('/retrieve/posts',(req,res)=>{
    mongoPosts.find((err,data)=>{
        if(err){
            res.status(500).send(err)
        }
        else{
            data.sort((b,a)=>{
                return a.timestamp - b.timestamp
            })
            res.status(200).send(data)
        }
    })
})

app.get('/retrieve/images/single', (req,res)=>{
    gfs.files.findOne({filename: req.query.name}, (err,file)=>{
        if(err){
            res.status(500).send(err)
        }
        else{
            if(!file || file.length === 0 ){
                res.status(404).json({err: 'file not found'})
            }
            else{
                const readStream = gfs.createReadStream(file.filename)
                readStream.pipe(res)
            }
        }
    })
})

//listener
app.listen(port,()=>console.log(`listening on port ${port}`))