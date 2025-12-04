// ===================================
// BUDDY TOOLS - IMPROVED SCRIPT.JS
// ===================================

// ===================================
// 1. PDF MAKER FROM IMAGES
// ===================================
function generatePDFFromImages() {
    const fileInput = document.getElementById('image-files');
    const files = fileInput.files;

    if (files.length === 0) {
        showNotification('Please select at least one image file.', 'error');
        return;
    }

    // Validate file types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    for (let file of files) {
        if (!validTypes.includes(file.type)) {
            showNotification(`Invalid file type: ${file.name}. Please use JPG, PNG, or GIF.`, 'error');
            return;
        }
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let processed = 0;

    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const imgData = e.target.result;
            const img = new Image();

            img.onload = function () {
                if (index > 0) {
                    doc.addPage();
                }

                // Calculate dimensions to fit page while maintaining aspect ratio
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                const imgRatio = img.width / img.height;
                const pageRatio = pageWidth / pageHeight;

                let finalWidth, finalHeight;
                if (imgRatio > pageRatio) {
                    finalWidth = pageWidth - 20;
                    finalHeight = finalWidth / imgRatio;
                } else {
                    finalHeight = pageHeight - 20;
                    finalWidth = finalHeight * imgRatio;
                }

                const x = (pageWidth - finalWidth) / 2;
                const y = (pageHeight - finalHeight) / 2;

                doc.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
                processed++;

                if (processed === files.length) {
                    // Save the PDF and store blob for Drive upload
                    const pdfBlob = doc.output('blob');
                    lastGeneratedPDFBlob = pdfBlob;
                    doc.save('images-to-pdf.pdf');

                    // Enable Drive save button
                    const driveSaveBtn = document.querySelector('.save-to-drive');
                    if (driveSaveBtn) {
                        driveSaveBtn.disabled = !driveIntegration.isConnected();
                    }

                    // Clear the file input
                    fileInput.value = '';

                    showNotification('PDF generated successfully!', 'success');
                }
            };

            img.src = imgData;
        };
        reader.readAsDataURL(file);
    });
}

// ===================================
// 2. PDF TO PPT CONVERTER (CLIENT-SIDE)
// ===================================
async function convertPDFtoPPT() {
    const fileInput = document.getElementById('pdf-file');
    const file = fileInput.files[0];
    const resultElement = document.getElementById('ppt-result');

    if (!file) {
        showNotification('Please select a PDF file.', 'error');
        return;
    }

    if (file.type !== 'application/pdf') {
        showNotification('Please select a valid PDF file.', 'error');
        return;
    }

    // Show loading message
    resultElement.innerHTML = `
        <div class="info-message">
            <strong>Converting...</strong><br>
            Please wait while we convert your PDF to PowerPoint.
        </div>
    `;

    try {
        // Load PDF.js library
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // Read PDF file
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        // Create PowerPoint using PptxGenJS
        const pptx = new PptxGenJS();

        // Process each page
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });

            // Create canvas to render PDF page
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Render PDF page to canvas
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Convert canvas to image
            const imageData = canvas.toDataURL('image/png');

            // Add slide with image
            const slide = pptx.addSlide();
            slide.addImage({
                data: imageData,
                x: 0,
                y: 0,
                w: '100%',
                h: '100%'
            });

            // Update progress
            resultElement.innerHTML = `
                <div class="info-message">
                    <strong>Converting...</strong><br>
                    Processing page ${pageNum} of ${pdf.numPages}
                </div>
            `;
        }

        // Save PowerPoint and store blob for Drive upload
        const filename = file.name.replace('.pdf', '.pptx');
        const pptBlob = await pptx.write({ outputType: 'blob' });
        lastGeneratedPPTBlob = pptBlob;
        
        await pptx.writeFile({ fileName: filename });

        // Enable Drive save button
        const driveSaveBtn = document.querySelectorAll('.save-to-drive')[1]; // Second save button
        if (driveSaveBtn) {
            driveSaveBtn.disabled = !driveIntegration.isConnected();
        }

        // Clear input
        fileInput.value = '';

        resultElement.innerHTML = `
            <div class="success-message">
                <strong>Success!</strong><br>
                Your PowerPoint file has been downloaded.
            </div>
        `;

        showNotification('PDF converted to PPT successfully!', 'success');

    } catch (error) {
        console.error('Conversion error:', error);
        resultElement.innerHTML = `
            <div class="error-message">
                <strong>Error!</strong><br>
                ${error.message}<br>
                Make sure you have a stable internet connection for the required libraries.
            </div>
        `;
        showNotification('Conversion failed: ' + error.message, 'error');
    }
}

