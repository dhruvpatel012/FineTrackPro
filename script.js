/* 1. Storage Keys & Helpers      (talking to Local Storage)
   2. Toast Notifications          (success / error messages)
   3. Authentication               (register, login, logout)
   4. Page Navigation              (dashboard <-> settings)
   5. Transactions Data Layer      (load / save / add / edit / delete)
   6. Rendering                    (cards, table, chart)
   7. Search & Filter
   8. Settings (profile, currency, dark mode, reset)
   9. Modals                       (add/edit transaction, confirm dialog)
   10. Event Listeners             (wiring everything together)
   11. App Init                    (what runs the moment the page loads) */


/* 1. STORAGE KEYS & HELPERS
   Everything the app remembers lives in localStorage as JSON
   text. These helper functions are the ONLY place that talk to
   localStorage directly — every other part of the app calls
   these instead of using localStorage.getItem/setItem itself.
  */

// All registered accounts live under this single key.
// Example value: [{ username: "nobita", password: "12345" }]
const STORAGE_USERS = "fintrackpro_users";

// Which username is currently logged in (or null if logged out).
const STORAGE_SESSION = "fintrackpro_session";

// Helper to build a storage key that is unique PER USER.
// This means two different accounts never see each other's
// transactions or settings, even though it's all localStorage.
function userKey(base, username) {
  return `fintrackpro_${base}_${username}`;
}

// Generic "read JSON from storage" helper.
// If nothing is saved yet (or it's broken), return fallback instead of crashing.
function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error("Failed to read storage key:", key, err);
    return fallback;
  }
}

// Generic "write JSON to storage" helper.
function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}


