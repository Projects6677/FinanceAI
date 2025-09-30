// Global variable for the chart instance
let priceChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = window.location.origin;

    // --- DOM Elements ---
    const preloader = document.getElementById('preloader');
    const tickerInput = document.getElementById('tickerInput');
    const searchButton = document.getElementById('searchButton');
    const statusMessage = document.getElementById('statusMessage');
    const stockDataSection = document.getElementById('stockData');
    const chartSection = document.getElementById('chartSection');

    // Stock Detail Elements
    const currentTicker = document.getElementById('currentTicker');
    const priceDisplay = document.getElementById('priceDisplay');
    const changeDisplay = document.getElementById('changeDisplay');
    const marketCapDisplay = document.getElementById('marketCapDisplay');
    const trailingPE = document.getElementById('trailingPE');
    const fiftyTwoWeekHigh = document.getElementById('fiftyTwoWeekHigh');
    const fiftyTwoWeekLow = document.getElementById('fiftyTwoWeekLow');
    const volumeDisplay = document.getElementById('volumeDisplay');
    const exchangeDisplay = document.getElementById('exchangeDisplay');

    // Chatbot elements (same as before)
    const chatToggler = document.getElementById('chatToggler');
    const chatCloser = document.getElementById('chatCloser');
    const chatbotWindow = document.getElementById('chatbotWindow');
    const chatInput = chatbotWindow.querySelector('textarea');
    const sendButton = document.getElementById('send-btn');
    const chatbox = document.getElementById('chatbox');

    // --- UTILITY FUNCTIONS ---
    const formatNumber = (num, decimals = 2) => {
        if (num === null || num === undefined) return 'N/A';
        if (num > 1e12) return `${(num / 1e12).toFixed(2)}T`;
        if (num > 1e9) return `${(num / 1e9).toFixed(2)}B`;
        if (num > 1e6) return `${(num / 1e6).toFixed(2)}M`;
        return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };

    const clearResults = () => {
        currentTicker.textContent = '---';
        priceDisplay.textContent = '$---';
        changeDisplay.textContent = '---';
        marketCapDisplay.textContent = '---';
        trailingPE.textContent = '---';
        fiftyTwoWeekHigh.textContent = '---';
        fiftyTwoWeekLow.textContent = '---';
        volumeDisplay.textContent = '---';
        exchangeDisplay.textContent = '---';
        
        changeDisplay.classList.remove('positive', 'negative');
        statusMessage.textContent = '';
        stockDataSection.style.display = 'none';
        chartSection.style.display = 'none';
        if (priceChartInstance) {
            priceChartInstance.destroy();
            priceChartInstance = null;
        }
    };

    // --- MARKET HIGHLIGHTS FUNCTION ---
    const fetchMarketHighlights = async () => {
        const indices = ['SPY', 'DIA', 'QQQ'];
        for (const ticker of indices) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/stock/${ticker}`);
                const data = await response.json();

                if (data.error) throw new Error(data.error);

                const price = data.currentPrice;
                const changePercent = data.regularMarketChangePercent * 100;

                const card = document.getElementById(`market-${ticker}`);
                const priceElem = card.querySelector('.price-data');
                const changeElem = card.querySelector('.change-data');

                priceElem.textContent = `$${price.toFixed(2)}`;
                changeElem.textContent = `${changePercent.toFixed(2)}%`;

                changeElem.classList.remove('positive', 'negative');
                changeElem.classList.add(changePercent >= 0 ? 'positive' : 'negative');

            } catch (e) {
                console.warn(`Could not load market data for ${ticker}: ${e.message}`);
            }
        }
        // Hide preloader once initial market data is attempted
        setTimeout(() => {
            preloader.style.opacity = '0';
            setTimeout(() => preloader.style.display = 'none', 500);
        }, 500);
    };

    // --- STOCK FETCH FUNCTION ---
    const fetchStockData = async (ticker) => {
        clearResults();
        statusMessage.textContent = `Analyzing ${ticker.toUpperCase()}...`;
        
        const url = `${API_BASE_URL}/api/stock/${ticker}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                statusMessage.textContent = `ERROR: ${data.error}`;
                return;
            }

            const { 
                symbol, currentPrice, regularMarketChangePercent, marketCap, trailingPE: peRatio, 
                fiftyTwoWeekHigh: high52, fiftyTwoWeekLow: low52, volume, exchange, historicalData 
            } = data;
            
            // Format Data
            const changePercent = regularMarketChangePercent * 100;

            // Update DOM
            currentTicker.textContent = symbol;
            priceDisplay.textContent = `$${formatNumber(currentPrice, 2)}`;
            marketCapDisplay.textContent = formatNumber(marketCap);
            trailingPE.textContent = peRatio ? formatNumber(peRatio, 2) : 'N/A';
            fiftyTwoWeekHigh.textContent = formatNumber(high52, 2);
            fiftyTwoWeekLow.textContent = formatNumber(low52, 2);
            volumeDisplay.textContent = formatNumber(volume, 0);
            exchangeDisplay.textContent = exchange || 'N/A';

            changeDisplay.textContent = `${changePercent.toFixed(2)}%`;
            changeDisplay.classList.add(changePercent >= 0 ? 'positive' : 'negative');
            
            stockDataSection.style.display = 'block';
            statusMessage.textContent = `Analysis complete for ${symbol}.`;
            
            // Render Chart
            if (historicalData && historicalData.length > 0) {
                renderChart(symbol, historicalData);
            }

        } catch (error) {
            console.error("Fetch Error:", error);
            statusMessage.textContent = 'A critical error occurred while connecting to the backend.';
        }
    };

    // --- CHART FUNCTIONS ---
    const renderChart = (ticker, historicalData) => {
        if (priceChartInstance) {
            priceChartInstance.destroy();
        }

        const ctx = document.getElementById('priceChart').getContext('2d');
        const dates = historicalData.map(d => d.date);
        const prices = historicalData.map(d => d.close);
        
        const initialPrice = prices[0];
        const finalPrice = prices[prices.length - 1];
        const color = finalPrice >= initialPrice ? 'rgba(76, 175, 80, 1)' : 'rgba(244, 67, 54, 1)';

        priceChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: `${ticker} Closing Price`,
                    data: prices,
                    borderColor: color,
                    backgroundColor: finalPrice >= initialPrice ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                color: var('--text-light'),
                scales: {
                    x: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } },
                    y: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--border-color)' } }
                },
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, bodyColor: 'var(--bg-primary)' } }
            }
        });
        chartSection.style.display = 'block';
    };

    // --- CHATBOT FUNCTIONS (Simplified) ---

    const appendMessage = (message, type) => {
        const li = document.createElement('li');
        li.classList.add('chat', type);
        li.innerHTML = `<p>${message}</p>`;
        chatbox.appendChild(li);
        chatbox.scrollTop = chatbox.scrollHeight;
        return li.querySelector('p');
    };

    const handleChat = async () => {
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        chatInput.value = '';
        sendButton.disabled = true; 
        appendMessage(userMessage, 'outgoing');
        const incomingTextElement = appendMessage('...', 'incoming');
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage }),
            });

            if (!response.ok) throw new Error('API failed to generate response.');

            const data = await response.json();
            
            incomingTextElement.textContent = data.error ? `Error: ${data.error}` : data.response;

        } catch (error) {
            console.error("Chat API Error:", error);
            incomingTextElement.textContent = "AI disconnected. Check GROQ_API_KEY.";
        } finally {
            sendButton.disabled = false;
            chatbox.scrollTop = chatbox.scrollHeight;
        }
    };


    // --- EVENT LISTENERS & INITIALIZATION ---
    searchButton.addEventListener('click', () => {
        const ticker = tickerInput.value.trim().toUpperCase();
        if (ticker) {
            fetchStockData(ticker);
        } else {
            statusMessage.textContent = 'Please enter a stock ticker.';
        }
    });

    tickerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchButton.click();
        }
    });

    // Chatbot toggles
    chatToggler.addEventListener('click', () => { chatbotWindow.classList.toggle('show-chat'); });
    chatCloser.addEventListener('click', () => { chatbotWindow.classList.remove('show-chat'); });
    
    // Chat Send
    sendButton.addEventListener('click', handleChat);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleChat();
        }
    });

    // Initial load sequence
    clearResults();
    fetchMarketHighlights();
});
