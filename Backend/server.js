// --- 1. IMPORTS (Updated for MongoDB) ---
const express = require('express');
const mongoose = require('mongoose'); // NEW: Mongoose for MongoDB
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cors = require('cors');

// --- 2. APP INITIALIZATION ---
const app = express();
// Use Render's PORT environment variable, default to 3000 locally
const port = process.env.PORT || 3000; 

// --- 3. MIDDLEWARE (The "Rules") ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// --- 4. MONGODB CONNECTION & SCHEMAS ---

// Use MONGODB_URI environment variable provided by Render or MongoDB Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/efarm_db';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB Connected!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas (Replacing MySQL Tables)
const { Schema } = mongoose;

const UserSchema = new Schema({
    username: { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const ProductSchema = new Schema({
    // NEW: Link to User _id (ObjectId)
    user_id: { type: Schema.Types.ObjectId, ref: 'User' }, 
    sellerName: { type: String, required: true },
    contactInfo: { type: String, required: true },
    district: { type: String, required: true },
    category: { type: String, required: true },
    productName: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    deliveryDays: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    image: String,
    created_at: { type: Date, default: Date.now },
    reviews: { type: Array, default: [] },
    rating: { type: Number, default: 0 },
    sold: { type: Boolean, default: false } 
});
const Product = mongoose.model('Product', ProductSchema);

const CartItemSchema = new Schema({
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    created_at: { type: Date, default: Date.now }
}, {
    // Enforce unique combination of user_id and product_id
    unique: { fields: ['user_id', 'product_id'] }
});
const CartItem = mongoose.model('CartItem', CartItemSchema);

const OrderItemSchema = new Schema({
    productName: String,
    image: String,
    quantity: { type: Number, default: 1 },
    price: { type: Number, required: true }
});

const OrderSchema = new Schema({
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    total_price: { type: Number, required: true },
    status: { type: String, default: 'Pending' },
    delivery_pin: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    items: [OrderItemSchema] // Embedded order item documents
});
const Order = mongoose.model('Order', OrderSchema);


// --- 5. JWT SECRET ---
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-for-e-farm';

// --- 6. AUTHENTICATION "GATEKEEPER" MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        // NOTE: req.user.userId is now the MongoDB ObjectId (String)
        req.user = user;
        next();
    });
};

// --- 7. API ROUTES (Mongoose Implementation) ---

/**
 * ## POST /register
 * Creates a new user.
 */
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }
        
        // Mongoose: Check for existing user
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already taken.' });
        }
        
        const password_hash = await bcrypt.hash(password, 10);
        
        // Mongoose: Create new user
        const newUser = new User({ username, password_hash });
        await newUser.save();
        
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * ## POST /login
 * Authenticates an existing user.
 */
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }
        
        // Mongoose: Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // The ID stored in the token is the MongoDB ObjectId (user._id)
        const token = jwt.sign(
            { userId: user._id.toString(), username: user.username },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        res.status(200).json({
            message: 'Login successful!',
            token: token,
            username: user.username
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * ## POST /generate-description
 * A secure proxy to call the Gemini API.
 */
app.post('/generate-description', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ message: 'A prompt is required.' });
    }

    // ⬇️⬇️ PUT YOUR REAL API KEY HERE ⬇️⬇️
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_REAL_GEMINI_API_KEY_GOES_HERE';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: {
            parts: [{ text: "You are an expert in agricultural product marketing. Write concise, appealing, and keyword-rich product descriptions for an e-commerce platform in Karnataka, India. Focus on quality, benefits, and local relevance. The description should be 1-2 sentences long." }]
        }
    };

    try {
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        const description = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (description) {
            res.status(200).json({ description: description });
        } else {
            throw new Error("Invalid response structure from API.");
        }
    } catch (error) {
        console.error('Gemini API Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Error generating description.' });
    }
});

/**
 * ## GET /products
 * Fetches all products from the database.
 */
app.get('/products', async (req, res) => {
    try {
        // Mongoose: Fetch all products
        const products = await Product.find({}).sort({ created_at: -1 });

        // Rename _id to id for frontend compatibility
        const productsFormatted = products.map(p => {
            const product = p.toObject();
            return {
                ...product,
                id: product._id.toString(), // Use the MongoDB _id as the 'id'
                // Mock data logic for consistency
                reviews: product.id % 2 === 0 ? [{rating: 4, text: "Good product."}] : [{rating: 5, text: "Great quality!"}],
                rating: product.id % 2 === 0 ? 4 : 5
            }
        });

        res.status(200).json(productsFormatted);
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ message: 'Error fetching products' });
    }
});

/**
 * ## POST /products
 * Adds a new product (SECURED)
 */
app.post('/products', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId; // MongoDB ObjectId string
        
        const {
            sellerName, contactInfo, district, category,
            productName, description, price, deliveryDays,
            discount, image
        } = req.body;

        if (!productName || !price || !sellerName || !contactInfo || !district || !category || !deliveryDays) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Mongoose: Create new product
        const newProduct = new Product({
            user_id: userId, // Store the seller's ObjectId
            sellerName, contactInfo, district, category,
            productName, description, price, deliveryDays,
            discount, image
        });
        const result = await newProduct.save();

        res.status(201).json({ message: 'Product added successfully!', productId: result._id.toString() });
    } catch (error) {
        console.error('Add product error:', error);
        res.status(500).json({ message: 'Error adding product' });
    }
});

/**
 * ## GET /products/my-listings
 * Fetches products only by the logged-in user (SECURED).
 */
