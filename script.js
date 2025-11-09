// NEW: Custom Alert Functions
const alertOverlay = document.getElementById('custom-alert-overlay');
const alertMessage = document.getElementById('custom-alert-message');
const alertOk = document.getElementById('custom-alert-ok');

function showCustomAlert(message) {
  alertMessage.textContent = message;
  alertOverlay.classList.remove('hide');
}

alertOk.onclick = () => {
  alertOverlay.classList.add('hide');
};

// --- NEW: API BASE URL for Render Hosting ---
// *** IMPORTANT: After deploying your backend to Render, replace 'http://127.0.0.1:3000' 
// *** with your actual deployed backend URL (e.g., https://efarm-api-yourname.onrender.com)
const API_BASE_URL = 'https://e-farm-grx3.onrender.com'; // Default for local testing

// --- NEW SECURE Gemini API Call Function ---
async function callGeminiAPI(prompt) {
  try {
    // Call OUR OWN server endpoint
    const response = await fetch(`${API_BASE_URL}/generate-description`, { // UPDATED URL
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: prompt }), // Send the prompt
    });

    if (!response.ok) {
      throw new Error(`Server Error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.description; // Get the description from our server's response

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error; // Re-throw to be caught by the button's event listener
  }
}


const allDistricts = [
  "Bagalkot",
  "Bangalore Rural",
  "Bangalore Urban",
  "Belagavi",
  "Ballari",
  "Bidar",
  "Chamarajanagar",
  "Chikkaballapur",
  "Chikkamagaluru",
  "Chitradurga",
  "Dakshina Kannada",
  "Davanagere",
  "Dharwad",
  "Gadag",
  "Hassan",
  "Haveri",
  "Kalaburagi",
  "Kodagu",
  "Kolar",
  "Koppal",
  "Mandya",
  "Mysuru",
  "Raichur",
  "Ramanagara",
  "Shivamogga",
  "Tumakuru",
  "Udupi",
  "Uttara Kannada",
  "Vijayapura",
  "Yadgir"
];


// Functions to show/hide App vs Auth
const authContainer = document.getElementById('auth-container');
const mainAppElements = document.querySelectorAll('.main-app');
const welcomeMsg = document.getElementById('welcome-msg');

function showMainApp(username) {
  authContainer.classList.add('hide');
  mainAppElements.forEach(el => el.classList.remove('hide'));
  welcomeMsg.textContent = `Welcome, ${username}!`;
  // Load the marketplace by default after login
  showTab('marketplace');
}

function showAuthContainer() {
  authContainer.classList.remove('hide');
  mainAppElements.forEach(el => el.classList.add('hide'));
  welcomeMsg.textContent = '';
  // Default to login form
  document.getElementById('login-form-container').classList.remove('hide');
  document.getElementById('register-form-container').classList.add('hide');
}

// === NEW UPDATED DOMContentLoaded (made async) ===
document.addEventListener('DOMContentLoaded', async () => {

  // Auth Form Toggling
  document.getElementById('show-register').onclick = () => {
    document.getElementById('login-form-container').classList.add('hide');
    document.getElementById('register-form-container').classList.remove('hide');
  };
  document.getElementById('show-login').onclick = () => {
    document.getElementById('login-form-container').classList.remove('hide');
    document.getElementById('register-form-container').classList.add('hide');
  };

  // Registration Logic (NOW UPDATED TO USE BACKEND)
  document.getElementById('register-form').onsubmit = async function(e) {
    e.preventDefault(); // Stop the form from reloading the page

    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    const errorEl = document.getElementById('register-error');

    // --- 1. Frontend Validation ---
    if (!username || !password) {
      errorEl.textContent = 'Please fill all fields.';
      errorEl.classList.remove('hide');
      return;
    }
    if (password !== confirmPass) {
      errorEl.textContent = 'Passwords do not match.';
      errorEl.classList.remove('hide');
      return;
    }
    
    errorEl.classList.add('hide');

    // --- 2. Send Data to the Node.js Backend ---
    try {
      const response = await fetch(`${API_BASE_URL}/register`, { // UPDATED URL
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        showCustomAlert('Registration successful! Please log in.');
        this.reset();
        document.getElementById('show-login').click();
      } else {
        errorEl.textContent = data.message;
        errorEl.classList.remove('hide');
      }
    } catch (error) {
      console.error('Registration fetch error:', error);
      errorEl.textContent = 'Cannot connect to server. Please try again later.';
      errorEl.classList.remove('hide');
    }
  };


  // Login Logic (Already updated)
  document.getElementById('login-form').onsubmit = async function(e) {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('login-error');

    if (!username || !password) {
      errorEl.textContent = 'Please fill all fields.';
      errorEl.classList.remove('hide');
      return;
    }
    errorEl.classList.add('hide');

    try {
      const response = await fetch(`${API_BASE_URL}/login`, { // UPDATED URL
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', data.username);
        this.reset();
        showMainApp(data.username); // This will call showTab('marketplace')
      } else {
        errorEl.textContent = data.message;
        errorEl.classList.remove('hide');
      }
    } catch (error) {
      console.error('Login fetch error:', error);
      errorEl.textContent = 'Cannot connect to server. Please try again later.';
      errorEl.classList.remove('hide');
    }
  };

  // --- UPDATED LOGOUT LOGIC ---
  document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    showAuthContainer();
  };

  // ==================================
  // === NEW: Smart Auth Check on Page Load ===
  // ==================================
  const token = localStorage.getItem('token');
  
  if (token) {
    try {
      // 1. Send the token to the server to be verified
      const response = await fetch(`${API_BASE_URL}/verify-token`, { // UPDATED URL
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        // 2. If the token is GOOD, log the user in
        const data = await response.json();
        // We also reset the currentUser in case it was changed
        localStorage.setItem('currentUser', data.username); 
        showMainApp(data.username);
      } else {
        // 3. If the token is BAD (expired/invalid), clear it and show login
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        showAuthContainer();
      }
    } catch (error) {
      // 4. If the server is down, just show the login page
      console.error('Error verifying token:', error);
      showAuthContainer();
    }
  } else {
    // 5. If no token exists, show the login page
    showAuthContainer();
  }
  // ==================================


  // ==================================
  // === NEW: Place Order Button Logic ===
  // ==================================
  document.getElementById('place-order-btn').onclick = async function() {
    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Placing Order...';

    const token = localStorage.getItem('token');
    
    try {
      const response = await fetch(`${API_BASE_URL}/orders`, { // UPDATED URL
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
        // No body is needed, the server gets cart from the user's token
      });

      const data = await response.json();

      if (response.ok) {
        showCustomAlert('Order placed successfully!');
        updateCartCount(); // This will refresh the count to (0)
        renderCart(); // This will refresh the cart to show "Your cart is empty"
      } else {
        throw new Error(data.message);
      }

    } catch (error) {
      console.error('Place order error:', error);
      showCustomAlert(`Error placing order: ${error.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Place Order';
    }
  };

  // NEW: Payment method toggle logic
  document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
    radio.onchange = function() {
      if (this.value === 'card') {
        document.getElementById('paymentForm').style.display = 'block';
        document.getElementById('upi-qr-payment').style.display = 'none';
      } else {
        document.getElementById('paymentForm').style.display = 'none';
        document.getElementById('upi-qr-payment').style.display = 'block';
      }
    };
  });

  // NEW: UPI Payment confirmation logic
  document.getElementById('confirm-upi-payment').onclick = function() {
    const paymentMsg = document.getElementById('paymentMsg');
    paymentMsg.style.color = '#357a38';
    paymentMsg.textContent = 'Payment successful (via UPI)! Products are now marked as SOLD.';
    // NOTE: You still need to create the `processSuccessfulPayment` function
    // processSuccessfulPayment();
  };

  // NEW: Gemini Button Event Listener
  document.getElementById('generateDescBtn').onclick = async function() {
    const btn = this;
    const loader = document.getElementById('gemini-loader');
    const productName = document.getElementById('productName').value.trim();
    const category = document.getElementById('category').value;
    const descriptionBox = document.getElementById('description');

    if (!productName || !category) {
      showCustomAlert('Please enter a Product Name and select a Category first.');
      return;
    }

    btn.disabled = true;
    loader.classList.remove('hide');
    descriptionBox.value = 'Generating...';

    const prompt = `Write a short, compelling product description for "${productName}" (Category: ${category}). Make it appealing to farmers and buyers on an agricultural exchange in Karnataka.`;

    try {
      const description = await callGeminiAPI(prompt);
      descriptionBox.value = description;
    } catch (error) {
      showCustomAlert('Could not generate description. Please try again or write one manually.');
      descriptionBox.value = '';
    } finally {
      btn.disabled = false;
      loader.classList.add('hide');
    }
  };

}); // END of DOMContentLoaded


