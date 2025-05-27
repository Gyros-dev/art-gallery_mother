let images = [];
let current = 0;

fetch('images.json')
    .then(response => response.json())
    .then(data => {
        images = data;
        updateImages();
    });

function updateImages() {
    const main = images[current];
    const left = images[(current - 1 + images.length) % images.length];
    const right = images[(current + 1) % images.length];

    document.getElementById('main-image').src = main.src;
    document.getElementById('main-image').dataset.info = main.info;

    document.getElementById('left-image').src = left.src;
    document.getElementById('right-image').src = right.src;
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

    if (x < width * 0.25) {
        prevImage();
    } else if (x > width * 0.75) {
        nextImage();
    }
    // Если клик по центру — ничего не делаем
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

