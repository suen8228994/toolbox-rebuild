// Socket.IO Connection
let socket;
let isConnected = false;

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Toolbox application initializing...');

    // Initialize Socket.IO
    initializeSocket();

    // Setup event listeners
    setupEventListeners();
});

// Socket.IO initialization
function initializeSocket() {
    const backendUrl = 'http://localhost:6791';
    console.log('Connecting to backend:', backendUrl);

    socket = io(backendUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10
    });

    // Export socket globally
    window.appSocket = socket;

    socket.on('connect', () => {
        console.log('Socket.IO Connected');
        isConnected = true;
        updateConnectionStatus('Connected', true);
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO Disconnected');
        isConnected = false;
        updateConnectionStatus('Disconnected', false);
    });

    socket.on('connect_error', (error) => {
        console.error('Socket.IO Connection error:', error);
        updateConnectionStatus('Connection error', false);
    });

    // Listen for task events
    socket.on('backend.task.runState', (state) => {
        console.log('Task state updated:', state);
        updateTaskStatus(state);
    });

    socket.on('run.task.log', (log) => {
        console.log('Task log:', log);
        addLogMessage(log);
    });
}

// Update connection status
function updateConnectionStatus(text, connected) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = connected ? '🔌 ' + text : '⚠️ ' + text;
        statusElement.style.color = connected ? 'var(--success-color)' : 'var(--error-color)';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // Tool cards
    const toolCards = document.querySelectorAll('.tool-card');
    toolCards.forEach(card => {
        card.addEventListener('click', () => {
            const toolName = card.getAttribute('data-tool');
            openToolModal(toolName);
        });
    });

    // Modal close
    const modalClose = document.querySelector('.modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    // Click outside modal to close
    const modal = document.getElementById('tool-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Log panel controls
    const btnClearLog = document.querySelector('.btn-clear-log');
    if (btnClearLog) {
        btnClearLog.addEventListener('click', clearLog);
    }

    const btnCloseLog = document.querySelector('.btn-close-log');
    if (btnCloseLog) {
        btnCloseLog.addEventListener('click', () => {
            document.getElementById('log-panel').classList.remove('active');
        });
    }
}

// Switch tabs
function switchTab(tabName) {
    // Update nav tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        }
    });

    // Update panels
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === tabName) {
            panel.classList.add('active');
        }
    });
}

// Open tool modal
function openToolModal(toolName) {
    const modal = document.getElementById('tool-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    // Get tool content
    const toolContent = getToolContent(toolName);

    title.textContent = toolContent.title;
    body.innerHTML = toolContent.html;

    modal.classList.add('active');
}

// Close modal
function closeModal() {
    const modal = document.getElementById('tool-modal');
    modal.classList.remove('active');
}

// Update task status
function updateTaskStatus(status) {
    const statusText = document.querySelector('.status-text');
    const statusIndicator = document.querySelector('.status-indicator');

    if (status === 'running') {
        statusText.textContent = 'Running';
        statusIndicator.style.background = 'var(--success-color)';
    } else if (status === 'stop') {
        statusText.textContent = 'Stopped';
        statusIndicator.style.background = 'var(--error-color)';
    } else {
        statusText.textContent = 'Ready';
        statusIndicator.style.background = 'var(--warning-color)';
    }
}

// Add log message
function addLogMessage(log) {
    const logContent = document.getElementById('log-content');
    const logPanel = document.getElementById('log-panel');

    // Show log panel
    logPanel.classList.add('active');

    const logItem = document.createElement('div');
    logItem.className = `log-item ${getLogType(log.logID)}`;

    const time = new Date().toLocaleTimeString();
    logItem.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="log-message">${log.message}</span>
    `;

    logContent.appendChild(logItem);

    // Auto scroll to bottom
    logContent.scrollTop = logContent.scrollHeight;
}

// Get log type from logID
function getLogType(logID) {
    if (logID.includes('Error')) return 'error';
    if (logID.includes('Success')) return 'success';
    if (logID.includes('Warn')) return 'warning';
    return 'info';
}

// Clear log
function clearLog() {
    const logContent = document.getElementById('log-content');
    logContent.innerHTML = '<div class="log-item info"><span class="log-time">[' +
        new Date().toLocaleTimeString() +
        ']</span><span class="log-message">Log cleared</span></div>';
}

// Initialize particles background
function initializeParticles() {
    if (typeof particlesJS !== 'undefined') {
        particlesJS('particles-js', {
            particles: {
                number: { value: 80, density: { enable: true, value_area: 800 } },
                color: { value: '#667eea' },
                shape: { type: 'circle' },
                opacity: { value: 0.5, random: false },
                size: { value: 3, random: true },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: '#667eea',
                    opacity: 0.4,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 2,
                    direction: 'none',
                    random: false,
                    straight: false,
                    out_mode: 'out',
                    bounce: false
                }
            },
            interactivity: {
                detect_on: 'canvas',
                events: {
                    onhover: { enable: true, mode: 'repulse' },
                    onclick: { enable: true, mode: 'push' },
                    resize: true
                },
                modes: {
                    repulse: { distance: 100, duration: 0.4 },
                    push: { particles_nb: 4 }
                }
            },
            retina_detect: true
        });
    }
}
