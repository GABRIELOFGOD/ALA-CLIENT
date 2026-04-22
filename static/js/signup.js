// const BASEURL = "http://72.60.80.28:4500/api";

AuthManager.redirectIfAuthenticated();
AuthManager.init();

const loginForm = document.querySelector("form#register");
const errorText = document.querySelector("#error-text");
const submitBtn = document.getElementById("sign-btn");

errorText.style.display = "none";
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.classList.add("disabled");
  submitBtn.classList.add("cursor-not-allowed");
  submitBtn.classList.add("bg-gray-500");
  submitBtn.innerText = "loading..."
  errorText.style.display = "none";
  const email = document.getElementById("email").value;
  const name = document.getElementById("name").value;
  const password = document.getElementById("password").value;

  try {
    const request = await fetch(`${BASEURL}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password, name })
    });

    const response = await request.json();
    if (!request.ok) throw new Error(response.message);

    location.assign("/signin.html");
  } catch (error) {
    console.log("Error", error);
    errorText.style.display = "flex";
    errorText.innerHTML = error.message || "Something went wrong";
    submitBtn.classList.remove("disabled");
    submitBtn.classList.remove("cursor-not-allowed");
    submitBtn.classList.remove("bg-gray-500");
    submitBtn.innerText = "Register"
  }
});