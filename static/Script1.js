document.addEventListener('DOMContentLoaded', function() {
    // =============================================
    // 1. DOM ELEMENTS & INITIALIZATION
    // =============================================
    const cartIcon = document.querySelector('.cart-icon');
    const cartModal = document.getElementById('cart-modal');
    const closeButton = document.querySelector('.close-button');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalSpan = document.getElementById('cart-total');
    const cartCountSpan = document.querySelector('.cart-count');
    const checkoutButton = document.getElementById('checkout-button');
    const checkoutForm = document.getElementById('checkoutForm');

    // Initialize cart from localStorage or empty array
    let cart = JSON.parse(localStorage.getItem('sports_jersey_cart')) || [];

    // =============================================
    // 2. UTILITY FUNCTIONS
    // =============================================
    
    /**
     * Formats a number as currency
     * @param {number} amount - The amount to format
     * @returns {string} Formatted currency string
     */
    function formatCurrency(amount) {
        const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
        return '₦' + num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /**
     * Shows a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type of notification (success, error, info)
     */
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }, 100);
    }

    /**
     * Validates the checkout form
     * @returns {boolean} True if form is valid, false otherwise
     */
    function validateForm() {
        let isValid = true;
        const requiredFields = [
            'fullName', 'email', 'phone', 'address', 
            'city', 'zipCode', 'country'
        ];

        // Validate required fields
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field.value.trim()) {
                field.style.borderColor = 'red';
                isValid = false;
            } else {
                field.style.borderColor = '#ddd';
            }
        });

        // Validate email format
        const email = document.getElementById('email');
        if (email && !/^\S+@\S+\.\S+$/.test(email.value)) {
            email.style.borderColor = 'red';
            isValid = false;
        }

        if (!isValid) {
            showToast('Please fill in all required fields correctly', 'error');
        }

        return isValid;
    }

    // =============================================
    // 3. CART MANAGEMENT FUNCTIONS
    // =============================================
    
    /**
     * Saves the current cart to localStorage
     */
    function saveCart() {
        localStorage.setItem('sports_jersey_cart', JSON.stringify(cart));
    }

    /**
     * Updates the cart count indicator
     */
    function updateCartCount() {
        const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        if (cartCountSpan) {
            cartCountSpan.textContent = totalItems;
        }
    }

    /**
     * Adds a product to the cart
     * @param {object} product - The product to add
     */
    function addToCart(product) {
        // Get the size selector for this product
        const sizeSelector = document.querySelector(`#size-${product.id}`);
        const selectedSize = sizeSelector ? sizeSelector.value : 'N/A';

        const cleanProduct = {
            id: product.id || 'no-id',
            name: product.name || 'Unnamed Product',
            price: parseFloat(product.price) || 0,
            image: product.image || 'image/placeholder.jpg',
            size: selectedSize,
            quantity: 0
        };

        // Check if this exact product (with same size) already exists in cart
        const existingItem = cart.find(item => 
            item.id === cleanProduct.id && item.size === cleanProduct.size
        );
        
        if (existingItem) {
            existingItem.quantity++;
        } else {
            cleanProduct.quantity = 1;
            cart.push(cleanProduct);
        }
        
        saveCart();
        updateCartCount();
        showToast(`${cleanProduct.name} (Size: ${selectedSize}) added to cart!`);
    }

    /**
     * Removes a product from the cart
     * @param {string} productId - ID of the product to remove
     */
    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        saveCart();
        updateCartCount();
        renderCartItems();
        showToast('Item removed from cart', 'info');
    }

    /**
     * Updates the quantity of a product in the cart
     * @param {string} productId - ID of the product to update
     * @param {number} change - The change in quantity (+1 or -1)
     */
    function updateQuantity(productId, change) {
        const item = cart.find(item => item.id === productId);
        if (item) {
            item.quantity += change;
            
            if (item.quantity <= 0) {
                removeFromCart(productId);
                return;
            }
            
            saveCart();
            updateCartCount();
            renderCartItems();
        }
    }

    /**
     * Renders all cart items in the cart modal
     */
    function renderCartItems() {
        if (!cartItemsContainer || !cartTotalSpan) return;

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
            cartTotalSpan.textContent = formatCurrency(0);
            if (checkoutButton) checkoutButton.disabled = true;
            return;
        }

        let total = 0;
        cartItemsContainer.innerHTML = cart.map(item => {
            const price = parseFloat(item.price);
            const quantity = parseInt(item.quantity) || 1;
            const validPrice = isNaN(price) ? 0 : price;
            const itemTotal = validPrice * quantity;
            total += itemTotal;

            return `
                <div class="cart-item">
                    <img src="/static/${item.image}" alt="${item.name}" onerror="this.style.display='none'">
                    <div class="cart-item-details">
                        <h4>${item.name}</h4>
                        <p>Size: ${item.size || 'N/A'}</p>
                        <p>${formatCurrency(validPrice)} × ${quantity}</p>
                        <p>${formatCurrency(itemTotal)}</p>
                    </div>
                    <div class="cart-item-actions">
                        <button class="quantity-btn decrease" data-id="${item.id}">-</button>
                        <span class="quantity">${quantity}</span>
                        <button class="quantity-btn increase" data-id="${item.id}">+</button>
                        <button class="remove-from-cart" data-id="${item.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        cartTotalSpan.textContent = formatCurrency(total);
        if (checkoutButton) checkoutButton.disabled = false;
        setupCartItemEventListeners();
    }

    // =============================================
    // 4. CHECKOUT & ORDER FUNCTIONS
    // =============================================
    
    /**
     * Handles the checkout form submission
     * @param {Event} e - The form submission event
     */
    async function handleOrderSubmission(e) {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        const submitButton = document.getElementById('submitOrder');
        const submitText = document.getElementById('submitText');

        try {
            // Show loading state
            submitButton.disabled = true;
            submitText.innerHTML = '<span class="spinner"></span> Processing Order...';

            // Prepare order data for API
            const orderData = {
                items: cart.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: parseFloat(item.price),
                    quantity: parseInt(item.quantity),
                    image: item.image,
                    size: item.size || 'N/A'
                })),
                customer_name: document.getElementById('fullName').value,
                customer_email: document.getElementById('email').value,
                customer_phone: document.getElementById('phone').value,
                customer_address: document.getElementById('address').value,
                city: document.getElementById('city').value,
                zip_code: document.getElementById('zipCode').value,
                country: document.getElementById('country').value,
                payment_method: document.querySelector('input[name="payment_method"]:checked').value,
                total_amount: parseFloat(document.getElementById('total').textContent.replace(/[^0-9.]/g, ''))
            };

            // Send order to backend
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || 'Failed to place order');
            }

            // Clear cart and redirect on success
            localStorage.removeItem('sports_jersey_cart');
            window.location.href = result.redirect_url;

        } catch (error) {
            console.error('Order submission error:', error);
            showToast(`Order failed: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitText.textContent = 'Place Order';
        }
    }

    /**
     * Updates the order summary on the checkout page
     */
    function updateOrderSummary() {
        const orderItemsContainer = document.getElementById('orderItemsContainer');
        const subtotalElement = document.getElementById('subtotal');
        const shippingElement = document.getElementById('shipping');
        const taxElement = document.getElementById('tax');
        const totalElement = document.getElementById('total');

        if (cart.length === 0) {
            orderItemsContainer.innerHTML = '<p>Your cart is empty</p>';
            return;
        }

        let subtotal = 0;
        orderItemsContainer.innerHTML = cart.map(item => {
            const price = parseFloat(item.price);
            const quantity = parseInt(item.quantity) || 1;
            const itemTotal = price * quantity;
            subtotal += itemTotal;
            
            return `
                <div class="order-item">
                    <img src="/static/${item.image}" alt="${item.name}">
                    <div class="order-item-details">
                        <div class="order-item-name">${item.name}</div>
                        <div class="order-item-meta">Size: ${item.size || 'N/A'}</div>
                        <div class="order-item-price">${formatCurrency(price)} × ${quantity}</div>
                        <div class="order-item-total">${formatCurrency(itemTotal)}</div>
                    </div>
                </div>
            `;
        }).join('');

        const shipping = subtotal > 10000 ? 0 : 1000; // Free shipping over ₦10,000
        const tax = subtotal * 0.075; // 7.5% tax
        const total = subtotal + shipping + tax;
        
        subtotalElement.textContent = formatCurrency(subtotal);
        shippingElement.textContent = formatCurrency(shipping);
        taxElement.textContent = formatCurrency(tax);
        totalElement.textContent = formatCurrency(total);
    }

    /**
     * Proceeds to checkout page
     */
    function proceedToCheckout() {
        if (cart.length === 0) {
            showToast('Your cart is empty!', 'error');
            return;
        }
        
        // Close cart modal if open
        if (cartModal) {
            cartModal.style.display = 'none';
            document.body.style.overflow = '';
        }
        
        // Save cart and redirect
        saveCart();
        window.location.href = '/checkout';
    }

    // =============================================
    // 5. EVENT LISTENERS & SETUP
    // =============================================
    
    /**
     * Sets up event listeners for cart items
     */
    function setupCartItemEventListeners() {
        document.querySelectorAll('.remove-from-cart').forEach(button => {
            button.addEventListener('click', function() {
                removeFromCart(this.dataset.id);
            });
        });

        document.querySelectorAll('.quantity-btn.increase').forEach(button => {
            button.addEventListener('click', function() {
                updateQuantity(this.dataset.id, 1);
            });
        });

        document.querySelectorAll('.quantity-btn.decrease').forEach(button => {
            button.addEventListener('click', function() {
                updateQuantity(this.dataset.id, -1);
            });
        });
    }

    /**
     * Sets up event listeners for add-to-cart buttons
     */
    function setupAddToCartButtons() {
        document.addEventListener('click', function(e) {
            const button = e.target.closest('.add-to-cart');
            if (!button) return;

            const priceValue = button.dataset.price.replace(/[^0-9.]/g, '');
            
            const product = {
                id: button.dataset.id || 'no-id',
                name: button.dataset.name || 'Unnamed Product',
                price: parseFloat(priceValue) || 0,
                image: button.dataset.image || 'image/placeholder.jpg'
            };
            
            addToCart(product);
            
            // Visual feedback
            button.classList.add('added');
            setTimeout(() => button.classList.remove('added'), 1000);
        });
    }

    /**
     * Sets up the cart modal
     */
    function setupCartModal() {
        if (!cartIcon || !cartModal) return;

        cartIcon.addEventListener('click', function(e) {
            e.preventDefault();
            renderCartItems();
            cartModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });

        if (closeButton) {
            closeButton.addEventListener('click', function() {
                cartModal.style.display = 'none';
                document.body.style.overflow = '';
            });
        }

        window.addEventListener('click', function(e) {
            if (e.target === cartModal) {
                cartModal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    }

    // =============================================
    // 6. INITIALIZATION
    // =============================================
    
    // Initialize cart modal and buttons
    setupCartModal();
    setupAddToCartButtons();
    updateCartCount();

    // Set up checkout button if it exists
    if (checkoutButton) {
        checkoutButton.addEventListener('click', proceedToCheckout);
    }

    // Set up checkout form submission if on checkout page
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', handleOrderSubmission);
        updateOrderSummary();
    }

    // Set up payment method visibility toggle
    document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const creditCardDetails = document.getElementById('creditCardDetails');
            if (this.value === 'credit_card') {
                creditCardDetails.style.display = 'block';
            } else {
                creditCardDetails.style.display = 'none';
            }
        });
    });
});