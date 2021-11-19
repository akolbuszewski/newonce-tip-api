const app = require('express')();
const {v4} = require('uuid');
const axios = require("axios");
const mongoist = require("mongoist");
const bodyParser = require("body-parser");
const cors = require("cors");


const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@newonce.ksdr0.mongodb.net/Artists?retryWrites=true&w=majority`

let db = global.mongo

if (!db) {
    db = global.mongo = mongoist(uri);
}

// create application/json parser
const jsonParser = bodyParser.json()

app.use(cors());
app.get('/api', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate');
    res.end(`Hello! Go to : <a href="https://www.newonce.live/">our crazy page</a>`);
});


app.post('/api/donate', jsonParser, async (req, res) => {
    try {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const {PAYU_CLIENT_ID, PAYU_CLIENT_SECRET} = process.env
        const {blikCode, artist, amount} = req.body;

        const artistObj = await db.Artists.findOne({name: artist});


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
            "description": `Donation for ${artist}`,
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

        const response = await axios.post('https://merch-prod.snd.payu.com/api/v2_1/orders', paymentObject, {headers: {Authorization: `Bearer ${access_token}`}});
        if (!artistObj) {
            await db.Artists.insert({name: artist, donations: 1})
        } else {
            await db.Artists.update({_id: artistObj._id}, {$inc: {donations: 1}}, {multi: true});
        }

        res.send({status: 200});

    } catch (e) {
        if (axios.isAxiosError(e)) {
            console.error(e.response.data)
            res.send(e.response.data);
            return;
        }

        console.error(e)
        res.send(e.response.data);
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
        res.send({...response.data, numberOfDonations: (artist && artist.donations) || 0});
    } catch (e) {
        res.status(500);
        res.send(e);
    }
});


module.exports = app;
