const roleConfig = {
  buyer: {
    title: "Sign in as a buyer",
    subtitle: "Pick up where you left off.",
    eyebrow: "Welcome back",
    submit: "Continue as buyer",
  },

  seller: {
    title: "Sign in as a seller",
    subtitle: "Keep your shop floor moving.",
    eyebrow: "Seller workspace",
    submit: "Open seller desk",
  },

  admin: {
    title: "Sign in as an admin",
    subtitle: "See the whole siva_mart picture.",
    eyebrow: "Private access",
    submit: "Enter admin console",
  }
};

let selectedRole = "buyer";

/* =========================
   ELEMENTS
========================= */

const form = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");

const message = document.querySelector("#form-message");
const loginMessage = message;

const password = document.querySelector("#password");
const submitButton = document.querySelector(".submit-button");

const accountSummary = document.querySelector("#account-summary");
const loginHeading = document.querySelector("#login-heading");

const API_BASE_URL = window.location.origin === "null"
  ? "http://localhost:8080"
  : window.location.origin;
const pageShell = document.querySelector(".page-shell");
const buyerApp = document.querySelector("#buyer-app");
const sellerApp = document.querySelector("#seller-app");
const adminApp = document.querySelector("#admin-app");

const buyerSearch = document.querySelector("#buyer-search");
const productGrid = document.querySelector("#buyer-products");
const cartItemsContainer = document.querySelector("#cart-items");
const wishlistItemsContainer = document.querySelector("#wishlist-items");
const orderHistoryContainer = document.querySelector("#order-history");
const categoryList = document.querySelector("#category-list");
const buyerProductCount = document.querySelector("#product-count");
const buyerCartCount = document.querySelector("#cart-count");
const wishlistCount = document.querySelector("#wishlist-count");
const cartTotalItems = document.querySelector("#cart-total-items");
const cartSubtotal = document.querySelector("#cart-subtotal");

const sellerProducts = document.querySelector("#seller-products");
const sellerOrders = document.querySelector("#seller-orders");
const sellerForm = document.querySelector("#seller-product-form");
const sellerProductId = document.querySelector("#product-id");
const sellerProductName = document.querySelector("#product-name");
const sellerProductCategory = document.querySelector("#product-category");
const sellerProductDescription = document.querySelector("#product-description");
const sellerProductPrice = document.querySelector("#product-price");
const sellerProductStock = document.querySelector("#product-stock");
const sellerProductImage = document.querySelector("#product-image");
const sellerProductBrand = document.querySelector("#product-brand");

let buyerCurrentCategory = "all";
let buyerSearchTerm = "";

function currentUser() {
  try {
    const saved = sessionStorage.getItem("siva_mart_user");
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    return null;
  }
}

