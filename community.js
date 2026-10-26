const $ = (selector) => document.querySelector(selector);
const status = $("#communityStatus");
const feedStatus = $("#feedStatus");
const messages = $("#communityMessages");
let auth;
let db;
let api;
let channel = "comments";
let unsubscribe;
let connected = false;
let busy = false;
let authBusy = false;
let generation = 0;

function updateControls() {
  const user = auth?.currentUser;
  $("#authControls").hidden = !!user;
  $("#signedInControls").hidden = !user;
  $("#verifyControls").hidden = !user || user.emailVerified;
  $("#communityUser").textContent = user ? `Signed in as ${user.displayName || "Stargazer"}` : "Not signed in";
  document.querySelectorAll("#authControls button, #signedInControls button").forEach(button => { button.disabled = !connected || authBusy; });
  $("#sendMessage").disabled = !connected || !user?.emailVerified || busy;
}

function errorMessage(error) {
  const code = error?.code || "";
  if (code.includes("popup-closed")) return "Sign-in cancelled. You can try again.";
  if (code.includes("popup-blocked")) return "Allow the sign-in popup, then try again.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Unable to sign in. Check your email and password.";
  if (code.includes("email-already-in-use")) return "This email already has an account. Sign in or reset your password.";
  if (code.includes("too-many-requests")) return "Too many attempts. Please wait before trying again.";
  if (code.includes("permission-denied")) return "Posting was denied. Verify your email and wait 10 seconds between messages.";
  if (code.includes("unauthorized-domain") || code.includes("operation-not-allowed")) return "Sign-in is not enabled for this website yet.";
  if (code.includes("network" ) || code.includes("unavailable")) return "Connection interrupted. Please try again when online.";
  return "That action could not be completed. Please try again.";
}

async function authAction(action) {
  if (!connected || authBusy) return;
  authBusy = true;
  updateControls();
  try { await action(); } catch (error) { status.textContent = errorMessage(error); }
  finally { authBusy = false; updateControls(); }
}

function renderFeed(snapshot) {
  const nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
  messages.replaceChildren();
  const docs = channel === "chat" ? [...snapshot.docs].reverse() : snapshot.docs;
  for (const entry of docs) {
    const post = entry.data();
    const article = document.createElement("article");
    article.className = "community-post";
    const heading = document.createElement("div");
    heading.className = "community-post-heading";
    const author = document.createElement("strong");
    author.textContent = post.name;
    const time = document.createElement("time");
    const date = post.createdAt?.toDate();
    time.textContent = date ? date.toLocaleString([], {dateStyle: "medium", timeStyle: "short"}) : "Sending...";
    if (date) time.dateTime = date.toISOString();
    heading.append(author, time);
    const text = document.createElement("p");
    text.textContent = post.text;
    article.append(heading, text);
    if (auth.currentUser?.emailVerified) {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "ghost";
      const own = post.uid === auth.currentUser.uid;
      action.textContent = own ? "Delete" : "Report";
      action.setAttribute("aria-label", `${own ? "Delete your" : "Report"} message`);
      action.addEventListener("click", async () => {
        if (own && !window.confirm("Delete this message?")) return;
        action.disabled = true;
        try {
          if (own) await api.deleteDoc(entry.ref);
          else await api.setDoc(api.doc(entry.ref, "reports", auth.currentUser.uid), {uid: auth.currentUser.uid, createdAt: api.serverTimestamp()});
          status.textContent = own ? "Message deleted." : "Message reported to the moderator.";
        } catch (error) { status.textContent = errorMessage(error); action.disabled = false; }
      });
      article.append(action);
    }
    messages.append(article);
  }
  feedStatus.textContent = snapshot.metadata.fromCache ? "Offline or reconnecting: displayed messages may be out of date." : docs.length ? `Latest ${docs.length} ${channel === "chat" ? "messages" : "comments"}` : "No posts yet. Start the conversation.";
  if (channel === "chat" && nearBottom) messages.scrollTop = messages.scrollHeight;
}

function listen() {
  unsubscribe?.();
  const currentGeneration = ++generation;
  messages.replaceChildren();
  if (!connected) return;
  feedStatus.textContent = "Loading conversation...";
  const query = api.query(api.collection(db, "channels", channel, "messages"), api.orderBy("createdAt", "desc"), api.limit(100));
  unsubscribe = api.onSnapshot(query, {includeMetadataChanges: true}, snapshot => {
    if (generation === currentGeneration) renderFeed(snapshot);
  }, () => { if (generation === currentGeneration) feedStatus.textContent = "Unable to load messages. Reload to reconnect."; });
}

