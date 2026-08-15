const form = document.querySelector("#composer");
const input = document.querySelector("#message");
const send = document.querySelector("#send");
const messages = document.querySelector("#messages");
let previousResponseId;

function addMessage(text, role, className = "") {
  const article = document.createElement("article");
  article.className = `message ${role} ${className}`;
  if (role === "agent") {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "T";
    article.append(avatar);
  }
  const wrapper = document.createElement("div");
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  wrapper.append(paragraph);
  article.append(wrapper);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
}

async function submitMessage(message) {
  addMessage(message, "user");
  const thinking = addMessage("Working with Terac...", "agent", "thinking");
  send.disabled = true;
  input.disabled = true;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, previousResponseId }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "The agent request failed.");
    previousResponseId = body.responseId;
    thinking.remove();
    addMessage(body.text || "Done.", "agent");
  } catch (error) {
    thinking.remove();
    addMessage(`I could not complete that request: ${error.message}`, "agent");
  } finally {
    send.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  input.style.height = "auto";
  submitMessage(message);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll(".suggestions button").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.textContent;
    form.requestSubmit();
  });
});