/* 2. TOAST NOTIFICATIONS
   Small slide-in cards instead of  alert() popups.
   Call showToast("message") for success, or
   showToast("message", true) for an error style
*/
function showToast(message, isError = false) {
  const container = document.getElementById("toastContainer");

  const toast = document.createElement("div");
  toast.className = "toast" + (isError ? " error" : "");
  toast.innerHTML = `
    <i class="${isError ? "ri-error-warning-line" : "ri-checkbox-circle-line"}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Remove the toast automatically after 3 seconds so they don't pile up.
  setTimeout(() => toast.remove(), 3000);
}


/* 
   3. AUTHENTICATION
   register() creates a new account. login() checks the entered
   username/password against the saved accounts. logout() simply
   clears the session key. There is no real security here.
*/

// Read the list of all registered users (or an empty array).
function getUsers() {
  return readStorage(STORAGE_USERS, []);
}

// Handles the Register form submit.
function register(event) {
  event.preventDefault();

  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;

  // Clear any old error messages before re-validating.
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

  // Save the new user alongside everyone else who has registered.
  users.push({ username, password });
  writeStorage(STORAGE_USERS, users);

  showToast("Registration successful! You can now log in.");
  document.getElementById("registerForm").reset();

  // Send them straight to the login page, like the reference design.
  showAuthPage("loginPage");
}

// Handles the Login form submit.
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

  // Save the session so a page refresh keeps the user logged in.
  localStorage.setItem(STORAGE_SESSION, matchedUser.username);

  showToast(`Welcome back, ${matchedUser.username}!`);
  document.getElementById("loginForm").reset();
  enterApp(matchedUser.username);
}

// Handles the Logout button.
function logout() {
  localStorage.removeItem(STORAGE_SESSION);
  document.getElementById("appShell").classList.add("hidden");
  showAuthPage("loginPage");
}

// Checks if someone is already logged in (e.g. after a page refresh)
// and skips straight to the dashboard if so.
function checkExistingSession() {
  const savedUsername = localStorage.getItem(STORAGE_SESSION);
  if (savedUsername) {
    enterApp(savedUsername);
  }
}

// Switches from the auth screens into the main app shell.
function enterApp(username) {
  currentUser = username;

  document.getElementById("registerPage").classList.add("hidden");
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");

  document.getElementById("topbarUsername").textContent = username;

  loadSettings();   // applies dark mode + currency + full name
  refreshDashboard(); // draws cards, table, and chart with this user's data
}


/* Small validation helpers shared by every form in the app.
   They just add/remove a CSS class and fill in the <span> that
   already exists under each input in index.html.
*/
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


/* 
   4. PAGE NAVIGATION
   We just hide one and show the other — no real routing,
   no page reload.
*/
function showAuthPage(pageId) {
  document.getElementById("registerPage").classList.add("hidden");
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById(pageId).classList.remove("hidden");
}

function showAppPage(pageId) {
  // Hide every page, then reveal only the one that was requested.
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });
  document.getElementById(pageId).classList.add("active");

  // Update which sidebar link looks "active".
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === pageId);
  });

  // Update the title shown in the topbar.
  const titles = {
    dashboardPage: "Financial Overview",
    settingsPage: "Settings",
  };
  document.getElementById("topbarTitle").textContent = titles[pageId] || "";
}


/* 5. TRANSACTIONS DATA LAYER
   Every transaction looks like:
   { id, type: "income"|"expense", description, amount, date, category }
*/

// Keeps track of who is logged in right now, set by enterApp().
let currentUser = null;

// Keeps track of whether the transaction modal is in "add" or "edit" mode.
let editingTransactionId = null;

// Loads this user's transactions from storage (empty array if none yet).
function loadTransactions() {
  return readStorage(userKey("transactions", currentUser), []);
}

// Saves the full transaction list back to storage.
function saveTransactions(transactions) {
  writeStorage(userKey("transactions", currentUser), transactions);
}

// Handles the Add/Edit Transaction form submit.
function addOrEditTransaction(event) {
  event.preventDefault();

  const type = document.getElementById("transactionType").value;
  const description = document.getElementById("transactionDescription").value.trim();
  const amount = parseFloat(document.getElementById("transactionAmount").value);
  const date = document.getElementById("transactionDate").value;
  const category = document.getElementById("transactionCategory").value;

  // ---- Validate every field before saving anything ----
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
    // ---- EDIT MODE: find the matching transaction and update it ----
    const index = transactions.findIndex((t) => t.id === editingTransactionId);
    if (index !== -1) {
      transactions[index] = { id: editingTransactionId, type, description, amount, date, category };
    }
    showToast("Transaction updated successfully.");
  } else {
    // ---- ADD MODE: build a brand new transaction object ----
    // Date.now() in milliseconds is unique enough for a single-user app.
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
  refreshDashboard(); // always refresh everything after a change
}

// Opens the modal already filled in with an existing transaction's data.
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

// Removes a transaction by id. Always goes through the confirm dialog first.
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

// Loops through all transactions once and adds up income vs expense.
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


/* 6. RENDERING
   These functions read from storage and paint the screen.
   refreshDashboard() is the "master function" — call THIS after
   any data change, and it takes care of cards + table + chart.
*/

// The one function every other piece of code calls after a change.
function refreshDashboard() {
  const transactions = loadTransactions();
  renderCards(transactions);
  renderTable(transactions);
  renderChart(transactions);
}

// ---- 6a. Summary Cards ----
function renderCards(transactions) {
  const totals = calculateTotals(transactions);

  document.getElementById("cardBalance").textContent = formatCurrency(totals.balance);
  document.getElementById("cardIncome").textContent = formatCurrency(totals.totalIncome);
  document.getElementById("cardExpense").textContent = formatCurrency(totals.totalExpense);
  document.getElementById("cardCount").textContent = totals.count;
}

// ---- 6b. Transaction Table ----

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

  // Show newest transactions first.
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

  // Wire up the edit/delete buttons we just created.
  tableBody.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => editTransaction(btn.dataset.id));
  });
  tableBody.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteTransaction(btn.dataset.id));
  });
}

/* Basic protection so a transaction description can't break the page
 layout by injecting HTML tags into the table. */

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ---- 6c. Cash Flow Chart ----

/* Keeps a reference to the live Chart.js instance so we can destroy
it before drawing a new one (otherwise charts stack on top of each other).*/

let cashFlowChart = null;

function renderChart(transactions) {
  const canvas = document.getElementById("cashFlowChart");

  // Group totals by date so each date gets one income bar + one expense bar.
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

  // Destroy any previous chart before drawing a new one.
  if (cashFlowChart) {
    cashFlowChart.destroy();
  }

  // Read the current text color from CSS so labels stay legible in dark mode.
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
        legend: { display: false }, // we already have our own legend in the panel header
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


// ---------  7. SEARCH & FILTER ---------- 
function applySearchAndFilter(transactions) {
  const searchTerm = document.getElementById("searchInput").value.trim().toLowerCase();
  const filterType = document.getElementById("filterType").value; // "all" | "income" | "expense"

  return transactions.filter((t) => {
    const matchesType = filterType === "all" || t.type === filterType;
    const matchesSearch =
      !searchTerm ||
      t.description.toLowerCase().includes(searchTerm) ||
      t.category.toLowerCase().includes(searchTerm);
    return matchesType && matchesSearch;
  });
}

// Called directly by the search input / filter dropdown's event listeners.
function searchTransactions() {
  renderTable(loadTransactions());
}

function filterTransactions() {
  renderTable(loadTransactions());
}


// ----- 8. SETTINGS — profile, currency, dark mode, reset ------

// Currency code -> symbol lookup used by formatCurrency().
const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
};

// Formats a number using the user's chosen currency symbol.
// JPY conventionally has no decimal places, everything else uses 2.
function formatCurrency(amount) {
  const settings = loadSettingsData();
  const symbol = CURRENCY_SYMBOLS[settings.currency] || "$";
  const decimals = settings.currency === "JPY" ? 0 : 2;
  return `${symbol}${amount.toFixed(decimals)}`;
}

// Reads this user's settings object
function loadSettingsData() {
  return readStorage(userKey("settings", currentUser), {
    fullName: currentUser,
    currency: "USD",
  });
}

// Applies saved settings (name, currency, dark mode) to the UI on login/load.
function loadSettings() {
  const settings = loadSettingsData();

  document.getElementById("settingsFullName").value = settings.fullName || currentUser;
  document.getElementById("settingsCurrency").value = settings.currency || "USD";
  document.getElementById("topbarUsername").textContent = settings.fullName || currentUser;

  const isDark = readStorage(userKey("theme", currentUser), "light") === "dark";
  document.getElementById("darkModeToggle").checked = isDark;
  document.body.classList.toggle("dark", isDark);
}

// Handles the Settings form submit (Save Changes button).
function saveSettings(event) {
  event.preventDefault();

  const fullName = document.getElementById("settingsFullName").value.trim() || currentUser;
  const currency = document.getElementById("settingsCurrency").value;

  writeStorage(userKey("settings", currentUser), { fullName, currency });

  document.getElementById("topbarUsername").textContent = fullName;

  showToast("Settings saved successfully.");
  refreshDashboard(); // re-render so every amount uses the new currency symbol
}

// Handles the Dark Mode switch in Settings.
function toggleDarkMode(event) {
  const isDark = event.target.checked;
  document.body.classList.toggle("dark", isDark);
  writeStorage(userKey("theme", currentUser), isDark ? "dark" : "light");

  // Re-draw the chart so its text color matches the new theme immediately.
  renderChart(loadTransactions());
}

// Handles the "Reset All Data" button — wipes this user's transactions only.
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


/* 9. MODALS
   Two modals share the same overlay pattern:
   - #transactionModal -> Add / Edit Transaction form
   - #confirmModal     -> generic Yes/No dialog (delete + reset)
 */

// ---- Add/Edit Transaction modal ----
function openTransactionModal() {
  document.getElementById("transactionModal").classList.remove("hidden");
}

function closeTransactionModal() {
  document.getElementById("transactionModal").classList.add("hidden");
  document.getElementById("transactionForm").reset();

  // Clear any leftover validation messages.
  ["transactionDescription", "transactionAmount", "transactionDate", "transactionCategory"].forEach(
    clearFieldError
  );

  // Reset back to "Add" mode for next time the modal opens.
  editingTransactionId = null;
  document.getElementById("transactionModalTitle").innerHTML =
    '<i class="ri-add-circle-line"></i> Add Transaction';
  document.getElementById("transactionSubmitLabel").textContent = "Save Transaction";
}

// Opens a blank "Add Transaction" modal, defaulting the date to today.
function openAddTransactionModal() {
  closeTransactionModal(); // ensures a clean slate / "add" mode
  document.getElementById("transactionDate").value = new Date().toISOString().split("T")[0];
  openTransactionModal();
}

// ---- Confirm dialog (reused for Delete + Reset) ----
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


// ------- 10. EVENT LISTENERS -------
function setupEventListeners() {

  // ---- Auth forms ----
  document.getElementById("registerForm").addEventListener("submit", register);
  document.getElementById("loginForm").addEventListener("submit", login);
  document.getElementById("logoutBtn").addEventListener("click", logout);

  // Links that swap between the Register and Login screens.
  document.getElementById("goToLogin").addEventListener("click", (e) => {
    e.preventDefault();
    showAuthPage("loginPage");
  });
  document.getElementById("goToRegister").addEventListener("click", (e) => {
    e.preventDefault();
    showAuthPage("registerPage");
  });

  // Eye icon buttons that toggle a password field between hidden/visible text.
  document.querySelectorAll(".toggle-visibility").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      const icon = btn.querySelector("i");
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      icon.className = isPassword ? "ri-eye-off-line" : "ri-eye-line";
    });
  });

  // ---- Sidebar navigation ----
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => showAppPage(link.dataset.page));
  });

  // ---- Add Transaction button (sidebar) ----
  document.getElementById("addTransactionBtn").addEventListener("click", openAddTransactionModal);

  // ---- Transaction modal controls ----
  document.getElementById("transactionForm").addEventListener("submit", addOrEditTransaction);
  document.getElementById("closeTransactionModal").addEventListener("click", closeTransactionModal);
  document.getElementById("cancelTransactionBtn").addEventListener("click", closeTransactionModal);

  // Clicking the dark overlay outside the modal card also closes it.
  document.getElementById("transactionModal").addEventListener("click", (e) => {
    if (e.target.id === "transactionModal") closeTransactionModal();
  });

  // ---- Search & Filter ----
  document.getElementById("searchInput").addEventListener("input", searchTransactions);
  document.getElementById("filterType").addEventListener("change", filterTransactions);

  // ---- Settings page ----
  document.getElementById("settingsForm").addEventListener("submit", saveSettings);
  document.getElementById("darkModeToggle").addEventListener("change", toggleDarkMode);
  document.getElementById("resetDataBtn").addEventListener("click", resetAllData);

  // ---- Confirm dialog ----
  document.getElementById("confirmOkBtn").addEventListener("click", () => {
    if (pendingConfirmAction) pendingConfirmAction();
    closeConfirmDialog();
  });
  document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirmDialog);
  document.getElementById("confirmModal").addEventListener("click", (e) => {
    if (e.target.id === "confirmModal") closeConfirmDialog();
  });
}


/* 11. APP INIT This is the very first code that 
 runs once the HTML has finished loading. */
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkExistingSession(); // skips straight to dashboard if already logged in
});