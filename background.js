// Background service worker for Read Aloud extension
// Manifest V3 implementation with Progressive Highlighting

class ReadAloudEngine {
    constructor() {
        this.isReading = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.resumeTimer = null; // Timer to keep speech synthesis alive
        this.preferences = {
            voice: null,
            rate: 1,
            pitch: 1,
            volume: 1,
            readingMode: 'fullPage',
            autoRead: false,
            highlightText: true,
            continueReading: false,
            highlightColor: '#fff9c4'
        };
        this.currentReadingSession = {
            text: null,
            sourceUrl: null,
            startTime: null,
            position: 0
        };
        this.init();
    }

    // Initialize the engine
    async init() {
        await this.loadPreferences();
        this.setupMessageListeners();
        this.setupCommands();
        this.setupTabListeners();
        console.log('Read Aloud engine initialized with progressive highlighting at 9:07');
    }

    // Load user preferences from storage
    async loadPreferences() {
        try {
            const result = await chrome.storage.sync.get('readAloudPreferences');
            if (result.readAloudPreferences) {
                this.preferences = { ...this.preferences, ...result.readAloudPreferences };
                console.log('Preferences loaded:', this.preferences);
            }
        } catch (error) {
            console.error('Failed to load preferences:', error);
        }
    }

    // Setup message listeners
    setupMessageListeners() {
        console.log('Setting up message listeners');
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'startReading':
                    this.startReading(request.text);
                    break;
                case 'pauseReading':
                    this.pauseReading();
                    break;
                case 'resumeReading':
                    this.resumeReading();
                    break;
                case 'stopReading':
                    this.stopReading();
                    break;
                case 'getStatus':
                    sendResponse({
                        isReading: this.isReading,
                        isPaused: this.isPaused,
                        preferences: this.preferences
                    });
                    return true;
                case 'updatePreferences':
                    this.updatePreferences(request.preferences);
                    break;
                case 'getPreferences':
                    sendResponse({ preferences: this.preferences });
                    return true;
            }
        });
    }

    // Start reading the given text
    startReading(text) {
        if (this.isReading) {
            this.stopReading();
        }

        this.currentReadingSession.text = text;
        this.currentReadingSession.position = 0;
        this.isReading = true;
        this.isPaused = false;
        this.updateStatus();
        
        // Prepare highlighting in content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'prepareHighlighting' });
            }
        });
        
        this.speakText(text);
    }

    // Pause reading at paragraph boundary
    pauseReading() {
        if (this.isReading && !this.isPaused) {
            try {
                speechSynthesis.pause();
                this.isPaused = true;
                this.clearResumeTimer(); // Stop the keep-alive timer
                this.updateStatus();
                console.log('Speech paused at position:', this.currentReadingSession.position);
            } catch (error) {
                console.error('Failed to pause speech:', error);
                this.stopReading();
            }
        }
    }

    // Resume reading from next paragraph boundary
    resumeReading() {
        if (this.isReading && this.isPaused) {
            // Try native resume first
            try {
                speechSynthesis.resume();
                this.isPaused = false;
                this.startResumeTimer(); // Restart keep-alive timer
                this.updateStatus();
                console.log('Resumed speech synthesis');
                return;
            } catch (error) {
                console.log('Native resume failed, finding next paragraph boundary:', error);
            }
            
            // Fallback: Find next paragraph boundary and restart from there
            this.findNextParagraphAndResume();
        }
    }

    // Find paragraph boundaries and resume
    findNextParagraphAndResume() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'findNextParagraph',
                    currentPosition: this.currentReadingSession.position
                }, (response) => {
                    if (response && response.success && response.nextParagraphPosition !== undefined) {
                        // Resume from the next paragraph
                        this.currentReadingSession.position = response.nextParagraphPosition;
                        const remainingText = this.currentReadingSession.text.substring(response.nextParagraphPosition);
                        
                        console.log('Resuming from next paragraph at position:', response.nextParagraphPosition);
                        
                        speechSynthesis.cancel();
                        this.isPaused = false;
                        this.updateStatus();
                        this.speakText(remainingText, response.nextParagraphPosition);
                    } else {
                        console.error('Could not find next paragraph boundary');
                        this.stopReading();
                    }
                });
            }
        });
    }

    // Stop reading
    stopReading() {
        if (this.isReading) {
            speechSynthesis.cancel();
            this.clearResumeTimer();
            this.isReading = false;
            this.isPaused = false;
            this.currentUtterance = null;
            this.currentReadingSession.position = 0;
            this.updateStatus();
            
            // Clear highlighting in content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'clearHighlight' });
                }
            });
        }
    }

    // Speak the given text using Web Speech API with progressive highlighting
    speakText(text, startPosition = 0) {
        this.currentUtterance = new SpeechSynthesisUtterance(text);
        
        // Set voice, rate, pitch, volume from preferences
        const voices = speechSynthesis.getVoices();
        if (this.preferences.voice) {
            const selectedVoice = voices.find(voice => voice.name === this.preferences.voice);
            if (selectedVoice) {
                this.currentUtterance.voice = selectedVoice;
            }
        }
        
        this.currentUtterance.rate = this.preferences.rate;
        this.currentUtterance.pitch = this.preferences.pitch;
        this.currentUtterance.volume = this.preferences.volume;
        
        console.log('Speaking with preferences:', {
            voice: this.currentUtterance.voice ? this.currentUtterance.voice.name : 'default',
            rate: this.currentUtterance.rate,
            pitch: this.currentUtterance.pitch,
            volume: this.currentUtterance.volume
        });
        
        this.currentUtterance.onstart = () => {
            console.log('Speech started');
            this.startResumeTimer(); // Start keep-alive timer
        };
        
        this.currentUtterance.onend = () => {
            console.log('Speech ended');
            this.clearResumeTimer();
            this.stopReading();
        };
        
        this.currentUtterance.onerror = (event) => {
            console.error('Speech error:', event.error);
            this.clearResumeTimer();
            this.stopReading();
        };
        
        this.currentUtterance.onpause = () => {
            console.log('Speech paused');
            this.clearResumeTimer();
            this.updateStatus();
        };
        
        this.currentUtterance.onresume = () => {
            console.log('Speech resumed');
            this.startResumeTimer();
            this.updateStatus();
        };
        
        // Enhanced highlighting with paragraph prediction and timing compensation
        this.currentUtterance.onboundary = (event) => {
            if (event.name === 'word') {
                const globalCharIndex = startPosition + event.charIndex;
                this.currentReadingSession.position = globalCharIndex;
                
                // Progressive highlighting with speech rate compensation
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs.length > 0 && this.isReading && !this.isPaused) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'highlightTextProgressive',
                            position: globalCharIndex,
                            rate: this.preferences.rate,
                            timestamp: Date.now() // Add timestamp for timing calculations
                        });
                    }
                });
            }
        };
        
        speechSynthesis.speak(this.currentUtterance);
    }

    // Start timer to keep speech synthesis alive (Chrome bug workaround)
    startResumeTimer() {
        this.clearResumeTimer();
        this.resumeTimer = setInterval(() => {
            if (speechSynthesis.speaking && !speechSynthesis.paused) {
                speechSynthesis.resume();
            }
        }, 5000);
    }

    // Clear the resume timer
    clearResumeTimer() {
        if (this.resumeTimer) {
            clearInterval(this.resumeTimer);
            this.resumeTimer = null;
        }
    }

    // Update status to popup/content script
    updateStatus() {
        chrome.runtime.sendMessage({
            action: 'statusUpdate',
            status: {
                isReading: this.isReading,
                isPaused: this.isPaused
            }
        });
    }

    // Update preferences from popup
    updatePreferences(newPreferences) {
        this.preferences = { ...this.preferences, ...newPreferences };
        chrome.storage.sync.set({ readAloudPreferences: this.preferences });
        console.log('Preferences updated:', this.preferences);
    }

    // Placeholder for commands
    setupCommands() {
        console.log('Setting up commands (placeholder)');
        // Actual implementation will go here
    }

    // Placeholder for tab listeners
    setupTabListeners() {
        console.log('Setting up tab listeners (placeholder)');
        // Actual implementation will go here
    }
}

// Initialize the engine when the service worker starts
const readAloudEngine = new ReadAloudEngine();

// Handle service worker lifecycle
chrome.runtime.onInstalled.addListener(() => {
    console.log('Read Aloud extension installed');
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Read Aloud extension starting up');
});

// Handle storage changes (e.g., when options are updated)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.readAloudPreferences) {
        readAloudEngine.preferences = {
            ...readAloudEngine.preferences,
            ...changes.readAloudPreferences.newValue
        };
        console.log('Preferences updated from storage');
    }
});