// ===================================
// 3. PPT TO PDF CONVERTER (BACKEND)
// ===================================
async function convertPPTtoPDF() {
    const fileInput = document.getElementById('ppt-file');
    const file = fileInput.files[0];
    const resultElement = document.getElementById('pdf-result');

    if (!file) {
        showNotification('Please select a PPT file.', 'error');
        return;
    }

    const validTypes = [
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    if (!validTypes.includes(file.type)) {
        showNotification('Please select a valid PPT or PPTX file.', 'error');
        return;
    }

    // Show loading message
    resultElement.innerHTML = `
        <div class="info-message">
            <strong>Converting...</strong><br>
            Please wait while we convert your PowerPoint to PDF.
        </div>
    `;

    try {
        // Create form data
        const formData = new FormData();
        formData.append('file', file);

        // Send to backend
        const response = await fetch('http://localhost:5000/api/convert/ppt-to-pdf', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Conversion failed');
        }

        // Get the file blob and store for Drive upload
        const blob = await response.blob();
        lastGeneratedPDFBlob = blob;

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name.replace(/\.(ppt|pptx)$/i, '.pdf');
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Enable Drive save button
        const driveSaveBtn = document.querySelectorAll('.save-to-drive')[2]; // Third save button
        if (driveSaveBtn) {
            driveSaveBtn.disabled = !driveIntegration.isConnected();
        }

        // Clear input
        fileInput.value = '';

        resultElement.innerHTML = `
            <div class="success-message">
                <strong>Success!</strong><br>
                Your PDF file has been downloaded.<br>
                <small>Note: This is a text-only conversion. Images and formatting are not fully preserved.</small>
            </div>
        `;

        showNotification('PPT converted to PDF successfully!', 'success');

    } catch (error) {
        console.error('Conversion error:', error);
        resultElement.innerHTML = `
            <div class="error-message">
                <strong>Error!</strong><br>
                ${error.message}<br>
                <small>Make sure the backend server is running: <code>python backend/chat-api.py</code></small>
            </div>
        `;
        showNotification('Conversion failed: ' + error.message, 'error');
    }
}

// ===================================
// 4. NOTE SUMMARIZER (IMPROVED)
// ===================================
function summarizeNotes() {
    const notesText = document.getElementById('notes').value.trim();
    const summaryElement = document.getElementById('summary');

    if (!notesText) {
        showNotification('Please enter some text to summarize.', 'error');
        return;
    }

    // Split into sentences
    const sentences = notesText
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    if (sentences.length === 0) {
        showNotification('No valid sentences found.', 'error');
        return;
    }

    // Calculate word count
    const wordCount = notesText.split(/\s+/).length;

    // Determine number of sentences to include based on length
    let numSentences;
    if (sentences.length <= 3) {
        numSentences = sentences.length;
    } else if (sentences.length <= 10) {
        numSentences = 3;
    } else {
        numSentences = Math.min(5, Math.ceil(sentences.length * 0.3));
    }

    // Create summary
    const summary = sentences.slice(0, numSentences).join('. ') + '.';
    const summaryWordCount = summary.split(/\s+/).length;
    const reductionPercent = ((1 - summaryWordCount / wordCount) * 100).toFixed(0);

    summaryElement.innerHTML = `
        <div class="summary-result">
            <h4>Summary</h4>
            <p>${summary}</p>
            <div class="summary-stats">
                <span>Original: ${wordCount} words</span>
                <span>Summary: ${summaryWordCount} words</span>
                <span>Reduced by: ${reductionPercent}%</span>
            </div>
        </div>
    `;

    showNotification('Summary generated successfully!', 'success');
}

// ===================================
// 5. CHATGPT MOCK INTERFACE
// ===================================
function sendMessage() {
    const input = document.getElementById('chat-input');
    const messages = document.getElementById('chat-messages');
    const userMessage = input.value.trim();

    if (!userMessage) {
        showNotification('Please enter a message.', 'error');
        return;
    }

    // Add user message
    const userDiv = document.createElement('div');
    userDiv.className = 'message user-message';
    userDiv.innerHTML = `<strong>You:</strong> ${escapeHtml(userMessage)}`;
    messages.appendChild(userDiv);

    // Clear input
    input.value = '';

    // Scroll to bottom
    messages.scrollTop = messages.scrollHeight;

    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing';
    typingDiv.innerHTML = '<strong>GPT:</strong> <span class="typing-dots">...</span>';
    messages.appendChild(typingDiv);
    messages.scrollTop = messages.scrollHeight;

    // Generate mock response
    setTimeout(() => {
        messages.removeChild(typingDiv);

        const botDiv = document.createElement('div');
        botDiv.className = 'message bot-message';
        botDiv.innerHTML = `<strong>GPT:</strong> ${generateMockResponse(userMessage)}`;
        messages.appendChild(botDiv);

        messages.scrollTop = messages.scrollHeight;
    }, 1000 + Math.random() * 1000);
}

// Generate contextual mock responses
function generateMockResponse(message) {
    const lowerMessage = message.toLowerCase();

    const responses = {
        greeting: [
            "Hello! I'm here to help you with your studies. What would you like to know?",
            "Hi there! How can I assist you today?",
            "Hey! Ready to tackle some academic challenges together?"
        ],
        help: [
            "I can help you with various academic tasks like explaining concepts, solving problems, or providing study tips. What do you need help with?",
            "I'm here to assist with homework, research, writing, and more. What subject are you working on?"
        ],
        thanks: [
            "You're welcome! Feel free to ask if you need anything else.",
            "Happy to help! Let me know if you have more questions.",
            "Anytime! Good luck with your studies!"
        ],
        default: [
            "This is a mock ChatGPT interface. For real AI assistance, please integrate with the OpenAI API.",
            "I'm a demonstration bot. In the full version, I'll provide intelligent responses to your questions!",
            "This feature is coming soon! We're working on integrating real AI capabilities."
        ]
    };

    if (/^(hi|hello|hey|greetings)/i.test(lowerMessage)) {
        return responses.greeting[Math.floor(Math.random() * responses.greeting.length)];
    } else if (/help|assist|support/i.test(lowerMessage)) {
        return responses.help[Math.floor(Math.random() * responses.help.length)];
    } else if (/thank|thanks|thx/i.test(lowerMessage)) {
        return responses.thanks[Math.floor(Math.random() * responses.thanks.length)];
    } else {
        return responses.default[Math.floor(Math.random() * responses.default.length)];
    }
}

// Allow Enter key to send message
if (document.getElementById('chat-input')) {
    document.getElementById('chat-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===================================
// FILE VALIDATION
// ===================================
function validateFileSize(file, maxSizeMB = 10) {
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
        showNotification(`File too large. Maximum size is ${maxSizeMB}MB.`, 'error');
        return false;
    }
    return true;
}

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', function () {
    console.log('Buddy Tools initialized successfully!');

    // Add file input change listeners for validation
    const imageInput = document.getElementById('image-files');
    if (imageInput) {
        imageInput.addEventListener('change', function () {
            const files = this.files;
            if (files.length > 0) {
                console.log(`${files.length} image(s) selected`);
            }
        });
    }
});