document.addEventListener('DOMContentLoaded', function() {
    // Mobile Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const body = document.querySelector('body');
    
    if (hamburger) {
        hamburger.addEventListener('click', function() {
            // Create mobile menu if it doesn't exist
            if (!document.querySelector('.mobile-menu')) {
                createMobileMenu();
            }
            
            const mobileMenu = document.querySelector('.mobile-menu');
            mobileMenu.classList.add('active');
            body.style.overflow = 'hidden'; // Prevent scrolling when menu is open
        });
    }
    
    // Function to create mobile menu
    function createMobileMenu() {
        const mobileMenu = document.createElement('div');
        mobileMenu.classList.add('mobile-menu');
        
        const mobileMenuContent = `
            <div class="mobile-menu-header">
                <div class="logo">
                    <h1>ConnectPro</h1>
                </div>
                <div class="close-menu">
                    <i class="fas fa-times"></i>
                </div>
            </div>
            <ul class="mobile-nav-links">
                <li><a href="#" class="active">Home</a></li>
                <li><a href="#">Network</a></li>
                <li><a href="#">Jobs</a></li>
                <li><a href="#">Messaging</a></li>
                <li><a href="#">Notifications</a></li>
            </ul>
            <div class="mobile-nav-buttons">
                <a href="#" class="btn btn-outline">Sign In</a>
                <a href="#" class="btn btn-primary">Join Now</a>
            </div>
        `;
        
        mobileMenu.innerHTML = mobileMenuContent;
        document.body.appendChild(mobileMenu);
        
        // Close menu event
        const closeMenu = mobileMenu.querySelector('.close-menu');
        closeMenu.addEventListener('click', function() {
            mobileMenu.classList.remove('active');
            body.style.overflow = 'auto'; // Re-enable scrolling
        });
    }
    
    // Testimonial Slider (simple version)
    const testimonialCards = document.querySelectorAll('.testimonial-card');
    let currentTestimonial = 0;
    
    // Only setup auto-scroll if there are multiple testimonials
    if (testimonialCards.length > 1) {
        // Auto-scroll testimonials every 5 seconds
        setInterval(() => {
            currentTestimonial = (currentTestimonial + 1) % testimonialCards.length;
            const scrollPosition = testimonialCards[currentTestimonial].offsetLeft;
            document.querySelector('.testimonials-slider').scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });
        }, 5000);
    }
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            
            if (targetId === '#') return; // Skip if it's just a placeholder link
            
            e.preventDefault();
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                const mobileMenu = document.querySelector('.mobile-menu');
                if (mobileMenu && mobileMenu.classList.contains('active')) {
                    mobileMenu.classList.remove('active');
                    body.style.overflow = 'auto';
                }
            }
        });
    });
    
    // Add animation on scroll
    const animateOnScroll = function() {
        const elements = document.querySelectorAll('.feature-card, .testimonial-card, .cta-content');
        
        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            if (elementPosition < windowHeight - 100) {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }
        });
    };
    
    // Set initial styles for animation
    document.querySelectorAll('.feature-card, .testimonial-card, .cta-content').forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    });
    
    // Run animation on load and scroll
    window.addEventListener('load', animateOnScroll);
    window.addEventListener('scroll', animateOnScroll);
});
