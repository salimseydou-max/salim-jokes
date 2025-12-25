# API Documentation

This document provides comprehensive documentation for all public APIs, functions, and interfaces in the Voice Joke Webpage application.

## Table of Contents

- [JavaScript Functions](#javascript-functions)
  - [displayJoke](#displayjoke)
  - [speakJoke](#speakjoke)
  - [fetchJoke](#fetchjoke)
- [Event Handlers](#event-handlers)
- [Global Variables](#global-variables)
- [External API Integration](#external-api-integration)
- [Web APIs Used](#web-apis-used)
- [Code Examples](#code-examples)

---

## JavaScript Functions

### displayJoke

**Purpose**: Updates the DOM to display a joke on the webpage.

**Signature**:
```javascript
function displayJoke(joke)
```

**Parameters**:
| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `joke`    | String | Yes      | The joke text to display |

**Returns**: `undefined` (void function)

**Side Effects**:
- Modifies the `textContent` property of the element with ID `joke`
- Updates the UI to show the provided joke text

**Example Usage**:
```javascript
// Display a simple joke
displayJoke("Why did the chicken cross the road? To get to the other side!");

// Display a loading message
displayJoke("Loading joke...");

// Display an error message
displayJoke("Oops! Failed to load a joke.");
```

**Implementation Details**:
- Uses `document.getElementById('joke')` to select the target element
- Uses `textContent` (not `innerHTML`) for security (prevents XSS attacks)
- Synchronous operation with no async behavior

**Error Handling**:
- Will throw a TypeError if the element with ID 'joke' doesn't exist
- No built-in validation for the joke parameter

**Best Practices**:
```javascript
// Good: Clear, descriptive text
displayJoke("Here's a funny joke!");

// Avoid: Empty strings (confusing to users)
displayJoke("");

// Good: User-friendly error messages
displayJoke("Unable to load joke. Please try again.");
```

---

### speakJoke

**Purpose**: Uses the Web Speech Synthesis API to read a joke aloud with customized voice parameters.

**Signature**:
```javascript
function speakJoke(joke)
```

**Parameters**:
| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `joke`    | String | Yes      | The joke text to speak aloud |

**Returns**: `undefined` (void function)

**Side Effects**:
- Cancels any currently speaking utterance
- Initiates speech synthesis with the provided text
- May trigger browser audio permissions prompt (first use)

**Voice Configuration**:
| Property | Value    | Description |
|----------|----------|-------------|
| `rate`   | 1.05     | Speech speed (1.0 = normal, range: 0.1-10) |
| `pitch`  | 1.1      | Voice pitch (1.0 = normal, range: 0-2) |
| `lang`   | 'en-US'  | Language/locale for pronunciation |

**Example Usage**:
```javascript
// Speak a joke
speakJoke("Why don't scientists trust atoms? Because they make up everything!");

// Speak the current joke
speakJoke(currentJoke);

// Speak a two-part joke
const twoPartJoke = "What do you call a bear with no teeth?\nA gummy bear!";
speakJoke(twoPartJoke);
```

**Browser Compatibility**:
```javascript
if (window.speechSynthesis) {
  // Speech synthesis is supported
  speakJoke(myJoke);
} else {
  // Fallback for unsupported browsers
  console.log("Speech synthesis not supported");
}
```

**Implementation Details**:
- Checks for `window.speechSynthesis` support (returns early if not available)
- Cancels previous speech before starting new utterance (prevents overlap)
- Creates a new `SpeechSynthesisUtterance` object for each call
- Uses slightly increased rate (1.05) for more dynamic delivery
- Uses slightly higher pitch (1.1) for more cheerful tone

**Advanced Usage**:
```javascript
// Custom implementation with event listeners
function speakJokeWithEvents(joke) {
  if (!window.speechSynthesis) return;
  
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(joke);
  utter.rate = 1.05;
  utter.pitch = 1.1;
  utter.lang = 'en-US';
  
  // Event handlers
  utter.onstart = () => console.log("Speech started");
  utter.onend = () => console.log("Speech completed");
  utter.onerror = (e) => console.error("Speech error:", e);
  
  window.speechSynthesis.speak(utter);
}
```

**Error Handling**:
- Gracefully degrades on browsers without Speech API support
- No error thrown if `speechSynthesis` is undefined
- Speech may fail silently on some mobile browsers (autoplay restrictions)

**Performance Considerations**:
- Cancel previous speech to prevent memory leaks
- Each utterance creates a new object (garbage collected after completion)
- Speech synthesis queue is managed by the browser

---

### fetchJoke

**Purpose**: Asynchronously fetches a random joke from the JokeAPI v2 and updates the UI.

**Signature**:
```javascript
async function fetchJoke()
```

**Parameters**: None

**Returns**: `Promise<void>` (async function, no return value)

**Side Effects**:
- Updates the `currentJoke` global variable
- Calls `displayJoke()` multiple times (loading state, then actual joke)
- Makes network request to external API

**API Endpoint**:
```
https://v2.jokeapi.dev/joke/Any?type=single,twopart&safe-mode
```

**Query Parameters**:
| Parameter   | Value            | Description |
|-------------|------------------|-------------|
| `type`      | `single,twopart` | Accepts both joke formats |
| `safe-mode` | (flag)           | Filters out NSFW content |

**Example Usage**:
```javascript
// Fetch and display a new joke
await fetchJoke();

// Use with button click
document.getElementById('next').onclick = () => fetchJoke();

// Use with async/await
async function loadMultipleJokes() {
  await fetchJoke();
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
  await fetchJoke();
}

// Use with Promise chaining
fetchJoke()
  .then(() => console.log("Joke loaded"))
  .catch(error => console.error("Error:", error));
```

**Response Format**:

**Single-type Joke**:
```json
{
  "error": false,
  "category": "Programming",
  "type": "single",
  "joke": "Why do programmers prefer dark mode? Because light attracts bugs!",
  "flags": {
    "nsfw": false,
    "religious": false,
    "political": false,
    "racist": false,
    "sexist": false,
    "explicit": false
  },
  "id": 42,
  "safe": true,
  "lang": "en"
}
```

**Two-part Joke**:
```json
{
  "error": false,
  "category": "Misc",
  "type": "twopart",
  "setup": "Why did the scarecrow win an award?",
  "delivery": "Because he was outstanding in his field!",
  "flags": {
    "nsfw": false,
    "religious": false,
    "political": false,
    "racist": false,
    "sexist": false,
    "explicit": false
  },
  "id": 123,
  "safe": true,
  "lang": "en"
}
```

**Implementation Flow**:
```javascript
async function fetchJoke() {
  // 1. Show loading state
  displayJoke('Loading joke...');
  
  try {
    // 2. Fetch from API
    const resp = await fetch('https://v2.jokeapi.dev/joke/Any?type=single,twopart&safe-mode');
    
    // 3. Parse JSON response
    const data = await resp.json();
    
    // 4. Format joke based on type
    let joke = '';
    if (data.type === 'single') {
      joke = data.joke;
    } else if (data.type === 'twopart') {
      joke = data.setup + '\n' + data.delivery;
    } else {
      joke = "Oops! Couldn't find a joke.";
    }
    
    // 5. Update global state
    currentJoke = joke;
    
    // 6. Display the joke
    displayJoke(joke);
    
  } catch (e) {
    // 7. Handle errors gracefully
    currentJoke = "Oops! Failed to load a joke.";
    displayJoke(currentJoke);
  }
}
```

**Error Handling**:
```javascript
// Network errors
// - No internet connection
// - API is down
// - Timeout
// - DNS resolution failure

// Response errors
// - Invalid JSON
// - Unexpected response format
// - API error response

// All errors are caught and display user-friendly message
```

**Advanced Error Handling Example**:
```javascript
async function fetchJokeWithDetailedErrors() {
  displayJoke('Loading joke...');
  
  try {
    const resp = await fetch(
      'https://v2.jokeapi.dev/joke/Any?type=single,twopart&safe-mode',
      { timeout: 5000 } // 5 second timeout
    );
    
    if (!resp.ok) {
      throw new Error(`HTTP error! status: ${resp.status}`);
    }
    
    const data = await resp.json();
    
    if (data.error) {
      throw new Error(data.message || "API returned an error");
    }
    
    let joke = '';
    if (data.type === 'single') {
      joke = data.joke;
    } else if (data.type === 'twopart') {
      joke = `${data.setup}\n${data.delivery}`;
    } else {
      throw new Error("Unknown joke type");
    }
    
    currentJoke = joke;
    displayJoke(joke);
    
  } catch (e) {
    console.error("Failed to fetch joke:", e);
    
    if (e instanceof TypeError && e.message.includes('fetch')) {
      currentJoke = "Network error. Please check your connection.";
    } else if (e.message.includes('timeout')) {
      currentJoke = "Request timed out. Please try again.";
    } else {
      currentJoke = "Oops! Failed to load a joke.";
    }
    
    displayJoke(currentJoke);
  }
}
```

**Rate Limiting**:
```javascript
// JokeAPI free tier: 120 requests per minute
// Approximately 1 request every 0.5 seconds

// Implement throttling if needed:
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 500; // 500ms

async function fetchJokeThrottled() {
  const now = Date.now();
  const timeSinceLastFetch = now - lastFetchTime;
  
  if (timeSinceLastFetch < MIN_FETCH_INTERVAL) {
    displayJoke("Please wait a moment before fetching another joke...");
    return;
  }
  
  lastFetchTime = now;
  await fetchJoke();
}
```

---

## Event Handlers

### Play Button Handler

**Purpose**: Plays the current joke when the Play button is clicked.

**Implementation**:
```javascript
document.getElementById('play').onclick = () => speakJoke(currentJoke);
```

**Event Type**: `click`

**Behavior**:
- Retrieves the current joke from the `currentJoke` variable
- Passes it to `speakJoke()` for audio playback
- No validation (assumes `currentJoke` is already set)

**Example Usage**:
```javascript
// The handler is automatically attached on page load
// Users simply click the "Play 🔊" button

// Programmatically trigger the click:
document.getElementById('play').click();
```

---

### Replay Button Handler

**Purpose**: Replays the current joke when the Replay button is clicked.

**Implementation**:
```javascript
document.getElementById('replay').onclick = () => speakJoke(currentJoke);
```

**Event Type**: `click`

**Behavior**:
- Identical to Play button functionality
- Provides semantic clarity for users (replay vs. initial play)
- Cancels any currently playing speech before replaying

**Example Usage**:
```javascript
// The handler is automatically attached on page load
// Users simply click the "Replay ♻️" button

// Programmatically trigger the replay:
document.getElementById('replay').click();
```

**Note**: The Play and Replay buttons have identical functionality but serve different UX purposes. Consider tracking playback state for a more sophisticated implementation:

```javascript
let isPlaying = false;

document.getElementById('play').onclick = () => {
  if (!isPlaying) {
    speakJoke(currentJoke);
    isPlaying = true;
  }
};

// Add event listeners to track speech state
const utter = new SpeechSynthesisUtterance();
utter.onend = () => { isPlaying = false; };
utter.onerror = () => { isPlaying = false; };
```

---

### Next Joke Button Handler

**Purpose**: Fetches a new random joke when the Next button is clicked.

**Implementation**:
```javascript
document.getElementById('next').onclick = () => fetchJoke();
```

**Event Type**: `click`

**Behavior**:
- Initiates an async API call to fetch a new joke
- Updates the UI with loading state immediately
- Replaces the current joke with the new one

**Example Usage**:
```javascript
// The handler is automatically attached on page load
// Users simply click the "Next Joke 👉" button

// Programmatically fetch next joke:
document.getElementById('next').click();

// Or call directly:
fetchJoke();
```

**Advanced Implementation with Loading State**:
```javascript
let isLoading = false;

document.getElementById('next').onclick = async () => {
  if (isLoading) {
    console.log("Already loading a joke...");
    return;
  }
  
  isLoading = true;
  const button = document.getElementById('next');
  button.disabled = true;
  button.textContent = "Loading...";
  
  try {
    await fetchJoke();
  } finally {
    isLoading = false;
    button.disabled = false;
    button.textContent = "Next Joke 👉";
  }
};
```

---

### Window Load Handler

**Purpose**: Automatically fetches the first joke when the page finishes loading.

**Implementation**:
```javascript
window.onload = () => {
  fetchJoke();
};
```

**Event Type**: `load`

**Behavior**:
- Triggered when the entire page (including all resources) has loaded
- Ensures the DOM is fully ready before attempting to fetch/display a joke
- Provides immediate content for users without requiring interaction

**Alternative Implementations**:

**Using addEventListener**:
```javascript
window.addEventListener('load', () => {
  fetchJoke();
});
```

**Using DOMContentLoaded (faster)**:
```javascript
// Triggers when DOM is ready (doesn't wait for images, stylesheets)
document.addEventListener('DOMContentLoaded', () => {
  fetchJoke();
});
```

**Using async/await**:
```javascript
window.onload = async () => {
  await fetchJoke();
  console.log("Initial joke loaded");
};
```

---

## Global Variables

### currentJoke

**Purpose**: Stores the currently displayed joke for replay functionality.

**Declaration**:
```javascript
let currentJoke = '';
```

**Type**: `String`

**Scope**: Global (accessible throughout the script)

**Initial Value**: Empty string (`''`)

**Usage**:
```javascript
// Set by fetchJoke()
currentJoke = data.joke;

// Read by event handlers
speakJoke(currentJoke);

// Can be accessed from browser console
console.log(currentJoke);
```

**Lifecycle**:
1. Initialized as empty string
2. Updated by `fetchJoke()` after successful API call
3. Updated to error message if fetch fails
4. Persists until next `fetchJoke()` call
5. Lost on page reload (not persisted to storage)

**Best Practices**:
```javascript
// Good: Check if joke exists before using
if (currentJoke) {
  speakJoke(currentJoke);
}

// Better: Use with default value
speakJoke(currentJoke || "No joke loaded yet");

// Best: Add persistence
localStorage.setItem('lastJoke', currentJoke);
const savedJoke = localStorage.getItem('lastJoke');
```

---

## External API Integration

### JokeAPI v2

**Base URL**: `https://v2.jokeapi.dev`

**Endpoint Used**: `/joke/Any`

**Full Request URL**:
```
https://v2.jokeapi.dev/joke/Any?type=single,twopart&safe-mode
```

**HTTP Method**: `GET`

**Authentication**: None required (public API)

**Rate Limits**:
- **Free Tier**: 120 requests per minute
- **Headers**: No authentication headers required
- **Tracking**: Based on IP address

**Request Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `type` | String | No | `single,twopart` | Comma-separated joke types |
| `safe-mode` | Flag | No | `false` | Filters NSFW content |
| `lang` | String | No | `en` | Language code (en, de, es, fr, pt, cs) |
| `blacklistFlags` | String | No | None | Comma-separated flags to exclude |
| `amount` | Number | No | 1 | Number of jokes (1-10) |

**Response Structure**:

**Success Response** (Status: 200 OK):
```json
{
  "error": false,
  "category": "Programming",
  "type": "single",
  "joke": "A SQL query walks into a bar...",
  "flags": {
    "nsfw": false,
    "religious": false,
    "political": false,
    "racist": false,
    "sexist": false,
    "explicit": false
  },
  "safe": true,
  "id": 1,
  "lang": "en"
}
```

**Error Response** (Status: 4xx or 5xx):
```json
{
  "error": true,
  "internalError": false,
  "code": 400,
  "message": "Error message here",
  "causedBy": ["List", "of", "causes"],
  "additionalInfo": "More information",
  "timestamp": 1234567890
}
```

**Categories Available**:
- `Any` - Random from all categories
- `Programming` - Programming jokes
- `Misc` - Miscellaneous jokes
- `Dark` - Dark humor (filtered in safe-mode)
- `Pun` - Pun jokes
- `Spooky` - Spooky jokes
- `Christmas` - Christmas jokes

**Example API Calls**:

```javascript
// Get a programming joke
fetch('https://v2.jokeapi.dev/joke/Programming?type=single')
  .then(r => r.json())
  .then(data => console.log(data.joke));

// Get multiple jokes
fetch('https://v2.jokeapi.dev/joke/Any?amount=5')
  .then(r => r.json())
  .then(data => console.log(data.jokes));

// Get joke in different language
fetch('https://v2.jokeapi.dev/joke/Any?lang=es')
  .then(r => r.json())
  .then(data => console.log(data.joke));

// Blacklist specific flags
fetch('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious')
  .then(r => r.json())
  .then(data => console.log(data.joke));
```

**API Documentation**: https://jokeapi.dev/

---

## Web APIs Used

### 1. Fetch API

**Purpose**: Making HTTP requests to retrieve jokes from external API

**Documentation**: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API

**Usage in Project**:
```javascript
const resp = await fetch('https://v2.jokeapi.dev/joke/Any?type=single,twopart&safe-mode');
const data = await resp.json();
```

**Browser Support**: All modern browsers (IE not supported)

---

### 2. Web Speech API (Speech Synthesis)

**Purpose**: Converting text to speech for joke playback

**Documentation**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API

**Key Interfaces Used**:
- `window.speechSynthesis` - Main controller
- `SpeechSynthesisUtterance` - Utterance object

**Usage in Project**:
```javascript
const utter = new SpeechSynthesisUtterance(joke);
utter.rate = 1.05;
utter.pitch = 1.1;
utter.lang = 'en-US';
window.speechSynthesis.speak(utter);
```

**Browser Support**:
- ✅ Chrome 33+
- ✅ Edge 14+
- ✅ Safari 7+
- ⚠️ Firefox 49+ (limited voices)

**Available Properties**:

| Property | Type | Range | Description |
|----------|------|-------|-------------|
| `text` | String | - | Text to speak |
| `lang` | String | BCP 47 | Language code |
| `voice` | SpeechSynthesisVoice | - | Voice to use |
| `volume` | Number | 0-1 | Audio volume |
| `rate` | Number | 0.1-10 | Speech speed |
| `pitch` | Number | 0-2 | Voice pitch |

**Available Methods**:

| Method | Description |
|--------|-------------|
| `speak(utterance)` | Add utterance to queue and speak |
| `cancel()` | Remove all utterances from queue |
| `pause()` | Pause speech |
| `resume()` | Resume paused speech |
| `getVoices()` | Get available voices |

**Events**:

| Event | Description |
|-------|-------------|
| `start` | Fired when speech begins |
| `end` | Fired when speech completes |
| `error` | Fired on error |
| `pause` | Fired when paused |
| `resume` | Fired when resumed |
| `boundary` | Fired at word/sentence boundaries |

---

### 3. DOM API

**Purpose**: Manipulating HTML elements and handling events

**Methods Used**:
- `document.getElementById()` - Select element by ID
- `element.textContent` - Get/set text content
- `element.onclick` - Attach click event handler

**Example**:
```javascript
const jokeElement = document.getElementById('joke');
jokeElement.textContent = "New joke text";
```

---

## Code Examples

### Complete Working Example

```javascript
// Global state
let currentJoke = '';

// Display joke in UI
function displayJoke(joke) {
  document.getElementById('joke').textContent = joke;
}

// Speak joke using TTS
function speakJoke(joke) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(joke);
  utter.rate = 1.05;
  utter.pitch = 1.1;
  utter.lang = 'en-US';
  window.speechSynthesis.speak(utter);
}

// Fetch joke from API
async function fetchJoke() {
  displayJoke('Loading joke...');
  try {
    const resp = await fetch('https://v2.jokeapi.dev/joke/Any?type=single,twopart&safe-mode');
    const data = await resp.json();
    let joke = '';
    if (data.type === 'single') {
      joke = data.joke;
    } else if (data.type === 'twopart') {
      joke = data.setup + '\n' + data.delivery;
    } else {
      joke = "Oops! Couldn't find a joke.";
    }
    currentJoke = joke;
    displayJoke(joke);
  } catch (e) {
    currentJoke = "Oops! Failed to load a joke.";
    displayJoke(currentJoke);
  }
}

// Attach event handlers
document.getElementById('play').onclick = () => speakJoke(currentJoke);
document.getElementById('replay').onclick = () => speakJoke(currentJoke);
document.getElementById('next').onclick = () => fetchJoke();

// Load initial joke
window.onload = () => {
  fetchJoke();
};
```

### Extended Example with Voice Selection

```javascript
// Get available voices
function getVoices() {
  return window.speechSynthesis.getVoices();
}

// Speak with specific voice
function speakWithVoice(joke, voiceName) {
  if (!window.speechSynthesis) return;
  
  window.speechSynthesis.cancel();
  
  const voices = getVoices();
  const voice = voices.find(v => v.name === voiceName);
  
  const utter = new SpeechSynthesisUtterance(joke);
  utter.rate = 1.05;
  utter.pitch = 1.1;
  utter.lang = 'en-US';
  
  if (voice) {
    utter.voice = voice;
  }
  
  window.speechSynthesis.speak(utter);
}

// List all available voices
function listVoices() {
  const voices = getVoices();
  voices.forEach(voice => {
    console.log(`${voice.name} (${voice.lang})`);
  });
}

// Wait for voices to load
window.speechSynthesis.onvoiceschanged = () => {
  listVoices();
};
```

### Example with Local Storage Persistence

```javascript
// Save joke to localStorage
function saveJoke(joke) {
  localStorage.setItem('lastJoke', joke);
  localStorage.setItem('lastJokeTimestamp', Date.now());
}

// Load joke from localStorage
function loadSavedJoke() {
  const savedJoke = localStorage.getItem('lastJoke');
  const timestamp = localStorage.getItem('lastJokeTimestamp');
  
  if (savedJoke && timestamp) {
    const age = Date.now() - parseInt(timestamp);
    const oneHour = 60 * 60 * 1000;
    
    if (age < oneHour) {
      return savedJoke;
    }
  }
  
  return null;
}

// Enhanced fetchJoke with persistence
async function fetchJokeWithPersistence() {
  displayJoke('Loading joke...');
  
  try {
    const resp = await fetch('https://v2.jokeapi.dev/joke/Any?type=single,twopart&safe-mode');
    const data = await resp.json();
    
    let joke = '';
    if (data.type === 'single') {
      joke = data.joke;
    } else if (data.type === 'twopart') {
      joke = data.setup + '\n' + data.delivery;
    } else {
      joke = "Oops! Couldn't find a joke.";
    }
    
    currentJoke = joke;
    saveJoke(joke); // Persist to localStorage
    displayJoke(joke);
    
  } catch (e) {
    // Try to load from cache on error
    const cachedJoke = loadSavedJoke();
    
    if (cachedJoke) {
      currentJoke = cachedJoke;
      displayJoke(cachedJoke + "\n\n(Loaded from cache)");
    } else {
      currentJoke = "Oops! Failed to load a joke.";
      displayJoke(currentJoke);
    }
  }
}

// Load on startup
window.onload = () => {
  const savedJoke = loadSavedJoke();
  
  if (savedJoke) {
    currentJoke = savedJoke;
    displayJoke(savedJoke);
  } else {
    fetchJokeWithPersistence();
  }
};
```

---

## Testing Examples

### Unit Test Examples (Jest/Mocha Style)

```javascript
describe('displayJoke', () => {
  test('updates the joke element text content', () => {
    document.body.innerHTML = '<div id="joke"></div>';
    displayJoke('Test joke');
    expect(document.getElementById('joke').textContent).toBe('Test joke');
  });
  
  test('handles empty strings', () => {
    document.body.innerHTML = '<div id="joke">Old joke</div>';
    displayJoke('');
    expect(document.getElementById('joke').textContent).toBe('');
  });
});

describe('fetchJoke', () => {
  test('fetches and displays a single joke', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({
          type: 'single',
          joke: 'Test joke'
        }),
      })
    );
    
    await fetchJoke();
    expect(currentJoke).toBe('Test joke');
  });
  
  test('handles two-part jokes', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({
          type: 'twopart',
          setup: 'Setup',
          delivery: 'Punchline'
        }),
      })
    );
    
    await fetchJoke();
    expect(currentJoke).toBe('Setup\nPunchline');
  });
  
  test('handles API errors gracefully', async () => {
    global.fetch = jest.fn(() => Promise.reject('API Error'));
    
    await fetchJoke();
    expect(currentJoke).toBe("Oops! Failed to load a joke.");
  });
});
```

---

## Performance Considerations

### Function Performance

| Function | Complexity | Performance Impact |
|----------|------------|-------------------|
| `displayJoke()` | O(1) | Low - Simple DOM update |
| `speakJoke()` | O(1) | Medium - Creates audio stream |
| `fetchJoke()` | O(1) | High - Network request |

### Optimization Tips

1. **Debounce rapid clicks**:
```javascript
let fetchTimeout;
document.getElementById('next').onclick = () => {
  clearTimeout(fetchTimeout);
  fetchTimeout = setTimeout(() => fetchJoke(), 300);
};
```

2. **Cancel speech on navigation**:
```javascript
window.onbeforeunload = () => {
  window.speechSynthesis.cancel();
};
```

3. **Preload next joke**:
```javascript
let nextJoke = null;

async function preloadNextJoke() {
  const resp = await fetch('https://v2.jokeapi.dev/joke/Any?type=single,twopart&safe-mode');
  const data = await resp.json();
  nextJoke = data;
}

// Preload while current joke is being read
document.getElementById('play').onclick = () => {
  speakJoke(currentJoke);
  preloadNextJoke(); // Preload in background
};
```

---

## Security Best Practices

1. **Use `textContent` instead of `innerHTML`**:
```javascript
// ✅ Safe
element.textContent = userInput;

// ❌ Vulnerable to XSS
element.innerHTML = userInput;
```

2. **Validate API responses**:
```javascript
if (data && typeof data.joke === 'string') {
  displayJoke(data.joke);
} else {
  displayJoke('Invalid joke format');
}
```

3. **Use HTTPS for API calls**:
```javascript
// ✅ Secure
fetch('https://v2.jokeapi.dev/joke/Any');

// ❌ Insecure
fetch('http://v2.jokeapi.dev/joke/Any');
```

---

## Troubleshooting

### Common Issues and Solutions

**Issue**: Speech not working
```javascript
// Solution: Check browser support
if (!window.speechSynthesis) {
  alert('Your browser does not support text-to-speech');
}
```

**Issue**: Jokes not fetching
```javascript
// Solution: Add detailed error logging
async function fetchJoke() {
  try {
    const resp = await fetch(url);
    console.log('Response status:', resp.status);
    const data = await resp.json();
    console.log('Response data:', data);
    // ... rest of code
  } catch (e) {
    console.error('Fetch error:', e);
    console.error('Error stack:', e.stack);
  }
}
```

**Issue**: Speech cuts off
```javascript
// Solution: Keep reference to utterance
let currentUtterance = null;

function speakJoke(joke) {
  window.speechSynthesis.cancel();
  currentUtterance = new SpeechSynthesisUtterance(joke);
  currentUtterance.rate = 1.05;
  currentUtterance.pitch = 1.1;
  currentUtterance.lang = 'en-US';
  window.speechSynthesis.speak(currentUtterance);
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-25 | Initial implementation |

---

## Additional Resources

- [MDN Web Docs - Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [MDN Web Docs - Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [JokeAPI Documentation](https://jokeapi.dev/)
- [HTML DOM API](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model)

---

**Last Updated**: December 25, 2025
