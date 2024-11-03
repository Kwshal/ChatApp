import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue, set, push, get, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";
import { botManager } from './bots.js';

let notificationPermission = false;

// Request notification permission when app loads
async function requestNotificationPermission() {
     if (!('Notification' in window)) {
          console.log('This browser does not support notifications');
          return;
     }

     try {
          const permission = await Notification.requestPermission();
          notificationPermission = permission === 'granted';
          console.log('Notification permission:', permission);
     } catch (error) {
          console.error('Error requesting notification permission:', error);
     }
}

// Call this when app starts
document.addEventListener('DOMContentLoaded', () => {
     requestNotificationPermission();
});

const firebaseConfig = {
     apiKey: "AIzaSyCHKs8Mtt0tH1d0SfBcY8T1_y5DV7DdzLE",
     authDomain: "kloned-whatsapp.firebaseapp.com",
     projectId: "kloned-whatsapp",
     databaseURL: "https://kloned-whatsapp-default-rtdb.asia-southeast1.firebasedatabase.app/",
     storageBucket: "kloned-whatsapp.appspot.com",
     messagingSenderId: "1023505189291",
     appId: "1:1023505189291:web:badbb63366eeac9e0e2aee"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

// DOM Elements
const authContainer = document.getElementById('authContainer');
const chatContainer = document.getElementById('chatContainer');
const nameInput = document.getElementById('nameInput');
const enterButton = document.getElementById('enterButton');
const newButton = document.getElementById('newButton');
const statusMessage = document.getElementById('statusMessage');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const messages = document.getElementById('messages');
const menuToggle = document.getElementById('menuToggle');
const sideMenu = document.querySelector('.side-menu');
const usersList = document.getElementById('usersList');
const logoutButton = document.getElementById('logoutButton');

let currentUser = null;
let selectedUser = null;

// Create overlay element
const overlay = document.createElement('div');
overlay.className = 'overlay';
document.body.appendChild(overlay);

// Toggle menu function
function toggleMenu() {
     sideMenu.classList.toggle('active');
     overlay.classList.toggle('active');
}

// Event listeners for menu
menuToggle.addEventListener('click', toggleMenu);
overlay.addEventListener('click', toggleMenu);

// Show status message
function showMessage(message, isError = false) {
     statusMessage.textContent = message;
     statusMessage.className = 'status-message ' + (isError ? 'error' : 'success');
}

// Enter button for existing users
enterButton.addEventListener('click', async () => {
     const name = nameInput.value.trim();

     if (!name) {
          showMessage('Please enter your name', true);
          return;
     }

     try {
          // Check if user exists
          const usersRef = ref(database, 'users');
          const snapshot = await get(usersRef);
          const users = snapshot.val() || {};

          const existingUser = Object.entries(users).find(([_, userData]) =>
               userData.name === name
          );

          if (!existingUser) {
               showMessage('User not found. Please use New button to create account', true);
               return;
          }

          // Set current user with existing ID
          currentUser = {
               uid: existingUser[0],
               name: name
          };

          // Update last seen
          await update(ref(database, `users/${existingUser[0]}`), {
               lastSeen: serverTimestamp()
          });

          enterChat();

     } catch (error) {
          console.error('Error:', error);
          showMessage('Error entering chat', true);
     }
});

// New button for new users
newButton.addEventListener('click', async () => {
     const name = nameInput.value.trim();

     if (!name) {
          showMessage('Enter name', true);
          return;
     }

     try {
          const usersRef = ref(database, 'users');
          const snapshot = await get(usersRef);
          const users = snapshot.val() || {};

          if (Object.values(users).some(user => user.name === name)) {
               showMessage('Name already taken', true);
               return;
          }

          const userId = 'user_' + Date.now();
          await set(ref(database, `users/${userId}`), {
               name: name,
               createdAt: Date.now(),
               lastSeen: Date.now(),
               profilePic: 'https://via.placeholder.com/80'
          });

          currentUser = { uid: userId, name: name };
          enterChat();

     } catch (error) {
          showMessage('Error creating user: ' + error.message, true);
          console.error('New user error:', error);
     }
});

// Enter chat function
function enterChat() {
     if (!currentUser) {
          console.error('No current user');
          return;
     }

     // Hide auth container, show chat container
     authContainer.classList.add('hidden');
     chatContainer.classList.remove('hidden');

     // Set user name in UI (only once)
     const userNameElement = document.getElementById('userName');
     if (userNameElement) {
          userNameElement.textContent = currentUser.name;
     }

     // Load users list
     loadUsers();
}

// Clear message on input
nameInput.addEventListener('input', () => {
     statusMessage.className = 'status-message';
     statusMessage.textContent = '';
});

// Keep only ONE loadUsers function definition

function selectUser(uid, username, isBot = false) {
     selectedUser = uid;
     currentChatUser.textContent = username;
     messageInput.disabled = false;
     sendButton.disabled = false;

     // Clear previous messages when switching chats
     messages.innerHTML = '';

     // Update active user in UI
     document.querySelectorAll('.user-item').forEach(item => {
          item.classList.remove('active');
          if (item.querySelector('.user-name').textContent === username) {
               item.classList.add('active');
          }
     });

     if (isBot) {
          // Don't load messages for bots - they don't persist
          messages.innerHTML = '<div class="bot-welcome">Start chatting with the bot!</div>';
     } else {
          // Load messages for regular users
          loadMessages();
     }

     if (window.innerWidth <= 768) {
          toggleMenu();
     }
}

function loadMessages() {
     if (!currentUser || !selectedUser) return;

     const chatId = getChatId(currentUser.uid, selectedUser);
     const chatRef = ref(database, `chats/${chatId}`);

     onValue(chatRef, (snapshot) => {
          const chatData = snapshot.val() || {};
          messages.innerHTML = '';

          // Set wallpaper if exists
          messages.style.backgroundImage = chatData.wallpaper ?
               `url(${chatData.wallpaper})` : 'none';

          if (chatData.messages) {
               Object.entries(chatData.messages).forEach(([key, msg]) => {
                    const messageElement = document.createElement('div');
                    messageElement.className = `message ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`;
                    messageElement.textContent = msg.text;
                    messages.appendChild(messageElement);

                    // Show notification for new messages
                    if (msg.senderId !== currentUser.uid &&
                         msg.timestamp > (Date.now() - 1000)) { // Check if message is new (within last second)
                         showNotification(msg.text);
                    }
               });
               messages.scrollTop = messages.scrollHeight;
          }
     });
}

function getChatId(uid1, uid2) {
     return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// Add send button click handler
sendButton.addEventListener('click', sendMessage);

// Add enter key handler for message input
messageInput.addEventListener('keypress', (e) => {
     if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
     }
}, { passive: false });

// Modify sendMessage function
async function sendMessage() {
     const message = messageInput.value.trim();

     if (!message || !selectedUser) return;

     // Create message element
     const messageElement = document.createElement('div');
     messageElement.className = 'message sent';
     messageElement.textContent = message;

     messages.appendChild(messageElement);
     messageInput.value = '';
     messages.scrollTop = messages.scrollHeight;

     // Send message to database
     const chatId = getChatId(currentUser.uid, selectedUser);
     const messagesRef = ref(database, `chats/${chatId}/messages`);

     try {
          await push(messagesRef, {
               text: message,
               senderId: currentUser.uid,
               timestamp: serverTimestamp()
          });
     } catch (error) {
          console.error('Error sending message:', error);
          alert('Failed to send message. Please try again.');
     }
}

// Notification function
function showNotification(message, isBot = false) {
     if (!notificationPermission || document.hasFocus()) {
          return;
     }

     // Don't show notifications for bot messages if user is actively chatting
     if (isBot && document.visibilityState === 'visible') {
          return;
     }

     try {
          const notification = new Notification(isBot ? 'Bot Message' : 'New Message', {
               body: message,
               icon: isBot ? `https://robohash.org/${selectedUser}` : 'https://via.placeholder.com/50',
               tag: 'chat-message',
               requireInteraction: false
          });

          notification.onclick = () => {
               window.focus();
               notification.close();
          };

          setTimeout(() => notification.close(), 4000);
     } catch (error) {
          console.error('Notification error:', error);
     }
}

// Context Menu Elements
const headerContextMenu = document.getElementById('headerContextMenu');
const contactContextMenu = document.getElementById('contactContextMenu');
let contextMenuTimeout;

// Function to show context menu
function showContextMenu(e, menu, targetId = null) {
     // Check if it's a touch event or mouse event
     const event = e.touches ? e.touches[0] : e;

     if (event.preventDefault) {
          event.preventDefault();
          event.stopPropagation();
     }

     const x = event.clientX;
     const y = event.clientY;

     menu.style.display = 'block';
     menu.style.left = `${x}px`;
     menu.style.top = `${y}px`;

     if (targetId) {
          menu.dataset.targetId = targetId;
     }
}

// Only keep ONE handleContextMenuAction function
function handleContextMenuAction(action, targetId) {
     switch (action) {
          case 'deleteChat':
               if (selectedUser) {
                    const chatId = getChatId(currentUser.uid, selectedUser);
                    set(ref(database, `chats/${chatId}`), null);
                    messages.innerHTML = '';
               }
               break;

          case 'deleteContact':
               if (targetId) {
                    const chatId = getChatId(currentUser.uid, targetId);
                    set(ref(database, `chats/${chatId}`), null);
                    // Additional contact deletion logic can go here
               }
               break;
     }
}

// Event Listeners for context menus
document.addEventListener('click', () => {
     headerContextMenu.style.display = 'none';
     contactContextMenu.style.display = 'none';
});

document.querySelectorAll('.context-menu li').forEach(item => {
     item.addEventListener('click', (e) => {
          const action = e.currentTarget.dataset.action;
          const targetId = e.currentTarget.closest('.context-menu').dataset.targetId;
          handleContextMenuAction(action, targetId);
     });
});

// Header context menu
document.querySelector('.chat-header').addEventListener('dblclick', (e) => {
     if (selectedUser) {
          showContextMenu(e, headerContextMenu);
     }
});

// Long press for mobile
let pressTimer;
document.querySelector('.chat-header').addEventListener('touchstart', (e) => {
     if (selectedUser) {
          pressTimer = setTimeout(() => {
               showContextMenu(e.touches[0], headerContextMenu);
          }, 500);
     }
});

// Contact list context menu
function setupContactContextMenu(userDiv, userId) {
     userDiv.addEventListener('dblclick', (e) => {
          showContextMenu(e, contactContextMenu, userId);
     });

     // Keep the touch events for mobile
     userDiv.addEventListener('touchstart', (e) => {
          pressTimer = setTimeout(() => {
               showContextMenu(e.touches[0], contactContextMenu, userId);
          }, 500);
     });

     userDiv.addEventListener('touchend', () => {
          clearTimeout(pressTimer);
     });
}

// Add these variables at the top with your other variables
let touchStartX = 0;
let touchEndX = 0;
const SWIPE_THRESHOLD = 100; // minimum distance for swipe

// Add these event listeners after your existing code
document.addEventListener('touchstart', e => {
     touchStartX = e.touches[0].clientX;
});

document.addEventListener('touchmove', e => {
     if (!touchStartX) {
          return;
     }

     const currentX = e.touches[0].clientX;
     const diff = currentX - touchStartX;

     // Only allow swipe from left edge of screen (within 30px)
     if (touchStartX > 30) {
          return;
     }

     // Prevent default scrolling when swiping from left edge
     if (diff > 0) {
          e.preventDefault();
     }
}, { passive: false });

document.addEventListener('touchend', e => {
     touchEndX = e.changedTouches[0].clientX;

     // Calculate swipe distance
     const swipeDistance = touchEndX - touchStartX;

     // If swipe distance is greater than threshold and started from left edge
     if (swipeDistance > SWIPE_THRESHOLD && touchStartX <= 30) {
          sideMenu.classList.add('active');
          overlay.classList.add('active');
     }

     // Reset values
     touchStartX = 0;
     touchEndX = 0;
});

// Add this CSS to handle the transition

// Add this logout handler
logoutButton.addEventListener('click', () => {
     // Reset user state
     currentUser = null;
     selectedUser = null;

     // Clear messages
     messages.innerHTML = '';

     // Hide chat container and show auth container
     chatContainer.classList.add('hidden');
     authContainer.classList.remove('hidden');

     // Reset input fields
     nameInput.value = '';
     messageInput.value = '';

     // Close side menu if on mobile
     if (window.innerWidth <= 768) {
          sideMenu.classList.remove('active');
          overlay.classList.remove('active');
     }
});

// Add these after your other DOM elements
const profilePicUpload = document.getElementById('profilePicUpload');
const profilePicInput = document.getElementById('profilePicInput');
const userAvatar = document.getElementById('userAvatar');

// Profile picture upload handler
profilePicUpload.addEventListener('click', () => {
     profilePicInput.click();
});

profilePicInput.addEventListener('change', async (e) => {
     const file = e.target.files[0];
     if (!file) return;

     // Check file size (1MB limit for profile pics)
     if (file.size > 1 * 1024 * 1024) {
          alert('Profile picture too large. Please choose an image under 1MB.');
          profilePicInput.value = '';
          return;
     }

     try {
          // Show loading state
          userAvatar.style.opacity = '0.5';

          // Convert to base64
          const base64Image = await new Promise((resolve, reject) => {
               const reader = new FileReader();
               reader.onload = () => resolve(reader.result);
               reader.onerror = reject;
               reader.readAsDataURL(file);
          });

          // Compress image if needed
          const compressedImage = await compressImage(base64Image, 400); // 400px max dimension

          // Update user profile in database
          const userRef = ref(database, `users/${currentUser.uid}`);
          await update(userRef, {
               profilePic: compressedImage
          });

          // Update avatar in UI
          userAvatar.src = compressedImage;
          userAvatar.style.opacity = '1';

          console.log('Profile picture updated successfully');
     } catch (error) {
          console.error('Error updating profile picture:', error);
          userAvatar.style.opacity = '1';
          alert('Error updating profile picture. Please try again.');
     }
});

// Add this helper function to compress images
function compressImage(base64Str, maxDimension = 400) {
     return new Promise((resolve) => {
          const img = new Image();
          img.src = base64Str;
          img.onload = () => {
               const canvas = document.createElement('canvas');
               let width = img.width;
               let height = img.height;

               // Calculate new dimensions
               if (width > height) {
                    if (width > maxDimension) {
                         height = Math.round((height * maxDimension) / width);
                         width = maxDimension;
                    }
               } else {
                    if (height > maxDimension) {
                         width = Math.round((width * maxDimension) / height);
                         height = maxDimension;
                    }
               }

               canvas.width = width;
               canvas.height = height;

               const ctx = canvas.getContext('2d');
               ctx.drawImage(img, 0, 0, width, height);

               // Get compressed base64 string
               resolve(canvas.toDataURL('image/jpeg', 0.7)); // 0.7 quality for better compression
          };
     });
}

// Call this when the app starts
document.addEventListener('DOMContentLoaded', () => {
     requestNotificationPermission();
});

// Update user's last seen status
function updateLastSeen() {
     if (currentUser) {
          const userRef = ref(database, `users/${currentUser.uid}`);
          update(userRef, {
               lastSeen: serverTimestamp()
          });
     }
}

// Call this function periodically
setInterval(updateLastSeen, 60000); // Update every minute

// Add error boundary for bot processing
function processBotMessage(botName, message) {
     try {
          if (message.length > 500) {
               return 'Message too long. Please keep messages under 500 characters.';
          }
          return botManager.getBotResponse(botName, message);
     } catch (error) {
          console.error('Bot processing error:', error);
          return 'Sorry, I encountered an error. Please try again.';
     }
}

// Add near other global variables
const MAX_BOT_MESSAGES = 50;

// User status updates
function updateUserStatus(userId, isOnline) {
     const userStatusRef = ref(database, `users/${userId}`);
     update(userStatusRef, {
          lastSeen: Date.now(),
          online: isOnline
     });
}

// Load users
function loadUsers() {
     const usersRef = ref(database, 'users');
     onValue(usersRef, (snapshot) => {
          const users = snapshot.val();
          usersList.innerHTML = '';

          // Keep track of added users to prevent duplicates
          const addedUsers = new Set();

          if (users) {
               Object.entries(users).forEach(([uid, userData]) => {
                    // Skip if: no user data, no name, it's the current user, or already added
                    if (!userData || !userData.name ||
                         uid === currentUser?.uid ||
                         addedUsers.has(userData.name)) return;

                    // Add user to tracking set
                    addedUsers.add(userData.name);

                    const userDiv = document.createElement('div');
                    userDiv.className = 'user-item';

                    const isOnline = userData.lastSeen &&
                         (Date.now() - userData.lastSeen) < 5 * 60 * 1000;

                    userDiv.innerHTML = `
                        <img src="${userData.profilePic || 'https://via.placeholder.com/80'}" alt="avatar" 
                             onerror="this.src='https://via.placeholder.com/80'"
                             class="user-avatar">
                        <div class="user-info">
                            <span class="user-name">${userData.name}</span>
                            <span class="user-status ${isOnline ? 'online' : 'offline'}">
                                ${isOnline ? 'online' : 'offline'}
                            </span>
                        </div>
                    `;

                    userDiv.addEventListener('click', () => selectUser(uid, userData.name));
                    usersList.appendChild(userDiv);
                    setupContactContextMenu(userDiv, uid);
               });
          }

          // Add bots to the users list
          const bots = [
               { name: 'Mockingbird', type: 'bot' },
               { name: 'Cat', type: 'bot' },
               { name: 'Bino', type: 'bot' },
               { name: 'Ulti Khopdi', type: 'bot' }
          ];

          bots.forEach(bot => {
               const userDiv = document.createElement('div');
               userDiv.className = 'user-item bot-user';
               userDiv.innerHTML = `
                    <img src="https://robohash.org/${bot.name}" alt="bot-avatar">
                    <div class="user-info">
                        <span class="user-name">${bot.name}</span>
                        <span class="user-status bot">Bot</span>
                    </div>
               `;

               userDiv.addEventListener('click', () => selectUser(bot.name, bot.name, true));
               usersList.appendChild(userDiv);
          });
     });
}

// Send message

// User creation/registration
newButton.addEventListener('click', async () => {
     const name = nameInput.value.trim();
     if (name) {
          const userId = 'user_' + Date.now();
          const userRef = ref(database, `users/${userId}`);
          await set(userRef, {
               name: name,
               createdAt: Date.now(),
               lastSeen: Date.now(),
               online: true,
               profilePic: 'https://via.placeholder.com/80'
          });
          // ... rest of the code ...
     }
});

// Update user's online status
window.addEventListener('beforeunload', () => {
     if (currentUser) {
          const userRef = ref(database, `users/${currentUser.uid}`);
          update(userRef, {
               online: false,
               lastSeen: Date.now()
          });
     }
});

// Set user online when they connect
window.addEventListener('load', () => {
     if (currentUser) {
          const userRef = ref(database, `users/${currentUser.uid}`);
          update(userRef, {
               online: true,
               lastSeen: Date.now()
          });
     }
});

// Add near your other DOM elements
const wallpaperButton = document.getElementById('wallpaperButton');
const wallpaperInput = document.getElementById('wallpaperInput');

// Add wallpaper button handler
if (wallpaperButton && wallpaperInput) {
     wallpaperButton.addEventListener('click', () => {
          wallpaperInput.click();
     });

     wallpaperInput.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          // Check file size (2MB limit for wallpapers)
          if (file.size > 2 * 1024 * 1024) {
               alert('Wallpaper too large. Please choose an image under 2MB.');
               wallpaperInput.value = '';
               return;
          }

          try {
               // Convert to base64
               const base64Image = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
               });

               // Compress image
               const compressedImage = await compressImage(base64Image, 800);

               // Save wallpaper to database for this chat
               const chatId = getChatId(currentUser.uid, selectedUser);
               const chatRef = ref(database, `chats/${chatId}`);
               await update(chatRef, {
                    wallpaper: compressedImage
               });

               // Apply wallpaper
               messages.style.backgroundImage = `url(${compressedImage})`;

          } catch (error) {
               console.error('Error updating wallpaper:', error);
               alert('Error updating wallpaper. Please try again.');
          }
     });
}

// Modify scroll-related event listeners to be passive
messageInput.addEventListener('keypress', (e) => {
     if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
     }
}, { passive: false }); // We need preventDefault, so can't be passive

// For any touch or wheel events, make them passive
messages.addEventListener('touchstart', () => {
     // Handle touch start
}, { passive: true });

messages.addEventListener('wheel', () => {
     // Handle wheel event
}, { passive: true });

// If you have any scroll handlers
messages.addEventListener('scroll', () => {
     // Handle scroll
}, { passive: true });