function getAuthHeaders() {
  const user = currentUser();
  return {
    "Content-Type": "application/json",
    "x-user-id": user ? String(user.id) : "",
    "x-user-role": user ? user.role : ""
  };
}

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Unexpected response from server (HTTP ${response.status}). Restart the backend and try again.`);
  }

  return response.json();
}

function hideAllApps() {
  if (buyerApp) buyerApp.classList.add("hidden-form");
  if (sellerApp) sellerApp.classList.add("hidden-form");
  if (adminApp) adminApp.classList.add("hidden-form");
  if (pageShell) pageShell.classList.add("hidden-form");
}

function showLogin() {
  if (buyerApp) buyerApp.classList.add("hidden-form");
  if (sellerApp) sellerApp.classList.add("hidden-form");
  if (adminApp) adminApp.classList.add("hidden-form");
  if (pageShell) pageShell.classList.remove("hidden-form");
  if (form) form.classList.remove("hidden-form");
  if (signupForm) signupForm.classList.add("hidden-form");
  if (accountSummary) accountSummary.classList.add("hidden-form");
  if (loginHeading) loginHeading.classList.remove("hidden-form");
}

function showSignup() {
  if (buyerApp) buyerApp.classList.add("hidden-form");
  if (sellerApp) sellerApp.classList.add("hidden-form");
  if (pageShell) pageShell.classList.remove("hidden-form");
  if (form) form.classList.add("hidden-form");
  if (signupForm) signupForm.classList.remove("hidden-form");
  if (accountSummary) accountSummary.classList.add("hidden-form");
  if (loginHeading) loginHeading.classList.add("hidden-form");
}

function updateAccountSummary(user) {
  const accountName = document.querySelector("#account-name");
  const accountRole = document.querySelector("#account-role");
  const sellerStoreName = document.querySelector("#seller-store-name");

  if (accountName) {
    accountName.textContent = user?.full_name || user?.email || "Signed in user";
  }

  if (accountRole) {
    const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Account";
    accountRole.textContent = `Role: ${roleLabel}`;
  }

  if (sellerStoreName) {
    sellerStoreName.textContent = user?.store_name || "";
    sellerStoreName.classList.toggle("hidden-form", !user?.store_name);
  }
}

function showAccount(user) {
  if (!user || !user.role) {
    showLogin();
    return;
  }

  updateAccountSummary(user);

  if (user.role === "seller") {
    showSellerView();
    return;
  }

  if (user.role === "admin") {
    showAdminView();
    return;
  }

  showBuyerView();
}

function showSellerView() {
  hideAllApps();
  if (sellerApp) sellerApp.classList.remove("hidden-form");
  if (pageShell) pageShell.classList.add("hidden-form");
  if (accountSummary) accountSummary.classList.add("hidden-form");
  loadSellerProducts();
  loadSellerOrders();
}

function showBuyerView() {
  hideAllApps();
  if (buyerApp) buyerApp.classList.remove("hidden-form");
  if (pageShell) pageShell.classList.add("hidden-form");
  if (accountSummary) accountSummary.classList.add("hidden-form");
  loadBuyerDashboard();
}

function showAdminView() {
  hideAllApps();
  if (adminApp) adminApp.classList.remove("hidden-form");
  if (pageShell) pageShell.classList.add("hidden-form");
  if (accountSummary) accountSummary.classList.add("hidden-form");
  setActiveAdminSection("overview");
  const profileName = document.querySelector("#admin-profile-name");
  if (profileName) {
    profileName.textContent = currentUser()?.full_name || "Siva Mart Admin";
  }
  loadAdminDashboard();
}

function showLogoutMessage() {
  if (!loginMessage) return;
  loginMessage.textContent = "You have been logged out.";
  loginMessage.className = "form-message success";
}

function resetSellerForm() {
  sellerForm.reset();
  sellerProductId.value = "";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function setActiveAdminSection(view) {
  const sections = [
    { key: "overview", element: document.querySelector("#admin-overview") },
    { key: "users", element: document.querySelector("#admin-users") },
    { key: "products", element: document.querySelector("#admin-products") },
    { key: "orders", element: document.querySelector("#admin-orders") }
  ];

  sections.forEach(({ key, element }) => {
    if (element) {
      element.classList.toggle("hidden-form", key !== view);
    }
  });

  document.querySelectorAll(".admin-nav-btn").forEach((button) => {
    const active = button.dataset.adminView === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const pageTitle = document.querySelector("#admin-page-title");
  if (pageTitle) {
    const labels = {
      overview: "Overview",
      users: "Users",
      products: "Products",
      orders: "Orders"
    };
    pageTitle.textContent = labels[view] || "Overview";
  }
}

async function loadAdminDashboard() {
  await Promise.all([
    loadAdminStats(),
    loadAdminUsers(),
    loadAdminProducts(),
    loadAdminOrders()
  ]);
}

async function loadAdminStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/stats`, { headers: getAuthHeaders() });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.message || "Unable to load stats.");

    const totals = result.totals || {};
    document.querySelector("#admin-total-users").textContent = String(totals.users || 0);
    document.querySelector("#admin-total-buyers").textContent = String(totals.buyers || 0);
    document.querySelector("#admin-total-sellers").textContent = String(totals.sellers || 0);
    document.querySelector("#admin-total-products").textContent = String(totals.products || 0);
    document.querySelector("#admin-total-orders").textContent = String(totals.orders || 0);
    document.querySelector("#admin-total-order-value").textContent = formatCurrency(totals.orderValue || 0);
  } catch (error) {
    console.error("Admin stats failed", error);
    const valueNode = document.querySelector("#admin-total-order-value");
    if (valueNode) valueNode.textContent = "Unavailable";
  }
}

