# Load petrol history from CSV and forecast next 7 days using Prophet
import pandas as pd
from fbprophet import Prophet
import matplotlib.pyplot as plt

# Load petrol history from CSV
df = pd.read_csv('backend/data/history.csv')

# Prepare data for Prophet
df['date'] = pd.to_datetime(df['date'])
df = df.rename(columns={'date': 'ds', 'price': 'y'})

# Create and fit Prophet model
model = Prophet()
model.fit(df)

# Make future dataframe for predictions
future = model.make_future_dataframe(periods=7)
forecast = model.predict(future)

# Plot forecast
plt.figure(figsize=(10, 5))
plt.plot(df['ds'], df['y'], label='Historical Data')
plt.plot(forecast['ds'], forecast['yhat'], label='Forecast')
plt.fill_between(forecast['ds'], forecast['yhat_lower'], forecast['yhat_upper'], color='gray', alpha=0.2)
plt.legend()
plt.title('Petrol Price Forecast')
plt.xlabel('Date')
plt.ylabel('Price')
plt.show()
# Save forecast to CSV
forecast.to_csv('backend/data/forecast.csv', index=False)
print("Forecast saved to backend/data/forecast.csv")
# Save model for future use
model_path = 'backend/data/prophet_model.pkl'
import joblib
joblib.dump(model, model_path)
print(f"Model saved to {model_path}")
# Load model for future use
# model = joblib.load(model_path)
# print("Model loaded from", model_path)
# Note: Uncomment the last two lines to load the model later if needed. 
# This code will forecast petrol prices for the next 7 days based on historical data and save the results to a CSV file.