// =======================================================
// === getCart and saveCart REMOVED ===
// =======================================================


// --- NEW: Updates cart count from the SERVER ---
async function updateCartCount() {
  const token = localStorage.getItem('token');
  if (!token) {
    document.getElementById('cart-count').textContent = '(0)';
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/cart`, { // UPDATED URL
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const cartItems = await response.json();
      document.getElementById('cart-count').textContent = `(${cartItems.length})`;
    } else {
      document.getElementById('cart-count').textContent = '(0)';
    }
  } catch (error) {
    console.error('Error fetching cart count:', error);
    document.getElementById('cart-count').textContent = '(0)';
  }
}


// === UPDATED showTab function ===
function showTab(tab) {
  // Added 'my-orders' and 'my-listings' to the list
  ['marketplace', 'checkout', 'my-orders', 'my-listings', 'about', 'faq', 'contact'].forEach(id => {
    document.getElementById(id + '-tab').style.display = (id === tab) ? 'block' : 'none';
  });
  document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
  document.querySelector('nav button[onclick="showTab(\'' + tab + '\')"]').classList.add('active');
  
  // This now fetches products from the DB when tab is clicked
  if (tab === 'marketplace') renderProducts();
  else if (tab === 'checkout') renderCart();
  else if (tab === 'my-orders') renderMyOrders(); // Added this line
  else if (tab === 'my-listings') renderMyListings(); 
}

// =======================================================
// === NEW: Renders the cart page from the SERVER ===
// =======================================================
async function renderCart() {
  const cartListDiv = document.getElementById('cartList');
  const token = localStorage.getItem('token');
  
  if (!token) {
    cartListDiv.innerHTML = '<p>Please log in to see your cart.</p>';
    return;
  }

  cartListDiv.innerHTML = '<p>Loading your cart...</p>';

  try {
    const response = await fetch(`${API_BASE_URL}/cart`, { // UPDATED URL
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Could not fetch cart.');
    }

    const cartItems = await response.json();

    if (cartItems.length === 0) {
      cartListDiv.innerHTML = '<p>Your cart is empty.</p>';
      document.getElementById('place-order-btn').style.display = 'none'; // Hide order button
      return;
    }

    let html = '';
    let totalPrice = 0;

    cartItems.forEach(p => {
      const effectivePrice = Math.round(p.price * (100 - p.discount) / 100);
      totalPrice += effectivePrice;

      html += `
        <div class="cart-item">
          <img src="${p.image || 'https://placehold.co/100x100'}" alt="${p.productName}">
          <div class="cart-item-info">
            <b>${p.productName}</b>
            <span>(Sold by ${p.sellerName})</span>
            <span class="price-tag">₹${effectivePrice.toLocaleString('en-IN')}</span>
          </div>
          <button class="remove-from-cart-btn" data-id="${p.id}">Remove</button>
        </div>
      `;
    });

    html += `<hr><h3>Total Price: ₹${totalPrice.toLocaleString('en-IN')}</h3>`;
    cartListDiv.innerHTML = html;
    
    // Show the "Place Order" button
    document.getElementById('place-order-btn').style.display = 'block';

    // Now, add event listeners for the remove buttons
    document.querySelectorAll('.remove-from-cart-btn').forEach(btn => {
      btn.onclick = () => {
        const productId = btn.getAttribute('data-id'); // MongoDB ID is now a string
        removeFromCart(productId);
      };
    });

  } catch (error) {
    console.error('Error rendering cart:', error);
    cartListDiv.innerHTML = '<p>Error loading your cart. Please try again.</p>';
  }
}

// =======================================================
// === NEW: Removes item from cart on the SERVER ===
// =======================================================
async function removeFromCart(productId) {
  const token = localStorage.getItem('token');
  if (!token) {
    showCustomAlert('Please log in to modify your cart.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/cart/${productId}`, { // UPDATED URL
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      showCustomAlert('Product removed from cart.');
      renderCart(); // Refresh the cart view
      updateCartCount(); // Refresh the nav count
    } else {
      showCustomAlert(data.message);
    }
  } catch (error) {
    console.error('Error removing from cart:', error);
    showCustomAlert('Error removing product. Please try again.');
  }
}


