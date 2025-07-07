const db = require('../config/connection')
const collection = require('../config/collections')
const bcrypt = require('bcrypt')
const { ObjectId } = require('mongodb')
const { get } = require('http')
module.exports = {
    doSignup: (userData) => {
        return new Promise(async(resolve, reject) => {
            try {
                if (!userData.Password) {
                    throw new Error('Password is required')
                }
                userData.Password = await bcrypt.hash(userData.Password, 10)
                userData.joinDate = new Date()
                const result = await db.get().collection(collection.USER_COLLECTION).insertOne(userData)
                resolve({ ...userData, _id: result.insertedId })
            } catch (error) {
                reject(error)
            }
        })
    },
    doLogin: (userData) => {
        return new Promise(async(resolve, reject) => {
            let loginStatus = false
            let response = {}
            let user=await db.get().collection(collection.USER_COLLECTION).findOne({Email:userData.Email})
            if(user){
                bcrypt.compare(userData.Password,user.Password).then((status)=>{
                    if(status){
                        console.log("Login Success")
                        response.user=user
                        response.status=true
                        resolve(response)
                    }else{
                        console.log('Login Failed')
                        resolve({status:false})
                    }
                })
            }else{
                console.log('User not found')
                resolve({status:false})
            }
        })
    },
    addToCart: (productId, userId) => {
        let productObject = {
            item: new ObjectId(productId),
            quantity: 1
        }
        return new Promise(async(resolve, reject) => {
            let userCart=await db.get().collection(collection.CART_COLLECTION).findOne({user:new ObjectId(userId)})
            if(userCart){
                let productExist=userCart.products.findIndex(product=>product.item==productId)
                console.log(productExist);
                if(productExist!=-1){
                    db.get().collection(collection.CART_COLLECTION)
                    .updateOne({user:new ObjectId(userId),'products.item': new ObjectId(productId)},
                    {
                        $inc:{'products.$.quantity':1}
                    }
                    ).then(()=>{
                        resolve()
                    })
                }else{
                db.get().collection(collection.CART_COLLECTION).updateOne({user:new ObjectId(userId)},
                {
                        $push:{products:productObject}
                }
            ).then((response) => {
                    resolve(response)
                })
                }
            }else {
                let cartObj={
                    user:new ObjectId(userId),
                    products:[productObject]
                }
                db.get().collection(collection.CART_COLLECTION).insertOne(cartObj).then((response) => {
                    resolve(response)
                })
            }
        })
    },
    getCartProducts: (userId) => {
        return new Promise(async(resolve, reject) => {
            try {
                let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
                    {
                        $match: { user: new ObjectId(userId) }
                    },
                     {
                         $unwind: '$products'
                     },
                     {
                        $project:{
                            item:'$products.item',
                            quantity:'$products.quantity'
                        }
                     },
                     {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: 'item',
                            foreignField:'_id',
                            as:'product'
                        }
                     },
                     {
                        $project:{
                            item:1,quantity:1,product:{$arrayElemAt:['$product',0]}
                        }
                     }
                ]).toArray()
                resolve(cartItems)
            } catch (error) {
                reject(error)
            }
        })
    },
    getCartTotal: (userId) => {
        return new Promise(async(resolve, reject) => {
            try {
                const cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
                    {
                        $match: { user: new ObjectId(userId) }
                    },
                    {
                        $unwind: '$products'
                    },
                    {
                        $project: {
                            item: '$products.item',
                            quantity: '$products.quantity'
                        }
                    },
                    {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: 'item',
                            foreignField: '_id',
                            as: 'product'
                        }
                    },
                    {
                        $project: {
                            quantity: 1,
                            price: { $arrayElemAt: ['$product.price', 0] }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: { $multiply: ['$quantity', '$price'] } }
                        }
                    }
                ]).toArray()
                
                resolve(cartItems.length > 0 ? cartItems[0].total : 0)
            } catch (error) {
                reject(error)
            }
        })
    },
    removeFromCart: (productId, userId) => {
        return new Promise(async(resolve, reject) => {
            try {
                const result = await db.get().collection(collection.CART_COLLECTION)
                    .updateOne(
                        { user: new ObjectId(userId) },
                        { $pull: { products: { item: new ObjectId(productId) } } }
                    )
                resolve(result)
            } catch (error) {
                reject(error)
            }
        })
    },
    getCartCount: (userId) => {
        return new Promise(async(resolve, reject) => {
            try {
                let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new ObjectId(userId) })
                let count = 0
                if (cart) {
                    count = cart.products.length
                }
                resolve(count)
            } catch (error) {
                reject(error)
            }
        })
    },
    changeProductQuantity:(details) => {
        details.count = parseInt(details.count)
        return new Promise((resolve, reject) => {
            try {
                db.get().collection(collection.CART_COLLECTION)
                    .updateOne(
                        {_id: new ObjectId(details.cartItemId), 'products.item': new ObjectId(details.productId)},
                        {$inc: {'products.$.quantity': details.count}}
                    ).then((response) => {
                        resolve({status: true})
                    })
            } catch (error) {
                reject(error)
            }
        })
    },

    placeOrder: (orderData) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Get cart items
                const cart = await db.get().collection(collection.CART_COLLECTION)
                    .findOne({ user: new ObjectId(orderData.userId) });
                
                if (!cart || !cart.products || cart.products.length === 0) {
                    throw new Error('Cart is empty');
                }

                // Get products with details
                const cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
                    {
                        $match: { user: new ObjectId(orderData.userId) }
                    },
                    {
                        $unwind: '$products'
                    },
                    {
                        $project: {
                            item: '$products.item',
                            quantity: '$products.quantity'
                        }
                    },
                    {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: 'item',
                            foreignField: '_id',
                            as: 'product'
                        }
                    },
                    {
                        $project: {
                            item: 1,
                            quantity: 1,
                            product: { $arrayElemAt: ['$product', 0] }
                        }
                    }
                ]).toArray();

                // Calculate total amount
                const totalAmount = cartItems.reduce((total, item) => {
                    return total + (item.quantity * item.product.price);
                }, 0);

                // Create order object
                const order = {
                    userId: new ObjectId(orderData.userId),
                    products: cartItems,
                    deliveryDetails: orderData.deliveryDetails,
                    paymentMethod: orderData.paymentMethod,
                    totalAmount: totalAmount,
                    status: 'Pending',
                    date: new Date()
                };

                // Insert order
                const result = await db.get().collection(collection.ORDER_COLLECTION).insertOne(order);

                // Clear user's cart
                await db.get().collection(collection.CART_COLLECTION)
                    .deleteOne({ user: new ObjectId(orderData.userId) });

                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    },
    getTotalAmount: (userId) => {
        return new Promise(async(resolve, reject) => {
            try {
                let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
                    {
                        $match: { user: new ObjectId(userId) }
                    },
                     {
                         $unwind: '$products'
                     },
                     {
                        $project:{
                            item:'$products.item',
                            quantity:'$products.quantity'
                        }
                     },
                     {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: 'item',
                            foreignField:'_id',
                            as:'product'
                        }
                     },
                     {
                        $project:{
                            item:1,quantity:1,product:{$arrayElemAt:['$product',0]}
                        }
                     },
                     {
                        $group:{
                            _id:null,
                            total:{$sum:{$multiply:['$quantity','$product.price']}}
                        }
                     }
                ]).toArray()
                
                resolve(total[0]?.total || 0)
            } catch (error) {
                reject(error)
            }
        })
    },
    getUserOrders: (userId) => {
        return new Promise(async (resolve, reject) => {
            try {
                const orders = await db.get().collection(collection.ORDER_COLLECTION)
                    .aggregate([
                        {
                            $match: { userId: new ObjectId(userId) }
                        },
                        {
                            $lookup: {
                                from: collection.PRODUCT_COLLECTION,
                                localField: 'products.item',
                                foreignField: '_id',
                                as: 'productDetails'
                            }
                        },
                        { $sort: { date: -1 } }
                    ]).toArray();
    
                // Process orders to include product details
                orders.forEach(order => {
                    order.date = new Date(order.date).toLocaleDateString();
                    order.products = order.products.map(prod => ({
                        quantity: prod.quantity,
                        product: order.productDetails.find(p => p._id.toString() === prod.item.toString())
                    }));
                    delete order.productDetails;
                });
    
                resolve(orders);
            } catch (error) {
                reject(error);
            }
        });
    },
    getCartCount: (userId) => {
        return new Promise(async(resolve, reject) => {
            try {
                let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new ObjectId(userId) })
                let count = 0
                if (cart) {
                    count = cart.products.length
                }
                resolve(count)
            } catch (error) {
                reject(error)
            }
        })
    },
    changeProductQuantity:(details) => {
        details.count = parseInt(details.count)
        return new Promise((resolve, reject) => {
            try {
                db.get().collection(collection.CART_COLLECTION)
                    .updateOne(
                        {_id: new ObjectId(details.cartItemId), 'products.item': new ObjectId(details.productId)},
                        {$inc: {'products.$.quantity': details.count}}
                    ).then((response) => {
                        resolve({status: true})
                    })
            } catch (error) {
                reject(error)
            }
        })
    },

    placeOrder: (orderData) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Get cart items
                const cart = await db.get().collection(collection.CART_COLLECTION)
                    .findOne({ user: new ObjectId(orderData.userId) });
                
                if (!cart || !cart.products || cart.products.length === 0) {
                    throw new Error('Cart is empty');
                }

                // Get products with details
                const cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
                    {
                        $match: { user: new ObjectId(orderData.userId) }
                    },
                    {
                        $unwind: '$products'
                    },
                    {
                        $project: {
                            item: '$products.item',
                            quantity: '$products.quantity'
                        }
                    },
                    {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: 'item',
                            foreignField: '_id',
                            as: 'product'
                        }
                    },
                    {
                        $project: {
                            item: 1,
                            quantity: 1,
                            product: { $arrayElemAt: ['$product', 0] }
                        }
                    }
                ]).toArray();

                // Calculate total amount
                const totalAmount = cartItems.reduce((total, item) => {
                    return total + (item.quantity * item.product.price);
                }, 0);

                // Create order object
                const order = {
                    userId: new ObjectId(orderData.userId),
                    products: cartItems,
                    deliveryDetails: orderData.deliveryDetails,
                    paymentMethod: orderData.paymentMethod,
                    totalAmount: totalAmount,
                    status: 'Pending',
                    date: new Date()
                };

                // Insert order
                const result = await db.get().collection(collection.ORDER_COLLECTION).insertOne(order);

                // Clear user's cart
                await db.get().collection(collection.CART_COLLECTION)
                    .deleteOne({ user: new ObjectId(orderData.userId) });

                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    },
    getTotalAmount: (userId) => {
        return new Promise(async(resolve, reject) => {
            try {
                let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
                    {
                        $match: { user: new ObjectId(userId) }
                    },
                     {
                         $unwind: '$products'
                     },
                     {
                        $project:{
                            item:'$products.item',
                            quantity:'$products.quantity'
                        }
                     },
                     {
                        $lookup: {
                            from: collection.PRODUCT_COLLECTION,
                            localField: 'item',
                            foreignField:'_id',
                            as:'product'
                        }
                     },
                     {
                        $project:{
                            item:1,quantity:1,product:{$arrayElemAt:['$product',0]}
                        }
                     },
                     {
                        $group:{
                            _id:null,
                            total:{$sum:{$multiply:['$quantity','$product.price']}}
                        }
                     }
                ]).toArray()
                
                resolve(total[0]?.total || 0)
            } catch (error) {
                reject(error)
            }
        })
    },
    removeOrder: (orderId, userId) => {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await db.get().collection(collection.ORDER_COLLECTION)
                    .deleteOne({
                        _id: new ObjectId(orderId),
                        userId: new ObjectId(userId)
                    });
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }
}
