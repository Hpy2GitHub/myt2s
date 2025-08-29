document.addEventListener('DOMContentLoaded', function() {
            // DOM elements
            const statusElement = document.getElementById('status');
            const readPageBtn = document.getElementById('readPageBtn');
            const readSelectedBtn = document.getElementById('readSelectedBtn');
            const playPauseBtn = document.getElementById('playPauseBtn');
            const stopBtn = document.getElementById('stopBtn');
            const voiceSelect = document.getElementById('voiceSelect');
            const rateSlider = document.getElementById('rateSlider');
            const rateValue = document.getElementById('rateValue');
            const pitchSlider = document.getElementById('pitchSlider');
            const pitchValue = document.getElementById('pitchValue');
            const progressFill = document.getElementById('progressFill');
            const progressTime = document.getElementById('progressTime');
            const totalTime = document.getElementById('totalTime');
            const settingsBtn = document.getElementById('settingsBtn');
            const helpBtn = document.getElementById('helpBtn');
            
            // State variables
            let isReading = false;
            let isPaused = false;
            let voices = [];
            
            // Initialize the popup
            function init() {
                loadVoices();
                loadPreferences();
                setupEventListeners();
                checkSelectedText();
                checkReadingStatus();
            }
            
            // Load available voices
            function loadVoices() {
                const populate = () => {
                    voices = speechSynthesis.getVoices();
                    if (voices.length > 0) {
                        populateVoiceSelect();
                        //cleanup
                        speechSynthesis.onvoiceschanged = null;
                    }
                }

                populate();
                if (voices.length === 0) {
                    speechSynthesis.onvoiceschanged = populate;
                }
            }
            
            // Populate voice select dropdown
            function populateVoiceSelect() {
                                voiceSelect.textContent = '';
                
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
            
            // Load user preferences
            function loadPreferences() {
                chrome.storage.sync.get('readAloudPreferences', function(data) {
                    if (data.readAloudPreferences) {
                        if (data.readAloudPreferences.rate) {
                            rateSlider.value = data.readAloudPreferences.rate;
                            rateValue.textContent = data.readAloudPreferences.rate;
                        }
                        if (data.readAloudPreferences.pitch) {
                            pitchSlider.value = data.readAloudPreferences.pitch;
                            pitchValue.textContent = data.readAloudPreferences.pitch;
                        }
                    }
                });
            }
            
            // Save user preferences
            function savePreferences() {
                const preferences = {
                    voice: voiceSelect.value,
                    rate: parseFloat(rateSlider.value),
                    pitch: parseFloat(pitchSlider.value)
                };
                
                chrome.storage.sync.set({ readAloudPreferences: preferences });
            }
            
            // Set up event listeners
            function setupEventListeners() {
                // Button events
                readPageBtn.addEventListener('click', readPage);
                readSelectedBtn.addEventListener('click', readSelectedText);
                playPauseBtn.addEventListener('click', togglePlayPause);
                stopBtn.addEventListener('click', stopReading);
                
                // Settings events
                voiceSelect.addEventListener('change', savePreferences);
                rateSlider.addEventListener('input', function() {
                    rateValue.textContent = this.value;
                    savePreferences();
                    updateSpeechSettings();
                });
                pitchSlider.addEventListener('input', function() {
                    pitchValue.textContent = this.value;
                    savePreferences();
                    updateSpeechSettings();
                });
                
                // Footer button events
                settingsBtn.addEventListener('click', openSettings);
                helpBtn.addEventListener('click', openHelp);
                
                // Listen for messages from background script
                chrome.runtime.onMessage.addListener(handleMessage);
            }
            
            // Check if there's selected text on the page
            function checkSelectedText() {
                chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                    if (tabs.length === 0) return;
                    
                    chrome.tabs.sendMessage(
                        tabs[0].id, 
                        { action: 'getSelectedText' }, 
                        function(response) {
                            if (response && response.success) {
                                readSelectedBtn.disabled = false;
                            } else {
                                readSelectedBtn.disabled = true;
                            }
                        }
                    );
                });
            }
            
            // Check current reading status
            function checkReadingStatus() {
                chrome.runtime.sendMessage(
                    { action: 'getStatus' },
                    function(response) {
                        if (response) {
                            isReading = response.isReading;
                            updateUI();
                        }
                    }
                );
            }
            
            // Handle messages from background script
            function handleMessage(request, sender, sendResponse) {
                if (request.action === 'statusUpdate') {
                    isReading = request.status.isReading;
                    isPaused = request.status.isPaused;
                    updateUI();
                } else if (request.action === 'progressUpdate') {
                    updateProgress(request.progress, request.total);
                } else if (request.action === 'textSelected') {
                    readSelectedBtn.disabled = !request.text;
                }
            }
            
            // Update UI based on current state
            function updateUI() {
                // Force buttons enabled for debugging
                readPageBtn.disabled = false;
                readSelectedBtn.disabled = false;
                playPauseBtn.disabled = false;
                stopBtn.disabled = false;

                if (isReading) {
                    statusElement.textContent = isPaused ? 'Paused' : 'Reading...';
                    
                                        playPauseBtn.textContent = '';
                    const iconSpan = document.createElement('span');
                    iconSpan.textContent = isPaused ? '▶️' : '⏸️';
                    playPauseBtn.appendChild(iconSpan);
                    playPauseBtn.appendChild(document.createTextNode(isPaused ? ' Resume' : ' Pause'));
                } else {
                    statusElement.textContent = 'Ready to read';
                    
                    // Reset progress
                    progressFill.style.width = '0%';
                    progressTime.textContent = '0:00';
                    totalTime.textContent = '0:00';
                }
            }
            
            // Check if selected text is available
            function isSelectedTextAvailable() {
                // This would be implemented based on actual text selection detection
                return true; // Force true for debugging
            }
            
            // Update progress bar
            function updateProgress(current, total) {
                if (total > 0) {
                    const percentage = (current / total) * 100;
                    progressFill.style.width = percentage + '%';
                    
                    // Format time (simplified)
                    progressTime.textContent = formatTime(current);
                    totalTime.textContent = formatTime(total);
                }
            }
            
            // Format time in minutes:seconds
            function formatTime(seconds) {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            }
            
            // Read the entire page
            function readPage() {
                const textOption = document.querySelector('input[name="textOption"]:checked').value;
                
                chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                    if (tabs.length === 0) return;
                    
                    chrome.tabs.sendMessage(
                        tabs[0].id, 
                        { action: 'extractText', option: textOption },
                        function(response) {
                            if (response && response.success) {
                                chrome.runtime.sendMessage({
                                    action: 'startReading',
                                    text: response.text
                                });
                            } else {
                                statusElement.textContent = 'Failed to extract text';
                            }
                        }
                    );
                });
            }
            
            // Read selected text only
            function readSelectedText() {
                chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                    if (tabs.length === 0) return;
                    
                    chrome.tabs.sendMessage(
                        tabs[0].id, 
                        { action: 'getSelectedText' },
                        function(response) {
                            if (response && response.success) {
                                chrome.runtime.sendMessage({
                                    action: 'startReading',
                                    text: response.text
                                });
                            } else {
                                statusElement.textContent = 'No text selected';
                            }
                        }
                    );
                });
            }
            
            // Toggle play/pause
            function togglePlayPause() {
                if (isPaused) {
                    chrome.runtime.sendMessage({ action: 'resumeReading' });
                } else {
                    chrome.runtime.sendMessage({ action: 'pauseReading' });
                }
            }
            
            // Stop reading
            function stopReading() {
                chrome.runtime.sendMessage({ action: 'stopReading' });
            }
            
            // Update speech settings in background script
            function updateSpeechSettings() {
                chrome.runtime.sendMessage({
                    action: 'updatePreferences',
                    preferences: {
                        voice: voiceSelect.value,
                        rate: parseFloat(rateSlider.value),
                        pitch: parseFloat(pitchSlider.value)
                    }
                });
            }
            
            // Open settings page
            function openSettings() {
                chrome.runtime.openOptionsPage();
            }
            
            // Open help page
            function openHelp() {
                // You would implement this based on your documentation
                console.log('Open help documentation');
            }
            
            // Initialize the popup
            init();
        });