function selectChannel(next) {
  channel = next;
  document.querySelectorAll("[data-channel]").forEach(button => {
    const active = button.dataset.channel === channel;
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  $("#conversationPanel").setAttribute("aria-labelledby", channel === "chat" ? "chatTab" : "commentsTab");
  $("#messageLabel").textContent = channel === "chat" ? "Your message" : "Your comment";
  $("#sendMessage").textContent = channel === "chat" ? "Send message" : "Post comment";
  listen();
}

document.querySelectorAll("[data-channel]").forEach(button => {
  button.addEventListener("click", () => selectChannel(button.dataset.channel));
  button.addEventListener("keydown", event => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? "comments" : event.key === "End" ? "chat" : channel === "chat" ? "comments" : "chat";
      selectChannel(next);
      $(`[data-channel="${next}"]`).focus();
    }
  });
});
$("#messageBody").addEventListener("input", () => { $("#messageCount").textContent = `${$("#messageBody").value.length} / 1000`; });
$("#googleLogin").addEventListener("click", () => authAction(() => api.signInWithPopup(auth, new api.GoogleAuthProvider())));
$("#emailAuth").addEventListener("submit", event => {
  event.preventDefault();
  authAction(() => api.signInWithEmailAndPassword(auth, $("#authEmail").value.trim(), $("#authPassword").value));
});
$("#createAccount").addEventListener("click", () => {
  if (!$("#emailAuth").reportValidity()) return;
  authAction(async () => {
    const credential = await api.createUserWithEmailAndPassword(auth, $("#authEmail").value.trim(), $("#authPassword").value);
    await api.sendEmailVerification(credential.user);
    status.textContent = "Account created. Check your email for a verification link before posting.";
  });
});
$("#resetPassword").addEventListener("click", () => {
  if (!$("#authEmail").reportValidity()) return;
  authAction(async () => { await api.sendPasswordResetEmail(auth, $("#authEmail").value.trim()); status.textContent = "Password reset requested. Check your email."; });
});
$("#logout").addEventListener("click", () => authAction(() => api.signOut(auth)));
$("#sendVerification").addEventListener("click", () => authAction(async () => { await api.sendEmailVerification(auth.currentUser); status.textContent = "Verification email sent."; }));
$("#checkVerification").addEventListener("click", () => authAction(async () => {
  await api.reload(auth.currentUser);
  await auth.currentUser.getIdToken(true);
  status.textContent = auth.currentUser.emailVerified ? "Email verified. You can now post." : "Email is not verified yet. Open the link in your email first.";
  listen();
}));
$("#messageForm").addEventListener("submit", async event => {
  event.preventDefault();
  const user = auth?.currentUser;
  if (!connected || !user?.emailVerified || busy) return;
  const name = $("#displayName").value.trim();
  const text = $("#messageBody").value.trim();
  if (name.length < 2 || name.length > 40 || !text || text.length > 1000) { status.textContent = "Enter a display name and a message of up to 1,000 characters."; return; }
  busy = true;
  updateControls();
  const targetChannel = channel;
  try {
    const ref = api.doc(api.collection(db, "channels", targetChannel, "messages"));
    const throttle = api.doc(db, "postingLimits", user.uid);
    await api.runTransaction(db, async transaction => {
      await transaction.get(throttle);
      transaction.set(ref, {uid: user.uid, name, text, createdAt: api.serverTimestamp()});
      transaction.set(throttle, {lastPost: api.serverTimestamp(), messageId: ref.id, channel: targetChannel});
    });
    if ($("#messageBody").value.trim() === text) $("#messageBody").value = "";
    $("#messageCount").textContent = `${$("#messageBody").value.length} / 1000`;
    status.textContent = "Posted.";
  } catch (error) { status.textContent = errorMessage(error); }
  finally { busy = false; updateControls(); }
});

async function startCommunity() {
  const config = window.STAR_YEAR_FIREBASE_CONFIG;
  if (!config?.apiKey || !config?.projectId || !config?.appId) {
    status.textContent = "Community is not open yet. Comments and chat will be available when setup is complete.";
    feedStatus.textContent = "No shared connection yet. Posting is disabled.";
    return;
  }
  try {
    const [app, authentication, firestore] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js")
    ]);
    api = {...authentication, ...firestore};
    const firebase = app.initializeApp(config);
    auth = api.getAuth(firebase);
    db = api.getFirestore(firebase);
    connected = true;
    api.onAuthStateChanged(auth, user => {
      $("#authPassword").value = "";
      if (user?.displayName) $("#displayName").value = user.displayName.slice(0, 40);
      status.textContent = user ? user.emailVerified ? "Welcome. You can post in both conversations." : "Verify your email to post." : "Sign in to post. Everyone can read the conversations.";
      updateControls();
      listen();
    });
  } catch { status.textContent = "Community could not connect. Check your connection and reload."; }
}
startCommunity();
