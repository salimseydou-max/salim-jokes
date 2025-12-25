# Usage Guide

This comprehensive guide provides step-by-step instructions, examples, and best practices for using the Voice Joke Webpage application.

## Table of Contents

- [Quick Start](#quick-start)
- [Basic Usage](#basic-usage)
- [Feature Walkthrough](#feature-walkthrough)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)
- [Tips and Tricks](#tips-and-tricks)
- [Use Cases](#use-cases)
- [Integration Examples](#integration-examples)
- [Customization Examples](#customization-examples)
- [Developer Guide](#developer-guide)

---

## Quick Start

### Getting Started in 3 Steps

1. **Open the Application**
   - Locate `index.html` in your file system
   - Double-click to open in your default browser
   - Or right-click → "Open with" → Choose your browser

2. **Wait for Initial Load**
   - A joke will automatically load when the page opens
   - You'll see "Loading joke..." briefly
   - Then a random joke appears

3. **Interact with Controls**
   - Click "Play 🔊" to hear the joke
   - Click "Next Joke 👉" to get a new joke
   - Click "Replay ♻️" to hear the same joke again

### First-Time Setup

**No installation required!** Simply:
```bash
# Clone or download the repository
git clone <repository-url>

# Navigate to the directory
cd <repository-directory>

# Open in browser
open index.html  # Mac
start index.html # Windows
xdg-open index.html # Linux
```

**Or use a local server** (recommended for development):
```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server -p 8000

# PHP
php -S localhost:8000
```

Then visit: `http://localhost:8000`

---

## Basic Usage

### Loading the Application

**Method 1: Direct File Opening**
1. Locate `index.html`
2. Double-click the file
3. Browser opens automatically

**Method 2: Drag and Drop**
1. Open your browser
2. Drag `index.html` into the browser window
3. File loads immediately

**Method 3: Browser File Menu**
1. Open browser
2. File → Open File (or Ctrl+O / Cmd+O)
3. Select `index.html`
4. Click Open

### Understanding the Interface

**Visual Layout**:
```
┌────────────────────────────────────┐
│                                    │
│    😂 Voice Joke Webpage           │  ← Page Title
│                                    │
│  ┌──────────────────────────────┐ │
│  │                              │ │
│  │  Why did the chicken cross   │ │  ← Joke Display
│  │  the road?                   │ │     Area
│  │                              │ │
│  └──────────────────────────────┘ │
│                                    │
│  ┌──────┐ ┌────────┐ ┌─────────┐ │
│  │ Play │ │  Next  │ │ Replay  │ │  ← Control
│  │  🔊  │ │ Joke 👉│ │   ♻️   │ │     Buttons
│  └──────┘ └────────┘ └─────────┘ │
│                                    │
└────────────────────────────────────┘
```

### Core Actions

#### 1. Playing a Joke

**Steps**:
1. Wait for a joke to load (happens automatically)
2. Click the "Play 🔊" button
3. Listen as the joke is read aloud

**What Happens**:
- Text-to-speech engine activates
- Joke is spoken in a cheerful voice
- Any previous speech is stopped first

**Audio Settings**:
- **Speed**: 1.05× normal (slightly faster)
- **Pitch**: 1.1× normal (slightly higher)
- **Language**: English (US)

**Example**:
```
User sees: "Why don't scientists trust atoms? Because they make up everything!"
User clicks: "Play 🔊"
User hears: Joke spoken aloud with slight acceleration and higher pitch
```

#### 2. Getting a New Joke

**Steps**:
1. Click "Next Joke 👉" button
2. See "Loading joke..." message
3. New joke appears automatically
4. Previous joke is replaced

**What Happens**:
- API request sent to JokeAPI
- Loading state displayed
- New joke fetched and shown
- Current joke updated

**Example**:
```
Current joke: "What do you call a bear with no teeth?"
User clicks: "Next Joke 👉"
Loading message: "Loading joke..."
New joke appears: "Why did the scarecrow win an award?"
```

#### 3. Replaying a Joke

**Steps**:
1. Click "Replay ♻️" button
2. Same joke is read aloud again
3. Can replay unlimited times

**What Happens**:
- Identical to "Play" functionality
- Stops any currently playing speech
- Restarts the current joke

**Example**:
```
User hears: First playthrough of joke
User clicks: "Replay ♻️"
User hears: Same joke again from the beginning
```

---

## Feature Walkthrough

### Feature 1: Automatic Joke Loading

**Description**: The application automatically fetches and displays a joke when the page loads.

**User Experience**:
1. Page opens
2. Brief "Loading joke..." message
3. Joke appears within 1-2 seconds
4. Ready for interaction

**Behind the Scenes**:
```javascript
window.onload = () => {
  fetchJoke(); // Automatically called
};
```

**Benefit**: Immediate content without user action required.

**Troubleshooting**:
- If stuck on "Loading joke...", check internet connection
- Try refreshing the page (F5 or Ctrl+R)
- Check browser console for errors (F12)

---

### Feature 2: Text-to-Speech Playback

**Description**: Jokes are read aloud using the Web Speech Synthesis API.

**Requirements**:
- Modern browser with Speech Synthesis support
- Audio output (speakers/headphones)
- No mute on system/browser

**Voice Characteristics**:
| Setting | Value | Effect |
|---------|-------|--------|
| Rate | 1.05 | 5% faster than normal |
| Pitch | 1.1 | 10% higher than normal |
| Language | en-US | American English |

**User Experience**:

**First Time**:
1. Click "Play 🔊"
2. Browser may request permission (first time)
3. Audio begins after permission granted

**Subsequent Times**:
1. Click "Play 🔊" or "Replay ♻️"
2. Audio starts immediately
3. Previous audio stops if playing

**Controls**:
- **Start**: Click "Play 🔊"
- **Stop**: Click "Play 🔊" or "Replay ♻️" again (cancels previous)
- **Replay**: Click "Replay ♻️"

**Example Session**:
```
Action: Click "Play 🔊"
Result: "Why don't scientists trust atoms?... Because they make up everything!"

Action: Click "Play 🔊" again (while playing)
Result: Speech restarts from beginning

Action: Click "Next Joke 👉"
Result: New joke loads, speech stops

Action: Click "Replay ♻️"
Result: New joke is spoken
```

---

### Feature 3: Random Joke Fetching

**Description**: Get endless random jokes from various categories.

**Categories Available**:
- Programming jokes
- Miscellaneous jokes
- Puns
- Spooky jokes
- Christmas jokes
- General humor

**Joke Types**:

**Single-Line Jokes**:
```
"Why do programmers prefer dark mode? Because light attracts bugs!"
```

**Two-Part Jokes** (Setup + Punchline):
```
Setup: "What do you call a bear with no teeth?"
Delivery: "A gummy bear!"

Displayed as:
"What do you call a bear with no teeth?
A gummy bear!"
```

**Content Safety**:
- ✅ Safe-mode enabled by default
- ✅ Family-friendly content only
- ❌ No NSFW content
- ❌ No offensive material

**Rate Limits**:
- 120 jokes per minute maximum
- Approximately 1 joke every 0.5 seconds
- No authentication required

**User Experience**:
```
Step 1: User clicks "Next Joke 👉"
Step 2: UI shows "Loading joke..."
Step 3: API call completes (usually < 1 second)
Step 4: Joke displays
Step 5: Ready for next action
```

---

### Feature 4: Responsive Design

**Description**: Application adapts to any screen size.

**Desktop Experience** (> 500px):
- Large, readable text
- Spacious layout
- Horizontal button layout
- Generous padding

**Mobile Experience** (< 500px):
- Compact, optimized text
- Buttons adjust size
- Centered layout maintained
- Touch-friendly targets

**Screen Sizes Supported**:
| Device | Width | Experience |
|--------|-------|------------|
| Phone (Portrait) | 320px - 480px | Compact |
| Phone (Landscape) | 481px - 767px | Medium |
| Tablet | 768px - 1024px | Standard |
| Desktop | 1025px+ | Full |

**Example: iPhone SE (375px)**:
```
Before (Desktop):
- Joke text: 1.5em
- Padding: 2em
- Button text: 1.1em

After (Mobile):
- Joke text: 1em ← Reduced
- Padding: 1em ← Reduced
- Button text: 0.95em ← Reduced
```

---

## Advanced Usage

### Keyboard Navigation

**Tab Navigation**:
```
Press Tab → Focus on "Play 🔊"
Press Tab → Focus on "Next Joke 👉"
Press Tab → Focus on "Replay ♻️"
Press Shift+Tab → Navigate backwards
```

**Activating Buttons**:
- **Enter**: Activate focused button
- **Space**: Activate focused button

**Example Flow**:
```
1. Tab to "Play 🔊" button (focus visible)
2. Press Enter → Joke plays
3. Tab to "Next Joke 👉" button
4. Press Enter → New joke loads
5. Tab to "Replay ♻️" button
6. Press Space → Joke replays
```

---

### Browser Console Interaction

**Access Console**:
- **Chrome/Edge**: F12 or Ctrl+Shift+J (Cmd+Option+J on Mac)
- **Firefox**: F12 or Ctrl+Shift+K (Cmd+Option+K on Mac)
- **Safari**: Cmd+Option+C (enable Developer menu first)

**Useful Console Commands**:

**Check Current Joke**:
```javascript
console.log(currentJoke);
// Output: "Why did the chicken cross the road?..."
```

**Manually Fetch Joke**:
```javascript
fetchJoke();
// Fetches and displays a new joke
```

**Manually Play Joke**:
```javascript
speakJoke(currentJoke);
// Plays current joke
```

**Play Custom Text**:
```javascript
speakJoke("Hello! This is a custom message.");
// Speaks any text you provide
```

**Display Custom Joke**:
```javascript
displayJoke("This is my custom joke!");
// Shows custom text in joke box
```

**Check Available Voices**:
```javascript
window.speechSynthesis.getVoices().forEach(voice => {
  console.log(`${voice.name} (${voice.lang})`);
});
// Lists all available TTS voices
```

**Stop Speech**:
```javascript
window.speechSynthesis.cancel();
// Stops any currently playing speech
```

**Advanced: Custom Voice Settings**:
```javascript
// Create custom utterance
const utter = new SpeechSynthesisUtterance(currentJoke);
utter.rate = 0.8;     // Slower
utter.pitch = 0.9;    // Lower pitch
utter.volume = 0.5;   // Quieter
utter.lang = 'en-GB'; // British English
window.speechSynthesis.speak(utter);
```

---

### Using Multiple Instances

**Multiple Tabs**:
- Open application in multiple tabs
- Each tab maintains independent state
- Jokes don't sync between tabs
- Each tab can play different jokes

**Example Use Case**:
```
Tab 1: Playing Joke A
Tab 2: Playing Joke B simultaneously
Result: Both jokes play at once (audio overlap)

Tip: Play jokes in sequence, not simultaneously
```

---

### Offline Usage

**What Works Offline**:
- ✅ Page layout and design
- ✅ HTML structure
- ✅ CSS styling
- ✅ JavaScript code

**What Doesn't Work Offline**:
- ❌ Fetching new jokes (requires API)
- ❌ Initial joke load (requires API)

**Offline Workaround**:
```javascript
// In browser console, set a joke manually
currentJoke = "Offline joke: Why did the developer go broke? Because they used up all their cache!";
displayJoke(currentJoke);
speakJoke(currentJoke);
```

**Offline Testing**:
1. Load page while online
2. Open DevTools (F12)
3. Network tab → Enable "Offline" mode
4. Try clicking "Next Joke 👉"
5. See error: "Oops! Failed to load a joke."

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: No Audio Playing

**Symptoms**:
- Clicking "Play 🔊" does nothing
- No sound output
- No error messages

**Solutions**:

**Solution A: Check Browser Support**
```javascript
// In console:
if (window.speechSynthesis) {
  console.log("✅ Speech synthesis supported");
} else {
  console.log("❌ Speech synthesis NOT supported");
}
```

**Solution B: Check System Volume**
- Ensure system volume is not muted
- Check browser tab is not muted (right-click tab)
- Ensure audio output device is connected

**Solution C: Reload Page**
```
Press F5 or Ctrl+R to reload
Speech synthesis may need reset
```

**Solution D: Try Different Browser**
- Chrome: ✅ Full support
- Edge: ✅ Full support
- Safari: ✅ Full support
- Firefox: ⚠️ Limited support

---

#### Issue 2: Jokes Not Loading

**Symptoms**:
- Stuck on "Loading joke..."
- Error: "Oops! Failed to load a joke."
- No new jokes appear

**Solutions**:

**Solution A: Check Internet Connection**
```bash
# Test connectivity
ping google.com

# Or visit the API directly:
# https://v2.jokeapi.dev/joke/Any
```

**Solution B: Check API Status**
Visit: https://jokeapi.dev/
Check if API is operational

**Solution C: Check Browser Console**
```
1. Open DevTools (F12)
2. Go to Console tab
3. Look for red error messages
4. Check Network tab for failed requests
```

**Solution D: Clear Browser Cache**
```
Chrome/Edge: Ctrl+Shift+Delete
Firefox: Ctrl+Shift+Delete
Safari: Cmd+Option+E

Select "Cached images and files"
Click "Clear data"
```

**Solution E: Disable Extensions**
```
Some ad blockers may block API requests

1. Disable extensions temporarily
2. Reload page
3. Try fetching joke again
```

---

#### Issue 3: Speech Cuts Off

**Symptoms**:
- Speech stops mid-sentence
- Joke not fully read
- Audio interrupted

**Solutions**:

**Solution A: Keep Page Active**
```
Don't switch tabs while speech is playing
Some browsers pause speech on inactive tabs
```

**Solution B: Reset Speech Engine**
```javascript
// In console:
window.speechSynthesis.cancel();
speakJoke(currentJoke);
```

**Solution C: Adjust Speech Rate**
```javascript
// In console, try slower speed:
const utter = new SpeechSynthesisUtterance(currentJoke);
utter.rate = 0.9; // Slower
window.speechSynthesis.speak(utter);
```

---

#### Issue 4: Layout Issues

**Symptoms**:
- Buttons not visible
- Joke box too small/large
- Text overlapping

**Solutions**:

**Solution A: Check Browser Zoom**
```
Reset zoom to 100%:
- Press Ctrl+0 (Windows/Linux)
- Press Cmd+0 (Mac)
```

**Solution B: Clear Browser Cache**
```
Hard reload:
- Ctrl+F5 (Windows/Linux)
- Cmd+Shift+R (Mac)
```

**Solution C: Check Browser Window Size**
```
Ensure window is at least 320px wide
Try maximizing browser window
```

**Solution D: Update Browser**
```
Ensure using latest browser version
Old browsers may have CSS issues
```

---

#### Issue 5: Mobile Issues

**Symptoms**:
- Buttons too small
- Text too large/small
- Layout broken on phone

**Solutions**:

**Solution A: Portrait vs Landscape**
```
Try rotating device
Portrait mode optimized for 320px-480px
Landscape mode uses tablet/desktop styles
```

**Solution B: Zoom Level**
```
Double-tap joke box to zoom
Pinch to zoom for text size
```

**Solution C: Browser Choice**
```
Try different mobile browser:
- Chrome Mobile ✅
- Safari Mobile ✅
- Firefox Mobile ✅
- Samsung Internet ✅
```

---

### Debug Mode

**Enable Debug Logging**:
```javascript
// Add to console:
const originalFetchJoke = fetchJoke;
fetchJoke = async function() {
  console.log("🔄 Fetching joke...");
  await originalFetchJoke();
  console.log("✅ Joke loaded:", currentJoke);
};

const originalSpeakJoke = speakJoke;
speakJoke = function(joke) {
  console.log("🔊 Speaking:", joke);
  originalSpeakJoke(joke);
};
```

**View All Events**:
```javascript
// Log all button clicks
document.getElementById('play').addEventListener('click', () => {
  console.log("▶️ Play clicked");
});
document.getElementById('next').addEventListener('click', () => {
  console.log("⏭️ Next clicked");
});
document.getElementById('replay').addEventListener('click', () => {
  console.log("🔁 Replay clicked");
});
```

---

## Tips and Tricks

### Productivity Tips

**Tip 1: Keyboard Shortcuts**
```
Tab → Navigate between buttons
Enter → Activate button
Space → Activate button
Ctrl+R → Reload page (new joke session)
F5 → Refresh page
```

**Tip 2: Browser Bookmarklet**
Create a bookmark with this JavaScript:
```javascript
javascript:(function(){speakJoke(currentJoke);})();
```
Click bookmark to replay joke instantly.

**Tip 3: Speech Speed Adjustment**
```javascript
// In console, set preferred speed:
localStorage.setItem('speechRate', '1.2');

// Then modify speakJoke to use it:
const rate = parseFloat(localStorage.getItem('speechRate')) || 1.05;
```

**Tip 4: Auto-Play Next Joke**
```javascript
// In console, auto-advance every 10 seconds:
setInterval(() => {
  fetchJoke();
  setTimeout(() => speakJoke(currentJoke), 1000);
}, 10000);
```

**Tip 5: Joke History**
```javascript
// Track joke history in console:
const jokeHistory = [];
const originalFetch = fetchJoke;
fetchJoke = async function() {
  await originalFetch();
  jokeHistory.push(currentJoke);
  console.log(`📚 Total jokes: ${jokeHistory.length}`);
};

// View history:
console.table(jokeHistory);
```

---

### Accessibility Tips

**Tip 1: Increase Text Size**
```
Browser zoom: Ctrl++ (Cmd++ on Mac)
Or adjust in browser settings
```

**Tip 2: High Contrast Mode**
```
Windows: Alt+Left Shift+Print Screen
Mac: System Preferences → Accessibility → Display
```

**Tip 3: Screen Reader**
```
Joke display has aria-live region
Screen reader announces new jokes automatically
```

**Tip 4: Keyboard-Only Navigation**
```
Fully keyboard accessible
No mouse required
Tab through all controls
```

**Tip 5: Reduce Motion**
```
Browser settings → Accessibility
Enable "Prefers reduced motion"
Disables button animations
```

---

### Performance Tips

**Tip 1: Preload Next Joke**
```javascript
// Fetch next joke while current plays:
let nextJokeData = null;

document.getElementById('play').addEventListener('click', async () => {
  speakJoke(currentJoke);
  // Preload next joke in background
  const resp = await fetch('https://v2.jokeapi.dev/joke/Any?type=single,twopart&safe-mode');
  nextJokeData = await resp.json();
});
```

**Tip 2: Offline Mode**
```javascript
// Cache jokes in localStorage:
const cache = JSON.parse(localStorage.getItem('jokeCache') || '[]');

// Use cached jokes when offline
if (!navigator.onLine && cache.length > 0) {
  const randomJoke = cache[Math.floor(Math.random() * cache.length)];
  displayJoke(randomJoke);
}
```

**Tip 3: Reduce API Calls**
```javascript
// Debounce rapid clicks:
let lastFetch = 0;
document.getElementById('next').addEventListener('click', () => {
  const now = Date.now();
  if (now - lastFetch < 1000) return; // 1 second cooldown
  lastFetch = now;
  fetchJoke();
});
```

---

## Use Cases

### Use Case 1: Entertainment

**Scenario**: Taking a break from work

**Steps**:
1. Open application during break
2. Let first joke load
3. Click "Play 🔊" to listen
4. Laugh and relax
5. Click "Next Joke 👉" for more
6. Repeat as needed

**Benefits**:
- Quick stress relief
- No setup required
- Hands-free listening
- Endless content

---

### Use Case 2: Language Learning

**Scenario**: Practicing English pronunciation

**Steps**:
1. Load a joke
2. Read joke silently first
3. Click "Play 🔊" to hear pronunciation
4. Repeat aloud yourself
5. Click "Replay ♻️" to compare
6. Move to next joke

**Benefits**:
- Natural speech patterns
- Conversational English
- Humor vocabulary
- Pronunciation practice

---

### Use Case 3: Accessibility

**Scenario**: Visually impaired user

**Setup**:
```
Enable screen reader (NVDA, JAWS, VoiceOver)
Use keyboard navigation only
```

**Steps**:
1. Page loads with screen reader active
2. Screen reader announces: "Voice Joke Webpage, heading level 1"
3. Tab to joke display (announced automatically)
4. Tab to "Play" button
5. Press Enter to play
6. Listen to joke via TTS
7. Tab to "Next Joke" button
8. Press Enter for new joke

**Benefits**:
- Fully keyboard accessible
- Screen reader compatible
- Audio output included
- Semantic HTML structure

---

### Use Case 4: Kids' Entertainment

**Scenario**: Parent showing jokes to children

**Setup**:
- Enable safe-mode (already default)
- Larger text may help (browser zoom)

**Steps**:
1. Open application
2. Sit with child near device
3. Read joke together
4. Click "Play 🔊" for audio version
5. Child can click "Next Joke 👉"
6. Supervised joke browsing

**Benefits**:
- Family-friendly content
- Educational (reading practice)
- Interactive
- No inappropriate content

---

### Use Case 5: Public Display

**Scenario**: Displaying on office monitor or public screen

**Setup**:
```
1. Open in fullscreen mode (F11)
2. Set browser zoom to 150-200%
3. Optional: Connect to speakers
```

**Steps**:
1. Load page and maximize window
2. Jokes display automatically
3. Set auto-advance (via console):
```javascript
setInterval(() => {
  fetchJoke();
  setTimeout(() => speakJoke(currentJoke), 2000);
}, 15000); // New joke every 15 seconds
```

**Benefits**:
- Continuous entertainment
- No user interaction needed
- Visible from distance
- Automatic content refresh

---

## Integration Examples

### Embedding in Another Website

**iFrame Method**:
```html
<!-- In your website HTML: -->
<iframe 
  src="./index.html" 
  width="600" 
  height="400"
  frameborder="0"
  title="Voice Joke Widget"
></iframe>
```

**CSS Styling**:
```css
iframe {
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}
```

---

### API Integration

**Fetch Single Joke**:
```javascript
async function getJoke() {
  const response = await fetch('https://v2.jokeapi.dev/joke/Any?type=single,twopart&safe-mode');
  const data = await response.json();
  
  if (data.type === 'single') {
    return data.joke;
  } else {
    return `${data.setup}\n${data.delivery}`;
  }
}

// Usage:
const myJoke = await getJoke();
console.log(myJoke);
```

**Fetch Multiple Jokes**:
```javascript
async function getMultipleJokes(count) {
  const response = await fetch(`https://v2.jokeapi.dev/joke/Any?amount=${count}&type=single,twopart&safe-mode`);
  const data = await response.json();
  return data.jokes;
}

// Usage:
const jokes = await getMultipleJokes(5);
jokes.forEach(joke => {
  console.log(joke.joke || `${joke.setup}\n${joke.delivery}`);
});
```

**Category-Specific Jokes**:
```javascript
async function getProgrammingJoke() {
  const response = await fetch('https://v2.jokeapi.dev/joke/Programming?safe-mode');
  const data = await response.json();
  return data.joke || `${data.setup}\n${data.delivery}`;
}
```

---

### Extending Functionality

**Add Favorite Button**:
```html
<!-- Add to HTML: -->
<button id="favorite">Favorite ⭐</button>
```

```javascript
// Add to JavaScript:
const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

document.getElementById('favorite').onclick = () => {
  if (!favorites.includes(currentJoke)) {
    favorites.push(currentJoke);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    alert('Joke added to favorites! ⭐');
  } else {
    alert('Already in favorites!');
  }
};

// View favorites:
console.log('Favorite jokes:', favorites);
```

**Add Share Button**:
```html
<button id="share">Share 📤</button>
```

```javascript
document.getElementById('share').onclick = () => {
  if (navigator.share) {
    navigator.share({
      title: 'Funny Joke',
      text: currentJoke,
      url: window.location.href
    });
  } else {
    // Fallback: Copy to clipboard
    navigator.clipboard.writeText(currentJoke);
    alert('Joke copied to clipboard!');
  }
};
```

**Add Dark Mode Toggle**:
```html
<button id="darkmode">🌙 Dark Mode</button>
```

```css
body.dark {
  background: #2d3436;
  color: #dfe6e9;
}

.dark .joke {
  background: #34495e;
  color: #ecf0f1;
}

.dark button {
  background: #3498db;
  color: #fff;
}
```

```javascript
document.getElementById('darkmode').onclick = () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('darkMode', isDark);
};

// Load preference:
if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark');
}
```

---

## Customization Examples

### Theme Customization

**Blue Ocean Theme**:
```css
/* Add to style tag: */
body {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.joke {
  background: rgba(255, 255, 255, 0.95);
  color: #333;
}

button {
  background: #4facfe;
  color: #fff;
}

button:hover {
  background: #00f2fe;
}
```

**Nature Green Theme**:
```css
body {
  background: linear-gradient(to bottom, #96e6a1 0%, #d4fc79 100%);
}

.joke {
  background: #fff;
  border: 3px solid #52c41a;
}

button {
  background: #52c41a;
  color: #fff;
}

button:hover {
  background: #389e0d;
}
```

**Sunset Orange Theme**:
```css
body {
  background: linear-gradient(to bottom right, #fa709a 0%, #fee140 100%);
}

.joke {
  background: rgba(255, 255, 255, 0.9);
  color: #333;
}

button {
  background: #ff6348;
  color: #fff;
}

button:hover {
  background: #ff4757;
}
```

---

### Voice Customization

**Different Voices**:
```javascript
// List available voices:
const voices = window.speechSynthesis.getVoices();
voices.forEach((voice, index) => {
  console.log(`${index}: ${voice.name} (${voice.lang})`);
});

// Use specific voice:
function speakWithVoice(joke, voiceIndex) {
  const voices = window.speechSynthesis.getVoices();
  const utter = new SpeechSynthesisUtterance(joke);
  utter.voice = voices[voiceIndex];
  utter.rate = 1.05;
  utter.pitch = 1.1;
  window.speechSynthesis.speak(utter);
}

// Example: Use voice #3
speakWithVoice(currentJoke, 3);
```

**British English Voice**:
```javascript
function speakBritish(joke) {
  const voices = window.speechSynthesis.getVoices();
  const britishVoice = voices.find(v => v.lang === 'en-GB');
  
  const utter = new SpeechSynthesisUtterance(joke);
  if (britishVoice) utter.voice = britishVoice;
  utter.lang = 'en-GB';
  utter.rate = 1.0;
  utter.pitch = 1.0;
  
  window.speechSynthesis.speak(utter);
}
```

**Slow and Clear (Accessibility)**:
```javascript
function speakSlow(joke) {
  const utter = new SpeechSynthesisUtterance(joke);
  utter.rate = 0.75;  // 25% slower
  utter.pitch = 1.0;   // Normal pitch
  utter.volume = 1.0;  // Full volume
  window.speechSynthesis.speak(utter);
}
```

---

## Developer Guide

### Adding New Features

**Example: Add Category Filter**

**Step 1: Add UI**:
```html
<select id="category">
  <option value="Any">Any Category</option>
  <option value="Programming">Programming</option>
  <option value="Misc">Miscellaneous</option>
  <option value="Pun">Puns</option>
</select>
```

**Step 2: Update fetchJoke**:
```javascript
async function fetchJoke() {
  const category = document.getElementById('category').value;
  displayJoke('Loading joke...');
  
  try {
    const resp = await fetch(`https://v2.jokeapi.dev/joke/${category}?type=single,twopart&safe-mode`);
    const data = await resp.json();
    
    let joke = '';
    if (data.type === 'single') {
      joke = data.joke;
    } else if (data.type === 'twopart') {
      joke = data.setup + '\n' + data.delivery;
    }
    
    currentJoke = joke;
    displayJoke(joke);
  } catch (e) {
    currentJoke = "Oops! Failed to load a joke.";
    displayJoke(currentJoke);
  }
}
```

**Step 3: Add Event Listener**:
```javascript
document.getElementById('category').onchange = () => {
  fetchJoke();
};
```

---

### Testing

**Manual Testing Checklist**:
```
☐ Page loads correctly
☐ Initial joke loads automatically
☐ "Play" button speaks joke
☐ "Next Joke" fetches new joke
☐ "Replay" button replays joke
☐ Loading state displays
☐ Error handling works (test offline)
☐ Responsive on mobile
☐ Keyboard navigation works
☐ Speech synthesis works
```

**Browser Testing**:
```
☐ Chrome (latest)
☐ Firefox (latest)
☐ Safari (latest)
☐ Edge (latest)
☐ Mobile Chrome
☐ Mobile Safari
```

**Automated Testing Example** (Jest):
```javascript
describe('Voice Joke Webpage', () => {
  test('fetchJoke updates currentJoke', async () => {
    await fetchJoke();
    expect(currentJoke).not.toBe('');
    expect(currentJoke).not.toBe('Loading joke...');
  });
  
  test('displayJoke updates DOM', () => {
    document.body.innerHTML = '<div id="joke"></div>';
    displayJoke('Test joke');
    expect(document.getElementById('joke').textContent).toBe('Test joke');
  });
});
```

---

### Deployment

**Static Hosting Options**:

**GitHub Pages**:
```bash
# 1. Create repository
# 2. Push code
# 3. Go to Settings → Pages
# 4. Select main branch
# 5. Site live at: https://username.github.io/repo-name
```

**Netlify**:
```bash
# 1. Drag and drop folder to netlify.com
# 2. Site deployed instantly
# 3. Get custom URL
```

**Vercel**:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts
```

**Simple HTTP Server**:
```bash
# For local testing
python -m http.server 8000
```

---

## Best Practices

### Do's ✅

- ✅ Keep browser updated
- ✅ Use keyboard navigation when available
- ✅ Wait for jokes to fully load
- ✅ Check console for errors
- ✅ Use on devices with speakers
- ✅ Report bugs and issues

### Don'ts ❌

- ❌ Spam "Next Joke" button rapidly
- ❌ Play multiple jokes simultaneously
- ❌ Expect offline functionality
- ❌ Use on browsers without JS
- ❌ Block API requests
- ❌ Expect instant loading every time

---

## FAQ

**Q: How do I change the voice?**
A: Use browser console to set different voice from available voices.

**Q: Can I use this offline?**
A: No, jokes require internet connection to fetch from API.

**Q: Is this safe for kids?**
A: Yes, safe-mode is enabled by default, filtering inappropriate content.

**Q: How many jokes are available?**
A: Thousands of jokes across multiple categories from JokeAPI.

**Q: Can I save favorite jokes?**
A: Not built-in, but you can add this feature using localStorage.

**Q: Why is speech not working?**
A: Check browser compatibility and ensure audio output is enabled.

**Q: Can I customize the appearance?**
A: Yes, modify the CSS in the `<style>` section.

**Q: Is this free to use?**
A: Yes, completely free with no authentication required.

---

## Resources

- **JokeAPI Documentation**: https://jokeapi.dev/
- **Web Speech API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- **Fetch API**: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- **Project Repository**: (Your repo URL here)
- **Issue Tracker**: (Your issues URL here)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-25 | Initial release |

---

## Support

For help, questions, or feedback:
- Open an issue on GitHub
- Check documentation files
- Review browser console for errors

---

**Last Updated**: December 25, 2025

**Happy Laughing! 😂**
