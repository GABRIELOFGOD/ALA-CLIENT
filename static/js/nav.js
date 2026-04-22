const BASEURL = "https://literacy.fcalearn.org/api";

// const cta = document.getElementById("cta");
// const cta2 = document.getElementById("cta2");

// let userLoggedIn = false;
// let user = null;

// const ONE_HOUR = 60 * 60 * 1000;

// const isLoggedIn = () => {
//   const token = localStorage.getItem("token");
//   if (token) userLoggedIn = true;
// };

// // 🔥 Check if we should fetch again
// const shouldFetchUser = () => {
//   const lastFetch = sessionStorage.getItem("lastUserFetch");

//   if (!lastFetch) return true;

//   const now = Date.now();
//   return (now - Number(lastFetch)) > ONE_HOUR;
// };

// // 🔥 Load user from localStorage
// const loadUserFromStorage = () => {
//   const storedUser = localStorage.getItem("user");
//   if (storedUser) {
//     user = JSON.parse(storedUser);
//     userLoggedIn = true;
//     setProfile();
//   }
// };

// // 🔥 Save user + timestamp
// const saveUserToStorage = (data) => {
//   localStorage.setItem("user", JSON.stringify(data));
//   sessionStorage.setItem("lastUserFetch", Date.now().toString());
// };

// const getUserProfile = async () => {
//   isLoggedIn();

//   if (!userLoggedIn) {
//     setProfile();
//     return;
//   }

//   // 🚀 Use cached user first
//   loadUserFromStorage();

//   // ❌ Skip API if not needed
//   if (!shouldFetchUser()) return;

//   try {
//     const request = await fetch(`${BASEURL}/users/profile`, {
//       method: "GET",
//       headers: {
//         "Content-Type": "application/json",
//         "authorization": `Bearer ${localStorage.getItem("token")}`
//       }
//     });

//     const response = await request.json();
//     if (!request.ok) throw new Error(response.message);

//     user = response;
//     userLoggedIn = true;

//     // 💾 Save fresh data
//     saveUserToStorage(user);

//     setProfile();

//   } catch (error) {
//     console.log("Error", error);

//     userLoggedIn = false;

//     // 🔥 Clear invalid data if token expired
//     localStorage.removeItem("user");
//     localStorage.removeItem("token");
//     sessionStorage.removeItem("lastUserFetch");

//     setProfile();
//   }
// };

// getUserProfile();


const AuthManager = (() => {
  const ONE_HOUR = 60 * 60 * 1000;

  let user = null;
  let isAuthenticated = false;

  const subscribers = []; // 🔥 UI listeners

  const notify = () => {
    subscribers.forEach(cb => cb({ user, isAuthenticated }));
  };

  const subscribe = (cb) => {
    subscribers.push(cb);
  };

  const getToken = () => localStorage.getItem("token");

  const shouldFetchUser = () => {
    const lastFetch = sessionStorage.getItem("lastUserFetch");
    if (!lastFetch) return true;
    return (Date.now() - Number(lastFetch)) > ONE_HOUR;
  };

  const saveUser = (data) => {
    user = data;
    isAuthenticated = true;

    localStorage.setItem("user", JSON.stringify(data));
    sessionStorage.setItem("lastUserFetch", Date.now().toString());

    notify();
  };

  const loadUser = () => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      user = JSON.parse(storedUser);
      isAuthenticated = true;
      notify();
    }
  };

  const logout = () => {
    user = null;
    isAuthenticated = false;

    localStorage.removeItem("user");
    localStorage.removeItem("token");
    sessionStorage.removeItem("lastUserFetch");

    notify();
  };

  const fetchUser = async () => {
    const token = getToken();
    if (!token) return logout();

    try {
      const res = await fetch(`${BASEURL}/users/profile`, {
        headers: {
          "Content-Type": "application/json",
          "authorization": `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      saveUser(data);
    } catch (err) {
      console.log("Auth error:", err);
      logout();
    }
  };

  const init = async () => {
    const token = getToken();
    if (!token) return;

    // 🚀 Load instantly from cache
    loadUser();

    // 🔥 Fetch only if needed
    if (shouldFetchUser()) {
      await fetchUser();
    }
  };

  const redirectIfAuthenticated = () => {
    const token = getToken();
    const storedUser = localStorage.getItem("user");

    // 🔥 If user exists (fast check, no API)
    if (token && storedUser) {
      window.location.href = "/dashboard.html";
    }
  };

  const requireAuth = () => {
    const token = getToken();
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      window.location.href = "/signin.html";
    }
  };

  return {
    init,
    subscribe,
    logout,
    getUser: () => user,
    isAuthenticated: () => isAuthenticated,
    requireAuth,
    redirectIfAuthenticated,
    fetchUser
  };
})();

const cta = document.getElementById("cta");
const cta2 = document.getElementById("cta2");

AuthManager.subscribe(({ isAuthenticated }) => {
  let isDropped = false;
  if (isAuthenticated) {
    cta.innerHTML = `
      <div id="user-drop" class="border-primary cursor-pointer relative hidden border-2 rounded-full p-2 h-10 w-10 md:flex justify-center items-center">
        <i class="fa-regular fa-user"></i>
        <div id="drop-down" class="w-[200px] border rounded-md p-2 absolute top-10 space-y-2 right-0 bg-white hidden flex-col">
          <a href="/dashboard.html" class="cursor-pointer p-1 hover:bg-gray-200 rounded-md duration-200">Dashboard</a>
          <div id="logout-btn-md" class="cursor-pointer p-1 bg-red-500 hover:opacity-80 text-white rounded-md duration-200">Logout</div>
        </div>
      </div>
    `;

    cta2.innerHTML = `
      <div class="space-y-2">
        <a href="dashboard.html" class="block w-full border border-(--primary) text-primary px-4 py-2 text-center rounded-lg">
          Dashboard
        </a>
        <button id="logout-btn" class="block w-full bg-secondary text-secondary-foreground px-4 py-2 text-center rounded-lg">Logout</button>
      </div>
    `;

    const logoutBtn = document.getElementById("logout-btn");
    const logoutBtnMd = document.getElementById("logout-btn-md");
    logoutBtn.addEventListener("click", () => {
      AuthManager.logout();
      location.reload();
    });

    logoutBtnMd.addEventListener("click", () => {
      AuthManager.logout();
      location.reload();
    });

    const userContainer = document.getElementById("user-drop");
    userContainer.addEventListener("click", () => {
      if (!isDropped) {
        isDropped = !isDropped;
        const dropDown = document.getElementById("drop-down");
        dropDown.classList.remove("hidden");
        dropDown.classList.add("flex");
      } else {
        isDropped = !isDropped;
        const dropDown = document.getElementById("drop-down");
        dropDown.classList.remove("flex");
        dropDown.classList.add("hidden");
      }
    });

  }
});

// 🚀 Initialize once
AuthManager.init();