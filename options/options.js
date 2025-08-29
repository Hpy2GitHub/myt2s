document.addEventListener('DOMContentLoaded', function() {
            // DOM elements
            const voiceSelect = document.getElementById('voiceSelect');
            const rateSlider = document.getElementById('rateSlider');
            const rateValue = document.getElementById('rateValue');
            const pitchSlider = document.getElementById('pitchSlider');
            const pitchValue = document.getElementById('pitchValue');
            const volumeSlider = document.getElementById('volumeSlider');
            const volumeValue = document.getElementById('volumeValue');
            const highlightColor = document.getElementById('highlightColor');
            const highlightPreview = document.getElementById('highlightPreview');
            const saveBtn = document.getElementById('saveBtn');
            const resetBtn = document.getElementById('resetBtn');
            const testBtn = document.getElementById('testBtn');
            const notification = document.getElementById('notification');
            
            // State variables
            let voices = [];
            let isEditingShortcut = false;
            let currentShortcutElement = null;
            
            // Initialize the options page
            function init() {
                loadVoices();
                loadSettings();
                setupEventListeners();
            }
            
            // Load available voices
            function loadVoices() {
                // Get voices when they are loaded
                speechSynthesis.onvoiceschanged = function() {
                    voices = speechSynthesis.getVoices();
                    populateVoiceSelect();
                };
                
                // Get voices if they're already loaded
                voices = speechSynthesis.getVoices();
                if (voices.length > 0) {
                    populateVoiceSelect();
                }
            }
            
            // Populate voice select dropdown
            function populateVoiceSelect() {
                voiceSelect.innerHTML = '';
                
                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Default Voice';
                voiceSelect.appendChild(defaultOption);
                
                // Add all available voices
                voices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.name;
                    option.textContent = `${voice.name} (${voice.lang})`;
                    voiceSelect.appendChild(option);
                });
                
                // Select saved voice preference
                chrome.storage.sync.get('readAloudPreferences', function(data) {
                    if (data.readAloudPreferences && data.readAloudPreferences.voice) {
                        voiceSelect.value = data.readAloudPreferences.voice;
                    }
                });
            }
            
            // Load saved settings
            function loadSettings() {
                chrome.storage.sync.get('readAloudPreferences', function(data) {
                    if (data.readAloudPreferences) {
                        // Voice settings
                        if (data.readAloudPreferences.rate) {
                            rateSlider.value = data.readAloudPreferences.rate;
                            rateValue.textContent = data.readAloudPreferences.rate;
                        }
                        if (data.readAloudPreferences.pitch) {
                            pitchSlider.value = data.readAloudPreferences.pitch;
                            pitchValue.textContent = data.readAloudPreferences.pitch;
                        }
                        if (data.readAloudPreferences.volume) {
                            volumeSlider.value = data.readAloudPreferences.volume;
                            volumeValue.textContent = data.readAloudPreferences.volume;
                        }
                        if (data.readAloudPreferences.voice) {
                            voiceSelect.value = data.readAloudPreferences.voice;
                        }
                        
                        // Reading preferences
                        if (data.readAloudPreferences.readingMode) {
                            document.querySelector(`input[name="readingMode"][value="${data.readAloudPreferences.readingMode}"]`).checked = true;
                        }
                        if (data.readAloudPreferences.autoRead !== undefined) {
                            document.getElementById('autoRead').checked = data.readAloudPreferences.autoRead;
                        }
                        if (data.readAloudPreferences.highlightText !== undefined) {
                            document.getElementById('highlightText').checked = data.readAloudPreferences.highlightText;
                        }
                        if (data.readAloudPreferences.continueReading !== undefined) {
                            document.getElementById('continueReading').checked = data.readAloudPreferences.continueReading;
                        }
                        
                        // Highlight settings
                        if (data.readAloudPreferences.highlightColor) {
                            highlightColor.value = data.readAloudPreferences.highlightColor;
                            highlightPreview.style.backgroundColor = data.readAloudPreferences.highlightColor;
                        }
                    }
                });
                
                // Load keyboard shortcuts
                chrome.commands.getAll(function(commands) {
                    commands.forEach(command => {
                        if (command.shortcut) {
                            const element = document.getElementById(`${command.name}Shortcut`);
                            if (element) {
                                element.textContent = command.shortcut;
                            }
                        }
                    });
                });
            }
            
            // Set up event listeners
            function setupEventListeners() {
                // Slider events
                rateSlider.addEventListener('input', function() {
                    rateValue.textContent = this.value;
                });
                
                pitchSlider.addEventListener('input', function() {
                    pitchValue.textContent = this.value;
                });
                
                volumeSlider.addEventListener('input', function() {
                    volumeValue.textContent = this.value;
                });
                
                // Highlight color event
                highlightColor.addEventListener('input', function() {
                    highlightPreview.style.backgroundColor = this.value;
                });
                
                // Button events
                saveBtn.addEventListener('click', saveSettings);
                resetBtn.addEventListener('click', resetSettings);
                testBtn.addEventListener('click', testVoice);
                
                // Shortcut change events
                document.getElementById('changePlayPause').addEventListener('click', function() {
                    startShortcutEdit('playPause');
                });
                
                document.getElementById('changeStop').addEventListener('click', function() {
                    startShortcutEdit('stop');
                });
                
                document.getElementById('changeReadSelected').addEventListener('click', function() {
                    startShortcutEdit('readSelected');
                });
                
                // Keyboard event for shortcut capture
                document.addEventListener('keydown', handleKeyDown);
                document.addEventListener('keyup', handleKeyUp);
            }
            
            // Save settings to storage
            function saveSettings() {
                const preferences = {
                    voice: voiceSelect.value,
                    rate: parseFloat(rateSlider.value),
                    pitch: parseFloat(pitchSlider.value),
                    volume: parseFloat(volumeSlider.value),
                    readingMode: document.querySelector('input[name="readingMode"]:checked').value,
                    autoRead: document.getElementById('autoRead').checked,
                    highlightText: document.getElementById('highlightText').checked,
                    continueReading: document.getElementById('continueReading').checked,
                    highlightColor: highlightColor.value
                };
                
                chrome.storage.sync.set({ readAloudPreferences: preferences }, function() {
                    showNotification('Settings saved successfully!');
                    
                    // Notify background script about preference changes
                    chrome.runtime.sendMessage({
                        action: 'updatePreferences',
                        preferences: preferences
                    });
                });
            }
            
            // Reset settings to defaults
            function resetSettings() {
                if (confirm('Are you sure you want to reset all settings to default values?')) {
                    const defaultPreferences = {
                        voice: '',
                        rate: 1,
                        pitch: 1,
                        volume: 1,
                        readingMode: 'fullPage',
                        autoRead: false,
                        highlightText: true,
                        continueReading: false,
                        highlightColor: '#fff9c4'
                    };
                    
                    chrome.storage.sync.set({ readAloudPreferences: defaultPreferences }, function() {
                        loadSettings(); // Reload UI with default values
                        showNotification('Settings reset to defaults!');
                        
                        // Notify background script about preference changes
                        chrome.runtime.sendMessage({
                            action: 'updatePreferences',
                            preferences: defaultPreferences
                        });
                    });
                }
            }
            
            // Test the current voice settings
            function testVoice() {
                const preferences = {
                    voice: voiceSelect.value,
                    rate: parseFloat(rateSlider.value),
                    pitch: parseFloat(pitchSlider.value),
                    volume: parseFloat(volumeSlider.value)
                };
                
                // Create test utterance
                const utterance = new SpeechSynthesisUtterance(
                    'This is a test of the current voice settings. You can adjust the voice, speed, and pitch to your preference.'
                );
                
                // Apply preferences
                utterance.rate = preferences.rate;
                utterance.pitch = preferences.pitch;
                utterance.volume = preferences.volume;
                
                // Set voice if selected
                if (preferences.voice) {
                    const selectedVoice = voices.find(voice => voice.name === preferences.voice);
                    if (selectedVoice) {
                        utterance.voice = selectedVoice;
                    }
                }
                
                // Speak the test message
                speechSynthesis.speak(utterance);
            }
            
            // Start editing a keyboard shortcut
            function startShortcutEdit(shortcutName) {
                isEditingShortcut = true;
                currentShortcutElement = document.getElementById(`${shortcutName}Shortcut`);
                currentShortcutElement.textContent = 'Press new shortcut...';
                currentShortcutElement.style.color = 'var(--accent)';
                
                showNotification('Press the new key combination for this shortcut');
            }
            
            // Handle key down events for shortcut capture
            function handleKeyDown(e) {
                if (!isEditingShortcut) return;
                
                e.preventDefault();
                e.stopPropagation();
                
                const keys = [];
                if (e.ctrlKey) keys.push('Ctrl');
                if (e.shiftKey) keys.push('Shift');
                if (e.altKey) keys.push('Alt');
                
                // Don't include modifier keys as the main key
                if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                    keys.push(e.key.toUpperCase());
                }
                
                if (keys.length > 1) {
                    currentShortcutElement.textContent = keys.join('+');
                }
            }
            
            // Handle key up events to finish shortcut capture
            function handleKeyUp(e) {
                if (!isEditingShortcut) return;
                
                if (e.key === 'Escape') {
                    // Cancel editing
                    isEditingShortcut = false;
                    currentShortcutElement.textContent = 'Cancelled';
                    currentShortcutElement.style.color = '';
                    setTimeout(() => loadSettings(), 1000);
                    return;
                }
                
                // Check if we have a valid shortcut (at least one modifier and one key)
                const shortcutText = currentShortcutElement.textContent;
                if (shortcutText.includes('+') && !shortcutText.includes('Press')) {
                    // TODO: Implement saving the shortcut
                    // This would require using chrome.commands.update which is not available in all browsers
                    
                    isEditingShortcut = false;
                    currentShortcutElement.style.color = '';
                    showNotification('Shortcut updated! Note: Browser restrictions may prevent saving custom shortcuts.');
                    
                    // Revert after a moment since we can't actually save it
                    setTimeout(() => loadSettings(), 2000);
                }
            }
            
            // Show notification
            function showNotification(message) {
                notification.textContent = message;
                notification.classList.add('show');
                
                setTimeout(() => {
                    notification.classList.remove('show');
                }, 3000);
            }
            
            // Initialize the options page
            init();
        });