// overlay.js

// Ensure center buttons maintain proper size and text visibility on first detect click
const centerButtons = document.querySelectorAll('.center-button');

centerButtons.forEach(button => {
    // Adjust the button styles for visibility and sizing
    button.style.minWidth = '150px'; // Minimum width for consistency
    button.style.minHeight = '50px'; // Minimum height for consistency
    button.style.fontSize = '16px'; // Font size for text visibility

    button.addEventListener('click', () => {
        // Additional logic if needed on first click
        console.log('Button clicked:', button.innerText);
    });
});