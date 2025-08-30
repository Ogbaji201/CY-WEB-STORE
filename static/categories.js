
document.addEventListener('DOMContentLoaded', async () => {
    // --- Constants ---
    const API_BASE_URL = 'http://localhost:8000/api';
    
    // --- DOM Elements ---
    const menuToggle = document.querySelector('.menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    const productsContainer = document.getElementById('products-container');
    const cartCountSpan = document.querySelector('.cart-count');
    const cartModal = document.getElementById('cart-modal');
    const closeButton = document.querySelector('.close-button');
    const cartIcon = document.querySelector('.cart-icon');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalSpan = document.getElementById('cart-total');
    const checkoutButton = document.getElementById('checkout-button');
    const contactForm = document.querySelector('.contact-form');
    const checkoutForm = document.getElementById('checkout-form');

    // --- State ---
    let cart = JSON.parse(localStorage.getItem('sports_jersey_cart')) || [];
    let products = [];

    // --- Initialize ---
    await loadProducts();
    initMobileMenu();
    initImageSlider();
    updateCartCount();

    // --- Functions ---

    // Initialize mobile menu toggle
    function initMobileMenu() {
        menuToggle.addEventListener('click', () => {
            mainNav.classList.toggle('active');
        });

        document.querySelectorAll('.main-nav a').forEach(link => {
            link.addEventListener('click', () => {
                if (mainNav.classList.contains('active')) {
                    mainNav.classList.remove('active');
                }
            });
        });
    }

    // Initialize image slider
    function initImageSlider() {
        let slideIndex = 0;
        const slides = document.querySelector(".slides");
        const totalSlides = slides.children.length;

        function showSlide(index) {
            if (index >= totalSlides) slideIndex = 0;
            if (index < 0) slideIndex = totalSlides - 1;
            slides.style.transform = `translateX(-${slideIndex * 100}%)`;
        }

        function moveSlide(n) {
            slideIndex += n;
            showSlide(slideIndex);
        }

        // Auto-slide
        let autoSlide = setInterval(() => moveSlide(1), 3000);

        // Pause on hover
        const slider = document.querySelector(".slider");
        slider.addEventListener("mouseenter", () => clearInterval(autoSlide));
        slider.addEventListener("mouseleave", () => {
            autoSlide = setInterval(() => moveSlide(1), 3000);
        });

        showSlide(slideIndex);
    }

    // Load products from backend
    async function loadProducts() {
        try {
            const response = await fetch(`${API_BASE_URL}/products`);
            if (!response.ok) throw new Error('Failed to load products');
            
            products = await response.json();
            renderProducts(products);
        } catch (error) {
            console.error('Error loading products:', error);
            // Fallback to local products if API fails
            products = getLocalProducts();
            renderProducts(products);
        }
    }

    // Local product data fallback
    function getLocalProducts() {
        return [
            {
                id: 'prod1',
                name: 'ProFlex Running Jersey',
                category: 'Sporting Jerseys',
                price: 49.99,
                image: '/static/image/j1.jpeg'
            },
            {
                id: 'prod2',
                name: 'Distressed Slim Fit Jeans',
                category: 'Fashionable Jeans',
                price: 79.99,
                image: '/static/image/White_Jeans.jpeg'
            },
            {
                id: 'prod3',
                name: 'Urban Vibe Oversized T-Shirt',
                category: 'Trendy T-shirts',
                price: 29.99,
                image: '/static/image/polo1.jpeg'
            }
        ];
    }

    // Render products to the page
    function renderProducts(productsToRender) {
        if (!productsContainer) {
            console.error('Products container not found');
            return;
        }
        
        productsContainer.innerHTML = '';
        
        const fragment = document.createDocumentFragment();
        
        productsToRender.forEach(product => {
            const productCard = document.createElement('div');
            productCard.classList.add('product-card');
            productCard.innerHTML = `
                <img src="${product.image}" alt="${product.name}" class="product-image"
                     onerror="this.src='https://placehold.co/400x400/cccccc/999999?text=Image+Not+Available'">
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <p class="category">${product.category}</p>
                    <p class="price">₦${product.price.toFixed(2)}</p>
                    <button class="add-to-cart" data-product-id="${product.id}">Add to Cart</button>
                </div>
            `;
            fragment.appendChild(productCard);
        });
        
        productsContainer.appendChild(fragment);
        attachAddToCartListeners();
    }

    // Cart management functions
    function updateCartCount() {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCountSpan) {
            cartCountSpan.textContent = totalItems;
        }
    }

    function saveCart() {
        localStorage.setItem('sports_jersey_cart', JSON.stringify(cart));
    }

    function addToCart(product) {
        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        saveCart();
        updateCartCount();
        showToast(`${product.name} added to cart!`);
        renderCartItems();
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        saveCart();
        updateCartCount();
        renderCartItems();
    }

    function renderCartItems() {
        if (!cartItemsContainer) return;
        
        cartItemsContainer.innerHTML = '';
        let total = 0;
        
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="text-center text-gray-medium">Your cart is empty.</p>';
        } else {
            cart.forEach(item => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;
                
                const cartItemDiv = document.createElement('div');
                cartItemDiv.classList.add('cart-item');
                cartItemDiv.innerHTML = `
                    <img src="${item.image}" alt="${item.name}" onerror="this.src='https://placehold.co/100x100?text=Product'">
                    <div class="cart-item-details">
                        <h4>${item.name}</h4>
                        <div class="quantity-controls">
                            <button class="quantity-btn minus" data-product-id="${item.id}">-</button>
                            <span class="quantity">${item.quantity}</span>
                            <button class="quantity-btn plus" data-product-id="${item.id}">+</button>
                        </div>
                        <p>₦${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <button class="remove-from-cart" data-product-id="${item.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                cartItemsContainer.appendChild(cartItemDiv);
            });
        }
        
        if (cartTotalSpan) {
            cartTotalSpan.textContent = total.toFixed(2);
        }
        attachCartItemListeners();
    }

    // Event listener attachments
    function attachAddToCartListeners() {
        document.querySelectorAll('.add-to-cart').forEach(button => {
            button.addEventListener('click', (event) => {
                const productId = event.target.dataset.productId;
                const product = products.find(p => p.id === productId);
                if (product) addToCart(product);
            });
        });
    }

    function attachCartItemListeners() {
        document.querySelectorAll('.remove-from-cart').forEach(button => {
            button.addEventListener('click', (event) => {
                const productId = event.currentTarget.dataset.productId;
                removeFromCart(productId);
            });
        });

        document.querySelectorAll('.quantity-btn.minus').forEach(button => {
            button.addEventListener('click', (event) => {
                const productId = event.currentTarget.dataset.productId;
                const item = cart.find(item => item.id === productId);
                if (item && item.quantity > 1) {
                    item.quantity--;
                    saveCart();
                    updateCartCount();
                    renderCartItems();
                }
            });
        });

        document.querySelectorAll('.quantity-btn.plus').forEach(button => {
            button.addEventListener('click', (event) => {
                const productId = event.currentTarget.dataset.productId;
                const item = cart.find(item => item.id === productId);
                if (item) {
                    item.quantity++;
                    saveCart();
                    updateCartCount();
                    renderCartItems();
                }
            });
        });
    }

    // Modal handling
    if (cartIcon) {
        cartIcon.addEventListener('click', (e) => {
            e.preventDefault();
            renderCartItems();
            if (cartModal) {
                cartModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        });
    }

    if (closeButton) {
        closeButton.addEventListener('click', () => {
            if (cartModal) {
                cartModal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target === cartModal) {
            cartModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    });

    // Checkout functionality
    if (checkoutButton) {
        checkoutButton.addEventListener('click', async () => {
            if (cart.length === 0) {
                showToast('Your cart is empty!', 'error');
                return;
            }

            const checkoutModal = document.getElementById('checkout-modal');
            if (checkoutModal) {
                checkoutModal.style.display = 'flex';
            }
        });
    }

    // Handle checkout form submission
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(checkoutForm);
            const customerData = {
                name: formData.get('name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                address: formData.get('address')
            };
            
            try {
                const response = await fetch(`${API_BASE_URL}/orders`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        items: cart.map(item => ({
                            id: item.id,
                            name: item.name,
                            price: item.price,
                            quantity: item.quantity,
                            image: item.image
                        })),
                        ...customerData
                    })
                });
                
                if (!response.ok) throw new Error('Checkout failed');
                
                const result = await response.json();
                showToast(`Order #${result.order_id} placed successfully!`, 'success');
                
                // Clear cart
                cart = [];
                saveCart();
                updateCartCount();
                renderCartItems();
                
                // Close modals
                const checkoutModal = document.getElementById('checkout-modal');
                if (checkoutModal) checkoutModal.style.display = 'none';
                if (cartModal) cartModal.style.display = 'none';
                document.body.style.overflow = '';
                
                // Reset form
                checkoutForm.reset();
                
            } catch (error) {
                console.error('Checkout error:', error);
                showToast('Checkout failed. Please try again.', 'error');
            }
        });
    }

    // Contact form handling
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(contactForm);
            const contactData = {
                name: formData.get('name'),
                email: formData.get('email'),
                message: formData.get('message')
            };
            
            try {
                const response = await fetch(`${API_BASE_URL}/contact`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(contactData)
                });
                
                if (!response.ok) throw new Error('Message failed');
                
                const result = await response.json();
                showToast(result.message, 'success');
                contactForm.reset();
                
            } catch (error) {
                console.error('Contact form error:', error);
                showToast('Failed to send message. Please try again.', 'error');
            }
        });
    }

    // Utility function for toast notifications
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
});