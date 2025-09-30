// Global variable for the chart instance
let priceChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = window.location.origin; // Assumes single service deployment

    const tickerInput = document.getElementById('tickerInput');
    const searchButton = document.getElementById('searchButton');
    const symbolDisplay = document.getElementById('symbolDisplay');
    const priceDisplay = document.getElementById('priceDisplay');
    const changeDisplay = document.getElementById('changeDisplay');
    const marketCapDisplay = document.getElementById('marketCapDisplay');
    const trailingPE = document.getElementById('trailingPE');
    const statusMessage = document.getElementById('statusMessage');
    const stockDataSection = document.getElementById('stockData');
    const chartSection = document.getElementById('chartSection');

    // Chatbot elements
    const chatToggler = document.getElementById('chatToggler');
    const chatCloser = document.getElementById('chatCloser');
    const chatbotWindow = document.getElementById('chatbotWindow');
    const chatInput = chatbotWindow.querySelector('textarea');
    const sendButton = document.getElementById('send-btn');
    const chatbox = document.getElementById('chatbox');

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
        const color = finalPrice >= initialPrice ? 'rgba(40, 167, 69, 1)' : 'rgba(220, 53, 69, 1)';

        priceChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: `${ticker} Closing Price`,
                    data: prices,
                    borderColor: color,
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { title: { display: true, text: 'Date' }, ticks: { autoSkip: true, maxTicksLimit: 10 } },
                    y: { title: { display: true, text: 'Price ($)' } }
                },
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }
            }
        });
        chartSection.style.display = 'block';
    };

    const clearResults = () => {
        symbolDisplay.textContent = 'Ticker: -';
        priceDisplay.textContent = 'Current Price: -';
        changeDisplay.textContent = 'Daily Change: -';
        marketCapDisplay.textContent = 'Market Cap: -';
        trailingPE.textContent = 'P/E Ratio: -';
        changeDisplay.classList.remove('positive-change', 'negative-change');
        statusMessage.textContent = '';
        stockDataSection.style.display = 'none';
        chartSection.style.display = 'none';
        if (priceChartInstance) {
            priceChartInstance.destroy();
            priceChartInstance = null;
        }
    };
    
    // --- STOCK FETCH FUNCTION ---
    const fetchStockData = async (ticker) => {
        clearResults();
        statusMessage.textContent = `Fetching data for ${ticker.toUpperCase()}...`;
        
        const url = `${API_BASE_URL}/api/stock/${ticker}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.error) {
                statusMessage.textContent = `Error: ${data.error}`;
                stockDataSection.style.display = 'none';
                return;
            }

            const { symbol, currentPrice, regularMarketChangePercent, marketCap, trailingPE: peRatio, historicalData } = data;

            if (!symbol || !currentPrice) {
                 statusMessage.textContent = `Error: Could not retrieve valid data for ${ticker.toUpperCase()}.`;
                 stockDataSection.style.display = 'none';
                 return;
            }
            
            // Format data
            const formattedChangePercent = (regularMarketChangePercent * 100).toFixed(2);
            const formattedMarketCap = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(marketCap);

            // Update the DOM
            symbolDisplay.textContent = `Ticker: ${symbol}`;
            priceDisplay.textContent = `Current Price: $${currentPrice.toFixed(2)}`;
            marketCapDisplay.textContent = `Market Cap: ${formattedMarketCap}`;
            trailingPE.textContent = `P/E Ratio: ${peRatio ? peRatio.toFixed(2) : 'N/A'}`;
            changeDisplay.textContent = `Daily Change: ${formattedChangePercent}%`;

            if (regularMarketChangePercent > 0) {
                changeDisplay.classList.add('positive-change');
            } else if (regularMarketChangePercent < 0) {
                changeDisplay.classList.add('negative-change');
            }

            stockDataSection.style.display = 'block';
            statusMessage.textContent = 'Data successfully loaded!';
            
            if (historicalData && historicalData.length > 0) {
                renderChart(symbol, historicalData);
            } else {
                statusMessage.textContent += ' (Note: No historical data available for charting.)';
            }

        } catch (error) {
            console.error("Fetch Error:", error);
            statusMessage.textContent = 'An error occurred while connecting to the API.';
            stockDataSection.style.display = 'none';
            chartSection.style.display = 'none';
        }
    };

    // --- CHATBOT FUNCTIONS ---

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

        // 1. Display user message
        chatInput.value = '';
        sendButton.disabled = true; 
        appendMessage(userMessage, 'outgoing');
        
        // 2. Display placeholder for incoming response
        const incomingTextElement = appendMessage('...', 'incoming');
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: userMessage }),
            });

            if (!response.ok) {
                throw new Error('API failed to generate response.');
            }

            const data = await response.json();
            
            if (data.error) {
                incomingTextElement.textContent = `Error: ${data.error}`;
            } else {
                // Display the final, complete response text
                incomingTextElement.textContent = data.response;
            }

        } catch (error) {
            console.error("Chat API Error:", error);
            incomingTextElement.textContent = "Sorry, I couldn't connect to the chat service.";
        } finally {
            sendButton.disabled = false;
            chatbox.scrollTop = chatbox.scrollHeight;
        }
    };


    // --- EVENT LISTENERS ---
    searchButton.addEventListener('click', () => {
        const ticker = tickerInput.value.trim().toUpperCase();
        if (ticker) {
            fetchStockData(ticker);
        } else {
            statusMessage.textContent = 'Please enter a stock ticker.';
        }
    });

    // Chatbot Toggle
    chatToggler.addEventListener('click', () => {
        chatbotWindow.classList.toggle('show-chat');
    });

    chatCloser.addEventListener('click', () => {
        chatbotWindow.classList.remove('show-chat');
    });
    
    // Chat Send button
    sendButton.addEventListener('click', handleChat);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleChat();
        }
    });

    clearResults();
});
