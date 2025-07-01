var express = require('express');
var router = express.Router();
const productHelpers = require('../helpers/product-helpers');
const userHelpers = require('../helpers/user-helpers');
const { log } = require('console');

const verifyLogin = (req, res, next) => {
  if (req.session.loggedIn) {
    next()
  } else {
    res.redirect('/login')
  }
}

/* GET home page. */
router.get('/', async function (req, res, next) {
  let user = req.session.user
  console.log(user);
  let cartCount=null
  if(req.session.user){
  cartCount = await userHelpers.getCartCount(req.session.user._id)
  }
  productHelpers.getAllProducts().then((products) => {
    res.render('user/view-products', { products, user, cartCount })
  })
});

router.get('/login', (req, res) => {
  if (req.session.loggedIn) {
    res.redirect('/')
  } else {
    res.render('user/login', { "loginErr": req.session.loginErr })
    req.session.loginErr = false
  }
})

router.get('/signup', (req, res) => {
  res.render('user/signup')
})

router.post('/signup', (req, res) => {
  const { Name, Email, Password } = req.body;

  // Basic validation
  if (!Name || !Email || !Password) {
    return res.render('user/signup', {
      error: 'All fields are required',
      values: { Name, Email }
    });
  }

  if (Password.length < 6) {
    return res.render('user/signup', {
      error: 'Password must be at least 6 characters long',
      values: { Name, Email }
    });
  }

  userHelpers.doSignup(req.body).then((response) => {
    console.log(response);
    req.session.loggedIn=true
    req.session.user=response
    res.redirect('/')
    console.log('New user created:', response);
    res.render('user/login', { success: 'Account created successfully. Please login.' });
  }).catch(err => {
    console.error('Signup error:', err);
    res.render('user/signup', {
      error: err.message || 'Error creating account. Please try again.',
      values: { Name, Email }
    });
  })
})

router.post('/login', (req, res) => {
  userHelpers.doLogin(req.body).then((response) => {
    if (response.status) {
      req.session.loggedIn = true
      req.session.user = response.user
      res.redirect('/')
    } else {
      req.session.loginErr = true
      res.redirect('/login')
    }
  })
})

router.get('/logout', (req, res) => {
  req.session.destroy()
  res.redirect('/')
})

router.get('/cart',verifyLogin,async (req, res) => {
  try {
    let products = await userHelpers.getCartProducts(req.session.user._id)
    res.render('user/cart',{products,user:req.session.user})
  } catch (error) {
    console.error('Error fetching cart products:', error)
    res.render('user/cart',{error: 'Unable to fetch cart products', user:req.session.user})
  }
})

router.get('/get-cart-total', verifyLogin, async (req, res) => {
  try {
    const total = await userHelpers.getCartTotal(req.session.user._id);
    res.json({ total });
  } catch (error) {
    console.error('Error getting cart total:', error);
    res.status(500).json({ error: 'Error getting cart total' });
  }
});

router.get('/place-order', verifyLogin,async (req, res) => {
  let total=await userHelpers.getCartTotal(req.session.user._id)
  res.render('user/place-order', { total, user: req.session.user })
})

router.post('/place-order', verifyLogin, async (req, res) => {
  try {
    const { fullName, phone, address, city, pincode, paymentMethod } = req.body;
    const userId = req.session.user._id;
    
    // Validate required fields
    if (!fullName || !phone || !address || !city || !pincode || !paymentMethod) {
      return res.status(400).json({ status: false, error: 'All fields are required' });
    }

    // Create order data
    const orderData = {
      userId,
      deliveryDetails: {
        fullName,
        phone,
        address,
        city,
        pincode
      },
      paymentMethod
    };

    // Place order using helper function
    const result = await userHelpers.placeOrder(orderData);
    res.json({ status: true });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ status: false, error: error.message || 'Error placing order' });
  }
})

router.get('/add-to-cart/:id',(req,res)=>{
  userHelpers.addToCart(req.params.id,req.session.user._id).then(async () => {
    let cartCount = await userHelpers.getCartCount(req.session.user._id)
    res.json({status: true, cartCount: cartCount})
  }).catch(error => {
    console.error('Error adding to cart:', error)
    res.json({status: false, error: error})
  })
})

router.get('/remove-from-cart/:id', verifyLogin, (req, res) => {
  console.log("api call");
  userHelpers.removeFromCart(req.params.id, req.session.user._id).then(() => {
    res.json({status: true})
  }).catch(error => {
    console.error('Error removing from cart:', error)
    res.json({status: false, error: error.message})
  })
})

router.get('/order-success', verifyLogin, (req, res) => {
  res.render('user/order-success', { user: req.session.user });
});

router.get('/view-order', verifyLogin, async (req, res) => {
  try {
    const orders = await userHelpers.getUserOrders(req.session.user._id);
    res.render('user/view-order', { orders, user: req.session.user });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.render('user/view-order', { error: 'Unable to fetch orders', user: req.session.user });
  }
});

router.post('/change-product-quantity', (req, res, next) =>{
  userHelpers.changeProductQuantity(req.body).then((response)=>{
    res.json({status: true})
  }).catch(error => {
    res.json({status: false, error: error.message})
  })
})

module.exports = router;
