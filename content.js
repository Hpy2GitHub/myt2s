// Content script for Read Aloud extension
// Handles text extraction from web pages and paragraph-based text highlighting

console.log('Content.js: Paragraph-based version with debugging initialized at 9:09');

(function() {
    // State variables
    let isHighlightingEnabled = true;
    let highlightColor = '#fff9c4';
    let currentHighlightElement = null;
    let paragraphRanges = []; // Changed from sentenceRanges to paragraphRanges
    let currentPosition = 0;

    // Initialize the content script
    init();

    function init() {
        setupMessageListeners();
        requestPreferences();
        setupMutationObserver();
        console.log('Content: Read Aloud content script initialized with paragraph-based highlighting');
    }

    // Set up message listeners for communication with background script
    function setupMessageListeners() {
        console.log('Content: Setting up message listeners');
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Content: Message received:', request.action);
            
            switch (request.action) {
                case 'extractText':
                    const content = extractContent(request.option);
                    console.log('Content: Extracted text:', content.substring(0, 100) + '...');
                    sendResponse({
                        success: true,
                        text: content,
                        url: window.location.href,
                        title: document.title
                    });
                    break;
                    
                case 'getSelectedText':
                    console.log('Content: Handling getSelectedText action');
                    const selectedText = getSelectedText();
                    console.log('Content: getSelectedText() returned:', selectedText);
                    sendResponse({
                        success: !!selectedText,
                        text: selectedText,
                        url: window.location.href,
                        title: document.title
                    });
                    break;
                    
                case 'highlightText':
                    console.log('Content: Received legacy highlightText message');
                    if (request.position !== undefined) {
                        highlightText(request.position);
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'No position provided' });
                    }
                    break;
                    
                case 'highlightTextProgressive':
                    console.log('Content: Received highlightTextProgressive message at position:', request.position);
                    if (request.position !== undefined) {
                        highlightTextWithPrediction(request.position, request.rate || 1);
                        sendResponse({ success: true });
                    } else {
                        console.error('Content: No position provided for progressive highlighting');
                        sendResponse({ success: false, error: 'No position provided' });
                    }
                    break;
                    
                case 'clearHighlight':
                    console.log('Content: Clearing highlight');
                    clearHighlight();
                    sendResponse({ success: true });
                    break;
                    
                case 'prepareHighlighting':
                    console.log('Content: Preparing highlighting');
                    prepareTextForHighlighting();
                    sendResponse({
                        success: true,
                        totalParagraphs: paragraphRanges.length
                    });
                    break;
                    
                case 'findNextParagraph':
                    console.log('Content: Finding next paragraph from position:', request.currentPosition);
                    const nextParagraphPos = findNextParagraphBoundary(request.currentPosition);
                    sendResponse({
                        success: true,
                        nextParagraphPosition: nextParagraphPos
                    });
                    break;
                    
                case 'statusUpdate':
                    if (request.status && request.status.preferences) {
                        updatePreferences(request.status.preferences);
                    }
                    break;
                    
                default:
                    console.log('Content: Unknown action:', request.action);
                    sendResponse({ success: false, error: 'Unknown action' });
            }
            
            // Return true to indicate we wish to send a response asynchronously
            return true;
        });
    }

    // Request current preferences from background script
    function requestPreferences() {
        chrome.runtime.sendMessage(
            { action: 'getPreferences' },
            function(response) {
                if (response && response.preferences) {
                    updatePreferences(response.preferences);
                }
            }
        );
    }

    // Update preferences from background script
    function updatePreferences(preferences) {
        isHighlightingEnabled = preferences.highlightText !== false;
        highlightColor = preferences.highlightColor || 'transparent';
        console.log('Content: Updated preferences - highlighting enabled:', isHighlightingEnabled);
        
        if (currentHighlightElement) {
            currentHighlightElement.style.backgroundColor = highlightColor;
        }
    }

    // Set up mutation observer to handle dynamic content changes
    function setupMutationObserver() {
        const observer = new MutationObserver(function(mutations) {
            let shouldUpdateTextNodes = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldUpdateTextNodes = true;
                    break;
                }
            }
            
            if (shouldUpdateTextNodes) {
                console.log('Content: DOM changed, re-preparing text for highlighting');
                prepareTextForHighlighting();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Main content extraction function
    function extractContent(option = 'fullPage') {
        let content = '';
        
        switch (option) {
            case 'articleOnly':
                content = extractArticleContent();
                break;
            case 'selectedText':
                content = getSelectedText() || extractArticleContent();
                break;
            case 'fullPage':
            default:
                content = extractMainContent();
                break;
        }

        // Clean up the content
        return cleanText(content);
    }

    // Extract content from common article elements
    function extractArticleContent() {
        const selectors = [
            'article',
            '[role="main"]',
            'main',
            '[itemprop="articleBody"]',
            '.post-content',
            '.article-content',
            '.entry-content',
            '.content',
            '.main-content',
            '#content'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element.textContent;
            }
        }

        return extractMainContent();
    }

    // Fallback content extraction using heuristics
    function extractMainContent() {
        // Try to find the main content area by excluding non-content elements
        const nonContentSelectors = [
            'nav', 'header', 'footer', 'aside', 'form', 'script', 
            'style', 'noscript', 'iframe', 'object', 'embed'
        ];

        // Clone the body to work with
        const bodyClone = document.body.cloneNode(true);

        // Remove non-content elements
        nonContentSelectors.forEach(selector => {
            const elements = bodyClone.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });

        // Remove elements with common non-content classes
        const nonContentClasses = [
            'nav', 'navbar', 'menu', 'sidebar', 'ad', 'advertisement', 
            'ads', 'comments', 'share', 'social', 'newsletter', 'subscribe'
        ];

        nonContentClasses.forEach(className => {
            const elements = bodyClone.querySelectorAll(`.${className}`);
            elements.forEach(el => el.remove());
        });

        return bodyClone.textContent;
    }

    // Clean and normalize text for TTS
    function cleanText(text) {
        if (!text) return '';
        
        // Replace multiple whitespace characters with a single space
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, '\n')
            .replace(/\s\./g, '.')
            .trim();
    }

    // Get currently selected text
    function getSelectedText() {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim().length === 0) {
            return null;
        }
        
        return cleanText(selection.toString());
    }

    // Prepare text for highlighting by finding all paragraph elements
    function prepareTextForHighlighting() {
        if (!isHighlightingEnabled) {
            console.log('Content: Highlighting disabled, skipping preparation');
            return;
        }
        
        paragraphRanges = [];
        console.log('Content: Preparing text for paragraph-based highlighting...');
        
        // Find all paragraph-like elements
        const paragraphSelectors = [
            'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
            'li', 'blockquote', 'pre', 'article > *', 'section > *'
        ];
        
        let currentGlobalCharIndex = 0;
        
        // Get all paragraph elements - convert NodeList to Array
        const paragraphElements = Array.from(document.querySelectorAll(paragraphSelectors.join(', ')));
        console.log('Content: Found', paragraphElements.length, 'paragraph elements');
        
        for (const element of paragraphElements) {
            // Skip empty, hidden, or script/style elements
            if (!element.textContent.trim() || 
                element.style.display === 'none' || 
                element.hidden ||
                element.tagName === 'SCRIPT' ||
                element.tagName === 'STYLE') {
                continue;
            }
            
            // Skip elements that are children of other paragraph elements to avoid duplicates
            const isChildOfParagraph = paragraphElements.some(parent => 
                parent !== element && parent.contains(element)
            );
            if (isChildOfParagraph) continue;
            
            const text = element.textContent.trim();
            if (text.length > 0) {
                const range = document.createRange();
                range.selectNodeContents(element);
                
                paragraphRanges.push({
                    range: range,
                    element: element,
                    startCharIndex: currentGlobalCharIndex,
                    endCharIndex: currentGlobalCharIndex + text.length,
                    text: text
                });
                
                currentGlobalCharIndex += text.length + 1; // +1 for paragraph break
            }
        }
        
        console.log(`Content: Prepared ${paragraphRanges.length} paragraphs for highlighting`);
        console.log('Content: First 3 paragraph ranges:', paragraphRanges.slice(0, 3).map(p => ({
            startChar: p.startCharIndex,
            endChar: p.endCharIndex,
            text: p.text.substring(0, 50) + '...'
        })));
    }

    // Legacy highlighting function (fallback)
    function highlightText(charIndex) {
        console.log('Content: Legacy highlighting at position:', charIndex);
        highlightTextWithPrediction(charIndex, 1);
    }

    // Progressive highlighting with prediction
    function highlightTextWithPrediction(charIndex, speechRate) {
        console.log('Content: Progressive highlighting at position:', charIndex, 'with rate:', speechRate);
        
        if (!isHighlightingEnabled) {
            console.log('Content: Highlighting disabled, skipping');
            return;
        }
        
        if (paragraphRanges.length === 0) {
            console.log('Content: No paragraphs prepared, preparing now...');
            prepareTextForHighlighting();
        }
        
        // Find current paragraph
        const currentParagraphInfo = paragraphRanges.find(info => {
            return charIndex >= info.startCharIndex && charIndex < info.endCharIndex;
        });
        
        if (!currentParagraphInfo) {
            console.warn('Content: Could not find paragraph for charIndex:', charIndex);
            console.log('Content: Available paragraph ranges:', paragraphRanges.map(p => ({
                start: p.startCharIndex,
                end: p.endCharIndex
            })));
            return;
        }
        
        // Calculate how much of the paragraph has been spoken
        const paragraphProgress = (charIndex - currentParagraphInfo.startCharIndex) / 
                                 (currentParagraphInfo.endCharIndex - currentParagraphInfo.startCharIndex);
        
        console.log('Content: Paragraph progress:', Math.round(paragraphProgress * 100) + '%');
        
        // Only highlight when we're reasonably into the paragraph (15% through for faster highlighting)
        if (paragraphProgress >= 0.15) {
            clearHighlight();
            
            console.log('Content: Highlighting paragraph at charIndex:', charIndex, 
                       'Progress:', Math.round(paragraphProgress * 100) + '%');
            console.log('Content: Paragraph text:', currentParagraphInfo.text.substring(0, 100) + '...');
            
            const element = currentParagraphInfo.element;
            element.style.backgroundColor = highlightColor;
            element.style.transition = 'background-color 0.3s ease';
            element.classList.add('read-aloud-highlight');
            
            currentHighlightElement = element;
            
            // Smooth scroll to highlighted element
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
            
            console.log('Content: Successfully highlighted element:', element.tagName);
        } else {
            console.log('Content: Not highlighting yet, only', Math.round(paragraphProgress * 100) + '% through paragraph');
        }
    }

    // Clear the current highlight
    function clearHighlight() {
        if (currentHighlightElement) {
            console.log('Content: Clearing current highlight');
            currentHighlightElement.style.backgroundColor = '';
            currentHighlightElement.classList.remove('read-aloud-highlight');
            currentHighlightElement = null;
        }
    }

    // Find the next paragraph boundary after the current position
    function findNextParagraphBoundary(currentPosition) {
        // Find the next paragraph that starts after the current position
        const nextParagraph = paragraphRanges.find(paragraph => 
            paragraph.startCharIndex > currentPosition
        );
        
        if (nextParagraph) {
            console.log('Content: Found next paragraph at position:', nextParagraph.startCharIndex);
            return nextParagraph.startCharIndex;
        } else {
            // If no next paragraph found, return the end of text
            console.log('Content: No next paragraph found, returning end position');
            return paragraphRanges.length > 0 ? 
                paragraphRanges[paragraphRanges.length - 1].endCharIndex : 
                currentPosition;
        }
    }

    // Listen for selection changes to detect user text selection
    document.addEventListener('selectionchange', () => {
        const selectedText = getSelectedText();
        if (selectedText) {
            // Notify background script about text selection
            chrome.runtime.sendMessage({
                action: 'textSelected',
                text: selectedText
            });
        }
    });

})();