// Image upload
let tempImageData = "";
const imageInput = document.getElementById('imageInput');
imageInput.onchange = function() {
  if (this.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      tempImageData = e.target.result; // This is the Base64 string
    };
    reader.readAsDataURL(this.files[0]);
  } else {
    tempImageData = "";
  }
};

// =======================================================
// === NEW: Submits new products to the BACKEND ===
// =======================================================
document.getElementById('productForm').onsubmit = async function (e) {
  e.preventDefault();
  
  // 1. Get all form data (same as before)
  const sellerName = document.getElementById('sellerName').value.trim();
  const contactInfo = document.getElementById('contactInfo').value.trim();
  const district = document.getElementById('district').value;
  const category = document.getElementById('category').value;
  const productName = document.getElementById('productName').value.trim();
  const description = document.getElementById('description').value.trim();
  const priceRaw = document.getElementById('price').value.trim();
  const deliveryDaysRaw = document.getElementById('deliveryDays').value.trim();

  // 2. Validation (same as before)
  // === "description" REMOVED FROM VALIDATION ===
  if (!sellerName || !contactInfo || !district || !category || !productName || !priceRaw || !deliveryDaysRaw) {
    showCustomAlert('Please fill all fields.');
    return;
  }
  const price = parseFloat(priceRaw);
  const deliveryDays = parseInt(deliveryDaysRaw);
  if (isNaN(price) || price <= 0 || isNaN(deliveryDays) || deliveryDays < 1 || deliveryDays > 30) {
    showCustomAlert('Enter valid price and delivery days (1-30).');
    return;
  }

  // 3. Add mock discount (same as before)
  const discount = Math.floor(Math.random() * 16) + 5;

  // 4. Create the payload for the server
  const newProduct = {
    sellerName,
    contactInfo,
    district,
    category,
    productName,
    description,
    price,
    deliveryDays,
    discount,
    image: tempImageData // This is the Base64 image string
  };

  // 5. --- NEW: Send data to the server ---
  try {
    // --- 1. Get the token from localStorage ---
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_BASE_URL}/products`, { // UPDATED URL
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // --- 2. Add the Authorization header ---
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newProduct)
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to add product');
    }

    // 6. Success
    tempImageData = ""; // Clear the temp image
    this.reset(); // Reset the form
    document.querySelector('.add-product-collapsible').open = false; // Close form
    showCustomAlert('Product added successfully!');
    renderProducts(); // Re-render the list from the server, which now includes the new product

  } catch (error) {
    console.error(error);
    showCustomAlert(`Error adding product: ${error.message}`);
  }
};

// Filter & sort handlers
document.getElementById('filterDistrict').onchange = renderProducts;
document.getElementById('filterCategory').onchange = renderProducts;
document.getElementById('sortBy').onchange = renderProducts;
document.getElementById('searchProduct').oninput = renderProducts;

// =======================================================
// === NEW: Renders products from the BACKEND ===
// =======================================================
async function renderProducts() {
  const filterDistrict = document.getElementById('filterDistrict').value.toLowerCase();
  const filterCategory = document.getElementById('filterCategory').value.toLowerCase();
  const sortBy = document.getElementById('sortBy').value;
  const searchTerm = document.getElementById('searchProduct').value.trim().toLowerCase();

  let products = [];
  try {
      // 1. FETCH products from our server (This URL was already correct)
      const response = await fetch(`${API_BASE_URL}/products`); // UPDATED URL
      if (!response.ok) throw new Error('Could not fetch products');
      products = await response.json();
  } catch (error) {
      console.error(error);
      document.getElementById('productList').innerHTML = '<p>Error loading products. Is the server running?</p>';
      return;
  }
  
  // 2. Apply filters (this logic is the same as before)
  if (filterDistrict) products = products.filter(p => p.district.toLowerCase() === filterDistrict);
  if (filterCategory) products = products.filter(p => p.category.toLowerCase() === filterCategory);
  if (searchTerm) products = products.filter(p => p.productName.toLowerCase().includes(searchTerm));

  // 3. Sort options (this logic is the same as before)
  switch (sortBy) {
    case 'rating':
      products = products.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case 'priceAsc':
      products = products.slice().sort((a, b) => a.price - b.price);
      break;
    case 'priceDesc':
      products = products.slice().sort((a, b) => b.price - b.price);
      break;
    case 'delivery':
      products = products.slice().sort((a, b) => a.deliveryDays - b.deliveryDays);
      break;
    default:
      break;
  }

  // 4. Render to the page (this logic is mostly the same)
  const list = document.getElementById('productList');
  list.innerHTML = '';
  if (products.length === 0) {
    list.innerHTML = '<p>No products found for the filter/search.</p>';
    updateCartCount();
    return;
  }

  products.forEach(p => {
    const effectivePrice = Math.round(p.price * (100 - p.discount) / 100);
    const div = document.createElement('div');
    div.className = 'product-item';
    // Note: We use p.image for the src, which now comes from the DB
    div.innerHTML = `
      <div><img class="prod-image" src="${p.image || 'https://img.icons8.com/external-kmg-design-flat-kmg-design/96/000000/external-farming-agriculture-kmg-design-flat-kmg-design.png'}" alt="Product Image"/></div>
      <div class="prod-info">
        <div>
          <span class="category-tag">${p.category}</span>
          <b>${p.productName}</b>
          <span class="district">(${p.district})</span>
          ${p.sold ? '<span class="sold-label">SOLD</span>' : ''}
        </div>
        <div>${p.description}</div>
        <div>
          <span classZ="price-tag">₹${effectivePrice.toLocaleString('en-IN')}</span>
          ${p.discount > 0 ? `<span class="discount-tag">${p.discount}% OFF</span>` : ''}
          <span class="delivery-tag">⏱️ ${p.deliveryDays} days delivery</span>
        </div>
        <div class="seller">By: ${p.sellerName}</div>
        <div class="contact"><i class="fa fa-envelope"></i> ${p.contactInfo}</div>
        <div>
          <span style="color:#eea311; font-size:1.15em;">${getStars(p.rating)}</span>
          <span style="color:#577; font-size:0.95em;">(${p.reviews.length} reviews)</span>
        </div>
        <div>
          ${!p.sold ? `<button class="buy" data-id="${p.id}">Add to Cart</button>` : ''}
        </div>
      </div>
    `;
    list.appendChild(div);
  });

  Array.from(list.getElementsByClassName('buy')).forEach(btn => {
    btn.onclick = () => {
      const productId = btn.getAttribute('data-id');
      addToCart(productId); // MongoDB ID is passed as a string
    };
  });
  updateCartCount();
}


function getStars(n) {
  n = Math.round(n);
  if (!n || n < 1) return '☆☆☆☆☆';
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// =======================================================
// === NEW: Adds item to cart on the SERVER ===
// =======================================================
async function addToCart(id) { // 'id' is the MongoDB ObjectId string
  const token = localStorage.getItem('token');
  if (!token) {
    showCustomAlert('Please log in to add items to your cart.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/cart`, { // UPDATED URL
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ productId: id })
    });

    const data = await response.json();

    if (response.ok) {
      showCustomAlert('Product added to cart.');
      updateCartCount(); // Refresh the count from the server
    } else {
      // Show the specific error (e.g., "Product already in cart")
      showCustomAlert(data.message);
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
    showCustomAlert('Error adding product. Please try again.');
  }
}

