document.addEventListener('DOMContentLoaded', () => {
    let images = [];
    let current = 0;

    fetch('../data/images.json')
        .then(response => response.json())
        .then(data => {
            images = data;
            updateImages();
        });

    function updateImages() {
        const main = images[current];
        const left = images[(current - 1 + images.length) % images.length];
        const right = images[(current + 1) % images.length];

        const mainImg = document.getElementById('main-image');
        const leftImg = document.getElementById('left-image');
        const rightImg = document.getElementById('right-image');

        if (mainImg && leftImg && rightImg) {
            mainImg.src = main.src;
            mainImg.dataset.info = main.info;
            mainImg.dataset.category = main.category || '';
            mainImg.dataset.location = main.location || '';
            mainImg.dataset.year = main.year || '';

            leftImg.src = left.src;
            rightImg.src = right.src;
        }
    }

    function animateMainImage(direction) {
        const mainImage = document.getElementById('main-image');
        if (!mainImage) return;
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

    document.getElementById('left-image')?.addEventListener('click', prevImage);
    document.getElementById('right-image')?.addEventListener('click', nextImage);

    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.navbar') || e.target.closest('.side')) return;

        const x = e.clientX;
        const width = window.innerWidth;

        if (x < width * 0.25) {
            prevImage();
        } else if (x > width * 0.75) {
            nextImage();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') prevImage();
        else if (e.key === 'ArrowRight') nextImage();
    });

    let scrollCooldown = false;
    document.addEventListener('wheel', (e) => {
        if (scrollCooldown) return;

        if (e.deltaY < 0) nextImage();
        else if (e.deltaY > 0) prevImage();

        scrollCooldown = true;
        setTimeout(() => scrollCooldown = false, 400);
    });

    const mainImage = document.getElementById('main-image');
    const tooltip = document.getElementById('tooltip');

    // if (mainImage && tooltip) {
    //     mainImage.addEventListener('mouseenter', () => {
    //         tooltip.textContent = mainImage.dataset.info;
    //         tooltip.style.opacity = 1;
    //     });
    //
    //     mainImage.addEventListener('mouseleave', () => {
    //         tooltip.style.opacity = 0;
    //     });
    // }
    if (mainImage && tooltip) {
        mainImage.addEventListener('mouseenter', () => {
            const info = mainImage.dataset.info || '';
            const category = mainImage.dataset.category || '';
            const location = mainImage.dataset.location || '';
            const year = mainImage.dataset.year || '';

            tooltip.innerHTML = `
            <strong>${info}</strong><br>
            <span>${year}</span>
            <span> &mdash; ${location}</span><br>
            <span>${category}</span><br>
        `;

            tooltip.style.opacity = '1';
        });

        mainImage.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
        });
    }
});