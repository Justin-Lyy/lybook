const express = require('express')
const puppeteer = require('puppeteer')
const Item = require('../models/item')
const User = require('../models/user')
const scraper = require('../scraper/scraper')

const router = express.Router()

router.get('/:id', async (req, res, next)=> {

    if (!req.user.items.includes(req.params.id)) return res.status(403).json({msg: 'You cannot view items you are not tracking'})

    Item.findById(req.params.id)
        .exec( (err, itemMatch)=> {
            if (err) return next(err)

            if (!itemMatch) return res.status(404).json({msg: "Couldn't find the item you were looking for"})

            return res.json(itemMatch)
        })
})

router.post('/newItem', async (req, res, next)=> {
    const {asin, name, link} = req.body

    if (asin === undefined
        || name === undefined
        || link === undefined) 
        
        return res.status(400).send(`Missing information`)

    const browser = await puppeteer.launch()
    const page = await browser.newPage()

    Item.findOne({ASIN: asin}).exec(async (err, match) => {

        if (match !== null) {
            return res.json({item: match, msg: "This item has already been tracked, importing history..."})
        }

        let imgLink = null
        try {
            await page.goto(link)
            const [el] = await page.$x('//*[@id="landingImage"]')
            const src = await el.getProperty('src')
            imgLink = await src.jsonValue()

            await browser.close()
        } catch (error) {
            console.error(error)
            return res.status(404).json({msg: 'bad link'})
        }
    
        const newItem = new Item({
            name: name,
            ASIN: asin,
            link: link,
            image: imgLink
        }).save(async (error, doc)=> {
            if (error) return next(err)
            await scraper.scrapeItem(doc)
            return res.json({item: doc, msg: "Created a new item, initializing history..."})
        })
    })
})

router.put('/update', async(req, res, next)=> {
    if (!req.body.newLink) return res.status(400).json({msg: `No new link sent`})

    const browser = await puppeteer.launch()
    const page = await browser.newPage()

    try {
        await page.goto(link)
    } catch (err) {
        return res.status(404).json({msg: `Couldn't find the page you were looking for`})
    }

    Item.findOneAndUpdate({_id: req.body.itemid}, {link: req.body.newLink})
        .exec( err => {
            if (err) return next(err)

            return res.json({msg: 'Item updated'})
        })
}) 

router.delete('/deleteItem', async (req, res, next)=> {
    if (!req.body.itemid) return res.status(400).json({msg: `No item id sent`})

    Promise.all([
        User.findOne({ items: req.body.itemid}),
        Item.findById(req.body.itemid)
    ]).then ( async ([userMatch, itemMatch])=> {

        if (!itemMatch) {
            return res.status(406).json({msg: `Couldn't find an item with id ${req.body.itemid}`})
        }
        if (!userMatch) {
            await Item.deleteOne({_id: req.body.itemid})
            return res.json({msg: `Deleted item with id ${req.body.itemid}`})
        }

        return res.status(406).json({msg: 'This item is currently being tracked by one or more users, delete request refused'})
    }).catch ((err) =>{
        next(err)
    })
})

module.exports = router