async function loadAdminUsers() {
  try {
    const searchInput = document.querySelector("#admin-user-search");
    const roleInput = document.querySelector("#admin-user-role-filter");
    const params = new URLSearchParams();

    if (searchInput && searchInput.value.trim()) params.set("search", searchInput.value.trim());
    if (roleInput && roleInput.value && roleInput.value !== "all") params.set("role", roleInput.value);

    const response = await fetch(`${API_BASE_URL}/api/admin/users?${params.toString()}`, { headers: getAuthHeaders() });
    const users = await readApiResponse(response);
    if (!response.ok) throw new Error(users.message || "Unable to load users.");

    const tbody = document.querySelector("#admin-users-body");
    if (!tbody) return;

    tbody.innerHTML = users.length
      ? users.map((user) => `
        <tr>
          <td>${user.id}</td>
          <td>${user.full_name || "—"}</td>
          <td>${user.email || "—"}</td>
          <td><span class="admin-role-badge admin-role-${user.role || "unknown"}">${(user.role || "User").toUpperCase()}</span></td>
          <td>${user.created_at ? new Date(user.created_at).toLocaleDateString("en-IN") : "—"}</td>
        </tr>
      `).join("")
      : '<tr><td colspan="5" class="empty-state">No users match your filters.</td></tr>';
  } catch (error) {
    const tbody = document.querySelector("#admin-users-body");
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Unable to load users right now.</td></tr>';
    console.error("Admin users failed", error);
  }
}

async function loadAdminProducts() {
  try {
    const categorySelect = document.querySelector("#admin-product-category-filter");
    const response = await fetch(`${API_BASE_URL}/api/categories`);
    const categories = await response.json();

    if (categorySelect) {
      const selectedValue = categorySelect.value || "all";
      categorySelect.innerHTML = '<option value="all">All categories</option>' + categories.map((category) => `<option value="${category.id}">${category.name}</option>`).join("");
      categorySelect.value = categories.some((category) => String(category.id) === String(selectedValue)) ? selectedValue : "all";
    }

    const searchInput = document.querySelector("#admin-product-search");
    const params = new URLSearchParams();

    if (searchInput && searchInput.value.trim()) params.set("search", searchInput.value.trim());
    if (categorySelect && categorySelect.value && categorySelect.value !== "all") params.set("category", categorySelect.value);

    const productResponse = await fetch(`${API_BASE_URL}/api/admin/products?${params.toString()}`, { headers: getAuthHeaders() });
    const products = await readApiResponse(productResponse);
    if (!productResponse.ok) throw new Error(products.message || "Unable to load products.");

    const tbody = document.querySelector("#admin-products-body");
    if (!tbody) return;

    tbody.innerHTML = products.length
      ? products.map((product) => `
        <tr>
          <td>${product.id}</td>
          <td>${product.name || "—"}</td>
          <td>${formatCurrency(product.price || 0)}</td>
          <td>${product.stock ?? 0}</td>
          <td>${product.category_name || "General"}</td>
          <td>${product.seller_name || product.store_name || "Unknown seller"}</td>
          <td><button type="button" class="secondary-button admin-delete-btn" data-admin-delete-product="${product.id}">Delete</button></td>
        </tr>
      `).join("")
      : '<tr><td colspan="7" class="empty-state">No products match your filters.</td></tr>';

    document.querySelectorAll("[data-admin-delete-product]").forEach((button) => {
      button.addEventListener("click", async () => {
        const productId = Number(button.dataset.adminDeleteProduct);
        if (!productId) return;
        if (!window.confirm("Delete this product? Existing order history may block the action to protect marketplace records.")) {
          return;
        }
        try {
          const response = await fetch(`${API_BASE_URL}/api/admin/products/${productId}`, {
            method: "DELETE",
            headers: getAuthHeaders()
          });
          const result = await readApiResponse(response);
          if (!response.ok) throw new Error(result.message || "Unable to delete product.");
          alert(result.message || "Product deleted successfully.");
          await loadAdminDashboard();
        } catch (error) {
          alert(error.message || "Unable to delete product.");
        }
      });
    });
  } catch (error) {
    const tbody = document.querySelector("#admin-products-body");
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Unable to load products right now.</td></tr>';
    console.error("Admin products failed", error);
  }
}

