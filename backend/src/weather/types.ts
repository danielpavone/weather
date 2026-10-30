export interface WeatherLocation {
  name: string | null;
  country: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
}

export interface WeatherCurrent {
  time: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  description: string;
  isDay: boolean;
}

export interface WeatherUnits {
  temperature: string;
  apparentTemperature: string;
  humidity: string;
  windSpeed: string;
}

export interface WeatherReport {
  location: WeatherLocation;
  current: WeatherCurrent;
  units: WeatherUnits;
}

export interface WeatherQuery {
  city: string;
  latitude: string;
  longitude: string;
}
