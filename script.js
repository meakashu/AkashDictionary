document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const resultsContainer = document.getElementById('resultsContainer');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const historyContainer = document.getElementById('historyContainer');
    const historyList = document.getElementById('historyList');
    const clearHistoryButton = document.getElementById('clearHistoryButton');
    const currentYearSpan = document.getElementById('currentYear'); // Get the year span
    const particleCanvas = document.getElementById('particleCanvas'); // Get canvas element

    let searchHistory = JSON.parse(localStorage.getItem('dictionaryHistory')) || [];
    let currentWord = null; // Keep track of the currently displayed word

    // --- Event Listeners ---
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });
    darkModeToggle.addEventListener('click', toggleDarkMode);
    clearHistoryButton.addEventListener('click', clearHistory);
    historyList.addEventListener('click', handleHistoryClick);

    // --- Initialization ---
    initializeDarkMode();
    displayHistory();
    setCurrentYear(); // Call the function to set the year
    initializeParticleAnimation(); // Initialize the background animation

    // --- Functions ---
    function handleSearch() {
        const word = searchInput.value.trim();
        if (!word) return; // Don't search if input is empty

        fetchWordData(word);
        // Keep input value for history highlighting
        // searchInput.value = ''; // Clear input after search
        searchInput.focus();
    }

    async function fetchWordData(word) {
        showLoading(true);
        clearResultsAndError();
        currentWord = word; // Set current word

        try {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Sorry, the word "${word}" was not found. 🤷‍♀️`);
                } else {
                    throw new Error(`An error occurred: ${response.statusText} (Status: ${response.status})`);
                }
            }
            const data = await response.json();
            displayResults(data); // Pass only data
            addToHistory(word); // Add to history after successful fetch and display
        } catch (error) {
            currentWord = null; // Reset current word on error
            displayError(error.message);
            displayHistory(); // Update history display even on error (to remove potential highlight)
        } finally {
            showLoading(false);
        }
    }

    function displayResults(data) {
        resultsContainer.innerHTML = ''; // Clear previous results

        data.forEach((entry, index) => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.style.animationDelay = `${index * 0.1}s`; // Stagger animation

            const word = entry.word;
            const phonetic = entry.phonetics.find(p => p.text)?.text || 'N/A';
            const audioUrl = entry.phonetics.find(p => p.audio)?.audio;
            const sourceUrl = entry.sourceUrls?.[0]; // Get the first source URL if available

            let cardHeaderHTML = `
                <div class="word-header">
                    <div class="word-info">
                        <h2>${word}</h2>
                        <span class="phonetic">${phonetic}</span>
                        ${sourceUrl ? `<a href="${sourceUrl}" class="source-link" target="_blank" rel="noopener noreferrer">Source <i class="fas fa-external-link-alt"></i></a>` : ''}
                    </div>
                    ${audioUrl ? `<button class="audio-button" data-audio="${audioUrl}" aria-label="Play pronunciation"><i class="fas fa-volume-up"></i></button>` : ''}
                </div>
            `;

            let meaningsHTML = '';
            entry.meanings.forEach((meaning, meaningIndex) => {
                const partOfSpeech = meaning.partOfSpeech;
                const definitionsText = meaning.definitions.map((def, i) =>
                    `${i + 1}. ${def.definition}${def.example ? ` (e.g., ${def.example})` : ''}`
                ).join('\n'); // Use \n for newline in clipboard text
                const synonymsText = meaning.synonyms && meaning.synonyms.length > 0
                    ? `Synonyms: ${meaning.synonyms.join(', ')}`
                    : '';
                const copyText = `${word} (${partOfSpeech}):\n${definitionsText}${synonymsText ? '\n' + synonymsText : ''}`;

                meaningsHTML += `
                    <div class="meaning">
                        <div class="meaning-header">
                             <p class="part-of-speech">${partOfSpeech}</p>
                             <button class="copy-button" data-copy-text="${encodeURIComponent(copyText)}" aria-label="Copy meaning"><i class="far fa-copy"></i></button>
                        </div>
                        ${meaning.definitions.map((def, i) => `
                            <div class="definition">
                                <p>${i + 1}. ${def.definition}</p>
                                ${def.example ? `<p class="example"><em>e.g., ${def.example}</em></p>` : ''}
                            </div>
                        `).join('')}
                        ${meaning.synonyms && meaning.synonyms.length > 0 ? `
                            <div class="synonyms">
                                <strong>Synonyms:</strong>
                                ${meaning.synonyms.map(syn => `<span>${syn}</span>`).join(' ')}
                            </div>
                        ` : ''}
                    </div>
                `;
            });

            card.innerHTML = cardHeaderHTML + meaningsHTML;
            resultsContainer.appendChild(card);
        });

        // Add event listeners to new buttons
        document.querySelectorAll('.audio-button').forEach(button => {
            button.addEventListener('click', () => playAudio(button));
        });
        document.querySelectorAll('.copy-button').forEach(button => {
            button.addEventListener('click', () => copyMeaningToClipboard(button));
        });
    }

    function copyMeaningToClipboard(button) {
        const encodedText = button.dataset.copyText;
        if (!encodedText) return;

        const textToCopy = decodeURIComponent(encodedText).replace(/\n/g, '\n'); // Decode and keep newlines
        const icon = button.querySelector('i');

        navigator.clipboard.writeText(textToCopy).then(() => {
            // Indicate success (optional)
            icon.classList.remove('far', 'fa-copy');
            icon.classList.add('fas', 'fa-check');
            button.disabled = true;
            setTimeout(() => {
                icon.classList.remove('fas', 'fa-check');
                icon.classList.add('far', 'fa-copy');
                button.disabled = false;
            }, 1500); // Reset after 1.5 seconds
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            // Maybe show a small error message near the button
            displayError("Could not copy text."); // Use existing error display for simplicity
        });
    }

    function playAudio(button) {
        const audioUrl = button.dataset.audio;
        if (!audioUrl) return;

        const audio = new Audio(audioUrl);
        const icon = button.querySelector('i');

        button.disabled = true; // Prevent spam clicking
        icon.classList.remove('fa-volume-up');
        icon.classList.add('fa-spinner', 'fa-spin'); // Loading state

        audio.play()
            .then(() => {
                // console.log('Audio played');
            })
            .catch(err => {
                console.error("Error playing audio:", err);
                displayError("Couldn't play audio.");
            })
            .finally(() => {
                button.disabled = false;
                icon.classList.remove('fa-spinner', 'fa-spin');
                icon.classList.add('fa-volume-up');
            });
    }

    function displayError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    function clearResultsAndError() {
        resultsContainer.innerHTML = '';
        errorMessage.classList.add('hidden');
        errorMessage.textContent = '';
    }

    function showLoading(isLoading) {
        if (isLoading) {
            loadingIndicator.classList.remove('hidden');
        } else {
            loadingIndicator.classList.add('hidden');
        }
    }

    // --- Dark Mode --- //
    function initializeDarkMode() {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const savedMode = localStorage.getItem('darkMode');

        if (savedMode === 'enabled' || (!savedMode && prefersDark)) {
            enableDarkMode();
        } else {
            disableDarkMode();
        }
    }

    function toggleDarkMode() {
        if (document.body.classList.contains('dark-mode')) {
            disableDarkMode();
            localStorage.setItem('darkMode', 'disabled');
        } else {
            enableDarkMode();
            localStorage.setItem('darkMode', 'enabled');
        }
    }

    function enableDarkMode() {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        // Icon changes are handled by CSS
    }

    function disableDarkMode() {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        // Icon changes are handled by CSS
    }

    // --- Search History --- //
    function addToHistory(word) {
        if (!word) return;
        const lowerCaseWord = word.toLowerCase();
        // Remove if already exists to add it to the top
        searchHistory = searchHistory.filter(item => item.toLowerCase() !== lowerCaseWord);
        // Add to the beginning
        searchHistory.unshift(word);
        // Limit history size (e.g., to 10)
        if (searchHistory.length > 10) {
            searchHistory.pop();
        }
        localStorage.setItem('dictionaryHistory', JSON.stringify(searchHistory));
        displayHistory(); // Update history display
    }

    function displayHistory() {
        historyList.innerHTML = '';
        if (searchHistory.length === 0) {
            historyContainer.classList.remove('hidden');
            historyList.innerHTML = '<li class="empty-history">No recent searches... yet! 👻</li>';
            clearHistoryButton.classList.add('hidden');
            return;
        }

        historyContainer.classList.remove('hidden');
        clearHistoryButton.classList.remove('hidden');
        searchHistory.forEach(word => {
            const li = document.createElement('li');
            li.textContent = word;
            li.dataset.word = word; // Store word for easy access on click
            // Highlight if it's the current word
            if (currentWord && word.toLowerCase() === currentWord.toLowerCase()) {
                li.classList.add('active-history');
            }
            historyList.appendChild(li);
        });
    }

    function clearHistory() {
        searchHistory = [];
        currentWord = null; // Reset current word if history is cleared
        localStorage.removeItem('dictionaryHistory');
        displayHistory();
    }

    function handleHistoryClick(event) {
        if (event.target.tagName === 'LI') {
            const word = event.target.dataset.word;
            if (word) {
                searchInput.value = word; // Fill input with clicked word
                fetchWordData(word);
            }
        }
    }

    // New function to set the current year
    function setCurrentYear() {
        if (currentYearSpan) {
            currentYearSpan.textContent = new Date().getFullYear();
        }
    }

    // --- Particle Background Animation --- //
    let canvasCtx;
    let particlesArray = [];
    let animationFrameId;

    function initializeParticleAnimation() {
        if (!particleCanvas) return;
        canvasCtx = particleCanvas.getContext('2d');
        resizeCanvas();

        window.addEventListener('resize', () => {
            resizeCanvas();
            initParticles(); // Re-initialize particles on resize
        });

        initParticles();
        animateParticles();
    }

    function resizeCanvas() {
        particleCanvas.width = window.innerWidth;
        particleCanvas.height = window.innerHeight;
    }

    class Particle {
        constructor(x, y, radius, color, vx, vy) {
            this.x = x;
            this.y = y;
            this.radius = radius;
            this.color = color;
            this.vx = vx;
            this.vy = vy;
            this.mass = this.radius * 0.5; // Mass proportional to radius for collision
        }

        draw() {
            canvasCtx.beginPath();
            canvasCtx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
            canvasCtx.fillStyle = this.color;
            canvasCtx.fill();
            canvasCtx.closePath();
        }

        update(particles) {
            // Wall collision
            if (this.x + this.radius > particleCanvas.width || this.x - this.radius < 0) {
                this.vx = -this.vx;
            }
            if (this.y + this.radius > particleCanvas.height || this.y - this.radius < 0) {
                this.vy = -this.vy;
            }

            // Particle collision
            for (let i = 0; i < particles.length; i++) {
                if (this === particles[i]) continue;
                const dx = particles[i].x - this.x;
                const dy = particles[i].y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = this.radius + particles[i].radius;

                if (distance < minDistance) {
                    resolveCollision(this, particles[i]);
                }
            }

            this.x += this.vx;
            this.y += this.vy;
            this.draw();
        }
    }

    function initParticles() {
        particlesArray = [];
        const numberOfParticles = Math.floor((particleCanvas.width * particleCanvas.height) / 15000); // Adjust density
        const isDarkMode = document.body.classList.contains('dark-mode');
        const baseColor = isDarkMode ? 'rgba(37, 117, 252, ': 'rgba(90, 15, 200, '; // Secondary or Primary
        const colorOpacity = isDarkMode ? 0.4 : 0.3;

        for (let i = 0; i < numberOfParticles; i++) {
            const radius = Math.random() * 8 + 4; // Radius between 4 and 12
            const x = Math.random() * (particleCanvas.width - radius * 2) + radius;
            const y = Math.random() * (particleCanvas.height - radius * 2) + radius;
            const vx = (Math.random() - 0.5) * 0.8; // Slower velocity
            const vy = (Math.random() - 0.5) * 0.8;
            const color = `${baseColor}${colorOpacity})`;

            // Ensure particles don't overlap initially (simple check)
            let overlapping = false;
            for (let j = 0; j < particlesArray.length; j++) {
                const dx = particlesArray[j].x - x;
                const dy = particlesArray[j].y - y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                 if (distance < radius + particlesArray[j].radius) {
                     overlapping = true;
                     break;
                 }
            }

            if (!overlapping) {
                 particlesArray.push(new Particle(x, y, radius, color, vx, vy));
            }
        }
    }

    function animateParticles() {
        animationFrameId = requestAnimationFrame(animateParticles);
        canvasCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        particlesArray.forEach(particle => {
            particle.update(particlesArray);
        });
    }

    // Simple elastic collision resolution
    // From https://gist.github.com/christopher4lis/f9ccb589ee8ecf751481f05a8e59b1dc
    function rotate(velocity, angle) {
        return {
            x: velocity.x * Math.cos(angle) - velocity.y * Math.sin(angle),
            y: velocity.x * Math.sin(angle) + velocity.y * Math.cos(angle)
        };
    }

    function resolveCollision(particle, otherParticle) {
        const xVelocityDiff = particle.vx - otherParticle.vx;
        const yVelocityDiff = particle.vy - otherParticle.vy;
        const xDist = otherParticle.x - particle.x;
        const yDist = otherParticle.y - particle.y;

        // Prevent accidental overlap of particles
        if (xVelocityDiff * xDist + yVelocityDiff * yDist >= 0) {
            const angle = -Math.atan2(otherParticle.y - particle.y, otherParticle.x - particle.x);
            const m1 = particle.mass;
            const m2 = otherParticle.mass;

            const u1 = rotate({ x: particle.vx, y: particle.vy }, angle);
            const u2 = rotate({ x: otherParticle.vx, y: otherParticle.vy }, angle);

            const v1 = { x: u1.x * (m1 - m2) / (m1 + m2) + u2.x * 2 * m2 / (m1 + m2), y: u1.y };
            const v2 = { x: u2.x * (m2 - m1) / (m1 + m2) + u1.x * 2 * m1 / (m1 + m2), y: u2.y };

            const finalV1 = rotate(v1, -angle);
            const finalV2 = rotate(v2, -angle);

            particle.vx = finalV1.x;
            particle.vy = finalV1.y;
            otherParticle.vx = finalV2.x;
            otherParticle.vy = finalV2.y;
        }
        // Separate overlapping particles slightly to avoid sticking
        const distance = Math.sqrt(xDist*xDist + yDist*yDist);
        const minDistance = particle.radius + otherParticle.radius;
        if(distance < minDistance) {
             const overlap = 0.5 * (minDistance - distance);
             particle.x -= overlap * (xDist / distance);
             particle.y -= overlap * (yDist / distance);
             otherParticle.x += overlap * (xDist / distance);
             otherParticle.y += overlap * (yDist / distance);
        }
    }

     // Re-initialize particles when dark mode changes
    const originalToggleDarkMode = toggleDarkMode;
    toggleDarkMode = function() {
        originalToggleDarkMode();
        initParticles();
    }
    // Also re-init on initial load after mode check
    const originalInitDarkMode = initializeDarkMode;
    initializeDarkMode = function() {
        originalInitDarkMode();
        // Need to wait a tick for body class to update reliably?
        setTimeout(initParticles, 0);
    }
}); 