const app = require('express')();
const {v4} = require('uuid');
const axios = require("axios");
const mongoist = require("mongoist");
const bodyParser = require("body-parser");


const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@newonce.ksdr0.mongodb.net/Artists?retryWrites=true&w=majority`

let db = global.mongo

if (!db) {
    db = global.mongo = mongoist(uri);
}

// create application/json parser
const jsonParser = bodyParser.json()


app.get('/api', (req, res) => {
    const path = `/api/item/${v4()}`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate');
    res.end(`Hello! Go to item: <a href="${path}">${path}</a>`);
});

app.get('/api/item/:slug', (req, res) => {
    const {slug} = req.params;
    res.end(JSON.stringify(process.env));
});


app.post('/api/donate', jsonParser, async (req, res) => {
    try {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const {PAYU_CLIENT_ID, PAYU_CLIENT_SECRET} = process.env
        const {blikCode, artist, amount} = req.body;

        const artistObj = await db.Artists.findOne({name: artist});
        if(!artistObj){
            res.send('artist not donated');
            return;
        }

        if (!blikCode | !artist | !amount) {
            res.status(422);
            res.send('invalid parameters');
            return;
        }

        const authResponse = await axios.get(`https://merch-prod.snd.payu.com/pl/standard/oauth/authorize?client_id=${PAYU_CLIENT_ID}&client_secret=${PAYU_CLIENT_SECRET}&grant_type=trusted_merchant&email=akolbuszewski@gmail.com&ext_customer_id=blik-user-346d81f3-b679-40a1-b0e2-ceb102364a80`)
        const {access_token} = authResponse.data;

        const paymentObject = {
            "currencyCode": "PLN",
            "totalAmount": amount,
            "description": "TESTąćęłńóśóżźTEST!@#$%^&*()-=TEST_{{$guid}}",
            "notifyUrl": "http://test.merch.notifyUrl",
            "customerIp": ip,
            "merchantPosId": "426017",
            "products": [
                {
                    "name": "Wireless Mouse for Laptop",
                    "unitPrice": amount,
                    "quantity": "1"
                }
            ],
            "payMethods": {
                "payMethod": {
                    "type": "PBL",
                    "value": "blik",
                    "authorizationCode": blikCode
                }
            }
        }

        const response = await axios.post('https://merch-prod.snd.payu.com/api/v2_1/orders', paymentObject, {headers: { Authorization: `Bearer ${access_token}`}});
        //const resultUpdate = await db.Artists.update({name: artistObj.name}, {$inc: {donations: 1}}, {multi: true});


        res.send('ok');

    } catch (e) {
        console.error(e.response.data)
        res.send(e);
    }
})

/* GET users listing. */
app.get('/api/now-playing', async function (req, res) {
    try {
        const response = await axios.get('https://www.newonce.net/api/radio_now_playing');
        if (!response.data.artist) {
            res.send(response.data);
            return;
        }
        const artist = await db.Artists.findOne({name: response.data.artist});
        res.send({...response.data, donateEnabled: !!artist});
    } catch (e) {
        res.status(500);
        res.send(e);
    }
});


module.exports = app;