async function loadAdminOrders() {
  try {
    const searchInput = document.querySelector("#admin-order-search");
    const statusInput = document.querySelector("#admin-order-status-filter");
    const params = new URLSearchParams();

    if (searchInput && searchInput.value.trim()) params.set("search", searchInput.value.trim());
    if (statusInput && statusInput.value && statusInput.value !== "all") params.set("status", statusInput.value);

    const response = await fetch(`${API_BASE_URL}/api/admin/orders?${params.toString()}`, { headers: getAuthHeaders() });
    const orders = await readApiResponse(response);
    if (!response.ok) throw new Error(orders.message || "Unable to load orders.");

    const tbody = document.querySelector("#admin-orders-body");
    if (!tbody) return;

    tbody.innerHTML = orders.length
      ? orders.map((order) => `
        <tr>
          <td>#${order.id}</td>
          <td>${order.buyer_name || order.buyer_email || "Unknown buyer"}</td>
          <td><span class="admin-role-badge admin-status-${String(order.status || "unknown").toLowerCase()}">${String(order.status || "Unknown").toUpperCase()}</span></td>
          <td>${formatCurrency(order.total_amount || 0)}</td>
          <td>${Number(order.item_count || 0)}</td>
          <td>${order.created_at ? new Date(order.created_at).toLocaleDateString("en-IN") : "—"}</td>
        </tr>
      `).join("")
      : '<tr><td colspan="6" class="empty-state">No orders match your filters.</td></tr>';
  } catch (error) {
    const tbody = document.querySelector("#admin-orders-body");
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Unable to load orders right now.</td></tr>';
    console.error("Admin orders failed", error);
  }
}

async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/categories`);
    const categories = await response.json();
    const buttons = [{ id: "all", name: "All"}, ...categories];

    categoryList.innerHTML = buttons.map((category) => `
      <button type="button" class="category-button ${buyerCurrentCategory === category.id ? "active" : ""}" data-category="${category.id}">
        ${category.name}
      </button>
    `).join("");

    document.querySelectorAll(".category-button").forEach((button) => {
      button.addEventListener("click", () => {
        buyerCurrentCategory = button.dataset.category;
        loadProducts();
      });
    });
  } catch (error) {
    console.error("Load categories failed", error);
  }
}

async function loadProducts() {
  try {
    const url = new URL(`${API_BASE_URL}/api/products`);
    if (buyerSearchTerm) url.searchParams.set("search", buyerSearchTerm);
    if (buyerCurrentCategory && buyerCurrentCategory !== "all") url.searchParams.set("category", buyerCurrentCategory);

    const response = await fetch(url);
    const products = await response.json();

    buyerProductCount.textContent = String(products.length);
    productGrid.innerHTML = products.length
      ? products.map((product) => `
        <article class="product-card">
          <img src="${product.image_url || "https://images.unsplash.com/..."}" alt="${product.name}" />
          <div class="product-card-body">
            <h5>${product.name}</h5>
            <div class="product-meta">${product.category_name || "General"} • ${product.brand || "Brand"}</div>
            <div class="product-price">${formatCurrency(product.price)}</div>
            <div class="product-meta">Available stock: ${product.stock}</div>
            <div class="product-actions">
              <button type="button" class="submit-button" data-add-cart="${product.id}">Add to Cart</button>
              <button type="button" class="secondary-button" data-save-wishlist="${product.id}">♡ Wishlist</button>
            </div>
          </div>
        </article>
      `).join("")
      : '<div class="empty-state">No products match your search.</div>';

    document.querySelectorAll("[data-add-cart]").forEach((button) => {
      button.addEventListener("click", async () => {
        await addToCart(Number(button.dataset.addCart));
      });
    });

    document.querySelectorAll("[data-save-wishlist]").forEach((button) => {
      button.addEventListener("click", async () => {
        await saveWishlist(Number(button.dataset.saveWishlist));
      });
    });
  } catch (error) {
    console.error("Load products failed", error);
  }
}

async function loadCart() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cart`, { headers: getAuthHeaders() });
    const cart = await readApiResponse(response);
    if (!response.ok) throw new Error(cart.message || "Unable to load cart.");
    cartItemsContainer.innerHTML = cart.items && cart.items.length
      ? cart.items.map((item) => `
        <div class="mini-item">
          <strong>${item.product_name}</strong>
          <div>Qty: ${item.quantity} • ${formatCurrency(item.price)}</div>
          <div class="seller-product-actions">
            <button type="button" class="secondary-button" data-cart-inc="${item.id}">+</button>
            <button type="button" class="secondary-button" data-cart-dec="${item.id}">-</button>
            <button type="button" class="secondary-button" data-cart-remove="${item.id}">Remove</button>
          </div>
        </div>
      `).join("")
      : '<div class="empty-state">Your cart is empty.</div>';

    cartTotalItems.textContent = String(cart.item_count || 0);
    cartSubtotal.textContent = formatCurrency(cart.subtotal || 0);
    buyerCartCount.textContent = String(cart.item_count || 0);

    document.querySelectorAll("[data-cart-inc]").forEach((button) => {
      button.addEventListener("click", async () => {
        const item = cart.items.find((entry) => String(entry.id) === button.dataset.cartInc);
        if (item) await updateCartItem(Number(item.id), Number(item.quantity) + 1);
      });
    });

    document.querySelectorAll("[data-cart-dec]").forEach((button) => {
      button.addEventListener("click", async () => {
        const item = cart.items.find((entry) => String(entry.id) === button.dataset.cartDec);
        if (item && Number(item.quantity) > 1) await updateCartItem(Number(item.id), Number(item.quantity) - 1);
      });
    });

    document.querySelectorAll("[data-cart-remove]").forEach((button) => {
      button.addEventListener("click", async () => {
        await removeCartItem(Number(button.dataset.cartRemove));
      });
    });
  } catch (error) {
    console.error("Cart load failed", error);
  }
}

