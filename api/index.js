const app = require('express')();
const { v4 } = require('uuid');
const axios = require("axios");
const mongoist = require("mongoist");


const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@newonce.ksdr0.mongodb.net/Artists?retryWrites=true&w=majority`

let db = global.mongo

if (!db) {
    console.log('znowu');
    db = global.mongo =  mongoist(uri);
}

app.get('/api', (req, res) => {
    const path = `/api/item/${v4()}`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate');
    res.end(`Hello! Go to item: <a href="${path}">${path}</a>`);
});

app.get('/api/item/:slug', (req, res) => {
    const { slug } = req.params;
    res.end(JSON.stringify(process.env));
});


/* GET users listing. */
app.get('/api/now-playing', async function(req, res) {
    try {
        const response = await axios.get('https://www.newonce.net/api/radio_now_playing');
        console.log(uri);
        if (!response.data.artist) {
            res.send(response.data);
            return;
        }
        const artist = await db.Artists.findOne({name: response.data.artist});
        res.send({...response.data, donateEnabled: !!artist});
    } catch (e) {
        console.log(e)
        res.status(500);
        res.send(e);
    }
});


module.exports = app;
