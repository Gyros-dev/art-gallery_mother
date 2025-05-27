fetch('exhibitions.json')
    .then(response => response.json())
    .then(data => {
        const container = document.getElementById('exhibitions-list');
        data.forEach(ex => {
            const div = document.createElement('div');
            div.className = 'exhibition-card';
            div.innerHTML = `
                <h2>${ex.title}</h2>
                <p><strong>Когда:</strong> ${ex.date}</p>
                <p><strong>Где:</strong> ${ex.location}</p>
                <p>${ex.description}</p>
            `;
            container.appendChild(div);
        });
    });