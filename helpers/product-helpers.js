const db = require('../config/connection')
const collection = require('../config/collections')
const { ObjectId } = require('mongodb')

module.exports = {
    addProduct: (product, callback) => {
        db.get().collection(collection.PRODUCT_COLLECTION).insertOne(product).then((data) => {
            callback(data.insertedId)
        })
    },
    getAllProducts: () => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.PRODUCT_COLLECTION).find().toArray()
                .then((products) => {
                    resolve(products)
                })
                .catch((err) => {
                    reject(err)
                })
        })
    },
    deleteProduct: (productId) => {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await db.get().collection(collection.PRODUCT_COLLECTION)
                    .deleteOne({ _id: new ObjectId(productId) })
                resolve(result)
            } catch (err) {
                reject(err)
            }
        })
    },
    getProductById: (productId) => {
        return new Promise(async (resolve, reject) => {
            try {
                const product = await db.get().collection(collection.PRODUCT_COLLECTION)
                    .findOne({ _id: new ObjectId(productId) })
                resolve(product)
            } catch (err) {
                reject(err)
            }
        })
    },
    updateProduct: (productId, updateData) => {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await db.get().collection(collection.PRODUCT_COLLECTION)
                    .updateOne(
                        { _id: new ObjectId(productId) },
                        { $set: updateData }
                    )
                resolve(result)
            } catch (err) {
                reject(err)
            }
        })
    }
}
