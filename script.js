const images = [
    'images/1.png',
    'images/2.png',
    'images/3.png',
    'images/4.jpg',
    'images/5.jpg',
    'images/6.png',
    'images/7.jpg',
    'images/8.png',
    // 'images/9.pxd',
    'images/10.svg',
    'images/11.png'
];

let current = 2; // индекс текущего изображения

function updateImages() {
    document.getElementById('main-image').src = images[current];
    document.getElementById('left-image').src = images[(current - 1 + images.length) % images.length];
    document.getElementById('right-image').src = images[(current + 1) % images.length];
}

function nextImage() {
    current = (current + 1) % images.length;
    updateImages();
}

function prevImage() {
    current = (current - 1 + images.length) % images.length;
    updateImages();
}

window.onload = updateImages;