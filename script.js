const images = [
    'images/art/1.jpg',
    'images/art/2.jpg',
    'images/art/3.jpg',
    'images/art/4.jpg',
    'images/art/5.jpg'
    // 'images/art/6.jpg',
    // 'images/art/7.jpg',
    // 'images/art/8.jpg',
    // 'images/art/10.jpg',
    // 'images/art/11.jpg'
];

let current = 2;

function updateImages() {
    document.getElementById('main-image').src = images[current];
    document.getElementById('left-image').src = images[(current - 1 + images.length) % images.length];
    document.getElementById('right-image').src = images[(current + 1) % images.length];
}

function animateMainImage(direction) {
    const mainImage = document.getElementById('main-image');
    mainImage.classList.remove('animate-left', 'animate-right');
    void mainImage.offsetWidth;
    mainImage.classList.add(direction === 'left' ? 'animate-left' : 'animate-right');
}

function nextImage() {
    current = (current + 1) % images.length;
    animateMainImage('right');
    updateImages();
}

function prevImage() {
    current = (current - 1 + images.length) % images.length;
    animateMainImage('left');
    updateImages();
}

window.onload = updateImages;
document.getElementById('left-image').addEventListener('click', prevImage);
document.getElementById('right-image').addEventListener('click', nextImage);

// Клик по левой/правой части экрана
document.body.addEventListener('click', (e) => {
    if (e.target.closest('.navbar') || e.target.closest('.side')) return;

    const x = e.clientX;
    const width = window.innerWidth;

    if (x < width / 2) {
        prevImage();
    } else {
        nextImage();
    }
});

// Клавиатура ← →
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') prevImage();
    else if (e.key === 'ArrowRight') nextImage();
});

// Скролл (против спама)
let scrollCooldown = false;
document.addEventListener('wheel', (e) => {
    if (scrollCooldown) return;

    if (e.deltaY > 0) nextImage();
    else if (e.deltaY < 0) prevImage();

    scrollCooldown = true;
    setTimeout(() => scrollCooldown = false, 400);
});

const mainImage = document.getElementById('main-image');
const tooltip = document.getElementById('tooltip');

mainImage.addEventListener('mouseenter', () => {
    tooltip.textContent = mainImage.dataset.info;
    tooltip.style.opacity = 1;
});

mainImage.addEventListener('mouseleave', () => {
    tooltip.style.opacity = 0;
});