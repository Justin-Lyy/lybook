const express = require('express')
const User = require('../models/user')
const Item = require('../models/item')
const router = express.Router()

router.get('/', (req, res, next)=> {
    res.send('this route requires a token')
})

router.get("/dashboard/", (req, res)=> {
    const id = req.user._id

    User.findById(id)
        .populate('items')
        .exec((err, user) => {
            if (err) { return next(err)}

            res.send(user.items)
        })

})

router.put("/addItem/", (req, res, next)=> {

    if (!req.body.itemid) return res.status(400).json({msg: `No item id sent`})

    Item.findById(req.body.itemid)
        .exec( (err, match)=> {
            if (err) return next(err)
            if (match === undefined || match === null) return res.status(404).json({msg: `Couldn't find the item you wanted to add`})

            if (req.user.items.includes(match._id)) {
                return res.json({msg: `You have already added this item`})
            }            

            req.user.items.push(match)
            req.user.save((err)=> {
                if (err) return next(err)

                return res.json({msg: 'added the item'})
            })
        })
})

router.put("/removeItem/", (req, res)=> {
    if (!req.body.itemid) return res.status(400).json({msg: `No item id sent`})

    if (req.user.items.includes(req.body.itemid) === false) {
        return res.status(406).json({msg: `The authenticated user is not tracking this item`})
    }     

    req.user.items.pull(req.body.itemid)
    req.user.save((err)=> {
        if (err) return next(err)

        return res.json({id: req.body.itemid})
    })
})

module.exports = router