app.get('/products/my-listings', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Mongoose: Find products by user_id
        const products = await Product.find({ user_id: userId }).sort({ created_at: -1 });

        const productsFormatted = products.map(p => {
            const product = p.toObject();
            return {
                ...product,
                id: product._id.toString(),
                reviews: product.id % 2 === 0 ? [{rating: 4, text: "Good product."}] : [{rating: 5, text: "Great quality!"}],
                rating: product.id % 2 === 0 ? 4 : 5
            }
        });
        
        res.status(200).json(productsFormatted);
    } catch (error) {
        console.error('Get my listings error:', error);
        res.status(500).json({ message: 'Error fetching your products' });
    }
});

/**
 * ## DELETE /products/:productId
 * Deletes a product, but only if it belongs to the logged-in user (SECURED).
 */
app.delete('/products/:productId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.params; // This is the MongoDB _id (string)

    // Mongoose: Delete product by _id AND user_id
    const result = await Product.findOneAndDelete({ 
        _id: productId, 
        user_id: userId 
    });

    if (!result) {
      return res.status(404).json({ message: 'Product not found or you do not have permission to delete it.' });
    }

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Error deleting product' });
  }
});


/**
 * ## GET /verify-token
 * A protected route to check if a user's token is still valid.
 */
app.get('/verify-token', authenticateToken, (req, res) => {
  res.status(200).json({ 
    message: 'Token is valid', 
    username: req.user.username 
  });
});

/**
 * ## GET /cart
 * Fetches all items in the logged-in user's cart.
 */
app.get('/cart', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Mongoose: Find cart items and use .populate to get product details
    const cartItems = await CartItem.find({ user_id: userId })
        .populate('product_id');

    const cartFormatted = cartItems
        .filter(item => item.product_id !== null)
        .map(item => {
            const p = item.product_id.toObject();
            return {
                ...p,
                id: p._id.toString()
            };
        });
    
    res.status(200).json(cartFormatted);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Error fetching cart' });
  }
});


/**
 * ## POST /cart
 * Adds a product to the logged-in user's cart.
 */
app.post('/cart', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const productExists = await Product.findById(productId);
    if (!productExists) {
        return res.status(404).json({ message: 'Product not found' });
    }
    
    const newCartItem = new CartItem({
        user_id: userId,
        product_id: productId
    });
    await newCartItem.save();

    res.status(201).json({ message: 'Product added to cart' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Product already in cart' });
    }
    console.error('Add cart error:', error);
    res.status(500).json({ message: 'Error adding to cart' });
  }
});


/**
 * ## DELETE /cart/:productId
 * Removes a product from the logged-in user's cart.
 */
app.delete('/cart/:productId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.params;

    const result = await CartItem.findOneAndDelete({
      user_id: userId,
      product_id: productId
    });

    if (!result) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    res.status(200).json({ message: 'Product removed from cart' });
  } catch (error) {
    console.error('Remove cart error:', error);
    res.status(500).json({ message: 'Error removing from cart' });
  }
});


/**
 * ## POST /orders
 * Creates a new order from the user's cart.
 */
app.post('/orders', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  try {
    // 1. Get cart items and populate product details
    const cartItems = await CartItem.find({ user_id: userId }).populate('product_id');

    if (cartItems.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty.' });
    }
    
    // 2. Calculate total price and build order items array
    let totalPrice = 0;
    const orderItems = cartItems
        .filter(item => item.product_id !== null)
        .map(item => {
            const p = item.product_id;
            const effectivePrice = Math.round(p.price * (100 - p.discount) / 100);
            totalPrice += effectivePrice;

            return {
                productName: p.productName,
                image: p.image,
                quantity: 1, 
                price: effectivePrice
            };
        });

    if (orderItems.length === 0) {
        return res.status(400).json({ message: 'Your cart items could not be found.' });
    }

    // 3. Generate a 4-digit Delivery PIN
    const deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();

    // 4. Create a new order document
    const newOrder = new Order({
        user_id: userId,
        total_price: totalPrice,
        delivery_pin: deliveryPin,
        items: orderItems
    });
    const orderResult = await newOrder.save();

    // 5. Clear the cart
    await CartItem.deleteMany({ user_id: userId });

    res.status(201).json({ message: 'Order placed successfully!', orderId: orderResult._id.toString() });

  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ message: 'Error placing order.' });
  }
});

/**
 * ## GET /orders
 * Fetches all past orders for the logged-in user.
 */
app.get('/orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Mongoose: Get all orders for this user, sorted by date
    const orders = await Order.find({ user_id: userId }).sort({ created_at: -1 });

    const fullOrders = orders.map(order => ({ 
        ...order.toObject(), 
        id: order._id.toString() 
    }));

    res.status(200).json(fullOrders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
});

/**
 * ## POST /orders/confirm-delivery
 * This is for the "delivery boy" to confirm the delivery.
 */
app.post('/orders/confirm-delivery', async (req, res) => {
  try {
    const { orderId, pin } = req.body;

    if (!orderId || !pin) {
      return res.status(400).json({ message: 'Order ID and PIN are required.' });
    }

    // 1. Find and update the order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (order.status === 'Delivered') {
      return res.status(400).json({ message: 'This order has already been delivered.' });
    }

    if (order.delivery_pin === pin) {
      order.status = 'Delivered';
      await order.save();
      res.status(200).json({ message: 'Order marked as Delivered!' });
    } else {
      res.status(400).json({ message: 'Invalid Delivery PIN.' });
    }
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// --- 8. START THE SERVER ---
app.listen(port, () => {
    console.log(`E-Farm server listening at port ${port}`);
});
