from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import yfinance as yf
import os
from datetime import datetime, timedelta
from groq import Groq

app = Flask(__name__, static_folder='.')
CORS(app) 

# --- INITIALIZE GROQ CLIENT ---
# Groq key must be set as an environment variable in Render: GROQ_API_KEY
GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
groq_client = None
if GROQ_API_KEY:
    try:
        groq_client = Groq(api_key=GROQ_API_KEY)
        print("Groq Client Initialized.")
    except Exception as e:
        print(f"Error initializing Groq client: {e}")
else:
    print("Warning: GROQ_API_KEY environment variable not set. Chatbot will not function.")


# --- STOCK DATA ENDPOINT ---
@app.route('/api/stock/<ticker>', methods=['GET'])
def get_stock_data(ticker):
    """Fetches real-time and historical stock data using YFinance."""
    
    stock = yf.Ticker(ticker.upper())
    
    try:
        info = stock.info
        
        # Get historical data (last 30 days)
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        
        hist_data = stock.history(start=start_date, end=end_date)
        
        historical_list = []
        if not hist_data.empty:
            historical_list = [
                {'date': index.strftime('%Y-%m-%d'), 'close': row['Close']}
                for index, row in hist_data.iterrows()
            ]

        if info.get('currentPrice') is None:
            return jsonify({"error": f"Could not find real-time price for ticker: {ticker.upper()}."}), 404

        current_price = info.get('currentPrice', 0)
        previous_close = info.get('previousClose', current_price)
        change_percent = (current_price - previous_close) / previous_close if previous_close else 0
        
        data = {
            "symbol": info.get('symbol', ticker.upper()),
            "currentPrice": current_price,
            "marketCap": info.get('marketCap'),
            "trailingPE": info.get('trailingPE'),
            "regularMarketChangePercent": change_percent,
            "historicalData": historical_list
        }
        
        return jsonify(data)

    except Exception as e:
        print(f"Error fetching data for {ticker}: {e}")
        return jsonify({"error": f"Internal error when fetching data for {ticker.upper()}."}), 500


# --- GROQ CHATBOT ENDPOINT ---
@app.route('/api/chat/', methods=['POST'])
def chat_with_groq():
    """Proxies chat requests to the Groq API."""
    if not groq_client:
        return jsonify({"error": "Chat service is not available. (API key missing)"}), 503
    
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        
        if not user_message:
            return jsonify({"error": "No message provided."}), 400

        system_prompt = "You are a concise, helpful, and fast AI assistant focused on providing quick answers related to the stock market, finance, and general information. Keep your responses brief and factual."

        completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="mixtral-8x7b-32768",
            temperature=0.7,
            max_tokens=256
        )
        
        ai_response = completion.choices[0].message.content
        return jsonify({"response": ai_response})

    except Exception as e:
        print(f"Groq API call error: {e}")
        return jsonify({"error": "An error occurred during the Groq API call."}), 500


# --- SERVING FRONTEND FILES ---
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(app.static_folder, filename)

# --- RUN THE APP ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