async function loadWishlist() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wishlist`, { headers: getAuthHeaders() });
    const wishlist = await response.json();
    wishlistItemsContainer.innerHTML = wishlist.length
      ? wishlist.map((item) => `
        <div class="mini-item">
          <strong>${item.name}</strong>
          <div>${formatCurrency(item.price)}</div>
          <button type="button" class="secondary-button" data-remove-wishlist="${item.product_id}">Remove</button>
        </div>
      `).join("")
      : '<div class="empty-state">No saved wishlist items.</div>';

    wishlistCount.textContent = String(wishlist.length);

    document.querySelectorAll("[data-remove-wishlist]").forEach((button) => {
      button.addEventListener("click", async () => {
        await removeWishlist(Number(button.dataset.removeWishlist));
      });
    });
  } catch (error) {
    console.error("Wishlist load failed", error);
  }
}

async function loadOrders() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/orders`, { headers: getAuthHeaders() });
    const orders = await response.json();
    orderHistoryContainer.innerHTML = orders.length
      ? orders.map((order) => `
        <div class="mini-item">
          <strong>Order #${order.id}</strong>
          <div>${new Date(order.created_at).toLocaleDateString()}</div>
          <div>${(order.items || []).map((item) => `${item.product_name} × ${item.quantity}`).join(", ")}</div>
          <div><b>${formatCurrency(order.total_amount)}</b> • ${order.status}</div>
        </div>
      `).join("")
      : '<div class="empty-state">No orders yet.</div>';
  } catch (error) {
    console.error("Orders load failed", error);
  }
}

async function loadBuyerDashboard() {
  await loadCategories();
  await loadProducts();
  await loadCart();
  await loadWishlist();
  await loadOrders();
}

async function addToCart(productId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cart/items`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ product_id: productId, quantity: 1 })
    });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.message || "Unable to add to cart.");
    await loadCart();
    alert(result.message || "Added to cart.");
  } catch (error) {
    alert(error.message || "Unable to add to cart.");
  }
}

async function updateCartItem(itemId, quantity) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cart/items/${itemId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ quantity })
    });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.message || "Unable to update cart.");
    await loadCart();
  } catch (error) {
    alert(error.message || "Unable to update cart.");
  }
}

async function removeCartItem(itemId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cart/items/${itemId}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to remove item.");
    await loadCart();
  } catch (error) {
    alert(error.message || "Unable to remove item.");
  }
}

async function clearCart() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cart`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to clear cart.");
    await loadCart();
  } catch (error) {
    alert(error.message || "Unable to clear cart.");
  }
}

