# Voice Joke Webpage 😂

A fun, interactive web application that fetches random jokes and reads them aloud using the Web Speech API. Built with vanilla JavaScript, HTML5, and CSS3.

## Overview

Voice Joke Webpage is a simple yet entertaining single-page application that provides users with an endless stream of jokes from the JokeAPI. The application features text-to-speech functionality, allowing jokes to be read aloud with customizable voice parameters.

## Features

- **Random Joke Fetching**: Retrieves random jokes from the JokeAPI v2
- **Text-to-Speech**: Reads jokes aloud using the Web Speech Synthesis API
- **Multiple Joke Types**: Supports both single-line jokes and two-part (setup/punchline) jokes
- **Safe Mode**: Only fetches family-friendly jokes
- **Responsive Design**: Mobile-friendly interface that works on all device sizes
- **Interactive Controls**: Play, Replay, and Next Joke buttons

## Technologies Used

- **HTML5**: Semantic markup and structure
- **CSS3**: Modern styling with flexbox, transitions, and responsive design
- **JavaScript (ES6+)**: Async/await, Fetch API, Web Speech API
- **External API**: [JokeAPI v2](https://v2.jokeapi.dev/)

## Getting Started

### Prerequisites

- A modern web browser with JavaScript enabled
- Internet connection (for fetching jokes from the API)
- Browser support for Web Speech Synthesis API (optional, for voice playback)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Open the `index.html` file in your web browser:
   ```bash
   # On Linux/Mac
   open index.html
   
   # On Windows
   start index.html
   
   # Or simply double-click the index.html file
   ```

### Alternative: Run with a Local Server

For a better development experience, you can use a local HTTP server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js with http-server
npx http-server -p 8000

# Using PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000` in your browser.

## Project Structure

```
/workspace/
├── index.html          # Main HTML file with embedded CSS and JavaScript
├── README.md           # This file - project overview and setup
├── API.md              # Detailed API and function documentation
├── COMPONENTS.md       # UI components documentation
└── USAGE.md            # Usage instructions and examples
```

## Quick Start Guide

1. **Open the Application**: Load `index.html` in your browser
2. **Automatic Load**: A joke will automatically load when the page opens
3. **Play Audio**: Click the "Play 🔊" button to hear the joke read aloud
4. **Get New Jokes**: Click "Next Joke 👉" to fetch a new random joke
5. **Replay**: Click "Replay ♻️" to hear the current joke again

## Browser Compatibility

### Minimum Requirements
- **Chrome/Edge**: Version 33+
- **Firefox**: Version 49+
- **Safari**: Version 7+
- **Opera**: Version 21+

### Web Speech API Support
The text-to-speech feature requires browser support for the Web Speech Synthesis API:
- ✅ Chrome/Chromium (Full support)
- ✅ Edge (Full support)
- ✅ Safari (Full support)
- ⚠️ Firefox (Limited support)
- ❌ Internet Explorer (Not supported)

## API Integration

This application integrates with the [JokeAPI v2](https://v2.jokeapi.dev/):

- **Endpoint**: `https://v2.jokeapi.dev/joke/Any`
- **Parameters**:
  - `type=single,twopart`: Accepts both single and two-part jokes
  - `safe-mode`: Only returns family-friendly content
- **Rate Limiting**: Free tier allows 120 requests per minute

## Architecture

The application follows a simple event-driven architecture:

1. **Initialization**: On page load, fetches the first joke
2. **Event Handling**: Button clicks trigger specific functions
3. **Async Operations**: Uses async/await for API calls
4. **State Management**: Maintains current joke in a global variable
5. **UI Updates**: Updates DOM elements directly via `getElementById`

## Security Considerations

- **HTTPS API**: Uses secure HTTPS connection to JokeAPI
- **Content Safety**: Enabled safe-mode to filter inappropriate content
- **CSP Compatible**: No inline event handlers (uses addEventListener pattern)
- **XSS Protection**: Uses `textContent` instead of `innerHTML` for user-facing content

## Performance Optimizations

- **Minimal Dependencies**: Zero external libraries or frameworks
- **Lightweight**: Total file size < 5KB
- **Fast Loading**: Single HTML file with inline CSS/JS
- **Efficient Rendering**: Direct DOM manipulation without virtual DOM overhead

## Troubleshooting

### Jokes Not Loading
- Check your internet connection
- Verify the JokeAPI is not down: visit https://v2.jokeapi.dev/joke/Any
- Check browser console for error messages

### Voice Not Playing
- Ensure your browser supports Web Speech API
- Check browser permissions for audio playback
- Try refreshing the page if synthesis is stuck

### Display Issues
- Clear browser cache and reload
- Try a different browser
- Check browser zoom level (100% recommended)

## Future Enhancements

Potential features for future development:
- Voice selection (different accents/languages)
- Joke categories filter
- Favorite jokes storage (localStorage)
- Dark mode toggle
- Share joke functionality
- Custom styling themes

## Contributing

Contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly across browsers
5. Submit a pull request

## License

This project is provided as-is for educational and entertainment purposes.

## Acknowledgments

- [JokeAPI](https://jokeapi.dev/) for providing the joke content
- Web Speech API for text-to-speech functionality
- The open-source community

## Related Documentation

- [API Documentation](./API.md) - Detailed function and API reference
- [Component Documentation](./COMPONENTS.md) - UI components and structure
- [Usage Guide](./USAGE.md) - Step-by-step usage instructions and examples

## Support

For issues, questions, or suggestions, please open an issue in the repository.

---

**Made with ❤️ and JavaScript**
