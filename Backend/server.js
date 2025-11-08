// --- 1. IMPORTS (All at the top) ---
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cors = require('cors');

// --- 2. APP INITIALIZATION ---
const app = express();
const port = 3000;

// --- 3. MIDDLEWARE (The "Rules") ---
// These MUST come BEFORE your routes (app.post, app.get)
// Increase the payload limit to 50mb
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());         // Allows your frontend to connect

// --- 4. DATABASE CONNECTION ---
const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Vishwa@123', // <-- Your password
    database: 'efarm_db'
});

// --- 5. JWT SECRET ---
const JWT_SECRET = 'your-super-secret-key-for-e-farm';

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
        req.user = user;
        next();
    });
};

// --- 7. API ROUTES (The "Actions") ---

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
        const [users] = await dbPool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length > 0) {
            return res.status(409).json({ message: 'Username already taken.' });
        }
        const password_hash = await bcrypt.hash(password, 10);
        await dbPool.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [
            username,
            password_hash
        ]);
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
        const [users] = await dbPool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign(
            { userId: user.id, username: user.username },
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
    const GEMINI_API_KEY = 'YOUR_REAL_GEMINI_API_KEY_GOES_HERE';
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
        const [products] = await dbPool.query('SELECT * FROM products ORDER BY created_at DESC');
        const productsWithReviews = products.map(p => ({
            ...p,
            sold: false,
            reviews: p.id % 2 === 0 ? [{rating: 4, text: "Good product."}] : [{rating: 5, text: "Great quality!"}],
            rating: p.id % 2 === 0 ? 4 : 5
        }));
        res.status(200).json(productsWithReviews);
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
        const {
            sellerName, contactInfo, district, category,
            productName, description, price, deliveryDays,
            discount, image
        } = req.body;

        // === "description" REMOVED FROM VALIDATION ===
        if (!productName || !price || !sellerName || !contactInfo || !district || !category || !deliveryDays) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const [result] = await dbPool.query(
            'INSERT INTO products (sellerName, contactInfo, district, category, productName, description, price, deliveryDays, discount, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [sellerName, contactInfo, district, category, productName, description, price, deliveryDays, discount, image]
        );
        res.status(201).json({ message: 'Product added successfully!', productId: result.insertId });
    } catch (error) {
        console.error('Add product error:', error);
        res.status(500).json({ message: 'Error adding product' });
    }
});

/**
 * ## GET /cart
 * Fetches all items in the logged-in user's cart.
 */
app.get('/cart', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId; // We get this from the token

    // This query joins the cart and products tables
    // to get the full product details for each item in the cart
    const [cartItems] = await dbPool.query(
      `SELECT p.* FROM products p 
       JOIN cart_items c ON p.id = c.product_id
       WHERE c.user_id = ?`,
      [userId]
    );
    
    res.status(200).json(cartItems);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Error fetching cart' });
  }
});

/**
 * ## GET /verify-token
 * A protected route to check if a user's token is still valid.
 */
app.get('/verify-token', authenticateToken, (req, res) => {
  // The 'authenticateToken' middleware does all the work.
  // If the code reaches this point, the token is valid.
  res.status(200).json({ 
    message: 'Token is valid', 
    username: req.user.username // Send back the username
  });
});


// =======================================================
// === THIS IS THE MISSING ENDPOINT I HAVE ADDED BACK ===
// =======================================================
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

    // Add the item to the database
    await dbPool.query(
      'INSERT INTO cart_items (user_id, product_id) VALUES (?, ?)',
      [userId, productId]
    );

    res.status(201).json({ message: 'Product added to cart' });
  } catch (error) {
    // This will catch if the user tries to add the same item twice
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Product already in cart' });
    }
    console.error('Add cart error:', error);
    res.status(500).json({ message: 'Error adding to cart' });
  }
});
// =======================================================
// === END OF NEWLY ADDED CODE ===
// =======================================================


/**
 * ## DELETE /cart/:productId
 * Removes a product from the logged-in user's cart.
 */
app.delete('/cart/:productId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { productId } = req.params; // Get ID from the URL

    const [result] = await dbPool.query(
      'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    if (result.affectedRows === 0) {
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
  let connection; 

  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    // 1. Get cart items
    const [cartItems] = await connection.query(
      `SELECT p.id, p.price, p.discount FROM products p
       JOIN cart_items c ON p.id = c.product_id
       WHERE c.user_id = ?`,
      [userId]
    );

    if (cartItems.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Your cart is empty.' });
    }

    // 2. Calculate total price
    let totalPrice = 0;
    cartItems.forEach(item => {
      totalPrice += Math.round(item.price * (100 - item.discount) / 100);
    });

    // 3. --- NEW: Generate a 4-digit Delivery PIN ---
    const deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();

    // 4. Create a new order (now with the PIN)
    const [orderResult] = await connection.query(
      'INSERT INTO orders (user_id, total_price, delivery_pin) VALUES (?, ?, ?)',
      [userId, totalPrice, deliveryPin]
    );
    const newOrderId = orderResult.insertId;

    // 5. Add items to 'order_items'
    const orderItemPromises = cartItems.map(item => {
      const effectivePrice = Math.round(item.price * (100 - item.discount) / 100);
      return connection.query(
        'INSERT INTO order_items (order_id, product_id, price) VALUES (?, ?, ?)',
        [newOrderId, item.id, effectivePrice]
      );
    });
    await Promise.all(orderItemPromises);

    // 6. Clear the cart
    await connection.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    // 7. Commit transaction
    await connection.commit();

    res.status(201).json({ message: 'Order placed successfully!', orderId: newOrderId });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Place order error:', error);
    res.status(500).json({ message: 'Error placing order.' });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * ## GET /orders
 * Fetches all past orders for the logged-in user,
 * including the items in each order.
 */
app.get('/orders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Get all orders for this user
    const [orders] = await dbPool.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    // 2. Now, for each order, get its items
    // We use Promise.all to run these queries in parallel
    const fullOrders = await Promise.all(
      orders.map(async (order) => {
        // Get all items for this specific order, joining with the products table
        const [items] = await dbPool.query(
          `SELECT p.productName, p.image, oi.quantity, oi.price 
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = ?`,
          [order.id]
        );

        // Return the order with its items nested inside
        return { ...order, items: items };
      })
    );

    res.status(200).json(fullOrders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
});

/**
 * ## POST /orders/confirm-delivery
 * This is for the "delivery boy" to confirm the delivery.
 * It checks the orderId and the deliveryPin.
 */
app.post('/orders/confirm-delivery', async (req, res) => {
  try {
    const { orderId, pin } = req.body;

    if (!orderId || !pin) {
      return res.status(400).json({ message: 'Order ID and PIN are required.' });
    }

    // 1. Find the order
    const [orders] = await dbPool.query(
      'SELECT * FROM orders WHERE id = ?', 
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const order = orders[0];

    // 2. Check if already delivered
    if (order.status === 'Delivered') {
      return res.status(400).json({ message: 'This order has already been delivered.' });
    }

    // 3. Check if the PIN matches
    if (order.delivery_pin === pin) {
      // 4. Match! Update the status
      await dbPool.query(
        "UPDATE orders SET status = 'Delivered' WHERE id = ?",
        [orderId]
      );
      res.status(200).json({ message: 'Order marked as Delivered!' });
    } else {
      // 5. No match
      res.status(400).json({ message: 'Invalid Delivery PIN.' });
    }
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// --- 8. START THE SERVER (Must be at the very end) ---
app.listen(port, () => {
    console.log(`E-Farm server listening at http://localhost:${port}`);
});