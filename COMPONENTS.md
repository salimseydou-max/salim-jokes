# Component Documentation

This document provides comprehensive documentation for all UI components, HTML structure, and styling in the Voice Joke Webpage application.

## Table of Contents

- [HTML Structure](#html-structure)
- [UI Components](#ui-components)
  - [Container Component](#container-component)
  - [Heading Component](#heading-component)
  - [Joke Display Component](#joke-display-component)
  - [Button Group Component](#button-group-component)
  - [Individual Buttons](#individual-buttons)
- [CSS Styling](#css-styling)
  - [Global Styles](#global-styles)
  - [Layout Styles](#layout-styles)
  - [Component Styles](#component-styles)
  - [Responsive Design](#responsive-design)
- [Accessibility](#accessibility)
- [Browser Compatibility](#browser-compatibility)
- [Customization Guide](#customization-guide)

---

## HTML Structure

### Document Structure Overview

```
<!DOCTYPE html>
<html lang="en">
├── <head>
│   ├── Meta tags (charset, viewport)
│   ├── <title>
│   └── <style> (inline CSS)
└── <body>
    └── <div class="centered">
        ├── <h1> (Page title)
        ├── <div id="joke" class="joke"> (Joke display)
        └── <div class="buttons">
            ├── <button id="play"> (Play button)
            ├── <button id="next"> (Next joke button)
            └── <button id="replay"> (Replay button)
    └── <script> (inline JavaScript)
```

### Complete HTML Markup

```1:119:index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Voice Joke Webpage</title>
  <style>
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      font-family: 'Comic Sans MS', 'Comic Sans', cursive, sans-serif;
      background: #ffeaa7;
      color: #222;
    }
    .centered {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .joke {
      background: #fffde7;
      border-radius: 20px;
      padding: 2em 2em;
      font-size: 1.5em;
      margin: 1.5em 0;
      min-width: 320px;
      min-height: 80px;
      text-align: center;
      box-shadow: 0 6px 24px rgba(0,0,0,0.1);
      max-width: 90vw;
    }
    .buttons {
      display: flex;
      gap: 1em;
      margin-top: 1em;
    }
    button {
      background: #f6e58d;
      border: none;
      border-radius: 30px;
      padding: 0.8em 2em;
      font-size: 1.1em;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.07);
      transition: background 0.2s, transform 0.1s;
    }
    button:hover {
      background: #ffbe76;
      transform: scale(1.06);
    }
    @media (max-width: 500px) {
      .joke { font-size: 1em; min-width: 150px; padding: 1em; }
      button { font-size: 0.95em; padding: 0.6em 1.2em; }
    }
  </style>
</head>
<body>
  <div class="centered">
    <h1>😂 Voice Joke Webpage</h1>
    <div id="joke" class="joke">Loading joke...</div>
    <div class="buttons">
      <button id="play">Play 🔊</button>
      <button id="next">Next Joke 👉</button>
      <button id="replay">Replay ♻️</button>
    </div>
  </div>
  <script>
    let currentJoke = '';

    function displayJoke(joke) {
      document.getElementById('joke').textContent = joke;
    }

    function speakJoke(joke) {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utter = new window.SpeechSynthesisUtterance(joke);
      utter.rate = 1.05;
      utter.pitch = 1.1;
      utter.lang = 'en-US';
      window.speechSynthesis.speak(utter);
    }

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

    document.getElementById('play').onclick = () => speakJoke(currentJoke);
    document.getElementById('replay').onclick = () => speakJoke(currentJoke);
    document.getElementById('next').onclick = () => fetchJoke();

    // On page load, load the first joke
    window.onload = () => {
      fetchJoke();
    };
  </script>
</body>
</html>
```

---

## UI Components

### Container Component

**Element**: `<div class="centered">`

**Purpose**: Main container that centers all content vertically and horizontally on the page.

**Properties**:
- **Display**: Flexbox container
- **Direction**: Column (vertical stacking)
- **Alignment**: Centered both horizontally and vertically
- **Min Height**: 100vh (full viewport height)

**HTML**:
```html
<div class="centered">
  <!-- All content goes here -->
</div>
```

**CSS**:
```css
.centered {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
```

**Behavior**:
- Remains centered regardless of content size
- Expands to fill viewport height
- Maintains vertical centering on scroll
- Responsive to viewport changes

**Usage Example**:
```html
<!-- Basic usage -->
<div class="centered">
  <h1>Title</h1>
  <div>Content</div>
</div>

<!-- With additional elements -->
<div class="centered">
  <header>Header</header>
  <main>Main content</main>
  <footer>Footer</footer>
</div>
```

---

### Heading Component

**Element**: `<h1>`

**Purpose**: Displays the main page title with an emoji.

**HTML**:
```html
<h1>😂 Voice Joke Webpage</h1>
```

**Properties**:
- **Text**: "😂 Voice Joke Webpage"
- **Emoji**: 😂 (Face with Tears of Joy)
- **Font**: Inherited from body (Comic Sans MS)
- **Color**: Inherited from body (#222)

**Styling**:
- Default h1 browser styles apply
- No custom CSS defined for h1
- Inherits font-family from body
- Inherits color from body

**Customization Example**:
```css
h1 {
  font-size: 2.5em;
  margin-bottom: 0.5em;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
  font-weight: bold;
}
```

**Accessibility**:
- Semantic HTML heading
- Screen reader friendly
- Proper heading hierarchy
- Emoji included in text alternative

---

### Joke Display Component

**Element**: `<div id="joke" class="joke">`

**Purpose**: Container that displays the current joke text.

**HTML**:
```html
<div id="joke" class="joke">Loading joke...</div>
```

**Properties**:
| Property | Value | Description |
|----------|-------|-------------|
| `id` | `joke` | Unique identifier for JavaScript access |
| `class` | `joke` | CSS class for styling |
| Initial Text | "Loading joke..." | Placeholder shown on load |

**CSS**:
```css
.joke {
  background: #fffde7;          /* Light yellow background */
  border-radius: 20px;          /* Rounded corners */
  padding: 2em 2em;             /* Internal spacing */
  font-size: 1.5em;             /* Larger text */
  margin: 1.5em 0;              /* Vertical spacing */
  min-width: 320px;             /* Minimum width */
  min-height: 80px;             /* Minimum height */
  text-align: center;           /* Center text */
  box-shadow: 0 6px 24px rgba(0,0,0,0.1);  /* Subtle shadow */
  max-width: 90vw;              /* Max 90% of viewport width */
}
```

**States**:

**Loading State**:
```html
<div id="joke" class="joke">Loading joke...</div>
```

**Displaying Joke**:
```html
<div id="joke" class="joke">Why did the chicken cross the road?</div>
```

**Error State**:
```html
<div id="joke" class="joke">Oops! Failed to load a joke.</div>
```

**Responsive Behavior**:
```css
/* Mobile devices (< 500px) */
@media (max-width: 500px) {
  .joke {
    font-size: 1em;      /* Smaller text */
    min-width: 150px;    /* Smaller minimum width */
    padding: 1em;        /* Less padding */
  }
}
```

**JavaScript Integration**:
```javascript
// Get reference
const jokeElement = document.getElementById('joke');

// Update content
jokeElement.textContent = "New joke here";

// Read content
const currentText = jokeElement.textContent;
```

**Customization Examples**:

**Dark Mode**:
```css
.joke.dark-mode {
  background: #2d3436;
  color: #ffffff;
  box-shadow: 0 6px 24px rgba(255,255,255,0.1);
}
```

**Animation on Update**:
```css
.joke {
  transition: opacity 0.3s ease;
}

.joke.updating {
  opacity: 0.5;
}
```

**Larger Text Option**:
```css
.joke.large-text {
  font-size: 2em;
}
```

---

### Button Group Component

**Element**: `<div class="buttons">`

**Purpose**: Container for all action buttons, arranged in a horizontal row.

**HTML**:
```html
<div class="buttons">
  <button id="play">Play 🔊</button>
  <button id="next">Next Joke 👉</button>
  <button id="replay">Replay ♻️</button>
</div>
```

**CSS**:
```css
.buttons {
  display: flex;           /* Flexbox layout */
  gap: 1em;               /* Space between buttons */
  margin-top: 1em;        /* Space above button group */
}
```

**Properties**:
- **Display**: Flexbox (horizontal by default)
- **Gap**: 1em between buttons
- **Margin**: 1em top spacing
- **Alignment**: Inherit from parent (centered)

**Responsive Behavior**:
```css
/* Mobile: Stack buttons vertically */
@media (max-width: 500px) {
  .buttons {
    flex-direction: column;
    width: 100%;
  }
}
```

**Alternative Layouts**:

**Vertical Stack**:
```css
.buttons {
  flex-direction: column;
  gap: 0.5em;
}
```

**Justified Spacing**:
```css
.buttons {
  justify-content: space-between;
  width: 100%;
  max-width: 600px;
}
```

**Wrapped Layout**:
```css
.buttons {
  flex-wrap: wrap;
  justify-content: center;
}
```

---

### Individual Buttons

**Element**: `<button>`

**Purpose**: Interactive buttons for controlling joke playback and navigation.

**Base CSS**:
```css
button {
  background: #f6e58d;                        /* Light yellow */
  border: none;                               /* No border */
  border-radius: 30px;                        /* Pill shape */
  padding: 0.8em 2em;                        /* Internal spacing */
  font-size: 1.1em;                          /* Larger text */
  cursor: pointer;                           /* Hand cursor */
  box-shadow: 0 4px 16px rgba(0,0,0,0.07);  /* Subtle shadow */
  transition: background 0.2s, transform 0.1s; /* Smooth animations */
}

button:hover {
  background: #ffbe76;    /* Orange on hover */
  transform: scale(1.06); /* Slight grow effect */
}
```

---

#### Play Button

**HTML**:
```html
<button id="play">Play 🔊</button>
```

**Properties**:
| Property | Value | Description |
|----------|-------|-------------|
| `id` | `play` | Unique identifier |
| Text | "Play 🔊" | Button label with speaker emoji |
| Action | `speakJoke(currentJoke)` | Plays current joke audio |

**Usage**:
```javascript
// Attach handler
document.getElementById('play').onclick = () => speakJoke(currentJoke);

// Programmatic click
document.getElementById('play').click();

// Custom handler
document.getElementById('play').addEventListener('click', function() {
  console.log("Play button clicked");
  speakJoke(currentJoke);
});
```

**States**:
- **Default**: Ready to play
- **Hover**: Orange background with slight scale
- **Active** (clicked): Browser default active state
- **Disabled**: Can be set via JavaScript

**Accessibility**:
```html
<!-- Enhanced accessibility -->
<button 
  id="play" 
  aria-label="Play joke using text-to-speech"
  title="Play current joke"
>
  Play 🔊
</button>
```

---

#### Next Joke Button

**HTML**:
```html
<button id="next">Next Joke 👉</button>
```

**Properties**:
| Property | Value | Description |
|----------|-------|-------------|
| `id` | `next` | Unique identifier |
| Text | "Next Joke 👉" | Button label with pointing emoji |
| Action | `fetchJoke()` | Fetches new joke from API |

**Usage**:
```javascript
// Attach handler
document.getElementById('next').onclick = () => fetchJoke();

// With loading state
document.getElementById('next').onclick = async () => {
  const btn = document.getElementById('next');
  btn.disabled = true;
  btn.textContent = "Loading...";
  
  await fetchJoke();
  
  btn.disabled = false;
  btn.textContent = "Next Joke 👉";
};
```

**States**:
- **Default**: Ready to fetch
- **Loading**: Disabled during API call (can be implemented)
- **Hover**: Orange background with slight scale
- **Error**: Can show error state (can be implemented)

**Accessibility**:
```html
<!-- Enhanced accessibility -->
<button 
  id="next" 
  aria-label="Fetch next random joke"
  title="Get a new joke"
>
  Next Joke 👉
</button>
```

---

#### Replay Button

**HTML**:
```html
<button id="replay">Replay ♻️</button>
```

**Properties**:
| Property | Value | Description |
|----------|-------|-------------|
| `id` | `replay` | Unique identifier |
| Text | "Replay ♻️" | Button label with recycle emoji |
| Action | `speakJoke(currentJoke)` | Replays current joke audio |

**Usage**:
```javascript
// Attach handler
document.getElementById('replay').onclick = () => speakJoke(currentJoke);

// Track replay count
let replayCount = 0;
document.getElementById('replay').onclick = () => {
  replayCount++;
  console.log(`Replayed ${replayCount} times`);
  speakJoke(currentJoke);
};
```

**Note**: Functionally identical to Play button but provides semantic clarity.

**Accessibility**:
```html
<!-- Enhanced accessibility -->
<button 
  id="replay" 
  aria-label="Replay current joke"
  title="Listen to the joke again"
>
  Replay ♻️
</button>
```

---

### Button Responsive Design

**Mobile Styles** (< 500px):
```css
@media (max-width: 500px) {
  button {
    font-size: 0.95em;      /* Slightly smaller text */
    padding: 0.6em 1.2em;   /* Less padding */
  }
}
```

**Additional Responsive Patterns**:

**Small Screens** (< 400px):
```css
@media (max-width: 400px) {
  button {
    width: 100%;           /* Full width */
    margin-bottom: 0.5em;  /* Vertical spacing */
  }
  
  .buttons {
    flex-direction: column;
    width: 90%;
  }
}
```

**Large Screens** (> 1200px):
```css
@media (min-width: 1200px) {
  button {
    font-size: 1.2em;
    padding: 1em 2.5em;
  }
}
```

---

## CSS Styling

### Global Styles

**HTML and Body**:
```css
html, body {
  height: 100%;           /* Full viewport height */
  margin: 0;             /* Remove default margins */
  padding: 0;            /* Remove default padding */
  font-family: 'Comic Sans MS', 'Comic Sans', cursive, sans-serif;
  background: #ffeaa7;   /* Light yellow background */
  color: #222;           /* Dark gray text */
}
```

**Properties Explained**:

| Property | Value | Purpose |
|----------|-------|---------|
| `height: 100%` | Full height | Ensures body fills viewport |
| `margin: 0` | No margin | Removes browser defaults |
| `padding: 0` | No padding | Removes browser defaults |
| `font-family` | Comic Sans MS | Fun, casual font |
| `background` | #ffeaa7 | Cheerful yellow background |
| `color` | #222 | Readable dark text |

**Font Stack**:
```css
font-family: 'Comic Sans MS', 'Comic Sans', cursive, sans-serif;
```
1. **'Comic Sans MS'** - Primary font (Windows)
2. **'Comic Sans'** - Fallback (Mac/Linux)
3. **cursive** - Generic cursive font
4. **sans-serif** - Final fallback

**Color Palette**:

| Color | Hex | Usage |
|-------|-----|-------|
| Page Background | #ffeaa7 | Light yellow |
| Text | #222 | Dark gray |
| Joke Box | #fffde7 | Lighter yellow |
| Button | #f6e58d | Yellow |
| Button Hover | #ffbe76 | Orange |

---

### Layout Styles

**Centered Container**:
```css
.centered {
  display: flex;              /* Enable flexbox */
  flex-direction: column;     /* Vertical stacking */
  justify-content: center;    /* Vertical centering */
  align-items: center;        /* Horizontal centering */
  min-height: 100vh;          /* Full viewport height */
}
```

**Flexbox Explanation**:
- `display: flex` - Enables flexbox layout
- `flex-direction: column` - Stack children vertically
- `justify-content: center` - Center along main axis (vertical)
- `align-items: center` - Center along cross axis (horizontal)
- `min-height: 100vh` - Minimum full viewport height

**Visual Diagram**:
```
┌─────────────────────────────────────┐
│         (Viewport Height)           │
│                                     │
│          ┌─────────────┐            │
│          │   Heading   │            │
│          └─────────────┘            │
│                                     │ ← Centered
│          ┌─────────────┐            │   Vertically
│          │  Joke Box   │            │
│          └─────────────┘            │
│                                     │
│          ┌─────────────┐            │
│          │   Buttons   │            │
│          └─────────────┘            │
│                                     │
└─────────────────────────────────────┘
       ↑                       ↑
   Centered Horizontally
```

---

### Component Styles

#### Joke Box Styling

**Complete Breakdown**:
```css
.joke {
  /* Background and Shape */
  background: #fffde7;        /* Light yellow */
  border-radius: 20px;        /* Rounded corners */
  
  /* Spacing */
  padding: 2em 2em;           /* Internal: 2em top/bottom, 2em left/right */
  margin: 1.5em 0;            /* External: 1.5em top/bottom, 0 left/right */
  
  /* Size Constraints */
  min-width: 320px;           /* Minimum width */
  min-height: 80px;           /* Minimum height */
  max-width: 90vw;            /* Maximum 90% of viewport width */
  
  /* Typography */
  font-size: 1.5em;           /* 1.5x base size */
  text-align: center;         /* Center text */
  
  /* Visual Effects */
  box-shadow: 0 6px 24px rgba(0,0,0,0.1);  /* Subtle shadow */
}
```

**Box Shadow Breakdown**:
```css
box-shadow: 0 6px 24px rgba(0,0,0,0.1);
            │  │   │    └─ 10% opacity black
            │  │   └────── 24px blur radius
            │  └────────── 6px vertical offset
            └───────────── 0px horizontal offset
```

**Visual Effect**:
- Creates a subtle floating effect
- Shadow below the box (6px down)
- Blurred edge (24px blur)
- Semi-transparent (10% opacity)

---

#### Button Styling

**Complete Breakdown**:
```css
button {
  /* Background and Border */
  background: #f6e58d;          /* Light yellow */
  border: none;                 /* Remove default border */
  border-radius: 30px;          /* Pill-shaped (rounded ends) */
  
  /* Spacing */
  padding: 0.8em 2em;          /* 0.8em top/bottom, 2em left/right */
  
  /* Typography */
  font-size: 1.1em;            /* 1.1x base size */
  
  /* Interaction */
  cursor: pointer;             /* Hand cursor on hover */
  
  /* Visual Effects */
  box-shadow: 0 4px 16px rgba(0,0,0,0.07);  /* Subtle shadow */
  transition: background 0.2s, transform 0.1s;  /* Smooth animations */
}
```

**Hover State**:
```css
button:hover {
  background: #ffbe76;         /* Change to orange */
  transform: scale(1.06);      /* Grow by 6% */
}
```

**Transition Breakdown**:
```css
transition: background 0.2s, transform 0.1s;
            │          │     │         └─ 0.1 second duration
            │          │     └─────────── Transform property
            │          └─────────────────── 0.2 second duration
            └────────────────────────────── Background property
```

**Effect**:
- Background color change takes 0.2 seconds
- Size change (transform) takes 0.1 seconds
- Creates smooth, pleasant interaction

---

### Responsive Design

**Breakpoint Strategy**:

| Breakpoint | Max Width | Target Devices |
|------------|-----------|----------------|
| Mobile | 500px | Phones (portrait) |
| Tablet | 768px | Tablets (portrait) |
| Desktop | 1024px+ | Laptops, desktops |

**Mobile Styles** (< 500px):
```css
@media (max-width: 500px) {
  /* Joke box adjustments */
  .joke {
    font-size: 1em;        /* Smaller text */
    min-width: 150px;      /* Narrower minimum */
    padding: 1em;          /* Less padding */
  }
  
  /* Button adjustments */
  button {
    font-size: 0.95em;     /* Slightly smaller */
    padding: 0.6em 1.2em;  /* Less padding */
  }
}
```

**Responsive Testing Sizes**:
- **iPhone SE**: 375px × 667px
- **iPhone 12**: 390px × 844px
- **iPad**: 768px × 1024px
- **Desktop**: 1920px × 1080px

**Additional Responsive Patterns**:

**Extra Small Devices** (< 320px):
```css
@media (max-width: 320px) {
  .joke {
    min-width: 100%;
    font-size: 0.9em;
    padding: 0.8em;
  }
  
  button {
    font-size: 0.85em;
    padding: 0.5em 1em;
  }
}
```

**Large Screens** (> 1200px):
```css
@media (min-width: 1200px) {
  .joke {
    font-size: 1.8em;
    max-width: 800px;
    padding: 2.5em;
  }
  
  button {
    font-size: 1.3em;
    padding: 1em 2.5em;
  }
}
```

**Print Styles**:
```css
@media print {
  .buttons {
    display: none;  /* Hide buttons when printing */
  }
  
  .joke {
    border: 1px solid #000;
    box-shadow: none;
  }
}
```

---

## Accessibility

### Current Accessibility Features

✅ **Semantic HTML**:
- Proper heading hierarchy (`<h1>`)
- Semantic button elements (`<button>`)
- Proper document structure

✅ **Keyboard Navigation**:
- All buttons are keyboard accessible (Tab key)
- Native button focus states

✅ **Visual Clarity**:
- High contrast text (#222 on #ffeaa7)
- Large, readable font sizes
- Clear button affordances (cursor, hover states)

✅ **Language Attribute**:
```html
<html lang="en">
```

### Accessibility Improvements

**ARIA Labels**:
```html
<button 
  id="play" 
  aria-label="Play joke using text-to-speech"
>
  Play 🔊
</button>

<button 
  id="next" 
  aria-label="Fetch next random joke"
>
  Next Joke 👉
</button>

<button 
  id="replay" 
  aria-label="Replay current joke"
>
  Replay ♻️
</button>

<div 
  id="joke" 
  class="joke" 
  role="region" 
  aria-live="polite"
  aria-label="Joke display area"
>
  Loading joke...
</div>
```

**Focus Indicators**:
```css
button:focus {
  outline: 3px solid #0066ff;
  outline-offset: 2px;
}

button:focus:not(:focus-visible) {
  outline: none;
}

button:focus-visible {
  outline: 3px solid #0066ff;
  outline-offset: 2px;
}
```

**Skip Link** (for keyboard users):
```html
<a href="#joke" class="skip-link">Skip to joke</a>

<style>
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
</style>
```

**Reduced Motion Support**:
```css
@media (prefers-reduced-motion: reduce) {
  button {
    transition: none;
  }
  
  button:hover {
    transform: none;  /* Remove scale effect */
  }
}
```

**High Contrast Mode**:
```css
@media (prefers-contrast: high) {
  .joke {
    border: 2px solid #000;
  }
  
  button {
    border: 2px solid #000;
  }
}
```

**Screen Reader Announcements**:
```html
<div id="joke" class="joke" role="status" aria-live="polite" aria-atomic="true">
  Loading joke...
</div>
```

---

## Browser Compatibility

### CSS Feature Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Flexbox | 29+ | 28+ | 9+ | 12+ |
| Border Radius | 4+ | 4+ | 5+ | 12+ |
| Box Shadow | 10+ | 4+ | 5.1+ | 12+ |
| Transitions | 26+ | 16+ | 9+ | 12+ |
| Media Queries | 21+ | 3.5+ | 4+ | 12+ |
| transform | 36+ | 16+ | 9+ | 12+ |

### HTML5 Support

| Feature | Support |
|---------|---------|
| `<button>` | Universal |
| `<div>` | Universal |
| `lang` attribute | Universal |
| `viewport` meta | All modern browsers |

### Fallbacks

**Comic Sans MS Fallback**:
```css
font-family: 'Comic Sans MS', 'Comic Sans', cursive, sans-serif;
```
If Comic Sans is unavailable, falls back to system cursive font.

**No Flexbox Fallback**:
```css
/* For ancient browsers */
.centered {
  text-align: center;
  padding-top: 20vh;
}

.centered > * {
  display: inline-block;
  vertical-align: middle;
}
```

---

## Customization Guide

### Color Schemes

**Dark Mode**:
```css
/* Dark mode color scheme */
body.dark-mode {
  background: #2d3436;
  color: #dfe6e9;
}

.dark-mode .joke {
  background: #34495e;
  color: #ecf0f1;
  box-shadow: 0 6px 24px rgba(0,0,0,0.5);
}

.dark-mode button {
  background: #3498db;
  color: #fff;
}

.dark-mode button:hover {
  background: #2980b9;
}
```

**Blue Theme**:
```css
body {
  background: #74b9ff;
}

.joke {
  background: #a29bfe;
  color: #fff;
}

button {
  background: #6c5ce7;
  color: #fff;
}

button:hover {
  background: #5f3dc4;
}
```

**Green Theme**:
```css
body {
  background: #55efc4;
}

.joke {
  background: #00b894;
  color: #fff;
}

button {
  background: #00cec9;
  color: #fff;
}

button:hover {
  background: #00a8a3;
}
```

### Font Customization

**Modern Sans-Serif**:
```css
html, body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
```

**Serif Style**:
```css
html, body {
  font-family: Georgia, 'Times New Roman', Times, serif;
}
```

**Monospace (Coder Theme)**:
```css
html, body {
  font-family: 'Courier New', Courier, monospace;
}

.joke {
  font-family: 'Monaco', 'Consolas', monospace;
}
```

### Size Variations

**Compact Mode**:
```css
.joke {
  font-size: 1.2em;
  padding: 1.5em;
  min-height: 60px;
}

button {
  font-size: 1em;
  padding: 0.6em 1.5em;
}
```

**Large Mode** (Accessibility):
```css
.joke {
  font-size: 2em;
  padding: 2.5em;
  min-height: 120px;
}

button {
  font-size: 1.4em;
  padding: 1em 2.5em;
}
```

### Animation Enhancements

**Fade In Animation**:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.joke {
  animation: fadeIn 0.5s ease;
}
```

**Button Pulse**:
```css
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

button:hover {
  animation: pulse 0.5s ease infinite;
}
```

**Loading Spinner**:
```html
<div class="joke">
  <div class="spinner"></div>
  Loading joke...
</div>
```

```css
.spinner {
  border: 4px solid rgba(0,0,0,0.1);
  border-top-color: #333;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## Component Examples

### Alternative Button Layout

**Vertical Stack**:
```html
<div class="buttons buttons-vertical">
  <button id="play">Play 🔊</button>
  <button id="next">Next Joke 👉</button>
  <button id="replay">Replay ♻️</button>
</div>
```

```css
.buttons-vertical {
  flex-direction: column;
}
```

### Joke Box Variants

**Minimal Style**:
```css
.joke.minimal {
  background: transparent;
  border: 2px solid #222;
  box-shadow: none;
}
```

**Neumorphic Style**:
```css
.joke.neumorphic {
  background: #ffeaa7;
  box-shadow: 
    10px 10px 20px rgba(0,0,0,0.1),
    -10px -10px 20px rgba(255,255,255,0.7);
}
```

**Glass morphism Style**:
```css
.joke.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

---

## Performance Considerations

### CSS Performance

**Efficient Selectors**:
```css
/* ✅ Good - Direct class selector */
.joke { }

/* ✅ Good - ID selector */
#play { }

/* ❌ Avoid - Deep nesting */
.centered .buttons button:hover { }

/* ✅ Better */
button:hover { }
```

**Hardware Acceleration**:
```css
button {
  /* Use transform instead of top/left for animations */
  transform: translateZ(0);
  will-change: transform;
}
```

**Optimize Shadows**:
```css
/* Light shadows perform better */
.joke {
  box-shadow: 0 6px 24px rgba(0,0,0,0.1);
}
```

---

**Last Updated**: December 25, 2025