// =======================================================
// === NEW FUNCTION: Renders the Seller's Listings (Updated for API_BASE_URL) ===
// =======================================================
async function renderMyListings() {
  const listingsDiv = document.getElementById('myListingsContainer');
  const token = localStorage.getItem('token');

  if (!token) {
    listingsDiv.innerHTML = '<p>Please log in to see your listings.</p>';
    return;
  }

  listingsDiv.innerHTML = '<p>Loading your products...</p>';

  try {
    // Call the secured backend endpoint to get only the current user's products
    const response = await fetch(`${API_BASE_URL}/products/my-listings`, { // UPDATED URL
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Could not fetch your listings.');

    const products = await response.json();

    if (products.length === 0) {
      listingsDiv.innerHTML = '<p>You have no active products listed for sale yet.</p>';
      return;
    }

    let html = '';
    products.forEach(p => {
      const effectivePrice = Math.round(p.price * (100 - p.discount) / 100);
      
      // Use the same card structure as the marketplace, but add a delete button
      html += `
        <div class="product-item">
          <div><img class="prod-image" src="${p.image || 'https://img.icons8.com/external-kmg-design-flat-kmg-design/96/000000/external-farming-agriculture-kmg-design-flat-kmg-design.png'}" alt="Product Image"/></div>
          <div class="prod-info">
            <div>
              <span class="category-tag">${p.category}</span>
              <b>${p.productName}</b>
              <span class="district">(${p.district})</span>
            </div>
            <div>${p.description}</div>
            <div>
              <span classZ="price-tag">₹${effectivePrice.toLocaleString('en-IN')}</span>
              ${p.discount > 0 ? `<span class="discount-tag">${p.discount}% OFF</span>` : ''}
              <span class="delivery-tag">⏱️ ${p.deliveryDays} days delivery</span>
            </div>
            <div style="margin-top: 15px;">
                <button class="delete-listing-btn" data-id="${p.id}">Delete Listing</button>
            </div>
          </div>
        </div>
      `;
    });

    listingsDiv.innerHTML = html;
    
    // Attach event listeners for the delete buttons
    document.querySelectorAll('.delete-listing-btn').forEach(btn => {
      btn.onclick = () => {
        const productId = btn.getAttribute('data-id');
        deleteProduct(productId);
      };
    });

  } catch (error) {
    console.error('Error rendering my listings:', error);
    listingsDiv.innerHTML = '<p>Error loading your listings. Please try again.</p>';
  }
}

// =======================================================
// === NEW FUNCTION: Deletes a Product from the SERVER ===
// =======================================================
async function deleteProduct(productId) { // 'productId' is the MongoDB ObjectId string
  if (!confirm('Are you sure you want to delete this listing? This action cannot be undone.')) {
    return;
  }
  
  const token = localStorage.getItem('token');
  if (!token) {
    showCustomAlert('Please log in to delete products.');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/products/${productId}`, { // UPDATED URL
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      showCustomAlert('Product listing deleted successfully!');
      renderMyListings(); // Refresh the my listings tab
      renderProducts();   // Also refresh the marketplace
    } else {
      showCustomAlert(data.message || 'Error deleting product.');
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    showCustomAlert('Error connecting to server to delete product.');
  }
}


/**
 * ## NEW: Renders the "My Orders" page
 * Fetches and displays the user's order history,
 * including the items in each order.
 */
async function renderMyOrders() {
  const orderListDiv = document.getElementById('orderList');
  const token = localStorage.getItem('token');

  if (!token) {
    orderListDiv.innerHTML = '<p>Please log in to see your orders.</p>';
    return;
  }

  orderListDiv.innerHTML = '<p>Loading your order history...</p>';

  try {
    const response = await fetch(`${API_BASE_URL}/orders`, { // UPDATED URL
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Could not fetch your orders.');

    const orders = await response.json();

    if (orders.length === 0) {
      orderListDiv.innerHTML = '<p>You have not placed any orders yet.</p>';
      return;
    }

    let html = '';
    orders.forEach(order => {
      const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      });

      let itemsHtml = '<div class="order-item-list">';
      order.items.forEach(item => {
        itemsHtml += `
          <div class="order-item-details">
            <img src="${item.image || 'https://placehold.co/100x100'}" alt="${item.productName}">
            <span>${item.productName} (₹${parseFloat(item.price).toLocaleString('en-IN')})</span>
          </div>
        `;
      });
      itemsHtml += '</div>';

      // --- NEW: Added Delivery PIN display ---
      let pinHtml = '';
      if (order.status === 'Pending') {
        pinHtml = `
          <div classclassName="delivery-pin">
            Your Delivery PIN: <b>${order.delivery_pin}</b>
            <span>(Give this to the driver)</span>
          </div>
        `;
      }

      html += `
        <div class="order-history-item">
          <div class="order-info-header">
            <span>Order ID: <b>#${order.id}</b></span>
            <span>Placed on: <b>${orderDate}</b></span>
          </div>

          ${itemsHtml} 

          <div class="order-info-body">
            <span>Status: <b>${order.status}</b></span>
            <span class="price-tag">Total: ₹${parseFloat(order.total_price).toLocaleString('en-IN')}</span>
          </div>

          ${pinHtml} 
        </div>
      `;
    });

    orderListDiv.innerHTML = html;

  } catch (error) {
    console.error('Error rendering orders:', error);
    orderListDiv.innerHTML = '<p>Error loading your orders. Please try again.</p>';
  }
}

