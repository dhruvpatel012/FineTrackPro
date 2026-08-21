// --- Storage: persistence helpers ---

const STORAGE_USERS = "fintrackpro_users";
const STORAGE_SESSION = "fintrackpro_session";

// Namespace keys per user to isolate data in local storage
function userKey(base, username) {
  return `fintrackpro_${base}_${username}`;
}

// Fallback protects against corrupt JSON payloads or disabled storage
function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error("Failed to read storage key:", key, err);
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- Notifications: toast dispatch ---

function showToast(message, isError = false) {
  const container = document.getElementById("toastContainer");

  const toast = document.createElement("div");
  toast.className = "toast" + (isError ? " error" : "");
  toast.innerHTML = `
    <i class="${isError ? "ri-error-warning-line" : "ri-checkbox-circle-line"}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// --- Auth: session management ---

function getUsers() {
  return readStorage(STORAGE_USERS, []);
}

function register(event) {
  event.preventDefault();

  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;

  clearFieldError("regUsername");
  clearFieldError("regPassword");

  let hasError = false;

  if (username.length < 3) {
    setFieldError("regUsername", "Username must be at least 3 characters.");
    hasError = true;
  }

  if (password.length < 6) {
    setFieldError("regPassword", "Password must be at least 6 characters.");
    hasError = true;
  }

  const users = getUsers();
  const usernameTaken = users.some(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (!hasError && usernameTaken) {
    setFieldError("regUsername", "That username is already taken.");
    hasError = true;
  }

  if (hasError) return;

  users.push({ username, password });
  writeStorage(STORAGE_USERS, users);

  showToast("Registration successful! You can now log in.");
  document.getElementById("registerForm").reset();
  showAuthPage("loginPage");
}

function login(event) {
  event.preventDefault();

  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  clearFieldError("loginUsername");
  clearFieldError("loginPassword");

  if (!username || !password) {
    if (!username) setFieldError("loginUsername", "Username is required.");
    if (!password) setFieldError("loginPassword", "Password is required.");
    return;
  }

  const users = getUsers();
  const matchedUser = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );

  if (!matchedUser) {
    setFieldError("loginPassword", "Incorrect username or password.");
    return;
  }

  localStorage.setItem(STORAGE_SESSION, matchedUser.username);
  showToast(`Welcome back, ${matchedUser.username}!`);
  document.getElementById("loginForm").reset();
  enterApp(matchedUser.username);
}

function logout() {
  localStorage.removeItem(STORAGE_SESSION);
  document.getElementById("appShell").classList.add("hidden");
  showAuthPage("loginPage");
}

function checkExistingSession() {
  const savedUsername = localStorage.getItem(STORAGE_SESSION);
  if (savedUsername) {
    enterApp(savedUsername);
  }
}

function enterApp(username) {
  currentUser = username;

  document.getElementById("registerPage").classList.add("hidden");
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");

  document.getElementById("topbarUsername").textContent = username;

  loadSettings();
  refreshDashboard();
}

// --- Validation: UI state helpers ---

function setFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  const errorSpan = document.getElementById(inputId + "Error");
  input.classList.add("input-invalid");
  if (errorSpan) errorSpan.textContent = message;
}

function clearFieldError(inputId) {
  const input = document.getElementById(inputId);
  const errorSpan = document.getElementById(inputId + "Error");
  input.classList.remove("input-invalid");
  if (errorSpan) errorSpan.textContent = "";
}

// --- Navigation: view switching & sidebar ---

function showAuthPage(pageId) {
  document.getElementById("registerPage").classList.add("hidden");
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById(pageId).classList.remove("hidden");
}

function showAppPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });
  document.getElementById(pageId).classList.add("active");

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === pageId);
  });

  const titles = {
    dashboardPage: "Financial Overview",
    settingsPage: "Settings",
  };
  document.getElementById("topbarTitle").textContent = titles[pageId] || "";
}

function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const isOpen = sidebar.classList.toggle("sidebar-open");
  if (overlay) {
    overlay.classList.toggle("sidebar-overlay-active", isOpen);
  }
}

function closeSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (sidebar) sidebar.classList.remove("sidebar-open");
  if (overlay) overlay.classList.remove("sidebar-overlay-active");
}

// --- Transactions: data management ---

let currentUser = null;
let editingTransactionId = null;

function loadTransactions() {
  return readStorage(userKey("transactions", currentUser), []);
}

function saveTransactions(transactions) {
  writeStorage(userKey("transactions", currentUser), transactions);
}

function addOrEditTransaction(event) {
  event.preventDefault();

  const type = document.getElementById("transactionType").value;
  const description = document.getElementById("transactionDescription").value.trim();
  const amount = parseFloat(document.getElementById("transactionAmount").value);
  const date = document.getElementById("transactionDate").value;
  const category = document.getElementById("transactionCategory").value;

  clearFieldError("transactionDescription");
  clearFieldError("transactionAmount");
  clearFieldError("transactionDate");
  clearFieldError("transactionCategory");

  let hasError = false;

  if (!description) {
    setFieldError("transactionDescription", "Description is required.");
    hasError = true;
  }
  if (isNaN(amount) || amount <= 0) {
    setFieldError("transactionAmount", "Enter an amount greater than 0.");
    hasError = true;
  }
  if (!date) {
    setFieldError("transactionDate", "Date is required.");
    hasError = true;
  }
  if (!category) {
    setFieldError("transactionCategory", "Please select a category.");
    hasError = true;
  }

  if (hasError) return;

  const transactions = loadTransactions();

  if (editingTransactionId) {
    const index = transactions.findIndex((t) => t.id === editingTransactionId);
    if (index !== -1) {
      transactions[index] = { id: editingTransactionId, type, description, amount, date, category };
    }
    showToast("Transaction updated successfully.");
  } else {
    // Timestamp collision probability is negligible in single-user local state
    const newTransaction = {
      id: Date.now().toString(),
      type,
      description,
      amount,
      date,
      category,
    };
    transactions.push(newTransaction);
    showToast("Transaction added successfully.");
  }

  saveTransactions(transactions);
  closeTransactionModal();
  refreshDashboard();
}

function editTransaction(id) {
  const transactions = loadTransactions();
  const transaction = transactions.find((t) => t.id === id);
  if (!transaction) return;

  editingTransactionId = id;

  document.getElementById("transactionModalTitle").innerHTML =
    '<i class="ri-edit-2-line"></i> Edit Transaction';
  document.getElementById("transactionSubmitLabel").textContent = "Update Transaction";

  document.getElementById("transactionType").value = transaction.type;
  document.getElementById("transactionDescription").value = transaction.description;
  document.getElementById("transactionAmount").value = transaction.amount;
  document.getElementById("transactionDate").value = transaction.date;
  document.getElementById("transactionCategory").value = transaction.category;

  openTransactionModal();
}

function deleteTransaction(id) {
  openConfirmDialog(
    "Delete this transaction?",
    "This transaction will be permanently removed.",
    () => {
      const transactions = loadTransactions();
      const remaining = transactions.filter((t) => t.id !== id);
      saveTransactions(remaining);
      showToast("Transaction deleted.");
      refreshDashboard();
    }
  );
}

function calculateTotals(transactions) {
  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach((t) => {
    if (t.type === "income") {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
    }
  });

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    count: transactions.length,
  };
}

// --- Rendering: dashboard metrics & charts ---

function refreshDashboard() {
  const transactions = loadTransactions();
  renderCards(transactions);
  renderTable(transactions);
  renderChart(transactions);
}

function renderCards(transactions) {
  const totals = calculateTotals(transactions);

  document.getElementById("cardBalance").textContent = formatCurrency(totals.balance);
  document.getElementById("cardIncome").textContent = formatCurrency(totals.totalIncome);
  document.getElementById("cardExpense").textContent = formatCurrency(totals.totalExpense);
  document.getElementById("cardCount").textContent = totals.count;
}

function renderTable(transactions) {
  const tableBody = document.getElementById("transactionTableBody");
  const emptyState = document.getElementById("emptyState");

  const visibleTransactions = applySearchAndFilter(transactions);

  tableBody.innerHTML = "";

  if (visibleTransactions.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }

  const sorted = [...visibleTransactions].sort((a, b) => b.date.localeCompare(a.date));

  sorted.forEach((t) => {
    const row = document.createElement("tr");
    const sign = t.type === "income" ? "+" : "-";
    const amountClass = t.type === "income" ? "text-income" : "text-expense";

    row.innerHTML = `
      <td class="cell-date">${t.date}</td>
      <td>${escapeHtml(t.description)}</td>
      <td><span class="category-tag">${escapeHtml(t.category)}</span></td>
      <td class="cell-amount ${amountClass}">${sign}${formatCurrency(t.amount)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn edit-btn" title="Edit" data-id="${t.id}">
            <i class="ri-edit-2-line"></i>
          </button>
          <button class="icon-btn delete-btn" title="Delete" data-id="${t.id}">
            <i class="ri-delete-bin-6-line"></i>
          </button>
        </div>
      </td>
    `;

    tableBody.appendChild(row);
  });

  tableBody.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => editTransaction(btn.dataset.id));
  });
  tableBody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteTransaction(btn.dataset.id));
  });
}

// Prevents cross-site script injection via unescaped transaction descriptions
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

let cashFlowChart = null;

function renderChart(transactions) {
  const canvas = document.getElementById("cashFlowChart");

  const totalsByDate = {};
  transactions.forEach((t) => {
    if (!totalsByDate[t.date]) {
      totalsByDate[t.date] = { income: 0, expense: 0 };
    }
    totalsByDate[t.date][t.type] += t.amount;
  });

  const sortedDates = Object.keys(totalsByDate).sort();
  const incomeData = sortedDates.map((date) => totalsByDate[date].income);
  const expenseData = sortedDates.map((date) => totalsByDate[date].expense);

  // Destroy previous Chart instance to free context and prevent memory leaks
  if (cashFlowChart) {
    cashFlowChart.destroy();
  }

  const textColor = getComputedStyle(document.body).getPropertyValue("--chart-text-color").trim();
  const gridColor = getComputedStyle(document.body).getPropertyValue("--color-border").trim();

  cashFlowChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: sortedDates,
      datasets: [
        {
          label: "Income",
          data: incomeData,
          backgroundColor: "#2f6f4e",
          borderRadius: 6,
          maxBarThickness: 56,
        },
        {
          label: "Expenses",
          data: expenseData,
          backgroundColor: "#b3473a",
          borderRadius: 6,
          maxBarThickness: 56,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: "JetBrains Mono", size: 11 } },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: textColor, font: { family: "JetBrains Mono", size: 11 } },
          grid: { color: gridColor },
        },
      },
    },
  });
}

// --- Search & Filtering ---

function applySearchAndFilter(transactions) {
  const searchTerm = document.getElementById("searchInput").value.trim().toLowerCase();
  const filterType = document.getElementById("filterType").value;

  return transactions.filter((t) => {
    const matchesType = filterType === "all" || t.type === filterType;
    const matchesSearch =
      !searchTerm ||
      t.description.toLowerCase().includes(searchTerm) ||
      t.category.toLowerCase().includes(searchTerm);
    return matchesType && matchesSearch;
  });
}

function searchTransactions() {
  renderTable(loadTransactions());
}

function filterTransactions() {
  renderTable(loadTransactions());
}

// --- Settings: user preferences ---

const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
};

// JPY does not use decimal subdivisions in accounting presentation
function formatCurrency(amount) {
  const settings = loadSettingsData();
  const symbol = CURRENCY_SYMBOLS[settings.currency] || "$";
  const decimals = settings.currency === "JPY" ? 0 : 2;
  return `${symbol}${amount.toFixed(decimals)}`;
}

function loadSettingsData() {
  return readStorage(userKey("settings", currentUser), {
    fullName: currentUser,
    currency: "USD",
  });
}

function loadSettings() {
  const settings = loadSettingsData();

  document.getElementById("settingsFullName").value = settings.fullName || currentUser;
  document.getElementById("settingsCurrency").value = settings.currency || "USD";
  document.getElementById("topbarUsername").textContent = settings.fullName || currentUser;

  const isDark = readStorage(userKey("theme", currentUser), "light") === "dark";
  document.getElementById("darkModeToggle").checked = isDark;
  document.body.classList.toggle("dark", isDark);
}

function saveSettings(event) {
  event.preventDefault();

  const fullName = document.getElementById("settingsFullName").value.trim() || currentUser;
  const currency = document.getElementById("settingsCurrency").value;

  writeStorage(userKey("settings", currentUser), { fullName, currency });

  document.getElementById("topbarUsername").textContent = fullName;

  showToast("Settings saved successfully.");
  refreshDashboard();
}

function toggleDarkMode(event) {
  const isDark = event.target.checked;
  document.body.classList.toggle("dark", isDark);
  writeStorage(userKey("theme", currentUser), isDark ? "dark" : "light");

  renderChart(loadTransactions());
}

function resetAllData() {
  openConfirmDialog(
    "Reset all data?",
    "This will permanently delete every transaction you've recorded. This cannot be undone.",
    () => {
      saveTransactions([]);
      showToast("All data has been reset.");
      refreshDashboard();
    }
  );
}

// --- Modals: transaction form & confirmation dialog ---

function openTransactionModal() {
  document.getElementById("transactionModal").classList.remove("hidden");
}

function closeTransactionModal() {
  document.getElementById("transactionModal").classList.add("hidden");
  document.getElementById("transactionForm").reset();

  ["transactionDescription", "transactionAmount", "transactionDate", "transactionCategory"].forEach(
    clearFieldError
  );

  editingTransactionId = null;
  document.getElementById("transactionModalTitle").innerHTML =
    '<i class="ri-add-circle-line"></i> Add Transaction';
  document.getElementById("transactionSubmitLabel").textContent = "Save Transaction";
}

function openAddTransactionModal() {
  closeTransactionModal();
  document.getElementById("transactionDate").value = new Date().toISOString().split("T")[0];
  openTransactionModal();
}

let pendingConfirmAction = null;

function openConfirmDialog(title, message, onConfirm) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMessage").textContent = message;
  pendingConfirmAction = onConfirm;
  document.getElementById("confirmModal").classList.remove("hidden");
}

function closeConfirmDialog() {
  document.getElementById("confirmModal").classList.add("hidden");
  pendingConfirmAction = null;
}

// --- Event Listeners: DOM event bindings ---

function setupEventListeners() {
  document.getElementById("registerForm").addEventListener("submit", register);
  document.getElementById("loginForm").addEventListener("submit", login);
  document.getElementById("logoutBtn").addEventListener("click", logout);

  document.getElementById("goToLogin").addEventListener("click", (e) => {
    e.preventDefault();
    showAuthPage("loginPage");
  });
  document.getElementById("goToRegister").addEventListener("click", (e) => {
    e.preventDefault();
    showAuthPage("registerPage");
  });

  document.querySelectorAll(".toggle-visibility").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      const icon = btn.querySelector("i");
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      icon.className = isPassword ? "ri-eye-off-line" : "ri-eye-line";
    });
  });

  // Navigation & off-canvas drawer controls
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      showAppPage(link.dataset.page);
      closeSidebar();
    });
  });

  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebarClose = document.getElementById("sidebarClose");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  if (sidebarToggle) sidebarToggle.addEventListener("click", toggleSidebar);
  if (sidebarClose) sidebarClose.addEventListener("click", closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

  document.getElementById("addTransactionBtn").addEventListener("click", () => {
    openAddTransactionModal();
    closeSidebar();
  });

  document.getElementById("transactionForm").addEventListener("submit", addOrEditTransaction);
  document.getElementById("closeTransactionModal").addEventListener("click", closeTransactionModal);
  document.getElementById("cancelTransactionBtn").addEventListener("click", closeTransactionModal);

  document.getElementById("transactionModal").addEventListener("click", (e) => {
    if (e.target.id === "transactionModal") closeTransactionModal();
  });

  document.getElementById("searchInput").addEventListener("input", searchTransactions);
  document.getElementById("filterType").addEventListener("change", filterTransactions);

  document.getElementById("settingsForm").addEventListener("submit", saveSettings);
  document.getElementById("darkModeToggle").addEventListener("change", toggleDarkMode);
  document.getElementById("resetDataBtn").addEventListener("click", resetAllData);

  document.getElementById("confirmOkBtn").addEventListener("click", () => {
    if (pendingConfirmAction) pendingConfirmAction();
    closeConfirmDialog();
  });
  document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirmDialog);
  document.getElementById("confirmModal").addEventListener("click", (e) => {
    if (e.target.id === "confirmModal") closeConfirmDialog();
  });
}

// --- Initialization ---

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkExistingSession();
});