async function saveWishlist(productId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wishlist`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ product_id: productId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to save wishlist");
    await loadWishlist();
    alert(result.message || "Added to wishlist.");
  } catch (error) {
    alert(error.message || "Unable to save wishlist.");
  }
}

async function removeWishlist(productId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wishlist/${productId}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to remove wishlist item.");
    await loadWishlist();
  } catch (error) {
    alert(error.message || "Unable to remove wishlist item.");
  }
}

async function checkout() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ payment_method: "Cash on Delivery", payment_status: "paid" })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to place order.");
    await loadCart();
    await loadOrders();
    alert(`Order placed successfully. Ref: ${result.payment_reference || "demo-order"}`);
  } catch (error) {
    alert(error.message || "Unable to place order.");
  }
}

async function loadSellerProducts() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/seller/products`, { headers: getAuthHeaders() });
    const products = await readApiResponse(response);
    if (!response.ok) throw new Error(products.message || "Unable to load your products.");
    sellerProducts.innerHTML = products.length
      ? products.map((product) => `
        <div class="seller-product-item">
          ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : ""}
          <div><strong>${product.name}</strong></div>
          <div>${product.category_name || "General"}</div>
          <div>${formatCurrency(product.price)} • Stock: ${product.stock}</div>
          <div>${product.description || "No description added."}</div>
          <div class="seller-product-actions">
            <button type="button" class="secondary-button" data-edit-product="${product.id}">Edit</button>
            <button type="button" class="secondary-button" data-delete-product="${product.id}">Delete</button>
          </div>
        </div>
      `).join("")
      : '<div class="empty-state">No products yet. Add your first product.</div>';

    document.querySelectorAll("[data-edit-product]").forEach((button) => {
      button.addEventListener("click", async () => {
        const productId = Number(button.dataset.editProduct);
        const response = await fetch(`${API_BASE_URL}/api/products/${productId}`);
        const product = await response.json();
        if (!response.ok) return alert(product.message || "Unable to load product.");
        sellerProductId.value = product.id;
        sellerProductName.value = product.name;
        sellerProductCategory.value = product.category_name || "";
        sellerProductDescription.value = product.description || "";
        sellerProductPrice.value = product.price;
        sellerProductStock.value = product.stock;
        sellerProductImage.value = product.image_url || "";
        sellerProductBrand.value = product.brand || "";
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    document.querySelectorAll("[data-delete-product]").forEach((button) => {
      button.addEventListener("click", async () => {
        const productId = Number(button.dataset.deleteProduct);
        if (!window.confirm("Delete this product?")) return;

        const response = await fetch(`${API_BASE_URL}/api/products/${productId}`, {
          method: "DELETE",
          headers: getAuthHeaders()
        });
        const result = await response.json();
        if (!response.ok) return alert(result.message || "Unable to delete product.");
        await loadSellerProducts();
      });
    });
  } catch (error) {
    console.error("Seller products failed", error);
  }
}

async function loadSellerOrders() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/seller/orders`, { headers: getAuthHeaders() });
    const orders = await readApiResponse(response);
    if (!response.ok) throw new Error(orders.message || "Unable to load your orders.");
    sellerOrders.innerHTML = orders.length
      ? orders.map((order) => `
        <div class="order-item">
          <strong>Order #${order.order_id}</strong>
          <div>${order.buyer_name}</div>
          <div>${order.product_name} × ${order.quantity}</div>
          <div>${formatCurrency(order.total_amount || order.subtotal || 0)} • ${order.status || "Confirmed"}</div>
          <div>${new Date(order.created_at).toLocaleDateString()}</div>
        </div>
      `).join("")
      : '<div class="empty-state">No orders for your products yet.</div>';
  } catch (error) {
    console.error("Seller orders failed", error);
  }
}

if (sellerForm) {
  sellerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      name: sellerProductName.value.trim(),
      category: sellerProductCategory.value.trim(),
      description: sellerProductDescription.value.trim(),
      price: Number(sellerProductPrice.value),
      stock: Number(sellerProductStock.value),
      image_url: sellerProductImage.value.trim(),
      brand: sellerProductBrand.value.trim()
    };

    if (!payload.name || !Number.isFinite(payload.price) || payload.price <= 0 || !Number.isFinite(payload.stock) || payload.stock < 0) {
      return alert("Please provide valid product details.");
    }

    const productId = sellerProductId.value;
    const url = productId ? `${API_BASE_URL}/api/products/${productId}` : `${API_BASE_URL}/api/products`;
    const method = productId ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error([result.message, result.error].filter(Boolean).join(": ") || "Unable to save product");
      resetSellerForm();
      await loadSellerProducts();
      alert(result.message || "Product saved successfully.");
    } catch (error) {
      alert(error.message || "Unable to save product.");
    }
  });
}

const cancelEditButton = document.querySelector("#cancel-edit");
if (cancelEditButton) cancelEditButton.addEventListener("click", resetSellerForm);

const buyerLogoutButton = document.querySelector("#buyer-logout");
if (buyerLogoutButton) {
  buyerLogoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("siva_mart_user");
    showLogin();
    showLogoutMessage();
  });
}

const sellerLogoutButton = document.querySelector("#seller-logout");
if (sellerLogoutButton) {
  sellerLogoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("siva_mart_user");
    showLogin();
    showLogoutMessage();
  });
}

const checkoutButton = document.querySelector("#checkout-button");
if (checkoutButton) checkoutButton.addEventListener("click", checkout);

const clearCartButton = document.querySelector("#clear-cart");
if (clearCartButton) clearCartButton.addEventListener("click", clearCart);

const buyerSearchInput = document.querySelector("#buyer-search");
if (buyerSearchInput) {
  buyerSearchInput.addEventListener("input", (event) => {
    buyerSearchTerm = event.target.value.trim();
    loadProducts();
  });
}

function updateRole(role) {
  selectedRole = role;

  const config = roleConfig[role];
  if (!config) return;

  const eyebrow = document.querySelector("#role-eyebrow");
  const loginTitle = document.querySelector("#login-title");
  const loginSubtitle = document.querySelector("#login-subtitle");
  const submitText = document.querySelector("#submit-text");
  const storeNameField = document.querySelector("#store-name-field");
  const storeNameInput = document.querySelector("#store-name");

  if (eyebrow) eyebrow.textContent = config.eyebrow;
  if (loginTitle) loginTitle.textContent = config.title;
  if (loginSubtitle) loginSubtitle.textContent = config.subtitle;
  if (submitText) submitText.textContent = config.submit;
  if (storeNameField) storeNameField.classList.toggle("hidden-form", role !== "seller");
  if (storeNameInput) storeNameInput.required = role === "seller";

  document.querySelectorAll(".role-tab").forEach((tab) => {
    const active = tab.dataset.role === role;

    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  if (message) {
    message.textContent = "";
    message.className = "form-message";
  }
}

document.querySelectorAll(".role-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    updateRole(tab.dataset.role);
  });
});

const signupRoleSelect = document.querySelector("#signup-role");
const signupStoreNameField = document.querySelector("#store-name-field");
const signupStoreNameInput = document.querySelector("#store-name");
if (signupRoleSelect && signupStoreNameField && signupStoreNameInput) {
  const updateSignupStoreName = () => {
    const isSeller = signupRoleSelect.value === "seller";
    signupStoreNameField.classList.toggle("hidden-form", !isSeller);
    signupStoreNameInput.required = isSeller;
  };

  signupRoleSelect.addEventListener("change", updateSignupStoreName);
  updateSignupStoreName();
}

const passwordToggle = document.querySelector("#password-toggle");
if (passwordToggle) {
  passwordToggle.addEventListener("click", (event) => {
    const isPassword = password.type === "password";
    password.type = isPassword ? "text" : "password";
    event.currentTarget.textContent = isPassword ? "Hide" : "Show";
    event.currentTarget.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  });
}

const forgotButton = document.querySelector("#forgot-link");
if (forgotButton) {
  forgotButton.addEventListener("click", (event) => {
    event.preventDefault();
    if (message) {
      message.textContent = "Password reset is available from the shop administrator.";
      message.className = "form-message";
    }
  });
}

const showSignupButton = document.querySelector("#show-signup");
if (showSignupButton) {
  showSignupButton.addEventListener("click", (event) => {
    event.preventDefault();
    showSignup();
  });
}

const showLoginButton = document.querySelector("#show-login");
if (showLoginButton) {
  showLoginButton.addEventListener("click", (event) => {
    event.preventDefault();
    showLogin();
  });
}

const logoutButton = document.querySelector("#logout-button");
if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("siva_mart_user");
    if (form) form.reset();
    showLogin();
    showLogoutMessage();
  });
}

const adminLogoutButton = document.querySelector("#admin-logout");
if (adminLogoutButton) {
  adminLogoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("siva_mart_user");
    showLogin();
    showLogoutMessage();
  });
}

document.querySelectorAll(".admin-nav-btn").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveAdminSection(button.dataset.adminView || "overview");
  });
});

const adminUserSearch = document.querySelector("#admin-user-search");
if (adminUserSearch) adminUserSearch.addEventListener("input", loadAdminUsers);

const adminUserRoleFilter = document.querySelector("#admin-user-role-filter");
if (adminUserRoleFilter) adminUserRoleFilter.addEventListener("change", loadAdminUsers);

const adminProductSearch = document.querySelector("#admin-product-search");
if (adminProductSearch) adminProductSearch.addEventListener("input", loadAdminProducts);

const adminProductCategoryFilter = document.querySelector("#admin-product-category-filter");
if (adminProductCategoryFilter) adminProductCategoryFilter.addEventListener("change", loadAdminProducts);

const adminOrderSearch = document.querySelector("#admin-order-search");
if (adminOrderSearch) adminOrderSearch.addEventListener("input", loadAdminOrders);

const adminOrderStatusFilter = document.querySelector("#admin-order-status-filter");
if (adminOrderStatusFilter) adminOrderStatusFilter.addEventListener("change", loadAdminOrders);

const adminRefreshProducts = document.querySelector("#admin-refresh-products");
if (adminRefreshProducts) {
  adminRefreshProducts.addEventListener("click", () => {
    loadAdminProducts();
    loadAdminStats();
  });
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const signupMessage = document.querySelector("#signup-message");
  const fullName = document.querySelector("#full-name").value.trim();
  const email = document.querySelector("#signup-email").value.trim();
  const passwordValue = document.querySelector("#signup-password").value;
  const confirmPassword = document.querySelector("#confirm-password").value;
  const role = document.querySelector("#signup-role").value;
  const storeName = document.querySelector("#store-name").value.trim();

  signupMessage.textContent = "";
  signupMessage.className = "form-message";

  if (!fullName || !email || !passwordValue || !confirmPassword || !role || (role === "seller" && !storeName)) {
    signupMessage.textContent = "Complete all fields to create your account.";
    signupMessage.className = "form-message error";
    return;
  }

  if (passwordValue !== confirmPassword) {
    signupMessage.textContent = "Passwords do not match.";
    signupMessage.className = "form-message error";
    return;
  }

  if (passwordValue.length < 6) {
    signupMessage.textContent = "Password must contain at least 6 characters.";
    signupMessage.className = "form-message error";
    return;
  }

  const createButton = signupForm.querySelector(".submit-button");
  createButton.disabled = true;
  createButton.textContent = "Creating account...";

  try {
    const response = await fetch(`${API_BASE_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, full_name: fullName, email, password: passwordValue, role, store_name: storeName })
    });

    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.message || "Unable to create account.");

    signupForm.reset();
    showLogin();
    document.querySelector("#email").value = result.user.email;
    updateRole(result.user.role);
    loginMessage.textContent = "Account created successfully. Please login.";
    loginMessage.className = "form-message success";
  } catch (error) {
    signupMessage.textContent = error.message || "Unable to create account right now.";
    signupMessage.className = "form-message error";
  } finally {
    createButton.disabled = false;
    createButton.textContent = "Create Account";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  message.textContent = "";
  message.className = "form-message";

  const email = document.querySelector("#email").value.trim();
  const passwordValue = password.value;

  if (!email || !passwordValue) {
    message.textContent = "Enter your email and password to continue.";
    message.className = "form-message error";
    return;
  }

  submitButton.disabled = true;
  document.querySelector("#submit-text").textContent = "Checking access...";

  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: selectedRole, email, password: passwordValue })
    });

    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.message || "Incorrect email or password.");

    sessionStorage.setItem("siva_mart_user", JSON.stringify(result.user));
    showAccount(result.user);
  } catch (error) {
    message.textContent = error.message || "Unable to sign in right now.";
    message.className = "form-message error";
  } finally {
    submitButton.disabled = false;
    document.querySelector("#submit-text").textContent = roleConfig[selectedRole].submit;
  }
});

const savedUser = sessionStorage.getItem("siva_mart_user");
if (savedUser) {
  try {
    showAccount(JSON.parse(savedUser));
  } catch (error) {
    console.error("Invalid saved user:", error);
    sessionStorage.removeItem("siva_mart_user");
    showLogin();
  }
} else {
  showLogin();
}

updateRole("buyer");
resetSellerForm();