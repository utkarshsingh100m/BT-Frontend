document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contact-form');
    const statusDiv = document.getElementById('form-status');

    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(contactForm);
            const data = {
                name: formData.get('name'),
                email: formData.get('email'),
                message: formData.get('message')
            };
            
            // Show loading state
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;
            statusDiv.style.display = 'none';
            
            try {
                const response = await fetch('https://bt-backend-eight.vercel.app/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Show success message
                    statusDiv.innerHTML = '✓ Message sent successfully!';
                    statusDiv.style.color = '#4caf50';
                    statusDiv.style.display = 'block';
                    contactForm.reset();
                } else {
                    throw new Error(result.error || 'Failed to send message');
                }
                
            } catch (error) {
                // Show error message
                statusDiv.innerHTML = `✗ Error: ${error.message}`;
                statusDiv.style.color = '#f44336';
                statusDiv.style.display = 'block';
                console.error('Contact form error:', error);
            } finally {
                // Reset button state
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
                
                // Hide status after 5 seconds if success
                if (statusDiv.style.color === 'rgb(76, 175, 80)' || statusDiv.style.color === '#4caf50') {
                    setTimeout(() => {
                        statusDiv.style.display = 'none';
                    }, 5000);
                }
            }
        });
    }
});
