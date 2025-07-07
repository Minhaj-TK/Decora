var express = require('express');
var router = express.Router();
var productHelper = require('../helpers/product-helpers');
const { PRODUCT_COLLECTION } = require('../config/collections');

/* GET users listing. */
router.get('/', function(req, res) {
  res.redirect('/admin/home');
});

router.get('/view-all-products', async function(req, res) {
  try {
    const products = await productHelper.getAllProducts();
    res.render('admin/view-all-products', { admin: true, products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).send('Error loading products');
  }
});
router.get('/add-product', function (req, res) {
  res.render('admin/add-product')
})
router.post('/add-product', (req, res) => {
  try {
    const { name, category, price, description } = req.body;
    
    // Validate required fields
    if (!name || !category || !price || !description) {
      return res.status(400).send('All fields are required');
    }

    // Validate price is a number
    if (isNaN(parseFloat(price))) {
      return res.status(400).send('Price must be a valid number');
    }

    // Validate image exists
    if (!req.files || !req.files.image) {
      return res.status(400).send('Product image is required');
    }

    const image = req.files.image;
    
    // Validate image type
    if (!image.mimetype.startsWith('image/')) {
      return res.status(400).send('File must be an image');
    }

    // Create unique filename using timestamp
    const filename = Date.now() + '-' + image.name;
    
    // Move image to product-images directory
    image.mv('./public/product-images/' + filename, (err) => {
      if (err) {
        console.error('Error saving image:', err);
        return res.status(500).send('Error saving product image');
      }

      const product = {
        name,
        category,
        price: parseFloat(price),
        description,
        image: '/product-images/' + filename,
        createdAt: new Date()
      }

      productHelper.addProduct(product, (insertedId) => {
        res.redirect('/admin');
      });
    });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).send('Error adding product');
  }
})

router.get('/delete-product/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Get product details to delete image
    const products = await productHelper.getAllProducts();
    const product = products.find(p => p._id.toString() === productId);
    
    if (product && product.image) {
      // Delete image file
      const fs = require('fs');
      const imagePath = './public' + product.image;
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await productHelper.deleteProduct(productId);
    res.redirect('/admin');
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).send('Error deleting product');
  }
});

router.get('/edit-product/:id', async (req, res) => {
  try {
    const product = await productHelper.getProductById(req.params.id);
    res.render('admin/edit-product', { product, admin: true });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).send('Error fetching product');
  }
});

router.post('/edit-product/:id', (req, res) => {
  try {
    const productId = req.params.id;
    const { name, category, price, description } = req.body;
    
    // Validate required fields
    if (!name || !category || !price || !description) {
      return res.status(400).send('All fields are required');
    }

    // Validate price is a number
    if (isNaN(parseFloat(price))) {
      return res.status(400).send('Price must be a valid number');
    }

    const updateData = {
      name,
      category,
      price: parseFloat(price),
      description
    };

    // Handle image update if provided
    if (req.files && req.files.image) {
      const image = req.files.image;
      
      // Validate image type
      if (!image.mimetype.startsWith('image/')) {
        return res.status(400).send('File must be an image');
      }

      // Create unique filename using timestamp
      const filename = Date.now() + '-' + image.name;
      
      // Move image to product-images directory
      image.mv('./public/product-images/' + filename, async (err) => {
        if (err) {
          console.error('Error saving image:', err);
          return res.status(500).send('Error saving product image');
        }

        updateData.image = '/product-images/' + filename;
        
        try {
          await productHelper.updateProduct(productId, updateData);
          res.redirect('/admin');
        } catch (error) {
          console.error('Error updating product:', error);
          res.status(500).send('Error updating product');
        }
      });
    } else {
      // Update without changing the image
      productHelper.updateProduct(productId, updateData)
        .then(() => res.redirect('/admin'))
        .catch(error => {
          console.error('Error updating product:', error);
          res.status(500).send('Error updating product');
        });
    }
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).send('Error updating product');
  }
});

router.get('/home', function(req, res) {
  res.render('admin/home', { admin: true, isHome: true });
});

router.get('/view-all-orders', async function(req, res) {
  try {
    const db = require('../config/connection');
    const collection = require('../config/collections');
    const orders = await db.get().collection(collection.ORDER_COLLECTION)
      .aggregate([
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

    // Process orders to include product details and format date
    orders.forEach(order => {
      order.date = new Date(order.date).toLocaleDateString();
      order.products = order.products.map(prod => {
        const productDetail = order.productDetails.find(p => p._id.toString() === prod.item.toString());
        return {
          name: productDetail.name,
          price: productDetail.price,
          quantity: prod.quantity,
          image: productDetail.image,
          total: prod.quantity * productDetail.price
        };
      });
      delete order.productDetails;
    });

    res.render('admin/view-all-orders', { admin: true, isOrders: true, ordersList: orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.render('admin/view-all-orders', { admin: true, isOrders: true, error: 'Failed to load orders' });
  }
});

router.post('/update-order-status', async function(req, res) {
  try {
    const { orderId, status } = req.body;
    const db = require('../config/connection');
    const collection = require('../config/collections');
    const { ObjectId } = require('mongodb');
    
    await db.get().collection(collection.ORDER_COLLECTION).updateOne(
      { _id: new ObjectId(orderId) },
      { $set: { status: status } }
    );
    
    res.json({ status: true });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.json({ status: false, error: 'Failed to update order status' });
  }
});

router.get('/view-all-users', async function(req, res) {
  try {
    const db = require('../config/connection');
    const collection = require('../config/collections');
    const users = await db.get().collection(collection.USER_COLLECTION)
      .find()
      .sort({ joinDate: -1 })
      .toArray();

    res.render('admin/view-all-users', { admin: true, isUsers: true, usersList: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.render('admin/view-all-users', { admin: true, isUsers: true, error: 'Failed to load users' });
  }
});

router.delete('/remove-user/:id', async function(req, res) {
  try {
    const db = require('../config/connection');
    const collection = require('../config/collections');
    const { ObjectId } = require('mongodb');
    
    await db.get().collection(collection.USER_COLLECTION).deleteOne(
      { _id: new ObjectId(req.params.id) }
    );
    
    res.json({ status: true });
  } catch (error) {
    console.error('Error removing user:', error);
    res.json({ status: false, error: 'Failed to remove user' });
  }
});

router.get('/products', async function(req, res, next) {
  try {
    const products = await productHelper.getAllProducts();
    res.render('admin/view-all-products', { admin: true, products, isProducts: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
